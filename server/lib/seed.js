/**
 * 数据初始化：系统内置工艺库 + 组织副本 + 演示数据
 */
const { db, uid, now } = require('./db');
const { buildItems, GROUPS } = require('../../seed/library');

/** 确保系统内置工艺库存在（org_id 为 null） */
function initSystemLibrary() {
  const exist = db.library.count((it) => !it.org_id);
  if (exist > 0) return exist;
  const items = buildItems().map((it) => ({ ...it, org_id: null, created_at: now() }));
  db.library.insertMany(items);
  db.library.flush();
  console.log(`[seed] 已初始化系统工艺库 ${items.length} 条`);
  return items.length;
}

/** 为新组织复制一份可编辑的工艺库副本 */
function seedLibraryForOrg(orgId, opts = {}) {
  const exist = db.library.count((it) => it.org_id === orgId);
  if (exist > 0 && !opts.force) return exist;
  if (exist > 0) db.library.removeWhere((it) => it.org_id === orgId);

  const systemItems = db.library.find((it) => !it.org_id);
  const src = systemItems.length ? systemItems : buildItems().map((it) => ({ ...it, org_id: null }));
  const copies = src.map((it) => ({
    ...it,
    id: uid(),
    org_id: orgId,
    source: 'copy',
    group_key: it.group_key || (GROUPS.find((g) => g.name === it.group_name) || {}).key || 'misc',
    created_at: now(),
  }));
  db.library.insertMany(copies);
  db.library.flush();
  return copies.length;
}

/** 重置组织工艺库到系统默认 */
function resetOrgLibrary(orgId) {
  return seedLibraryForOrg(orgId, { force: true });
}

/** 为演示账号生成示例空间模板（用于模板管理页与智能造价复用） */
function seedDemoTemplates(userId, orgId) {
  if (db.templates.count((t) => t.org_id === orgId)) return 0;

  const tpls = [
    {
      name: '刚需三房 · 现代简约',
      layout: '三室两厅两卫', building_area: 108, tier: '中档',
      note: '面向首次装修的三居室，主打收纳与动线效率，主材国产一线品牌。',
      spaces: [
        { name: '玄关', area: 4 }, { name: '客厅', area: 26 }, { name: '餐厅', area: 12 },
        { name: '主卧', area: 16 }, { name: '次卧', area: 12 }, { name: '次卧2', area: 10 },
        { name: '厨房', area: 8 }, { name: '主卫', area: 5 }, { name: '客卫', area: 4 },
        { name: '阳台', area: 6 }, { name: '走廊', area: 5 },
      ],
    },
    {
      name: '婚房两居 · 轻奢奶油风',
      layout: '两室两厅一卫', building_area: 89, tier: '高档',
      note: '老房翻新，全屋重做水电，重点投入客餐厅与主卧氛围。',
      spaces: [
        { name: '玄关', area: 3.5 }, { name: '客厅', area: 22 }, { name: '餐厅', area: 10 },
        { name: '主卧', area: 14 }, { name: '次卧', area: 11 }, { name: '厨房', area: 7 },
        { name: '卫生间', area: 4.5 }, { name: '阳台', area: 5 }, { name: '走廊', area: 4 },
        { name: '储物间', area: 8 },
      ],
    },
    {
      name: '改善四房 · 全屋定制',
      layout: '四室两厅两卫', building_area: 132, tier: '高档',
      note: '改善型四居，含独立书房与全屋定制柜体，注重静音与收纳。',
      spaces: [
        { name: '玄关', area: 4 }, { name: '客厅', area: 28 }, { name: '餐厅', area: 14 },
        { name: '主卧', area: 18 }, { name: '次卧', area: 13 }, { name: '次卧2', area: 12 },
        { name: '书房', area: 11 }, { name: '厨房', area: 9 }, { name: '主卫', area: 6 },
        { name: '客卫', area: 5 }, { name: '阳台', area: 7 }, { name: '走廊', area: 5 },
      ],
    },
  ];

  const docs = tpls.map((t) => db.templates.insert({
    id: uid(),
    org_id: orgId,
    user_id: userId,
    building_type: '高层',
    house_type: '新房',
    city: '合肥',
    source: 'preset',
    created_at: now(),
    ...t,
  }));
  db.templates.flush();
  return docs.length;
}

/** 为演示账号生成示例报价 */
function seedDemoQuotes(userId, orgId) {
  if (db.quotes.count((q) => q.org_id === orgId)) return 0;

  seedDemoTemplates(userId, orgId);

  const customers = [
    { name: '王女士', phone: '13805610001', community: '华润·幸福里', building_area: 108, layout: '三室两厅两卫' },
    { name: '李先生', phone: '13905610002', community: '万科·森林公园', building_area: 89, layout: '两室两厅一卫' },
    { name: '张女士', phone: '13705610003', community: '保利·西山林语', building_area: 132, layout: '四室两厅两卫' },
  ].map((c) => db.customers.insert({ id: uid(), org_id: orgId, ...c, source: '到店', status: 'following', created_at: now() }));

  const ai = require('./ai');
  const demo = [
    { customer: customers[0], city: '合肥', tier: '中档', house_type: '新房', status: 'issued', days: 2 },
    { customer: customers[1], city: '合肥', tier: '简装', house_type: '老房', house_age: 15, status: 'won', days: 12 },
    { customer: customers[2], city: '合肥', tier: '高档', house_type: '新房', status: 'draft', days: 0 },
  ];

  let n = 0;
  for (const d of demo) {
    const est = ai.estimate({
      city: d.city,
      building_area: d.customer.building_area,
      layout: d.customer.layout,
      tier: d.tier,
      house_type: d.house_type,
      house_age: d.house_age || 0,
      building_type: '高层',
      floor: 8,
      has_elevator: true,
    });
    const qid = uid();
    const total = est.total;
    const quote = db.quotes.insert({
      id: qid,
      org_id: orgId,
      user_id: userId,
      quote_number: genQuoteNo(orgId),
      title: `${d.customer.community} ${d.customer.building_area}㎡ ${d.customer.layout} 装修报价`,
      customer_id: d.customer.id,
      customer_name: d.customer.name,
      customer_phone: d.customer.phone,
      community: d.customer.community,
      city: d.city,
      province: '安徽',
      building_area: d.customer.building_area,
      layout: d.customer.layout,
      tier: d.tier,
      house_type: d.house_type,
      house_age: d.house_age || 0,
      floor: 8,
      building_type: '高层',
      status: d.status,
      total_amount: total,
      cost_amount: est.cost_total,
      margin_rate: est.gross_margin,
      item_count: est.items.length,
      notes: '',
      created_at: new Date(Date.now() - d.days * 86400000).toISOString(),
      updated_at: now(),
    });
    db.quote_items.insertMany(
      est.items.map((it) => ({ ...it, id: uid(), quote_id: qid, org_id: orgId, created_at: now() }))
    );
    n += 1;
  }
  db.quotes.flush();
  db.quote_items.flush();
  return n;
}

function genQuoteNo(orgId) {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const seq = db.quotes.count((q) => q.org_id === orgId) + 1;
  return `BJ${ymd}${String(seq).padStart(3, '0')}`;
}

module.exports = { initSystemLibrary, seedLibraryForOrg, resetOrgLibrary, seedDemoQuotes, seedDemoTemplates, genQuoteNo };
