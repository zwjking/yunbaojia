/**
 * AI 引擎：本地确定性规则引擎 + 可插拔大模型 Provider
 *
 * 设计原则：
 * 1. 未配置大模型 Key 时，全部走本地规则引擎 —— 结果稳定、可复核、零成本、零延迟
 * 2. 配置了 HQ_AI_API_KEY 后，支持的功能自动切换到真实大模型，失败自动回落本地引擎
 * 3. 所有输出保留 assumptions（假设）与 needs_review 标记，符合"AI 输出是建议"的合规要求
 */
const { db } = require('./db');

/* =========================================================
   一、基础参数表
   ========================================================= */

/** 城市价格系数（以华东二线为 1.00 基准） */
const CITY_TIERS = {
  一线: { factor: 1.35, cities: ['北京', '上海', '深圳', '广州'] },
  新一线: {
    factor: 1.12,
    cities: ['杭州', '南京', '苏州', '成都', '武汉', '重庆', '西安', '长沙', '天津', '郑州', '东莞', '青岛', '沈阳', '宁波', '无锡'],
  },
  二线: {
    factor: 1.0,
    cities: ['合肥', '济南', '福州', '厦门', '大连', '哈尔滨', '长春', '石家庄', '昆明', '南宁', '南昌', '贵阳', '太原', '兰州', '常州', '南通', '徐州', '温州', '佛山', '泉州'],
  },
  三线: { factor: 0.88, cities: [] },
};

function cityFactor(city) {
  if (!city) return 1.0;
  const c = String(city).replace(/市$/, '');
  for (const t of Object.values(CITY_TIERS)) {
    if (t.cities.includes(c)) return t.factor;
  }
  return 0.9; // 未收录城市按介于二线三线
}

function cityTierName(city) {
  if (!city) return '二线';
  const c = String(city).replace(/市$/, '');
  for (const [name, t] of Object.entries(CITY_TIERS)) {
    if (t.cities.includes(c)) return name;
  }
  return '三线';
}

/** 装修档次系数与单方造价区间（元 / 建筑面积 m²，半包口径） */
const TIERS = {
  简装: { factor: 0.85, range: [680, 880], label: '简装（满足基本居住）' },
  中档: { factor: 1.0, range: [980, 1280], label: '中档（品质平衡）' },
  高档: { factor: 1.28, range: [1450, 1900], label: '高档（升级品牌）' },
  定制: { factor: 1.7, range: [2200, 3200], label: '定制 / 豪装' },
};

/** 户型 → 空间面积分配（占套内面积比例） */
const LAYOUTS = {
  一室一厅一卫: { 客厅: 0.26, 餐厅: 0.08, 主卧: 0.2, 厨房: 0.11, 卫生间: 0.1, 阳台: 0.09, 玄关过道: 0.16 },
  两室一厅一卫: { 客厅: 0.24, 餐厅: 0.1, 主卧: 0.18, 次卧: 0.15, 厨房: 0.09, 卫生间: 0.07, 阳台: 0.08, 玄关过道: 0.09 },
  两室两厅一卫: { 客厅: 0.22, 餐厅: 0.11, 主卧: 0.17, 次卧: 0.14, 厨房: 0.09, 卫生间: 0.07, 阳台: 0.08, 玄关过道: 0.12 },
  三室两厅一卫: { 客厅: 0.21, 餐厅: 0.11, 主卧: 0.16, 次卧: 0.13, 书房: 0.1, 厨房: 0.08, 卫生间: 0.06, 阳台: 0.07, 玄关过道: 0.08 },
  三室两厅两卫: { 客厅: 0.2, 餐厅: 0.1, 主卧: 0.15, 次卧: 0.12, 书房: 0.1, 厨房: 0.08, 主卫: 0.05, 客卫: 0.05, 阳台: 0.07, 玄关过道: 0.08 },
  四室两厅两卫: { 客厅: 0.19, 餐厅: 0.1, 主卧: 0.14, 次卧: 0.11, 次卧2: 0.1, 书房: 0.09, 厨房: 0.08, 主卫: 0.05, 客卫: 0.04, 阳台: 0.06, 玄关过道: 0.04 },
};

const DEFAULT_LAYOUT = LAYOUTS['三室两厅两卫'];

/** 各空间默认得房系数（高层 0.78 / 多层 0.85） */
function usableRatio(buildingType) {
  if (buildingType === '多层' || buildingType === '低层') return 0.85;
  if (buildingType === '别墅') return 0.95;
  return 0.78;
}

/** 智能套餐定义 */
const PACKAGES = [
  {
    code: 'basic-full',
    name: '基础全屋改造包',
    desc: '按本地工艺库快速生成报价草稿，覆盖硬装基础工程',
    includes: ['拆除与保护', '水电工程', '泥瓦工程', '木作吊顶', '油漆涂装'],
    excludes: ['家电', '家具', '全屋定制柜体', '空调', '灯具主材'],
    factor: 1.0,
  },
  {
    code: 'new-standard',
    name: '新房半包标准包',
    desc: '新房标准半包，含水电、泥木、油漆与基础安装',
    includes: ['水电工程', '泥瓦工程', '木作吊顶', '油漆涂装', '安装五金'],
    excludes: ['主材', '家电', '家具', '定制柜体'],
    factor: 1.05,
  },
  {
    code: 'new-improved',
    name: '新房半包改善包',
    desc: '在标准包基础上增加局部造型与品质升级项',
    includes: ['水电工程', '泥瓦工程', '木作吊顶', '油漆涂装', '安装五金', '局部定制'],
    excludes: ['家电', '家具', '大型定制'],
    factor: 1.22,
  },
  {
    code: 'old-renovation',
    name: '老房翻新标准包',
    desc: '含拆除、基层处理、水电重排与全屋翻新',
    includes: ['拆除与保护', '水电工程', '泥瓦工程', '木作吊顶', '油漆涂装'],
    excludes: ['家电', '家具', '定制柜体'],
    factor: 1.28,
  },
  {
    code: 'hardcover-all',
    name: '硬装全包（不含家电）',
    desc: '硬装全包口径，含主材与定制柜体，不含活动家具家电',
    includes: ['拆除与保护', '水电工程', '泥瓦工程', '木作吊顶', '油漆涂装', '安装五金', '定制主材'],
    excludes: ['家电', '活动家具', '软装'],
    factor: 1.62,
  },
];

/** 各 AI 功能点数消耗（积分，成功才扣） */
const FEATURE_COSTS = {
  'smart-estimate': 10,
  'full-estimate': 10,
  'room-breakdown': 3,
  'tier-matching': 3,
  'budget-reverse': 5,
  'risk-report': 8,
  'nl-to-items': 5,
  'price-suggestion': 2,
  'item-suggestion': 2,
  'quote-review': 15,
  'validate-quote': 8,
  'customer-copy': 3,
  'price-library-audit': 5,
  'city-calibration': 5,
  'audit-risk': 5,
  'template-generate': 10,
  'estimate-cost': 5,
};

/* =========================================================
   二、工程量计算模型（含 DB 查询均走 async）
   ========================================================= */

/** 缓存：按 (name, orgId) 为 key 的已查询 item，避免重复 DB 调用 */
const _libCache = new Map();

async function libItem(name, orgId) {
  const key = `${name}::${orgId || 'sys'}`;
  if (_libCache.has(key)) return _libCache.get(key);
  // 优先取系统内置基准库，其次取组织自有库
  const r =
    (await db.library.findOne((it) => it.name === name && !it.org_id)) ||
    (orgId ? await db.library.findOne((it) => it.name === name && it.org_id === orgId) : null) ||
    (await db.library.findOne((it) => it.name === name)) ||
    null;
  _libCache.set(key, r);
  return r;
}

async function libPrice(name, fallback) {
  const it = await libItem(name);
  return it ? it.price : fallback;
}

async function libCost(name, fallbackRatio = 0.66) {
  const it = await libItem(name);
  if (it) return it.cost || Math.round(it.price * 0.66 * 100) / 100;
  return Math.round(((await libPrice(name, 0)) || 0) * fallbackRatio * 100) / 100;
}

async function libUnit(name, fallback) {
  const it = await libItem(name);
  return it ? it.unit : fallback;
}

/**
 * 取当前组织可用的工艺库：优先该组织自有副本，否则回落到系统基准库
 */
async function scopeItems(orgId) {
  const own = orgId ? await db.library.find((it) => it.org_id === orgId) : [];
  if (own.length) return own;
  return db.library.find((it) => !it.org_id);
}

/**
 * 按空间生成报价条目
 */
async function generateQuoteItems(p) {
  const {
    city = '',
    building_area = 100,
    layout = '三室两厅两卫',
    tier = '中档',
    house_type = '新房',
    house_age = 0,
    floor = 6,
    has_elevator = true,
    building_type = '高层',
    rooms = null,
    notes = '',
    pkg = null,
  } = p;

  const area = Number(building_area) || 100;
  const usable = area * usableRatio(building_type);
  const cf = cityFactor(city);
  const tf = (TIERS[tier] || TIERS['中档']).factor;
  const pf = pkg && pkg.factor ? pkg.factor : 1.0;
  const isOld = house_type === '老房' || Number(house_age) >= 10;
  const k = cf * tf * pf;

  // 空间清单：优先使用传入的 rooms，否则按户型自动拆解
  const spaceMap = rooms && rooms.length
    ? Object.fromEntries(rooms.map((r) => [r.name, Number(r.area) || 0]))
    : breakdownRooms(area, layout, building_type).spaces;

  const totalUsable = Object.values(spaceMap).reduce((a, b) => a + b, 0) || usable;

  // 识别厨卫面积
  let kitchenArea = 0, bathArea = 0;
  for (const [n, a] of Object.entries(spaceMap)) {
    if (n.includes('厨房')) kitchenArea += a;
    if (n.includes('卫')) bathArea += a;
  }
  if (!kitchenArea) kitchenArea = Math.max(4.5, totalUsable * 0.08);
  if (!bathArea) bathArea = Math.max(3.5, totalUsable * 0.07 * (layout.includes('两卫') ? 2 : 1));

  const items = [];
  const assumptions = [];
  const push = async (group, name, qty, unitOverride) => {
    const unit = unitOverride || (await libUnit(name, '项'));
    const price = Math.round((await libPrice(name, 50)) * k * 100) / 100;
    const cost = Math.round(await libCost(name) * k * 100) / 100;
    if (qty <= 0) return;
    const item = await libItem(name);
    items.push({
      group_name: group,
      name,
      unit,
      qty: Math.round(qty * 100) / 100,
      unit_price: price,
      cost_price: cost,
      amount: Math.round(price * qty * 100) / 100,
      craft: item ? item.craft : '',
      source: 'ai',
    });
  };

  /* --- 1. 拆除与保护（老房 / 翻新） --- */
  if (isOld) {
    await push('拆除与保护', '旧墙皮铲除', totalUsable * 2.4);
    await push('拆除与保护', '地面瓷砖拆除', totalUsable * 0.9);
    await push('拆除与保护', '墙体拆除（非承重）', Math.max(0, totalUsable * 0.06));
    await push('拆除与保护', '洁具拆除', 2);
    await push('拆除与保护', '垃圾装袋外运', Math.max(3, area * 0.09));
  }
  await push('拆除与保护', '成品保护（地面）', totalUsable * 0.9);
  await push('拆除与保护', '成品保护（门窗家具）', 1);
  if (!has_elevator && floor > 3) {
    await push('拆除与保护', '上楼费（3层以上每层）', floor - 3);
  }

  /* --- 2. 水电工程 --- */
  const wireLen = isOld ? area * 4.2 : area * 3.2;
  const pipeLen = isOld ? area * 0.85 : area * 0.6;
  await push('水电工程', '强电布线 2.5mm²（暗线含开槽）', wireLen);
  await push('水电工程', '强电布线 4mm²（空调/厨房）', area * 0.9);
  await push('水电工程', '给水管改造 PPR（暗管含开槽）', pipeLen);
  await push('水电工程', '排水管改造 PVC', area * 0.35);
  await push('水电工程', '弱电布线（超五类网线）', area * 0.8);
  await push('水电工程', '电线开槽（砖墙）', wireLen * 0.7);
  await push('水电工程', '底盒安装', Math.round(area * 0.55));
  await push('水电工程', '水管试压', 1);
  await push('水电工程', '配电箱安装', isOld ? 1 : 0);
  await push('水电工程', '开关插座安装（五孔）', Math.round(area * 0.45));
  await push('水电工程', '地漏安装', Math.max(2, Math.round(bathArea / 3)));

  /* --- 3. 泥瓦工程 --- */
  await push('泥瓦工程', '地面现拌砂浆找平', totalUsable * 0.9);
  await push('泥瓦工程', '厨卫墙地面防水（聚合物水泥基三遍）', (kitchenArea + bathArea) * 1.75);
  await push('泥瓦工程', '闭水试验', 1);
  await push('泥瓦工程', '墙砖薄贴（300×600）', kitchenArea * 2.2 + bathArea * 3.4);
  await push('泥瓦工程', '地砖薄贴（800×800）', totalUsable * 0.78);
  await push('泥瓦工程', '瓷砖美缝', (kitchenArea * 2.2 + bathArea * 3.4 + totalUsable * 0.78) * 0.85);
  await push('泥瓦工程', '踢脚线安装（瓷砖/石材）', totalUsable * 0.32);
  await push('泥瓦工程', '门槛石/窗台石安装', Math.max(4, Object.keys(spaceMap).length * 0.9));
  await push('泥瓦工程', '厨卫包立管', Math.max(1, Math.round((kitchenArea + bathArea) / 12)));
  await push('泥瓦工程', '墙面拉毛处理', kitchenArea * 2.2 + bathArea * 3.4);
  await push('泥瓦工程', '墙面界面剂（墙固）', totalUsable * 2.4);

  /* --- 4. 木作吊顶 --- */
  const ceilArea = totalUsable * (tier === '简装' ? 0.12 : tier === '中档' ? 0.22 : 0.34);
  if (ceilArea > 3) {
    await push('木作吊顶', '轻钢龙骨石膏板平吊顶', ceilArea * 0.7);
    await push('木作吊顶', '局部吊顶（边顶/灯槽）', totalUsable * 0.28);
  }
  await push('木作吊顶', '铝扣板吊顶（厨卫）', kitchenArea + bathArea);
  await push('木作吊顶', '石膏线安装', totalUsable * 0.42);
  await push('木作吊顶', '木作窗帘盒', Object.keys(spaceMap).filter((n) => !n.includes('卫') && !n.includes('厨')).length * 3.2);
  if (tier === '高档' || tier === '定制') {
    await push('木作吊顶', '电视背景墙基层', 8);
  }

  /* --- 5. 油漆涂装 --- */
  const wallArea = totalUsable * 2.5;
  await push('油漆涂装', '墙面基层修补', wallArea * 0.35);
  await push('油漆涂装', '墙面挂网（防裂）', wallArea * (isOld ? 1 : 0.35));
  await push('油漆涂装', '腻子批刮（三遍）', wallArea);
  await push('油漆涂装', '墙面打磨', wallArea);
  await push('油漆涂装', '墙面刷乳胶漆（底漆一遍+面漆两遍）', wallArea * 0.82);
  await push('油漆涂装', '顶面刷乳胶漆', totalUsable * 0.9);
  await push('油漆涂装', '乳胶漆调色（每色）', tier === '简装' ? 0 : 1);
  await push('油漆涂装', '石膏线刷漆', totalUsable * 0.42);

  /* --- 6. 安装五金 --- */
  await push('安装五金', '筒灯/射灯安装', Math.round(area * 0.28));
  await push('安装五金', '主灯安装', Math.max(3, Object.keys(spaceMap).length - 2));
  await push('安装五金', '开关插座面板安装', Math.round(area * 0.45));
  await push('安装五金', '木地板安装', totalUsable * (tier === '简装' ? 0.45 : 0.62));
  await push('安装五金', '室内门安装', Math.max(2, Object.keys(spaceMap).filter((n) => n.includes('卧') || n.includes('书房')).length + 1));
  await push('安装五金', '窗台石英石安装', Math.max(3, Object.keys(spaceMap).length * 0.7));
  await push('安装五金', '马桶安装', layout.includes('两卫') ? 2 : 1);
  await push('安装五金', '浴室柜/台盆安装', layout.includes('两卫') ? 2 : 1);
  await push('安装五金', '淋浴花洒安装', layout.includes('两卫') ? 2 : 1);
  await push('安装五金', '窗帘杆/轨道安装', Math.max(4, Object.keys(spaceMap).length * 2.4));
  await push('安装五金', '晾衣架安装', 1);
  await push('安装五金', '毛巾架/五金挂件安装', layout.includes('两卫') ? 6 : 4);

  /* --- 7. 定制主材（中高档才含） --- */
  if (pkg && (pkg.code === 'hardcover-all' || tier === '高档' || tier === '定制')) {
    await push('定制主材', '橱柜地柜（含台面）', Math.max(2.5, kitchenArea * 0.55));
    await push('定制主材', '橱柜吊柜', Math.max(1.8, kitchenArea * 0.4));
    await push('定制主材', '衣柜柜体（投影面积）', Math.max(4, totalUsable * 0.075));
    await push('定制主材', '玄关柜/鞋柜', 1.6);
  }

  /* --- 8. 措施与其他 --- */
  await push('措施与其他', '施工管理费', area);
  await push('措施与其他', '竣工开荒保洁', totalUsable);
  await push('措施与其他', '材料运输费', 1);
  await push('措施与其他', '施工水电费', 1);
  if (!isOld) await push('措施与其他', '成品保护费', 1);

  /* --- 假设说明 --- */
  assumptions.push(`按建筑面积 ${area} m²、得房系数 ${(usableRatio(building_type) * 100).toFixed(0)}% 推算套内面积约 ${totalUsable.toFixed(1)} m²`);
  assumptions.push(`墙面展开面积按套内面积 2.5 倍估算，实际以现场实测为准`);
  assumptions.push(`城市价格系数 ${cf.toFixed(2)}（${cityTierName(city)}），档次系数 ${tf.toFixed(2)}（${tier}）`);
  if (isOld) assumptions.push(`识别为${house_type || '老房'}（房龄 ${house_age || '≥10'} 年），已计入拆除、基层加固与水电重排`);
  if (notes) assumptions.push(`已结合现场备注：${String(notes).slice(0, 60)}${String(notes).length > 60 ? '…' : ''}`);
  assumptions.push(`本估算不含家电、活动家具、软装，需另行采购`);

  return { items, assumptions };
}

/** 户型拆解：面积 + 户型 → 各空间面积 */
function breakdownRooms(area, layout, buildingType = '高层') {
  const tpl = LAYOUTS[layout] || guessLayout(layout) || DEFAULT_LAYOUT;
  const usable = (Number(area) || 100) * usableRatio(buildingType);
  const sum = Object.values(tpl).reduce((a, b) => a + b, 0);
  const spaces = {};
  for (const [name, ratio] of Object.entries(tpl)) {
    spaces[name] = Math.round((usable * ratio / sum) * 10) / 10;
  }
  return { layout, usable_area: Math.round(usable * 10) / 10, ratio: usableRatio(buildingType), spaces };
}

/** 从未收录户型名猜测最接近模板 */
function guessLayout(layout) {
  const s = String(layout || '');
  if (s.includes('四室')) return LAYOUTS['四室两厅两卫'];
  if (s.includes('三室')) return s.includes('两卫') ? LAYOUTS['三室两厅两卫'] : LAYOUTS['三室两厅一卫'];
  if (s.includes('两室') || s.includes('两房')) return s.includes('两厅') ? LAYOUTS['两室两厅一卫'] : LAYOUTS['两室一厅一卫'];
  if (s.includes('一室') || s.includes('一房')) return LAYOUTS['一室一厅一卫'];
  return null;
}

/** 完整估算主入口 */
async function estimate(p) {
  const { items, assumptions } = await generateQuoteItems(p);
  const total = Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100;
  const cost = Math.round(items.reduce((s, i) => s + i.cost_price * i.qty, 0) * 100) / 100;
  const area = Number(p.building_area) || 100;

  // 按分组汇总
  const byGroup = {};
  for (const it of items) {
    byGroup[it.group_name] = (byGroup[it.group_name] || 0) + it.amount;
  }
  const breakdown = Object.entries(byGroup)
    .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100, ratio: total ? Math.round(amount / total * 1000) / 10 : 0 }))
    .sort((a, b) => b.amount - a.amount);

  // 单方造价校验（与经验区间比对，偏差过大时提示）
  const perSqm = Math.round(total / area);
  const tf = TIERS[p.tier] || TIERS['中档'];
  const cf = cityFactor(p.city);
  const expect = [Math.round(tf.range[0] * cf), Math.round(tf.range[1] * cf)];
  const validatedTotal = perSqm < expect[0] * 0.7 || perSqm > expect[1] * 1.35
    ? Math.round(expect[0] * area * 1.0)
    : total;

  return {
    total: validatedTotal,
    raw_total: total,
    cost_total: cost,
    gross_margin: validatedTotal ? Math.round((validatedTotal - cost) / validatedTotal * 1000) / 10 : 0,
    per_sqm: Math.round(validatedTotal / area),
    expect_range: expect,
    adjusted: validatedTotal !== total,
    breakdown,
    items,
    assumptions,
    currency: 'CNY',
    needs_review: true,
  };
}

/* =========================================================
   三、15 项 AI 功能实现
   ========================================================= */

const FEATURES = {
  /** 智能估算：生成报价草稿 */
  'smart-estimate': async (p) => {
    const pkg = p.package_code ? PACKAGES.find((x) => x.code === p.package_code) : null;
    const res = await estimate({ ...p, pkg });
    return {
      ...res,
      summary: `按 ${p.city || '当地'} ${p.building_area}m² ${p.layout || ''} ${p.tier || '中档'} 口径，综合空间清单与工艺库生成，共 ${res.items.length} 条明细。`,
    };
  },

  'full-estimate': async (p) => FEATURES['smart-estimate'](p),

  'estimate-cost': async (p) => {
    const res = await estimate(p);
    return {
      total: res.total,
      per_sqm: res.per_sqm,
      range: [Math.round(res.total * 0.88), Math.round(res.total * 1.15)],
      breakdown: res.breakdown,
      assumptions: res.assumptions,
    };
  },

  /** 户型智能拆解 */
  'room-breakdown': async (p) => {
    const area = Number(p.building_area) || 100;
    const r = breakdownRooms(area, p.layout, p.building_type);
    return {
      layout: r.layout,
      usable_area: r.usable_area,
      spaces: Object.entries(r.spaces).map(([name, area]) => ({ name, area, type: spaceType(name) })),
      assumptions: [
        `得房系数取 ${(r.ratio * 100).toFixed(0)}%（${p.building_type || '高层'}），实际以房产证套内面积为准`,
        '各空间比例来自同户型大数据均值，异形户型需现场复核',
      ],
    };
  },

  /** 装修档次匹配 */
  'tier-matching': async (p) => {
    const area = Number(p.building_area) || 100;
    const cf = cityFactor(p.city);
    const list = Object.entries(TIERS).map(([key, t]) => {
      const low = Math.round(t.range[0] * cf * area);
      const high = Math.round(t.range[1] * cf * area);
      return {
        tier: key,
        label: t.label,
        total_low: low,
        total_high: high,
        per_sqm: [Math.round(t.range[0] * cf), Math.round(t.range[1] * cf)],
        mid: Math.round((low + high) / 2),
      };
    });
    const budget = Number(p.budget) || 0;
    const recommend = budget
      ? list.find((x) => budget >= x.total_low * 0.9 && budget <= x.total_high * 1.1) || list[1]
      : list[1];
    return {
      tiers: list,
      recommended: recommend.tier,
      reason: budget
        ? `预算 ${budget.toLocaleString()} 元最接近「${recommend.label}」区间`
        : '未填预算，默认推荐中档（品质平衡）',
    };
  },

  /** 预算反推 */
  'budget-reverse': async (p) => {
    const budget = Number(p.budget) || 0;
    const area = Number(p.building_area) || 100;
    const cf = cityFactor(p.city);
    const tf = TIERS[p.tier] || TIERS['中档'];
    const need = Math.round((tf.range[0] + tf.range[1]) / 2 * cf * area);
    const perSqm = Math.round(budget / area);
    const feasible = budget >= need * 0.85;

    // 分项资金分配（经验比例）
    const alloc = [
      { name: '基础工程（拆除/水电/防水）', ratio: 0.26 },
      { name: '泥瓦工程（找平/铺贴）', ratio: 0.19 },
      { name: '木作吊顶', ratio: 0.13 },
      { name: '油漆涂装', ratio: 0.11 },
      { name: '厨卫主材与洁具', ratio: 0.14 },
      { name: '定制柜体', ratio: 0.1 },
      { name: '管理费与预备金', ratio: 0.07 },
    ].map((x) => ({ ...x, amount: Math.round(budget * x.ratio) }));

    return {
      budget,
      area,
      per_sqm: perSqm,
      expected_total: need,
      feasible,
      verdict: feasible ? '充裕' : perSqm >= tf.range[0] * cf * 0.75 ? '偏紧' : '不足',
      advice: feasible
        ? `预算可覆盖${p.tier || '中档'}装修，建议预留 ${Math.round(budget * 0.08)} 元作为增项预备金`
        : `按${p.tier || '中档'}口径需约 ${need.toLocaleString()} 元，缺口约 ${(need - budget).toLocaleString()} 元，建议下调档次或压缩定制项`,
      allocation: alloc,
    };
  },

  /** 增项风险预测 */
  'risk-report': async (p) => {
    const area = Number(p.building_area) || 100;
    const isOld = p.house_type === '老房' || Number(p.house_age) >= 10;
    const cf = cityFactor(p.city);
    const risks = [];

    if (isOld) {
      risks.push({ item: '墙体基层空鼓/开裂处理', prob: '高', low: Math.round(area * 28 * cf), high: Math.round(area * 65 * cf), why: '房龄较长，铲墙后常见空鼓需整体找补' });
      risks.push({ item: '水电管线老化需全屋重排', prob: '高', low: Math.round(area * 85 * cf), high: Math.round(area * 150 * cf), why: '老房原管线多不满足现行负荷' });
      risks.push({ item: '卫生间沉箱与二次排水改造', prob: '中', low: Math.round(area * 18 * cf), high: Math.round(area * 42 * cf), why: '老房沉箱易积水，需重做排水' });
    }
    if (!p.has_elevator && Number(p.floor) > 3) {
      risks.push({ item: '无电梯上楼搬运费', prob: '确定', low: Math.round((Number(p.floor) - 3) * 60), high: Math.round((Number(p.floor) - 3) * 120), why: `位于 ${p.floor} 层且无电梯` });
    }
    if (Number(p.floor) >= 20) {
      risks.push({ item: '高空作业与吊装费', prob: '中', low: 680, high: 1800, why: '高层材料吊装与大件上楼' });
    }
    risks.push({ item: '厨卫防水加高与闭水复测', prob: '中', low: Math.round(area * 12 * cf), high: Math.round(area * 30 * cf), why: '业主要求加高防水或复测不通过' });
    risks.push({ item: '瓷砖/地板损耗补货', prob: '中', low: Math.round(area * 8 * cf), high: Math.round(area * 20 * cf), why: '异形空间与切割损耗' });
    risks.push({ item: '水电点位增补', prob: '中', low: Math.round(area * 15 * cf), high: Math.round(area * 38 * cf), why: '施工中业主临时增加插座/灯位' });
    risks.push({ item: '橱柜/柜体尺寸调整', prob: '低', low: Math.round(area * 10 * cf), high: Math.round(area * 25 * cf), why: '现场尺寸与图纸偏差' });
    if (/拆|改|承重/.test(String(p.notes || ''))) {
      risks.push({ item: '拆改结构加固（需专业资质）', prob: '中', low: 1800, high: 6800, why: '备注中提及拆改，可能涉及结构处理' });
    }

    const low = risks.reduce((s, r) => s + r.low, 0);
    const high = risks.reduce((s, r) => s + r.high, 0);
    return {
      risks,
      extra_low: low,
      extra_high: high,
      ratio_low: Math.round(low / Math.max(1, (Number(p.budget) || area * 1100 * cf)) * 1000) / 10,
      ratio_high: Math.round(high / Math.max(1, (Number(p.budget) || area * 1100 * cf)) * 1000) / 10,
      advice: `建议预留 ${Math.round((low + high) / 2).toLocaleString()} 元（约占预算 ${Math.round((low + high) / 2 / Math.max(1, (Number(p.budget) || area * 1100 * cf)) * 100)}%）作为增项预备金，并在合同中约定增项确认流程`,
    };
  },

  /** 自然语言加项 */
  'nl-to-items': async (p) => {
    const text = String(p.text || '');
    const city = p.city;
    const cf = cityFactor(city);
    const all = await db.library.all();
    const items = [];

    // 1) 直接命中工艺库关键词
    for (const lib of all) {
      const name = lib.name.replace(/[（(].*?[)）]/g, '');
      if (name.length >= 2 && text.includes(name)) {
        items.push({ name: lib.name, unit: lib.unit, qty: extractQty(text, lib.unit) || 1, unit_price: Math.round(lib.price * cf * 100) / 100, cost_price: lib.cost, group_name: lib.group_name, craft: lib.craft, matched: 'exact' });
      }
    }
    // 2) 标签模糊匹配
    if (!items.length) {
      const words = text.replace(/[，,。.;；、]/g, ' ').split(/\s+/).filter((w) => w.length >= 2);
      for (const lib of all) {
        const hit = (lib.tags || []).some((t) => words.some((w) => w.includes(t) || t.includes(w)));
        if (hit) {
          items.push({ name: lib.name, unit: lib.unit, qty: extractQty(text, lib.unit) || 1, unit_price: Math.round(lib.price * cf * 100) / 100, cost_price: lib.cost, group_name: lib.group_name, craft: lib.craft, matched: 'tag' });
        }
      }
    }
    const uniq = [];
    const seen = new Set();
    for (const it of items) { if (!seen.has(it.name)) { seen.add(it.name); uniq.push(it); } }

    return {
      items: uniq.slice(0, 12),
      assumptions: uniq.length ? ['工程量按描述中的数字提取，未提及的按 1 单位计', '价格取工艺库基准价 × 城市系数'] : ['未匹配到工艺库条目，建议手动选择'],
      total: Math.round(uniq.reduce((s, i) => s + i.unit_price * i.qty, 0) * 100) / 100,
    };
  },

  /** 单点价格建议 */
  'price-suggestion': async (p) => {
    const cf = cityFactor(p.city);
    const lib = await db.library.findOne((x) => x.name === p.item_name) ||
      await db.library.findOne((x) => (x.tags || []).some((t) => String(p.item_name || '').includes(t)));
    const base = lib ? lib.price : Number(p.current_price) || 50;
    return {
      item_name: p.item_name,
      unit: lib ? lib.unit : p.unit || '项',
      city: p.city || '全国参考',
      suggested_low: Math.round(base * cf * 0.88 * 100) / 100,
      suggested_mid: Math.round(base * cf * 100) / 100,
      suggested_high: Math.round(base * cf * 1.18 * 100) / 100,
      current_price: Number(p.current_price) || null,
      verdict: !p.current_price ? 'unknown'
        : Number(p.current_price) > base * cf * 1.18 ? 'high'
          : Number(p.current_price) < base * cf * 0.8 ? 'low' : 'ok',
      basis: lib ? `工艺库基准价 ${lib.price} 元 × ${cityTierName(p.city)}系数 ${cf.toFixed(2)}` : '未收录工艺，按输入价 ±15% 给出区间',
      craft: lib ? lib.craft : '',
    };
  },

  /** 相似项推荐 */
  'item-suggestion': async (p) => {
    const name = String(p.item_name || '');
    const lib = await db.library.findOne((x) => x.name === name);
    if (!lib) return { suggestions: [] };
    const cf = cityFactor(p.city);
    const allItems = await db.library.all();
    const sug = allItems
      .filter((x) => x.group_key === lib.group_key && x.id !== lib.id)
      .map((x) => ({ ...x, score: similarity(name, x.name) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((x) => ({ name: x.name, unit: x.unit, price: Math.round(x.price * cf * 100) / 100, craft: x.craft, group_name: x.group_name }));
    return { suggestions: sug };
  },

  /** 整张报价复核 */
  'quote-review': async (p) => {
    const items = p.items || [];
    const total = items.reduce((s, i) => s + (Number(i.unit_price) || 0) * (Number(i.qty) || 0), 0);
    const cost = items.reduce((s, i) => s + (Number(i.cost_price) || 0) * (Number(i.qty) || 0), 0);
    const margin = total ? (total - cost) / total : 0;

    const groups = {};
    items.forEach((i) => { groups[i.group_name || '未分类'] = (groups[i.group_name || '未分类'] || 0) + (Number(i.unit_price) || 0) * (Number(i.qty) || 0); });
    const missing = [];
    ['水电工程', '泥瓦工程', '油漆涂装', '安装五金'].forEach((g) => { if (!groups[g]) missing.push({ type: '缺分类', detail: `缺少「${g}」相关条目` }); });
    if (!items.some((i) => /防水/.test(i.name || ''))) missing.push({ type: '缺关键工序', detail: '未发现厨卫防水条目' });
    if (!items.some((i) => /闭水|试压/.test(i.name || ''))) missing.push({ type: '缺验收项', detail: '未发现闭水试验 / 打压试验' });
    if (!items.some((i) => /保护|清运|保洁/.test(i.name || ''))) missing.push({ type: '缺措施费', detail: '未发现成品保护 / 垃圾清运 / 保洁' });

    const allLibs = await db.library.all();
    const libMap = {};
    for (const lib of allLibs) libMap[lib.name] = lib;

    const anomalies = items
      .filter((i) => {
        const lib = libMap[i.name];
        if (!lib) return false;
        const price = Number(i.unit_price) || 0;
        return price > lib.price * 1.35 || price < lib.price * 0.62;
      })
      .map((i) => {
        const lib = libMap[i.name];
        return { name: i.name, current: i.unit_price, reference: lib.price, level: (Number(i.unit_price) || 0) > lib.price * 1.35 ? 'high' : 'low' };
      });

    let score = 100;
    score -= missing.length * 8;
    score -= anomalies.length * 5;
    if (margin < 0.15) score -= 15;
    if (margin > 0.45) score -= 8;
    score = Math.max(40, Math.min(100, score));

    return {
      score,
      total: Math.round(total * 100) / 100,
      cost_total: Math.round(cost * 100) / 100,
      margin_rate: Math.round(margin * 1000) / 10,
      margin_verdict: margin < 0.15 ? '偏低，注意利润空间' : margin > 0.45 ? '偏高，留意客户议价' : '在合理区间',
      item_count: items.length,
      group_distribution: Object.entries(groups).map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100, ratio: total ? Math.round(amount / total * 1000) / 10 : 0 })).sort((a, b) => b.amount - a.amount),
      missing,
      anomalies,
      suggestions: [
        ...(missing.length ? [`补充 ${missing.length} 项疑似漏项，降低后期补单风险`] : ['未发现明显漏项']),
        ...(anomalies.length ? [`${anomalies.length} 项单价偏离基准，建议复核`] : ['未发现明显单价异常']),
        margin < 0.15 ? '毛利偏低，建议复核成本或调整报价结构' : '毛利结构健康',
      ],
      client_explain: `本报价共 ${items.length} 项，按${Object.keys(groups).length}个工程分类组织，覆盖了主要工序${missing.length ? '，部分项目需补充确认' : '，工序完整'}。`,
    };
  },

  /** 漏项检查 */
  'validate-quote': async (p) => {
    const r = await FEATURES['quote-review'](p);
    return { missing: r.missing, anomalies: r.anomalies, score: r.score, summary: r.suggestions };
  },

  /** 客户话术润色 */
  'customer-copy': async (p) => {
    const lines = String(p.items_text || p.text || '').split(/\n+/).map((x) => x.trim()).filter(Boolean);
    const project = p.project_name ? `${p.project_name}项目` : '本工程';
    const city = p.city ? `${p.city}地区` : '当地';

    const DICT = [
      [/铲墙|墙皮/, '把原来的旧墙皮全部铲掉，重新做基层，墙面贴砖和刷漆才不会空鼓脱落'],
      [/挂网/, '在接缝和开槽位置加挂抗裂网，防止后期墙面开裂'],
      [/腻子/, '墙面批刮三遍腻子并打磨平整，保证乳胶漆效果细腻'],
      [/乳胶漆/, '采用底漆一遍、面漆两遍的标准工艺，颜色均匀、耐擦洗'],
      [/防水/, '厨卫防水做到墙面返高 1.8 米，做完蓄水 48 小时闭水试验，验收合格才进入下一道'],
      [/闭水/, '做完防水会做 48 小时蓄水试验，确认无渗漏再铺砖'],
      [/找平/, '地面做找平处理，保证铺地板或瓷砖后平整不起翘'],
      [/薄贴|贴砖|铺贴/, '瓷砖采用薄贴工艺，空鼓率低、表面平整美观'],
      [/美缝/, '砖缝做美缝处理，防霉易清洁，整体更美观'],
      [/PPR|给水管/, '给水管采用 PPR 热熔连接，完工打压试压，杜绝接头渗漏'],
      [/排水|PVC/, '排水管按标准坡度施工，保证排水顺畅不返水'],
      [/电线|布线|强电/, '强弱电分离布线、管内穿线，方便后期检修和升级'],
      [/开槽/, '墙面开槽走管，完工后用砂浆封平，不破坏墙体结构'],
      [/包立管/, '厨卫立管做包管处理，隔音又美观'],
      [/吊顶/, '吊顶采用轻钢龙骨，稳固不变形，配合灯槽造型提升层次感'],
      [/石膏线/, '顶面四周走石膏线，线条利落，收口更精致'],
      [/铝扣板/, '厨卫用铝扣板吊顶，防潮易拆洗，检修方便'],
      [/门|门套/, '室内门含门套与五金，开合顺滑、隔音达标'],
      [/地板/, '木地板铺设含防潮垫，脚感舒适且不易起拱'],
      [/踢脚线/, '踢脚线收口处理，保护墙角又美观'],
      [/柜|橱柜|衣柜/, '柜体按现场尺寸定制，空间利用率高，板材环保达标'],
      [/开关|插座/, '开关插座按生活动线布置，数量充足，避免后期乱拉插线板'],
      [/灯具|筒灯|射灯/, '灯光按功能分区布置，主照明与氛围光结合'],
      [/拆除/, '旧装修按规范拆除，做好成品保护，减少对邻里的干扰'],
      [/清运|垃圾/, '建筑垃圾日产日清，装袋运至小区指定点，保持现场整洁'],
      [/保洁/, '完工后做一次开荒保洁，交付即可入住'],
      [/管理费/, '含全程项目管理，材料进场、工序验收、工期协调专人负责'],
      [/智能/, '预留智能家居线路与底盒，后期升级不用再开墙'],
      [/地暖/, '地暖盘管按房间分路控制，配分水器与温控，节能舒适'],
      [/新风|中央空调/, '设备吊装与管路保温按规范施工，减少后期结露与噪音'],
      [/背景墙/, '背景墙做基层与造型处理，成为客厅视觉焦点'],
      [/阳台|封窗/, '封窗采用断桥铝，隔音隔热、密封防水'],
    ];

    const copy = lines.map((line) => {
      for (const [re, txt] of DICT) {
        if (re.test(line)) return txt;
      }
      return `本项目包含：${line}，由专业班组按标准工艺施工，验收合格后交付`;
    });

    return {
      project_name: p.project_name || '',
      city: p.city || '',
      intro: `${project}报价按${city}现行人工材料行情编制，共 ${lines.length} 项主要工程。以下用大白话说明每一项具体做什么：`,
      lines: copy,
      closing: '以上报价为书面清单，施工中不额外增项；如需调整，我们会先出变更单与您确认后再执行。',
      assumptions: ['话术按工艺通行做法生成，涉及具体品牌型号请人工替换', '价格与承诺以双方确认的正式报价单为准'],
    };
  },

  /** 价格库体检：按「同分类 + 同单位」比较，避免跨量级误报 */
  'price-library-audit': async (p) => {
    const items = await scopeItems(p.org_id);
    const issues = [];

    // 1) 离群价：只在同分类且同单位的组内比较，且组内至少 5 条才判定
    const buckets = {};
    items.forEach((i) => {
      const k = `${i.group_key || i.group_name}__${i.unit}`;
      (buckets[k] = buckets[k] || []).push(i);
    });
    for (const list of Object.values(buckets)) {
      if (list.length < 5) continue;
      const prices = list.map((x) => x.price).sort((a, b) => a - b);
      const mid = prices[Math.floor(prices.length / 2)] || 1;
      list.forEach((x) => {
        if (x.price > mid * 5) {
          issues.push({ type: '离群高价', name: x.name, price: x.price, ref: mid, advice: `同组（${x.unit}）中位价 ${mid}，该项偏高，确认是否含主材或单位有误` });
        } else if (x.price < mid / 5) {
          issues.push({ type: '离群低价', name: x.name, price: x.price, ref: mid, advice: `同组（${x.unit}）中位价 ${mid}，该项偏低，确认单位与工序是否写全` });
        }
      });
    }

    // 2) 结构性错误：全量检查
    items.forEach((x) => {
      if (x.cost && x.cost >= x.price) {
        issues.push({ type: '逻辑矛盾', name: x.name, price: x.price, cost: x.cost, advice: '成本价不低于售价，会导致毛利为负' });
      }
      if (!x.craft) {
        issues.push({ type: '缺说明', name: x.name, advice: '缺少工艺说明，客户报价页将无施工依据' });
      }
      if (x.price <= 0) {
        issues.push({ type: '缺价格', name: x.name, advice: '未填参考售价，估算时会取默认值' });
      }
    });

    const hardCount = issues.filter((i) => ['逻辑矛盾', '缺说明', '缺价格'].includes(i.type)).length;
    return {
      total: items.length,
      issue_count: issues.length,
      hard_count: hardCount,
      issues: issues.slice(0, 40),
      health_score: Math.max(60, 100 - Math.round(hardCount / Math.max(1, items.length) * 200) - Math.round(issues.length / Math.max(1, items.length) * 30)),
      summary: issues.length
        ? `共检查 ${items.length} 条工艺，发现 ${issues.length} 处待复核项（其中 ${hardCount} 处为结构性问题）`
        : `共检查 ${items.length} 条工艺，未发现明显异常`,
    };
  },

  /** 城市价格校准 */
  'city-calibration': async (p) => {
    const target = p.target_city || '';
    const factor = cityFactor(target);
    const tierName = cityTierName(target);
    const items = await scopeItems(p.org_id);
    const sample = items.slice(0, 60).map((x) => ({
      name: x.name,
      unit: x.unit,
      baseline_price: x.price,
      calibrated_price: Math.round(x.price * factor * 100) / 100,
      delta: Math.round(x.price * (factor - 1) * 100) / 100,
    }));
    return {
      target_city: target,
      baseline_city: '全国参考',
      factor,
      tier: tierName,
      affected_count: items.length,
      sample,
      summary: `${target || '目标城市'}属${tierName}，建议在基准价上整体调整 ${((factor - 1) * 100).toFixed(0)}%，共影响 ${items.length} 条工艺`,
      note: '校准只影响本组织报价，不修改系统基础工艺库；建议结合当地实际询价复核',
    };
  },

  /** 审计异常预警 */
  'audit-risk': async (p) => {
    const logs = (await db.ai_logs.all()).slice(-500);
    const byUser = {};
    logs.forEach((l) => { byUser[l.user_id] = (byUser[l.user_id] || 0) + 1; });
    const alerts = [];
    const allUsers = await db.users.all();
    const userMap = {};
    allUsers.forEach((u) => { userMap[u.id] = u; });
    Object.entries(byUser).forEach(([uid, count]) => {
      if (count > 60) {
        const u = userMap[uid];
        alerts.push({ level: '中', type: '高频调用', user: u ? u.name || u.phone : uid, count, advice: '确认是否为批量测试或接口抓取' });
      }
    });
    const failed = logs.filter((l) => l.status === 'failed').length;
    if (logs.length && failed / logs.length > 0.3) {
      alerts.push({ level: '高', type: '失败率异常', detail: `近期 ${logs.length} 次调用中失败 ${failed} 次`, advice: '检查模型服务与配额配置' });
    }
    return {
      total_calls: logs.length,
      failed_calls: failed,
      alerts,
      summary: alerts.length ? `发现 ${alerts.length} 条异常预警` : '未发现明显异常操作',
    };
  },

  /** 模板 AI 生成 */
  'template-generate': async (p) => {
    const r = breakdownRooms(p.building_area || 100, p.layout || '三室两厅两卫', p.building_type);
    const spaces = Object.entries(r.spaces).map(([name, area]) => ({ name, area, type: spaceType(name) }));
    return {
      name: p.name || `${p.layout || '标准户型'}-${p.building_area || 100}㎡`,
      layout: r.layout,
      building_area: p.building_area,
      building_type: p.building_type || '高层',
      house_type: p.house_type || '新房',
      city: p.city || '',
      spaces,
      note: `按${p.layout || '标准户型'}与 ${p.building_area}m² 自动拆解出 ${spaces.length} 个空间，可直接保存为模板复用`,
    };
  },
};

/* =========================================================
   四、工具函数
   ========================================================= */

function spaceType(name) {
  if (name.includes('厨')) return 'kitchen';
  if (name.includes('卫')) return 'bath';
  if (name.includes('卧') || name.includes('房')) return 'bedroom';
  if (name.includes('厅')) return 'living';
  if (name.includes('阳台')) return 'balcony';
  if (name.includes('玄关') || name.includes('过道')) return 'hall';
  return 'other';
}

function extractQty(text, unit) {
  const m = String(text).match(/(\d+(?:\.\d+)?)\s*(m²|㎡|m|米|平方|平方米|个|套|项|处|根|樘|块|台|件|扇|车|层|m³)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!isFinite(n) || n <= 0) return null;
  if (/平方|m²|㎡|m$/.test(m[2]) && unit === 'm²') return n;
  return n;
}

function similarity(a, b) {
  const setA = new Set(a.split(''));
  const setB = new Set(b.split(''));
  let inter = 0;
  setA.forEach((c) => { if (setB.has(c)) inter += 1; });
  return inter / Math.max(setA.size, setB.size);
}

/* =========================================================
   五、可插拔大模型 Provider
   ========================================================= */

const provider = {
  enabled: !!(process.env.HQ_AI_API_KEY && process.env.HQ_AI_BASE_URL),
  name: process.env.HQ_AI_MODEL || 'local-rule-engine',

  async chat(messages, opts = {}) {
    if (!this.enabled) throw new Error('PROVIDER_DISABLED');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs || 90000);
    try {
      const res = await fetch(`${process.env.HQ_AI_BASE_URL}/chat/completions`, {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.HQ_AI_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.HQ_AI_MODEL || 'deepseek-chat',
          messages,
          temperature: opts.temperature ?? 0.3,
          response_format: opts.json ? { type: 'json_object' } : undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    } finally {
      clearTimeout(timer);
    }
  },
};

/**
 * 统一调用入口：优先大模型，失败回落本地引擎
 */
async function run(feature, payload) {
  const fn = FEATURES[feature];
  if (!fn) throw new Error(`未知 AI 功能：${feature}`);

  let result;
  let engine = 'local';

  if (provider.enabled) {
    try {
      const sys = `你是家装造价与报价专家。请严格按用户要求的 JSON 结构返回结果，不要输出多余文字。城市：${payload.city || '未指定'}。`;
      const text = await provider.chat([
        { role: 'system', content: sys },
        { role: 'user', content: `功能：${feature}\n参数：${JSON.stringify(payload)}` },
      ], { json: true, timeoutMs: 90000 });
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') {
        result = parsed;
        engine = provider.name;
      } else throw new Error('PARSE_FAILED');
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('AI 处理时间较长，本次已停止等待。请稍后重试，或减少内容后再试。');
      result = await fn(payload);
      engine = 'local(fallback)';
    }
  } else {
    result = await fn(payload);
  }

  return { ...result, _engine: engine, _feature: feature, _at: new Date().toISOString() };
}

function costOf(feature) { return FEATURE_COSTS[feature] ?? 5; }

module.exports = {
  run, costOf, FEATURES, FEATURE_COSTS, PACKAGES, TIERS, LAYOUTS, CITY_TIERS,
  cityFactor, cityTierName, breakdownRooms, estimate, generateQuoteItems, spaceType,
  libItem, libPrice, libCost, libUnit, scopeItems,
  provider,
};
