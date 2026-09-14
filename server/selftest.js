/**
 * 逻辑层自测：不启动 HTTP 服务，直接验证 AI 引擎与数据种子
 * 运行：node server/selftest.js
 */
const path = require('path');
process.chdir(__dirname);

const { db } = require('./lib/db');
const seed = require('./lib/seed');
const AI = require('./lib/ai');

let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass += 1; console.log(`  [OK]   ${name} ${extra}`); }
  else { fail += 1; console.log(`  [FAIL] ${name} ${extra}`); }
}

(async () => {
  console.log('\n===== 1. 工艺库种子 =====');
  const n = seed.initSystemLibrary();
  const lib = db.library.find((x) => !x.org_id);
  check('系统工艺库初始化', lib.length >= 180, `共 ${lib.length} 条`);
  const groups = [...new Set(lib.map((x) => x.group_name))];
  check('分类数量 = 8', groups.length === 8, groups.join('/'));
  const bad = lib.filter((x) => !x.name || !x.unit || !(x.price > 0));
  check('无空值条目', bad.length === 0, bad.length ? JSON.stringify(bad[0]) : '');

  console.log('\n===== 2. 城市系数 =====');
  check('上海 = 1.35（一线）', AI.cityFactor('上海') === 1.35);
  check('杭州 = 1.12（新一线）', AI.cityFactor('杭州') === 1.12);
  check('合肥 = 1.00（二线）', AI.cityFactor('合肥') === 1.0);
  check('未知城市回落 0.9', AI.cityFactor('某某市') === 0.9);

  console.log('\n===== 3. 户型拆解 =====');
  const bd = AI.breakdownRooms(108, '三室两厅两卫', '高层');
  const sumSpaces = Object.values(bd.spaces).reduce((a, b) => a + b, 0);
  check('套内面积合理', bd.usable_area > 70 && bd.usable_area < 90, `${bd.usable_area} m²`);
  check('空间面积合计≈套内', Math.abs(sumSpaces - bd.usable_area) < 2, `${sumSpaces.toFixed(1)} vs ${bd.usable_area}`);
  console.log('        ' + Object.entries(bd.spaces).map(([k, v]) => `${k}:${v}`).join(' '));

  console.log('\n===== 4. 智能造价（新房中档 108㎡ 合肥） =====');
  const est = AI.estimate({
    city: '合肥', building_area: 108, layout: '三室两厅两卫',
    tier: '中档', house_type: '新房', building_type: '高层', floor: 8, has_elevator: true,
  });
  check('生成明细 > 40 条', est.items.length > 40, `${est.items.length} 条`);
  check('总价在合理区间', est.total > 60000 && est.total < 260000, `¥${est.total}`);
  check('单方造价合理', est.per_sqm > 700 && est.per_sqm < 2000, `${est.per_sqm} 元/m²`);
  check('毛利率合理', est.gross_margin > 5 && est.gross_margin < 60, `${est.gross_margin}%`);
  check('含假设说明', est.assumptions.length >= 4, `${est.assumptions.length} 条`);
  console.log('        分组：' + est.breakdown.map((b) => `${b.name} ${b.ratio}%`).join(' | '));

  console.log('\n===== 5. 老房 vs 新房 =====');
  const old = AI.estimate({
    city: '合肥', building_area: 108, layout: '三室两厅两卫',
    tier: '中档', house_type: '老房', house_age: 20, building_type: '高层', floor: 8, has_elevator: true,
  });
  check('老房总价 > 新房', old.total > est.total, `老房 ¥${old.total} vs 新房 ¥${est.total}`);
  check('老房含拆除项', old.items.some((i) => i.group_name === '拆除与保护' && /拆除/.test(i.name)));

  console.log('\n===== 6. 档次差异 =====');
  const jian = AI.estimate({ city: '合肥', building_area: 108, layout: '三室两厅两卫', tier: '简装', house_type: '新房', building_type: '高层' });
  const gao = AI.estimate({ city: '合肥', building_area: 108, layout: '三室两厅两卫', tier: '高档', house_type: '新房', building_type: '高层' });
  check('高档 > 简装', gao.total > jian.total, `简装 ¥${jian.total} / 中档 ¥${est.total} / 高档 ¥${gao.total}`);

  console.log('\n===== 7. 城市差异 =====');
  const sh = AI.estimate({ city: '上海', building_area: 108, layout: '三室两厅两卫', tier: '中档', house_type: '新房', building_type: '高层' });
  check('上海 > 合肥', sh.total > est.total, `上海 ¥${sh.total} vs 合肥 ¥${est.total}`);

  console.log('\n===== 8. 各 AI 功能 =====');
  const tier = await AI.FEATURES['tier-matching']({ city: '合肥', building_area: 108, budget: 120000 });
  check('档次匹配返回 4 档', tier.tiers.length === 4, `推荐：${tier.recommended}`);

  const bud = await AI.FEATURES['budget-reverse']({ budget: 120000, building_area: 108, city: '合肥', tier: '中档' });
  check('预算反推有分配', bud.allocation.length === 7, `判定：${bud.verdict}`);

  const risk = await AI.FEATURES['risk-report']({ city: '合肥', building_area: 108, house_type: '老房', house_age: 20, floor: 6, has_elevator: true, budget: 120000 });
  check('风险预测有条目', risk.risks.length >= 4, `增项 ¥${risk.extra_low}~${risk.extra_high}`);

  const nl = await AI.FEATURES['nl-to-items']({ text: '客厅墙面刷乳胶漆 35 平米，厨卫做防水', city: '合肥' });
  check('自然语言加项命中', nl.items.length > 0, `${nl.items.length} 条：${(nl.items[0] || {}).name || ''}`);

  const ps = await AI.FEATURES['price-suggestion']({ item_name: '厨卫墙地面防水（聚合物水泥基三遍）', city: '合肥', current_price: 58 });
  check('单点价格建议', ps.suggested_mid > 0, `区间 ¥${ps.suggested_low}-${ps.suggested_high}，判定 ${ps.verdict}`);

  const rev = await AI.FEATURES['quote-review']({ items: est.items.map((i) => ({ group_name: i.group_name, name: i.name, qty: i.qty, unit_price: i.unit_price, cost_price: i.cost_price })) });
  check('整单复核评分', rev.score >= 40 && rev.score <= 100, `评分 ${rev.score}，漏项 ${rev.missing.length}，异常 ${rev.anomalies.length}`);

  const cc = await AI.FEATURES['customer-copy']({ items_text: '墙面刷乳胶漆\n厨卫防水\nPPR 给水管改造', project_name: '幸福里', city: '合肥' });
  check('话术润色输出', cc.lines.length === 3, `示例：${cc.lines[0].slice(0, 24)}…`);

  const audit = await AI.FEATURES['price-library-audit']({});
  check('价格库体检（误报率 < 15%）',
    audit.total === lib.length && audit.issue_count < lib.length * 0.15,
    `健康度 ${audit.health_score}，问题 ${audit.issue_count}/${audit.total}`);
  if (audit.issue_count) {
    console.log('        示例：' + audit.issues.slice(0, 3).map((i) => `${i.type}-${i.name}`).join(' | '));
  }

  const calib = await AI.FEATURES['city-calibration']({ target_city: '上海' });
  check('城市校准系数', calib.factor === 1.35, `${calib.tier} ×${calib.factor}`);

  const tpl = await AI.FEATURES['template-generate']({ building_area: 100, layout: '三室两厅两卫', building_type: '高层' });
  check('模板生成', tpl.spaces.length >= 8, `${tpl.spaces.length} 个空间`);

  console.log('\n===== 9. 套餐与积分 =====');
  check('套餐数 = 5', AI.PACKAGES.length === 5, AI.PACKAGES.map((p) => p.name).join('/'));
  check('积分消耗表完整', Object.keys(AI.FEATURE_COSTS).length >= 15, `${Object.keys(AI.FEATURE_COSTS).length} 项`);

  console.log('\n===== 10. 组织副本 =====');
  const orgId = 'TEST_ORG';
  seed.seedLibraryForOrg(orgId, { force: true });
  const orgLib = db.library.find((x) => x.org_id === orgId);
  check('组织工艺库副本', orgLib.length === lib.length, `${orgLib.length} 条`);

  console.log('\n===== 11. 演示数据 =====');
  const demoN = seed.seedDemoQuotes('TEST_USER', orgId);
  const demoQ = db.quotes.find((q) => q.org_id === orgId);
  check('生成演示报价', demoQ.length === 3, `${demoQ.length} 张`);
  if (demoQ.length) {
    console.log('        ' + demoQ.map((q) => `${q.quote_number} ${q.building_area}m² ${q.tier} ¥${q.total_amount} (${q.status})`).join('\n        '));
  }

  // 清理测试数据
  db.quotes.removeWhere((q) => q.org_id === orgId);
  db.quote_items.removeWhere((i) => i.org_id === orgId);
  db.library.removeWhere((x) => x.org_id === orgId);
  db.customers.removeWhere((c) => c.org_id === orgId);
  db.quotes.flush(); db.quote_items.flush(); db.library.flush(); db.customers.flush();

  console.log(`\n===== 结果：通过 ${pass} 项，失败 ${fail} 项 =====\n`);
  process.exit(fail ? 1 : 0);
})();
