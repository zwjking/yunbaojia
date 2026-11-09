/**
 * 会员套餐 / 积分充值 / 出单次数 / 订单 / 发票 / 退款
 * 本地部署无支付网关，采用"模拟支付"：下单 → 标记已支付 → 即时到账
 */
const { db, uid, now } = require('../lib/db');
const A = require('../lib/auth');
const { ok, fail } = require('../lib/http');

const PLANS = [
  {
    key: 'free', name: '免费版', tag: '体验入门', price: '¥0', cycle: '永久免费',
    credits: 30,
    monthly: 0, yearly: 0,
    note: '随便新建、编辑、在线预览报价；出成品（导出 / 分享）时再按次购买。',
    cta: '免费开始', borderColor: '#94a3b8', glowColor: 'rgba(148,163,184,0.3)',
    aiQuota: { label: '赠送 30 积分 / 月', detail: '约 3 次智能造价试用，可另购积分包' },
    features: ['1 个账号', '不限新建 / 编辑报价', '在线预览报价', '示例工艺库与户型模板可查看', '出 PDF/Excel、分享给客户需购买出单次数'],
  },
  {
    key: 'personal', name: '普通版（按次）', tag: '按需出单', price: '¥9.9', cycle: '/ 1 次出单',
    credits: 0,
    monthly: 0, yearly: 0,
    note: '9.9 元买 1 次，1 次 = 出一份报价（导出/出单）；同一份解锁后反复导出不重复扣次。',
    cta: '购买出单次数', borderColor: '#1565f5', glowColor: 'rgba(21,101,245,0.22)',
    aiQuota: { label: 'AI 按积分计费', detail: '智能造价按积分扣，单独购买积分包，与出单次数互不影响' },
    features: ['不限新建 / 编辑报价', 'PDF / Excel 导出', '客户报价页分享', '客户档案管理', '同一份解锁后反复导出免费', '用完再买、不订阅不扣月费'],
  },
  {
    key: 'plus', name: 'Plus 版', tag: '推荐 · 不限次', price: '¥38', cycle: '/ 月',
    credits: 1000,
    monthly: 38, yearlyMonthly: 32, yearlyTotal: 388,
    note: '包月不限次导出，AI 全程协助、漏项提醒、价格风险预警，高频出单更划算。',
    cta: '开通 Plus 版', highlight: true, borderColor: '#7c3aed', glowColor: 'rgba(124,58,237,0.28)',
    aiQuota: { label: '赠送 1000 积分 / 月', detail: '约 100 次智能造价，AI 全程协助' },
    features: ['1 个账号', '不限次导出 / 出单', '不限报价项目', '个人报价模板 10 套', 'AI 协助填写项目', '完整漏项提醒 + 价格风险提示', 'Excel / PDF 导出', '客户资料管理'],
  },
  {
    key: 'enterprise', name: '企业版', tag: '团队使用', price: '定制', cycle: '按需报价',
    credits: 5000,
    monthly: 0, yearly: 0,
    note: '席位 / 价格库 / 审批流按团队规模定制，价格一对一沟通。',
    cta: '联系开通', borderColor: '#0891b2', glowColor: 'rgba(8,145,178,0.22)',
    aiQuota: { label: '赠送 5000 积分 / 月', detail: '约 500 次智能造价，人均 100，团队共享额度' },
    features: ['5 个账号起', '不限报价项目', '企业统一价格库', '企业报价模板库', '老板审批报价', '员工角色权限', '成本与毛利可见', '红黄绿蓝风险预警', '团队客户资料管理', '专属开通支持'],
  },
];

const CREDIT_PACKS = [
  { code: 'c100', name: '体验包', credits: 100, price: 9.9, tag: '', bonus: 0 },
  { code: 'c500', name: '常用包', credits: 500, price: 39, tag: '省 22%', bonus: 0 },
  { code: 'c1200', name: '进阶包', credits: 1200, price: 88, tag: '最受欢迎', bonus: 50 },
  { code: 'c3000', name: '专业包', credits: 3000, price: 198, tag: '省 34%', bonus: 200 },
  { code: 'c8000', name: '团队包', credits: 8000, price: 468, tag: '省 42%', bonus: 800 },
];

const EXPORT_PACKS = [
  { code: 'e1', name: '单次出单', count: 1, price: 9.9, tag: '' },
  { code: 'e5', name: '5 次出单', count: 5, price: 45, tag: '省 9%' },
  { code: 'e20', name: '20 次出单', count: 20, price: 168, tag: '省 15%' },
];

module.exports = function register(api) {

  /* ---------------- 套餐 ---------------- */
  api.get('/plans', async (req, res) => ok(res, PLANS));
  api.get('/subscriptions/plans', async (req, res) => ok(res, PLANS));

  api.get('/subscriptions/orders', async (req, res) => {
    const user = await A.requireAuth(req, res);
    if (!user) return;
    ok(res, db.orders.find((o) => o.org_id === user.org_id && o.kind === 'subscription')
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))));
  });

  api.post('/subscriptions/purchase', async (req, res, body) => {
    const user = await A.requireAuth(req, res);
    if (!user) return;
    const plan = PLANS.find((p) => p.key === body.plan);
    if (!plan) return fail(res, '套餐不存在。');
    const cycle = body.cycle === 'yearly' ? 'yearly' : 'monthly';
    const amount = cycle === 'yearly' ? (plan.yearlyTotal || plan.monthly * 12) : plan.monthly;
    if (!amount) return fail(res, '该套餐不支持在线购买，请联系我们开通。');
    const order = await db.orders.insert({
      id: uid(), org_id: user.org_id, user_id: user.id, kind: 'subscription',
      order_no: genOrderNo('SUB'), plan: plan.key, plan_name: plan.name, cycle,
      amount, status: 'pending', created_at: now(),
    });
    ok(res, order, 201);
  });

  /* 结算：写用户套餐 + 有效期 + 赠送积分，并同步团队套餐。
   * 【坑】原实现取 PLANS[].monthly_credits_bonus —— 该字段从来不存在，
   *       NaN || 0 得 0，于是用户走一次在线开通积分会被清零。
   *       现在改用 PLANS[].credits（与 auth.js 的注册/月度发放同源）。 */
  const settleSubscription = async (order) => {
    const months = order.cycle === 'yearly' ? 12 : 1;
    const expires = new Date(Date.now() + months * 30 * 86400000).toISOString();
    const curUser = await db.users.findOne({ id: order.user_id });
    if (!curUser) return false;
    const cur = curUser.credits || 0;
    const grant = (PLANS.find((p) => p.key === order.plan) || {}).credits || 0;
    const okUser = await db.users.update(order.user_id, {
      plan: order.plan,
      plan_expires_at: expires,
      credits: cur + grant,
      credits_month: new Date().toISOString().slice(0, 7),
    });
    const org = await db.orgs.findOne({ id: order.org_id });
    const okOrg = org ? await db.orgs.update(org.id, { plan: order.plan }) : true;
    return !!okUser && !!okOrg;
  };

  api.post('/subscriptions/orders/:id/pay', async (req, res, body, params) => {
    const user = await A.requireAuth(req, res);
    if (!user) return;
    const order = await db.orders.findOne({ id: params.id });
    if (!order || order.org_id !== user.org_id) return fail(res, '订单不存在。', 404);
    await db.orders.update(order.id, { status: 'paid', paid_at: now(), pay_method: body.method || '模拟支付' });
    await settleSubscription(order);
    ok(res, { ...db.orders.findOne({ id: order.id }), message: '支付成功，套餐已生效。' });
  });

  api.post('/subscriptions/orders/:id/cancel', async (req, res, body, params) => {
    const user = await A.requireAuth(req, res);
    if (!user) return;
    const order = await db.orders.findOne({ id: params.id });
    if (!order || order.org_id !== user.org_id) return fail(res, '订单不存在。', 404);
    ok(res, db.orders.update(order.id, { status: 'cancelled' }));
  });

  /* ---------------- 积分 ---------------- */
  api.get('/ai-credits/packs', async (req, res) => ok(res, CREDIT_PACKS));

  api.get('/ai-credits/balance', async (req, res) => {
    const user = await A.requireAuth(req, res);
    if (!user) return;
    ok(res, { credits: user.credits || 0, unlimited: !!user.is_platform_admin, month: user.credits_month });
  });

  api.get('/ai-credits/purchases', async (req, res) => {
    const user = await A.requireAuth(req, res);
    if (!user) return;
    ok(res, db.orders.find((o) => o.org_id === user.org_id && o.kind === 'credits')
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))));
  });

  api.post('/ai-credits/purchases', async (req, res, body) => {
    const user = await A.requireAuth(req, res);
    if (!user) return;
    const pack = CREDIT_PACKS.find((p) => p.code === body.pack_code);
    if (!pack) return fail(res, '充值包不存在。');
    const order = await db.orders.insert({
      id: uid(), org_id: user.org_id, user_id: user.id, kind: 'credits',
      order_no: genOrderNo('CRD'), pack_code: pack.code, pack_name: pack.name,
      call_count: pack.credits + (pack.bonus || 0), amount: pack.price,
      status: 'pending', created_at: now(),
    });
    ok(res, order, 201);
  });

  api.post('/ai-credits/purchases/:id/pay', async (req, res, body, params) => {
    const user = await A.requireAuth(req, res);
    if (!user) return;
    const order = await db.orders.findOne({ id: params.id });
    if (!order || order.org_id !== user.org_id) return fail(res, '订单不存在。', 404);
    db.orders.update(order.id, { status: 'paid', paid_at: now(), pay_method: body.method || '模拟支付' });
    db.users.update(user.id, { credits: (user.credits || 0) + (order.call_count || 0) });
    ok(res, { ...db.orders.findOne({ id: order.id }), message: `支付成功！${order.call_count} 积分已到账。` });
  });

  api.post('/ai-credits/purchases/:id/cancel', async (req, res, body, params) => {
    const user = await A.requireAuth(req, res);
    if (!user) return;
    ok(res, db.orders.update(params.id, { status: 'cancelled' }));
  });

  /* ---------------- 出单次数 ---------------- */
  api.get('/report-credits/packs', async (req, res) => ok(res, EXPORT_PACKS));

  api.get('/report-credits/balance', async (req, res) => {
    const user = await A.requireAuth(req, res);
    if (!user) return;
    ok(res, {
      purchased: user.export_purchased || 0,
      used: user.export_used || 0,
      remaining: (user.export_purchased || 0) - (user.export_used || 0),
      unlimited: ['plus', 'enterprise'].includes(user.plan),
    });
  });

  api.get('/report-credits/purchases', async (req, res) => {
    const user = await A.requireAuth(req, res);
    if (!user) return;
    ok(res, db.orders.find((o) => o.org_id === user.org_id && o.kind === 'export'));
  });

  api.post('/report-credits/purchases', async (req, res, body) => {
    const user = await A.requireAuth(req, res);
    if (!user) return;
    const pack = EXPORT_PACKS.find((p) => p.code === body.pack_code);
    if (!pack) return fail(res, '次数包不存在。');
    const order = await db.orders.insert({
      id: uid(), org_id: user.org_id, user_id: user.id, kind: 'export',
      order_no: genOrderNo('EXP'), pack_code: pack.code, pack_name: pack.name,
      call_count: pack.count, amount: pack.price, status: 'pending', created_at: now(),
    });
    ok(res, order, 201);
  });

  api.post('/report-credits/purchases/:id/pay', async (req, res, body, params) => {
    const user = await A.requireAuth(req, res);
    if (!user) return;
    const order = await db.orders.findOne({ id: params.id });
    if (!order || order.org_id !== user.org_id) return fail(res, '订单不存在。', 404);
    db.orders.update(order.id, { status: 'paid', paid_at: now(), pay_method: body.method || '模拟支付' });
    db.users.update(user.id, { export_purchased: (user.export_purchased || 0) + (order.call_count || 0) });
    ok(res, { ...db.orders.findOne({ id: order.id }), message: `支付成功！${order.call_count} 次出单额度已到账。` });
  });

  /* ---------------- 发票 ---------------- */
  api.get('/invoices/records', async (req, res) => {
    const user = await A.requireAuth(req, res);
    if (!user) return;
    ok(res, db.orders.find((o) => o.org_id === user.org_id && o.invoice_requested)
      .map((o) => ({
        id: o.id, order_no: o.order_no, amount: o.amount,
        status: o.invoice_status || 'pending', created_at: o.paid_at || o.created_at,
        title: o.invoice_title || '', tax_no: o.invoice_tax_no || '',
      })));
  });

  api.get('/invoices/invoiceable-orders', async (req, res) => {
    const user = await A.requireAuth(req, res);
    if (!user) return;
    ok(res, db.orders.find((o) => o.org_id === user.org_id && o.status === 'paid' && !o.invoice_requested));
  });

  api.post('/invoices/records', async (req, res, body) => {
    const user = await A.requireAuth(req, res);
    if (!user) return;
    const ids = Array.isArray(body.order_ids) ? body.order_ids : [];
    if (!ids.length) return fail(res, '请选择要开票的订单。');
    ids.forEach(async (id) => await db.orders.update(id, {
      invoice_requested: true, invoice_status: 'pending',
      invoice_title: body.title || '', invoice_tax_no: body.tax_no || '',
    }));
    ok(res, { count: ids.length, message: `已提交 ${ids.length} 笔发票申请，我们将在 3 个工作日内开具。` });
  });

  /* ---------------- 退款 ---------------- */
  api.get('/refunds/support-info', async (req, res) => ok(res, {
    contact: '请在系统设置 → 帮助与反馈中提交工单，或邮件联系 support@example.com',
    policy: '套餐订阅到期不续费自动停用；积分充值包 180 天内有效；已消耗的套餐费 / 积分不予退还。',
  }));

  api.post('/refunds', async (req, res, body) => {
    const user = await A.requireAuth(req, res);
    if (!user) return;
    const order = await db.orders.findOne({ id: body.order_id });
    if (!order || order.org_id !== user.org_id) return fail(res, '订单不存在。', 404);
    ok(res, db.notifications.insert({
      id: uid(), org_id: user.org_id, type: 'refund_request', order_id: order.id,
      order_no: order.order_no, amount: order.amount, reason: body.reason || '',
      status: 'pending', created_by: user.id, created_at: now(),
    }), 201);
  });
};

function genOrderNo(prefix) {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `${prefix}${ymd}${String(Math.floor(Math.random() * 9000) + 1000)}`;
}

module.exports.PLANS = PLANS;
module.exports.CREDIT_PACKS = CREDIT_PACKS;
module.exports.EXPORT_PACKS = EXPORT_PACKS;
