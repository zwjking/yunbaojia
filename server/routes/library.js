/**
 * 工艺价格库 + 户型模板
 */
const { db, uid, now } = require('../lib/db');
const A = require('../lib/auth');
const { ok, fail } = require('../lib/http');
const { seedLibraryForOrg, resetOrgLibrary } = require('../lib/seed');
const { GROUPS } = require('../lib/seed/library');

async function orgLibrary(user) {
  return await db.library.find((it) => it.org_id === user.org_id);
}

module.exports = function register(api) {

  /* ================= 工艺价格库 ================= */

  api.get('/price-library', async (req, res) => {
    const user = await A.requireAuth(req, res);
    if (!user) return;
    const q = req.query || {};
    let list = await orgLibrary(user);
    if (!list.length) { await seedLibraryForOrg(user.org_id); list = await orgLibrary(user); }
    if (q.keyword) {
      const kw = String(q.keyword).toLowerCase();
      list = list.filter((x) => x.name.toLowerCase().includes(kw) || (x.tags || []).some((t) => t.includes(kw)));
    }
    if (q.group && q.group !== 'all') list = list.filter((x) => x.group_key === q.group || x.group_name === q.group);

    const groups = GROUPS.map((g) => ({
      ...g,
      count: list.filter((x) => x.group_key === g.key).length,
    }));
    ok(res, { items: list, groups, total: list.length });
  });

  api.get('/price-library/presets', async (req, res) => {
    const user = await A.requireAuth(req, res);
    if (!user) return;
    ok(res, [
      { code: 'default', name: '系统标准库', desc: '内置 180 条常用工艺，覆盖八大分类' },
      { code: 'economy', name: '经济型价格', desc: '整体下浮 12%，适合简装/出租房报价' },
      { code: 'quality', name: '品质型价格', desc: '整体上浮 15%，适合中高端客户' },
      { code: 'premium', name: '高端价格', desc: '整体上浮 35%，含品牌主材工艺' },
    ]);
  });

  api.post('/price-library/apply-preset', async (req, res, body) => {
    const user = await A.requireAuth(req, res);
    if (!user) return;
    const factor = { default: 1, economy: 0.88, quality: 1.15, premium: 1.35 }[body.code] || 1;
    const list = await orgLibrary(user);
    const base = await db.library.find((it) => !it.org_id);
    for (const it of list) {
      const sys = base.find((x) => x.name === it.name);
      const p = sys ? sys.price : it.price / factor;
      await db.library.update(it.id, {
        price: Math.round(p * factor * 100) / 100,
        cost: Math.round((sys ? sys.cost : it.cost / factor) * factor * 100) / 100,
      });
    }
    await db.library.flush();
    ok(res, { applied: body.code, count: list.length, message: `已应用预设，共更新 ${list.length} 条工艺价格。` });
  });

  api.post('/price-library/reset', async (req, res) => {
    const user = await A.requireAuth(req, res);
    if (!user) return;
    const n = await resetOrgLibrary(user.org_id);
    ok(res, { ok: true, count: n, message: `已重置为系统标准库，共 ${n} 条。` });
  });

  api.post('/price-library/import', async (req, res, body) => {
    const user = await A.requireAuth(req, res);
    if (!user) return;
    const rows = Array.isArray(body.items) ? body.items : [];
    if (!rows.length) return fail(res, '没有可导入的数据。');
    let added = 0, updated = 0;
    for (const r of rows) {
      if (!r.name) continue;
      const exist = await db.library.findOne((x) => x.org_id === user.org_id && x.name === r.name);
      const data = {
        group_key: r.group_key || 'misc',
        group_name: r.group_name || '未分类',
        name: r.name,
        unit: r.unit || '项',
        price: Number(r.price) || 0,
        cost: Number(r.cost) || 0,
        craft: r.craft || '',
        tags: r.tags || [],
      };
      if (exist) { await db.library.update(exist.id, data); updated += 1; }
      else { await db.library.insert({ id: uid(), org_id: user.org_id, source: "import", created_at: now(), ...data }); added += 1; }
    }
    await db.library.flush();
    ok(res, { added, updated, message: `导入完成：新增 ${added} 条，更新 ${updated} 条。` });
  });

  api.get('/price-library/:id', async (req, res, body, params) => {
    const user = await A.requireAuth(req, res);
    if (!user) return;
    const it = await db.library.findOne({ id: params.id });
    if (!it) return fail(res, '工艺不存在。', 404);
    ok(res, it);
  });

  api.post('/price-library', async (req, res, body) => {
    const user = await A.requireAuth(req, res);
    if (!user) return;
    if (!body.name) return fail(res, '请填写工艺名称。');
    const item = await db.library.insert({
      id: uid(), org_id: user.org_id, source: 'custom', created_at: now(),
      group_key: body.group_key || 'misc',
      group_name: body.group_name || GROUPS.find((g) => g.key === body.group_key)?.name || '未分类',
      name: body.name, unit: body.unit || '项',
      price: Number(body.price) || 0, cost: Number(body.cost) || 0,
      craft: body.craft || '', tags: body.tags || [],
    });
    ok(res, item, 201);
  });

  api.put('/price-library/:id', async (req, res, body, params) => {
    const user = await A.requireAuth(req, res);
    if (!user) return;
    const it = await db.library.findOne({ id: params.id });
    if (!it) return fail(res, '工艺不存在。', 404);
    const allow = ['name', 'unit', 'price', 'cost', 'craft', 'tags', 'group_key', 'group_name'];
    const patch = {};
    allow.forEach((k) => { if (body[k] !== undefined) patch[k] = body[k]; });
    ok(res, await db.library.update(params.id, patch));
  });

  api.del('/price-library/:id', async (req, res, body, params) => {
    const user = await A.requireAuth(req, res);
    if (!user) return;
    await db.library.remove(params.id);
    ok(res, { ok: true });
  });

  /* ================= 户型模板 ================= */

  api.get('/room-templates', async (req, res) => {
    const user = await A.requireAuth(req, res);
    if (!user) return;
    ok(res, await db.templates.find((t) => t.org_id === user.org_id)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))));
  });

  api.post('/room-templates', async (req, res, body) => {
    const user = await A.requireAuth(req, res);
    if (!user) return;
    const tpl = await db.templates.insert({
      id: uid(), org_id: user.org_id, user_id: user.id, created_at: now(),
      name: body.name || '未命名模板',
      layout: body.layout || '',
      building_area: Number(body.building_area) || 0,
      building_type: body.building_type || '高层',
      house_type: body.house_type || '新房',
      city: body.city || '',
      tier: body.tier || '中档',
      spaces: body.spaces || [],
      note: body.note || '',
      source: body.source || 'manual',
    });
    ok(res, tpl, 201);
  });

  api.put('/room-templates/:id', async (req, res, body, params) => {
    const user = await A.requireAuth(req, res);
    if (!user) return;
    const t = await db.templates.findOne({ id: params.id });
    if (!t || t.org_id !== user.org_id) return fail(res, '模板不存在。', 404);
    const allow = ['name', 'layout', 'building_area', 'building_type', 'house_type', 'city', 'tier', 'spaces', 'note'];
    const patch = {};
    allow.forEach((k) => { if (body[k] !== undefined) patch[k] = body[k]; });
    ok(res, db.templates.update(params.id, patch));
  });

  api.del('/room-templates/:id', async (req, res, body, params) => {
    const user = await A.requireAuth(req, res);
    if (!user) return;
    await db.templates.remove(params.id);
    ok(res, { ok: true });
  });

  /** 本地匹配：按面积 / 户型 / 装修类型打分（免费，不扣点数） */
  api.post('/ai/templates/match-rank', async (req, res, body) => {
    const user = await A.requireAuth(req, res);
    if (!user) return;
    const all = await db.templates.find((t) => t.org_id === user.org_id);
    const area = Number(body.building_area) || 0;
    const layout = String(body.layout || '');
    const houseType = String(body.house_type || '');

    const ranked = all.map((t) => {
      let score = 40;
      const reasons = [];
      if (layout && t.layout === layout) { score += 30; reasons.push('户型一致'); }
      else if (layout && sameRoomCount(layout, t.layout)) { score += 15; reasons.push('居室数量一致'); }

      const ta = Number(t.building_area) || 0;
      if (area && ta) {
        const diff = Math.abs(ta - area) / area;
        if (diff <= 0.08) { score += 25; reasons.push('面积接近'); }
        else if (diff <= 0.2) { score += 15; reasons.push(`面积偏差 ${(diff * 100).toFixed(0)}%`); }
        else if (diff <= 0.5) { score += 5; reasons.push(`面积偏差 ${(diff * 100).toFixed(0)}%，需调整`); }
        else { score -= 10; reasons.push('面积偏差较大'); }
      }
      if (houseType && t.house_type === houseType) { score += 10; reasons.push('装修类型一致'); }
      else if (houseType && t.house_type) { score -= 8; reasons.push(`装修类型冲突（模板偏${t.house_type}）`); }

      return { ...t, score: Math.max(0, Math.min(100, score)), reasons, area_diff: area && ta ? Math.round((ta - area) / area * 1000) / 10 : null };
    }).sort((a, b) => b.score - a.score);

    ok(res, {
      matches: ranked.slice(0, 5),
      best: ranked[0] || null,
      total: all.length,
      message: all.length ? `本地匹配到 ${all.length} 个模板，最高匹配度 ${ranked[0] ? ranked[0].score : 0} 分` : '你还没有任何模板。',
    });
  });
};

function sameRoomCount(a, b) {
  const ca = (a.match(/[一二三四五]室/) || [''])[0];
  const cb = (b.match(/[一二三四五]室/) || [''])[0];
  return ca && ca === cb;
}
