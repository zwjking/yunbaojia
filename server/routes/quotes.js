/**
 * 报价管理：CRUD + 状态机 + 明细 + 付款条款 + 审计 + 分享
 */
const { db, uid, now } = require('../lib/db');
const A = require('../lib/auth');
const { ok, fail } = require('../lib/http');
const { genQuoteNo } = require('../lib/seed');

const STATUS_LABEL = {
  draft: '草稿',
  pending_approval: '待审批',
  approved: '已通过',
  rejected: '已驳回',
  final: '终稿',
  issued: '已签发',
  won: '已成交',
  lost: '未成交',
  paused: '已暂停',
  abandoned: '已放弃',
  archived: '已归档',
};

/** 允许的状态流转 */
const TRANSITIONS = {
  draft: ['pending_approval', 'final', 'issued', 'archived'],
  pending_approval: ['approved', 'rejected', 'draft'],
  approved: ['final', 'draft'],
  rejected: ['draft'],
  final: ['issued', 'draft'],
  issued: ['won', 'lost', 'paused', 'abandoned'],
  paused: ['issued', 'lost'],
  won: [],
  lost: [],
  abandoned: ['draft'],
  archived: ['draft'],
};

function itemsOf(quoteId) {
  return db.quote_items.find({ quote_id: quoteId }).map((i) => ({
    ...i,
    subtotal: Math.round((Number(i.unit_price) || 0) * (Number(i.qty) || 0) * 100) / 100,
  }));
}

function recalc(quoteId) {
  const items = itemsOf(quoteId);
  const total = Math.round(items.reduce((s, i) => s + (Number(i.unit_price) || 0) * (Number(i.qty) || 0), 0) * 100) / 100;
  const cost = Math.round(items.reduce((s, i) => s + (Number(i.cost_price) || 0) * (Number(i.qty) || 0), 0) * 100) / 100;
  const q = db.quotes.findOne({ id: quoteId });
  const taxRate = Number(q && q.tax_rate) || 0;
  const manageFee = Number(q && q.manage_fee) || 0;
  const grand = Math.round((total + manageFee) * (1 + taxRate / 100) * 100) / 100;
  return db.quotes.update(quoteId, {
    total_amount: total,
    cost_amount: cost,
    grand_total: grand,
    margin_rate: grand ? Math.round((grand - cost) / grand * 1000) / 10 : 0,
    item_count: items.length,
  });
}

function withItems(q) {
  if (!q) return null;
  return { ...q, items: itemsOf(q.id), status_label: STATUS_LABEL[q.status] || q.status };
}

module.exports = function register(api) {

  /* ---------------- 列表 ---------------- */
  api.get('/quotes', async (req, res) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const q = req.query || {};
    let list = db.quotes.find((x) => x.org_id === user.org_id && x.status !== 'archived');

    if (q.status && q.status !== 'all') list = list.filter((x) => x.status === q.status);
    if (q.keyword) {
      const kw = String(q.keyword).toLowerCase();
      list = list.filter((x) =>
        [x.title, x.customer_name, x.community, x.quote_number, x.city].some((v) => String(v || '').toLowerCase().includes(kw))
      );
    }
    if (q.range && q.range !== 'all') list = filterByRange(list, q.range);

    list.sort((a, b) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)));
    ok(res, {
      items: list,
      total: list.length,
      stats: quoteStats(db.quotes.find((x) => x.org_id === user.org_id)),
    });
  });

  api.get('/quotes/stats', async (req, res) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const q = req.query || {};
    let list = db.quotes.find((x) => x.org_id === user.org_id);
    if (q.range && q.range !== 'all') list = filterByRange(list, q.range);
    ok(res, quoteStats(list));
  });

  /* ---------------- 详情 ---------------- */
  api.get('/quotes/:id', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const q = db.quotes.findOne({ id: params.id });
    if (!q || q.org_id !== user.org_id) return fail(res, '报价不存在。', 404);
    ok(res, withItems(q));
  });

  /* ---------------- 新建 ---------------- */
  api.post('/quotes', async (req, res, body) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const quote = db.quotes.insert({
      id: uid(),
      org_id: user.org_id,
      user_id: user.id,
      quote_number: genQuoteNo(user.org_id),
      title: body.title || '未命名报价',
      customer_id: body.customer_id || '',
      customer_name: body.customer_name || '',
      customer_phone: body.customer_phone || '',
      community: body.community || '',
      province: body.province || '',
      city: body.city || '',
      building_area: Number(body.building_area) || 0,
      layout: body.layout || '',
      tier: body.tier || '中档',
      house_type: body.house_type || '新房',
      house_age: Number(body.house_age) || 0,
      floor: Number(body.floor) || 0,
      building_type: body.building_type || '高层',
      has_elevator: body.has_elevator !== false,
      status: 'draft',
      total_amount: 0, cost_amount: 0, grand_total: 0, margin_rate: 0,
      manage_fee: Number(body.manage_fee) || 0,
      tax_rate: Number(body.tax_rate) || 0,
      notes: body.notes || '',
      share_token: '',
      export_unlocked: false,
      created_at: now(), updated_at: now(),
    });
    ok(res, withItems(quote), 201);
  });

  /* ---------------- 更新 ---------------- */
  api.put('/quotes/:id', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const q = db.quotes.findOne({ id: params.id });
    if (!q || q.org_id !== user.org_id) return fail(res, '报价不存在。', 404);
    if (['won', 'lost'].includes(q.status)) return fail(res, '已结案的报价不可再修改，请先撤回状态。');

    const allow = ['title', 'customer_id', 'customer_name', 'customer_phone', 'community', 'province',
      'city', 'building_area', 'layout', 'tier', 'house_type', 'house_age', 'floor', 'building_type',
      'has_elevator', 'notes', 'manage_fee', 'tax_rate', 'valid_days', 'payment_terms'];
    const patch = {};
    allow.forEach((k) => { if (body[k] !== undefined) patch[k] = body[k]; });

    db.quotes.update(params.id, patch);
    recalc(params.id);
    logHistory(params.id, user, 'update', '更新报价信息');
    ok(res, withItems(db.quotes.findOne({ id: params.id })));
  });

  api.del('/quotes/:id', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const q = db.quotes.findOne({ id: params.id });
    if (!q || q.org_id !== user.org_id) return fail(res, '报价不存在。', 404);
    if (!['owner', 'admin'].includes(user.role) && q.user_id !== user.id) {
      return fail(res, '仅管理员或创建人可删除。', 403);
    }
    if (q.status === 'won') return fail(res, '已成交的报价不可删除（财务与业绩留痕要求）。如需作废，请先改为「未成交」或「已归档」。', 403);
    if (q.status === 'issued') return fail(res, '已签发的报价不可直接删除，请先置为「已归档」再删除。', 403);
    db.quote_items.removeWhere((it) => it.quote_id === params.id);
    db.quotes.remove(params.id);
    ok(res, { ok: true });
  });

  api.post('/quotes/:id/duplicate', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const src = db.quotes.findOne({ id: params.id });
    if (!src || src.org_id !== user.org_id) return fail(res, '报价不存在。', 404);
    const { id, created_at, updated_at, quote_number, ...rest } = src;
    const copy = db.quotes.insert({
      ...rest,
      id: uid(),
      quote_number: genQuoteNo(user.org_id),
      title: `${src.title}（副本）`,
      status: 'draft',
      share_token: '',
      export_unlocked: false,
      created_at: now(), updated_at: now(),
    });
    db.quote_items.insertMany(
      itemsOf(params.id).map((it) => ({ ...it, id: uid(), quote_id: copy.id, created_at: now() }))
    );
    ok(res, withItems(copy), 201);
  });

  /* ---------------- 明细 ---------------- */
  api.get('/quotes/:id/items', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    ok(res, itemsOf(params.id));
  });

  api.post('/quotes/:id/items', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const q = db.quotes.findOne({ id: params.id });
    if (!q || q.org_id !== user.org_id) return fail(res, '报价不存在。', 404);
    const item = db.quote_items.insert({
      id: uid(),
      quote_id: params.id,
      org_id: user.org_id,
      group_name: body.group_name || '未分类',
      name: body.name || '新项目',
      unit: body.unit || '项',
      qty: Number(body.qty) || 1,
      unit_price: Number(body.unit_price) || 0,
      cost_price: Number(body.cost_price) || 0,
      craft: body.craft || '',
      remark: body.remark || '',
      source: body.source || 'manual',
      created_at: now(),
      amount: Math.round((Number(body.unit_price) || 0) * (Number(body.qty) || 1) * 100) / 100,
    });
    recalc(params.id);
    ok(res, { ...item, subtotal: item.amount }, 201);
  });

  api.put('/quotes/:id/items/:itemId', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const item = db.quote_items.findOne({ id: params.itemId });
    if (!item || item.quote_id !== params.id) return fail(res, '明细不存在。', 404);
    const allow = ['group_name', 'name', 'unit', 'qty', 'unit_price', 'cost_price', 'craft', 'remark'];
    const patch = {};
    allow.forEach((k) => { if (body[k] !== undefined) patch[k] = body[k]; });
    patch.amount = Math.round((Number(patch.unit_price ?? updated.unit_price) || 0) * (Number(patch.qty ?? updated.qty) || 0) * 100) / 100;
    const updated = db.quote_items.update(params.itemId, patch);
    recalc(params.id);
    ok(res, { ...updated, subtotal: updated.amount });
  });

  api.del('/quotes/:id/items/:itemId', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    db.quote_items.remove(params.itemId);
    recalc(params.id);
    ok(res, { ok: true });
  });

  /** 批量保存明细（编辑器整表保存） */
  api.post('/quotes/:id/items/batch', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const q = db.quotes.findOne({ id: params.id });
    if (!q || q.org_id !== user.org_id) return fail(res, '报价不存在。', 404);
    const list = Array.isArray(body.items) ? body.items : [];
    const keepIds = new Set();
    for (const it of list) {
      if (it.id && db.quote_items.findOne({ id: it.id })) {
        keepIds.add(it.id);
        db.quote_items.update(it.id, {
          group_name: it.group_name, name: it.name, unit: it.unit,
          qty: Number(it.qty) || 0, unit_price: Number(it.unit_price) || 0,
          cost_price: Number(it.cost_price) || 0, craft: it.craft || '', remark: it.remark || '',
        });
      } else {
        const n = db.quote_items.insert({
          id: uid(), quote_id: params.id, org_id: user.org_id,
          group_name: it.group_name || '未分类', name: it.name || '新项目', unit: it.unit || '项',
          qty: Number(it.qty) || 0, unit_price: Number(it.unit_price) || 0,
          cost_price: Number(it.cost_price) || 0, craft: it.craft || '', remark: it.remark || '',
          source: it.source || 'manual', created_at: now(),
        });
        keepIds.add(n.id);
      }
    }
    if (body.replace) {
      db.quote_items.removeWhere((it) => it.quote_id === params.id && !keepIds.has(it.id));
    }
    recalc(params.id);
    ok(res, itemsOf(params.id));
  });

  /* ---------------- 状态流转 ---------------- */
  const doTransition = (to, label, extra = {}) => async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const q = db.quotes.findOne({ id: params.id });
    if (!q || q.org_id !== user.org_id) return fail(res, '报价不存在。', 404);
    const allowed = TRANSITIONS[q.status] || [];
    if (!allowed.includes(to)) {
      return fail(res, `当前状态「${STATUS_LABEL[q.status] || q.status}」不能变更为「${label}」。`);
    }
    if (to === 'issued' && !itemsOf(params.id).length) {
      return fail(res, '报价还没有明细，先添加项目再签发。');
    }
    db.quotes.update(params.id, { status: to, ...extra, updated_at: now() });
    logHistory(params.id, user, to, label);
    ok(res, withItems(db.quotes.findOne({ id: params.id })));
  };

  api.post('/quotes/:id/submit', doTransition('pending_approval', '提交审批'));
  api.post('/quotes/:id/approve', doTransition('approved', '审批通过'));
  api.post('/quotes/:id/reject', doTransition('rejected', '驳回', { reject_reason: '' }));
  api.post('/quotes/:id/finalize', doTransition('final', '定稿'));
  api.post('/quotes/:id/issue', (req, res, body, params) => {
    const h = doTransition('issued', '签发给客户');
    return h(req, res, body, params);
  });
  api.post('/quotes/:id/win', doTransition('won', '标记成交'));
  api.post('/quotes/:id/lose', doTransition('lost', '标记未成交'));
  api.post('/quotes/:id/pause', doTransition('paused', '暂停跟进'));
  api.post('/quotes/:id/resume', doTransition('issued', '恢复跟进'));
  api.post('/quotes/:id/abandon', doTransition('abandoned', '放弃'));

  api.post('/quotes/:id/archive', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    db.quotes.update(params.id, { status: 'archived', updated_at: now() });
    logHistory(params.id, user, 'archive', '归档');
    ok(res, { ok: true });
  });

  api.post('/quotes/:id/unarchive', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    db.quotes.update(params.id, { status: 'draft', updated_at: now() });
    ok(res, { ok: true });
  });

  /** 变更单：记录变更并回到可编辑状态 */
  api.post('/quotes/:id/change-order', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const q = db.quotes.findOne({ id: params.id });
    if (!q || q.org_id !== user.org_id) return fail(res, '报价不存在。', 404);
    db.notifications.insert({
      id: uid(), org_id: user.org_id, type: 'change_order', quote_id: params.id,
      reason: body.reason || '', amount_delta: Number(body.amount_delta) || 0,
      status: 'recorded', created_by: user.id, created_at: now(),
    });
    db.quotes.update(params.id, { status: 'draft', updated_at: now() });
    logHistory(params.id, user, 'change_order', `发起变更：${body.reason || '未填写原因'}`);
    ok(res, withItems(db.quotes.findOne({ id: params.id })));
  });

  /* ---------------- 历史 / 审计 / 用量 ---------------- */
  api.get('/quotes/:id/history', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    ok(res, db.notifications.find({ quote_id: params.id, type: 'quote_log' })
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))));
  });

  api.get('/quotes/:id/pricing-audit', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const items = itemsOf(params.id);
    const issues = [];
    const byGroup = {};
    items.forEach((i) => {
      byGroup[i.group_name] = (byGroup[i.group_name] || 0) + i.unit_price * i.qty;
      const lib = db.library.findOne((x) => x.name === i.name && (x.org_id === user.org_id || !x.org_id));
      if (lib && i.unit_price > lib.price * 1.4) {
        issues.push({ level: 'high', item: i.name, current: i.unit_price, reference: lib.price, msg: '单价高于工艺库基准 40% 以上' });
      } else if (lib && i.unit_price < lib.price * 0.6) {
        issues.push({ level: 'low', item: i.name, current: i.unit_price, reference: lib.price, msg: '单价低于工艺库基准 40%，注意漏项或亏损' });
      }
      if (!i.cost_price || i.cost_price <= 0) {
        issues.push({ level: 'warn', item: i.name, msg: '未填写成本，毛利统计不准' });
      }
    });
    const total = items.reduce((s, i) => s + i.unit_price * i.qty, 0);
    ok(res, {
      item_count: items.length,
      total: Math.round(total * 100) / 100,
      group_distribution: Object.entries(byGroup).map(([name, amount]) => ({
        name, amount: Math.round(amount * 100) / 100,
        ratio: total ? Math.round(amount / total * 1000) / 10 : 0,
      })).sort((a, b) => b.amount - a.amount),
      issues,
    });
  });

  api.get('/quotes/:id/material-takeoff', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const items = itemsOf(params.id);
    const RULES = [
      { re: /乳胶漆|刷漆/, mat: '乳胶漆（L）', per: 0.14, unit: 'L' },
      { re: /腻子/, mat: '腻子粉（kg）', per: 1.6, unit: 'kg' },
      { re: /贴砖|铺贴/, mat: '瓷砖胶（kg）', per: 4.2, unit: 'kg' },
      { re: /防水/, mat: '防水涂料（kg）', per: 2.1, unit: 'kg' },
      { re: /布线|电线/, mat: '电线（m）', per: 1.05, unit: 'm' },
      { re: /PPR|给水管/, mat: 'PPR 管（m）', per: 1.02, unit: 'm' },
      { re: /吊顶|石膏板/, mat: '石膏板（张）', per: 0.35, unit: '张' },
      { re: /找平/, mat: '水泥砂浆（m³）', per: 0.032, unit: 'm³' },
      { re: /美缝/, mat: '美缝剂（支）', per: 0.22, unit: '支' },
    ];
    const agg = {};
    items.forEach((i) => {
      RULES.forEach((r) => {
        if (r.re.test(i.name)) {
          agg[r.mat] = agg[r.mat] || { material: r.mat, unit: r.unit, qty: 0, for_items: [] };
          agg[r.mat].qty += i.qty * r.per;
          if (agg[r.mat].for_items.length < 3) agg[r.mat].for_items.push(i.name);
        }
      });
    });
    ok(res, {
      materials: Object.values(agg).map((x) => ({ ...x, qty: Math.round(x.qty * 100) / 100 }))
        .sort((a, b) => b.qty - a.qty),
      note: '材料用量为经验系数估算，仅作采购备料参考，实际以现场施工为准',
    });
  });

  /* ---------------- 出单 / 导出解锁 ---------------- */
  api.post('/quotes/:id/unlock-export', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const q = db.quotes.findOne({ id: params.id });
    if (!q || q.org_id !== user.org_id) return fail(res, '报价不存在。', 404);
    if (q.export_unlocked) return ok(res, { unlocked: true, message: '该报价已解锁，可反复导出。' });

    const plan = user.plan || 'free';
    if (plan === 'plus' || plan === 'enterprise') {
      db.quotes.update(params.id, { export_unlocked: true });
      return ok(res, { unlocked: true, message: 'Plus/企业版不限次导出，已解锁。' });
    }
    const purchased = user.export_purchased || 0;
    const used = user.export_used || 0;
    if (purchased - used <= 0) {
      return fail(res, '出单次数不足，请先购买出单次数或升级 Plus 版。', 402, 'NEED_PURCHASE');
    }
    db.users.update(user.id, { export_used: used + 1 });
    db.quotes.update(params.id, { export_unlocked: true });
    ok(res, { unlocked: true, remaining: purchased - used - 1, message: '已解锁，同一份报价可反复导出。' });
  });

  /* ---------------- 客户分享 ---------------- */
  api.post('/quotes/:id/share', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const q = db.quotes.findOne({ id: params.id });
    if (!q || q.org_id !== user.org_id) return fail(res, '报价不存在。', 404);
    const token = q.share_token || uid() + uid().slice(0, 6);
    db.quotes.update(params.id, { share_token: token, share_enabled: true });
    ok(res, { token, url: `/q/${token}` });
  });

  api.get('/quotes/share/:token', async (req, res, body, params) => {
    const q = db.quotes.findOne({ share_token: params.token });
    if (!q || !q.share_enabled) return fail(res, '报价不存在或已取消分享。', 404);
    const org = db.orgs.findOne({ id: q.org_id }) || {};
    const items = itemsOf(q.id);
    const showCost = !!(org.settings && org.settings.show_cost_to_client);
    ok(res, {
      quote: {
        quote_number: q.quote_number, title: q.title, customer_name: q.customer_name,
        community: q.community, city: q.city, building_area: q.building_area, layout: q.layout,
        tier: q.tier, house_type: q.house_type, total_amount: q.total_amount,
        grand_total: q.grand_total, status: q.status, notes: q.notes,
        created_at: q.created_at,
      },
      org: { name: org.name, phone: org.phone, address: org.address, intro: org.intro },
      items: items.map((i) => ({
        group_name: i.group_name, name: i.name, unit: i.unit, qty: i.qty,
        unit_price: i.unit_price, amount: Math.round(i.unit_price * i.qty * 100) / 100,
        craft: i.craft, cost_price: showCost ? i.cost_price : undefined,
      })),
      share: true,
    });
  });

  api.post('/quotes/share/:token/unlock', async (req, res, body, params) => {
    ok(res, { ok: true });
  });
};

/* ---------------- 工具 ---------------- */

function filterByRange(list, range) {
  const nowMs = Date.now();
  const start = {
    month: new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime(),
    quarter: new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3, 1).getTime(),
    year: new Date(new Date().getFullYear(), 0, 1).getTime(),
  }[range] || 0;
  return list.filter((x) => new Date(x.created_at).getTime() >= start);
}

function quoteStats(list) {
  const total = list.length;
  const draft = list.filter((x) => x.status === 'draft').length;
  const pending = list.filter((x) => x.status === 'pending_approval').length;
  const issued = list.filter((x) => x.status === 'issued').length;
  const won = list.filter((x) => x.status === 'won').length;
  const lost = list.filter((x) => ['lost', 'abandoned'].includes(x.status)).length;
  const closed = won + lost;
  const amount = list.reduce((s, x) => s + (Number(x.grand_total) || Number(x.total_amount) || 0), 0);
  const wonAmount = list.filter((x) => x.status === 'won').reduce((s, x) => s + (Number(x.grand_total) || Number(x.total_amount) || 0), 0);
  const costAmount = list.reduce((s, x) => s + (Number(x.cost_amount) || 0), 0);
  return {
    total, draft, pending, issued, won, lost,
    win_rate: closed ? Math.round(won / closed * 100) : 0,
    convert_rate: total ? Math.round((total - draft) / total * 100) : 0,
    amount: Math.round(amount * 100) / 100,
    won_amount: Math.round(wonAmount * 100) / 100,
    avg_amount: total ? Math.round(amount / total * 100) / 100 : 0,
    margin_rate: amount ? Math.round((amount - costAmount) / amount * 1000) / 10 : 0,
  };
}

function logHistory(quoteId, user, action, label) {
  db.notifications.insert({
    id: uid(), type: 'quote_log', quote_id: quoteId,
    action, label, user_id: user.id, user_name: user.name || user.phone,
    created_at: now(),
  });
}

module.exports.STATUS_LABEL = STATUS_LABEL;
