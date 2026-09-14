/**
 * 认证 / 用户 / 组织
 */
const { db, uid, now } = require('../lib/db');
const A = require('../lib/auth');
const { ok, fail } = require('../lib/http');
const { seedLibraryForOrg } = require('../lib/seed');

const PLANS = {
  free: { key: 'free', name: '免费版', credits: 30, export_quota: 0, price: 0 },
  personal: { key: 'personal', name: '普通版（按次）', credits: 0, export_quota: 0, price: 9.9 },
  plus: { key: 'plus', name: 'Plus 版', credits: 1000, export_quota: -1, price: 38 },
  enterprise: { key: 'enterprise', name: '企业版', credits: 5000, export_quota: -1, price: 0 },
};

/** 内存验证码（重启即失效，够用且安全） */
const CODE_TTL = 5 * 60 * 1000;
function setCode(key, code) {
  db.sessions.removeWhere((s) => s.key === `code:${key}`);
  db.sessions.insert({ id: uid(), key: `code:${key}`, code, expire_at: Date.now() + CODE_TTL });
}
function getCode(key) {
  const rec = db.sessions.findOne((s) => s.key === `code:${key}`);
  if (!rec) return null;
  if (rec.expire_at < Date.now()) { db.sessions.remove(rec.id); return null; }
  return rec.code;
}

/** 每月发放套餐赠送点数 */
function grantMonthlyCredits(user) {
  const ym = new Date().toISOString().slice(0, 7);
  if (user.credits_month === ym) return user;
  const plan = PLANS[user.plan] || PLANS.free;
  const add = plan.credits || 0;
  return db.users.update(user.id, {
    credits: (user.credits || 0) + add,
    credits_month: ym,
    export_used: 0,
  });
}

module.exports = function register(router) {
  const api = router;

  /* ---------- 发送验证码（本地模式直接返回，便于测试） ---------- */
  api.post('/auth/sms-code/send', async (req, res, body) => {
    const phone = String(body.phone || '').trim();
    if (!A.validPhone(phone)) return fail(res, '请输入正确的 11 位手机号。');
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setCode(phone, code);
    ok(res, {
      sent: true,
      // 本地部署：无短信网关，直接回传验证码便于自测；生产环境应删除此字段
      dev_code: code,
      message: `验证码已发送，请查收短信。（本地测试验证码：${code}）`,
      ttl: 300,
    });
  });

  /* ---------- 手机号验证码登录 / 注册 ---------- */
  api.post('/auth/login-sms', async (req, res, body) => {
    const phone = String(body.phone || '').trim();
    const code = String(body.code || '').trim();
    if (!A.validPhone(phone)) return fail(res, '请输入正确的 11 位手机号。');
    if (!code) return fail(res, '请输入短信验证码。');

    const real = getCode(phone);
    if (!real) return fail(res, '验证码已过期，请重新获取。');
    if (real !== code) return fail(res, '账号不存在或验证码错误。');

    let user = db.users.findOne({ phone });
    if (!user) {
      user = createUser({ phone, name: `用户${phone.slice(-4)}`, plan: 'free' });
    } else if (user.status === 'disabled') {
      return fail(res, '账号已被停用，请联系管理员。', 403);
    }
    db.sessions.removeWhere((s) => s.key === `code:${phone}`);
    finishLogin(res, user);
  });

  /* ---------- 账号密码登录 ---------- */
  api.post('/auth/login', async (req, res, body) => {
    const account = String(body.account || body.phone || body.email || '').trim();
    const pwd = String(body.password || '');
    if (!account || !pwd) return fail(res, '请输入账号和密码。');

    const user = db.users.findOne({ phone: account }) || db.users.findOne({ email: account });
    if (!user) return fail(res, '账号不存在或密码错误。', 401);
    if (!A.verifyPassword(pwd, user.password_hash)) return fail(res, '账号不存在或密码错误。', 401);
    if (user.status === 'disabled') return fail(res, '账号已被停用，请联系管理员。', 403);

    finishLogin(res, user);
  });

  /* ---------- 注册 ---------- */
  api.post('/auth/register', async (req, res, body) => {
    const phone = String(body.phone || '').trim();
    const pwd = String(body.password || '');
    const name = String(body.name || '').trim();
    const code = String(body.code || '').trim();

    if (!A.validPhone(phone)) return fail(res, '请输入正确的 11 位手机号。');
    if (pwd.length < 6) return fail(res, '密码至少 6 位。');
    if (db.users.findOne({ phone })) return fail(res, '该手机号已注册，请直接登录。');

    if (code) {
      const real = getCode(phone);
      if (!real) return fail(res, '验证码已过期，请重新获取。');
      if (real !== code) return fail(res, '验证码错误。');
      db.sessions.removeWhere((s) => s.key === `code:${phone}`);
    }

    const user = createUser({ phone, password: pwd, name: name || `用户${phone.slice(-4)}`, email: body.email, plan: body.plan || 'free' });
    finishLogin(res, user, 201);
  });

  /* ---------- 刷新令牌 ---------- */
  api.post('/auth/refresh', async (req, res, body) => {
    const payload = A.verify(String(body.refresh_token || ''));
    if (!payload || payload.type !== 'refresh') return fail(res, '登录状态已失效，请重新登录。', 401);
    const user = db.users.findOne({ id: payload.sub });
    if (!user || user.status === 'disabled') return fail(res, '登录状态已失效，请重新登录。', 401);
    ok(res, { ...A.issueTokens(user), user: A.publicUser(user) });
  });

  /* ---------- 退出 ---------- */
  api.post('/auth/logout', async (req, res) => ok(res, { ok: true }));

  /* ---------- 当前用户 ---------- */
  api.get('/users/me', async (req, res) => {
    let user = A.requireAuth(req, res);
    if (!user) return;
    user = grantMonthlyCredits(user);
    const org = db.orgs.findOne({ id: user.org_id });
    ok(res, {
      ...A.publicUser(user),
      org: org || null,
      plan_info: planInfo(user),
      permissions: permissionsOf(user),
    });
  });

  api.put('/users/me', async (req, res, body) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const patch = {};
    ['name', 'avatar', 'phone2', 'company', 'title'].forEach((k) => {
      if (body[k] !== undefined) patch[k] = body[k];
    });
    const updated = db.users.update(user.id, patch);
    ok(res, A.publicUser(updated));
  });

  api.put('/users/me/password', async (req, res, body) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    if (!A.verifyPassword(String(body.old_password || ''), user.password_hash)) {
      return fail(res, '原密码不正确。');
    }
    if (String(body.new_password || '').length < 6) return fail(res, '新密码至少 6 位。');
    db.users.update(user.id, { password_hash: A.hashPassword(body.new_password) });
    ok(res, { ok: true, message: '密码已更新。' });
  });

  api.get('/users/plan-info', async (req, res) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    ok(res, planInfo(user));
  });

  api.get('/users/me/permissions', async (req, res) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    ok(res, permissionsOf(user));
  });

  /* ---------- 组织 ---------- */
  api.get('/org/profile', async (req, res) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    ok(res, db.orgs.findOne({ id: user.org_id }) || {});
  });

  api.put('/org/profile', async (req, res, body) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    if (!['owner', 'admin'].includes(user.role)) return fail(res, '仅管理员可修改组织信息。', 403);
    const patch = {};
    ['name', 'logo', 'phone', 'address', 'intro', 'brand_color'].forEach((k) => {
      if (body[k] !== undefined) patch[k] = body[k];
    });
    ok(res, db.orgs.update(user.org_id, patch));
  });

  api.get('/org/settings', async (req, res) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const org = db.orgs.findOne({ id: user.org_id }) || {};
    ok(res, org.settings || defaultOrgSettings());
  });

  api.put('/org/settings', async (req, res, body) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    if (!['owner', 'admin'].includes(user.role)) return fail(res, '仅管理员可修改设置。', 403);
    const org = db.orgs.findOne({ id: user.org_id });
    const merged = { ...defaultOrgSettings(), ...(org.settings || {}), ...(body.settings || body) };
    db.orgs.update(user.org_id, { settings: merged });
    ok(res, merged);
  });

  /* ---------- 成员（团队） ---------- */
  api.get('/users', async (req, res) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const list = db.users.find({ org_id: user.org_id }).map(A.publicUser);
    ok(res, list);
  });

  api.put('/users/:id/role', async (req, res, body, params) => {
    const user = A.requireAdmin(req, res);
    if (!user) return;
    const target = db.users.findOne({ id: params.id });
    if (!target || target.org_id !== user.org_id) return fail(res, '成员不存在。', 404);
    if (!['owner', 'admin', 'member'].includes(body.role)) return fail(res, '角色不合法。');
    ok(res, A.publicUser(db.users.update(target.id, { role: body.role })));
  });

  api.post('/users/invitations', async (req, res, body) => {
    const user = A.requireAdmin(req, res);
    if (!user) return;
    const phone = String(body.phone || '').trim();
    if (!A.validPhone(phone)) return fail(res, '请输入正确的 11 位手机号。');
    ok(res, db.notifications.insert({
      id: uid(), org_id: user.org_id, type: 'invitation', phone,
      role: body.role || 'member', status: 'pending', invited_by: user.id,
    }));
  });

  api.get('/users/invitations', async (req, res) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    ok(res, db.notifications.find({ org_id: user.org_id, type: 'invitation' }));
  });

  /* ---------- 公开配置 ---------- */
  api.get('/public-config', async (req, res) => {
    ok(res, {
      app_name: '云报价 · 家装报价系统',
      sms_enabled: false,
      ai_provider: require('../lib/ai').provider.enabled ? 'llm' : 'local-rule-engine',
      plans: Object.values(PLANS),
      version: '1.0.0',
    });
  });
};

/* ---------------- 内部函数 ---------------- */

function createUser({ phone, password, name, email, plan }) {
  const org = db.orgs.insert({
    id: uid(),
    name: `${name || phone} 的团队`,
    plan: plan || 'free',
    created_at: now(),
  });
  // 为新组织初始化一份可编辑的工艺库副本
  seedLibraryForOrg(org.id);

  const ym = new Date().toISOString().slice(0, 7);
  const user = db.users.insert({
    id: uid(),
    phone,
    email: email || '',
    name,
    password_hash: A.hashPassword(password || Math.random().toString(36).slice(2, 10)),
    role: 'owner',
    org_id: org.id,
    plan: plan || 'free',
    status: 'active',
    credits: (PLANS[plan || 'free'] || PLANS.free).credits,
    credits_month: ym,
    export_used: 0,
    export_purchased: 0,
    // 仅当系统里一个用户都没有时，首个注册者自动成为平台管理员。
    // 注意：必须是 === 0 —— 用 === 1 会让「已有 1 个用户」时注册的新账号也拿到管理员权限。
    is_platform_admin: db.users.count() === 0,
    created_at: now(),
  });
  return user;
}

function finishLogin(res, user, status = 200) {
  user = grantMonthlyCredits(user);
  db.users.update(user.id, { last_login_at: now() });
  const org = db.orgs.findOne({ id: user.org_id });
  res.statusCode = status;
  ok(res, {
    ...A.issueTokens(user),
    user: A.publicUser(user),
    org: org || null,
    plan_info: planInfo(user),
  });
}

function planInfo(user) {
  const plan = PLANS[user.plan] || PLANS.free;
  return {
    plan: user.plan,
    plan_name: plan.name,
    credits: user.credits || 0,
    monthly_credits: plan.credits,
    export_quota: plan.export_quota,
    export_used: user.export_used || 0,
    export_purchased: user.export_purchased || 0,
    is_platform_admin: !!user.is_platform_admin,
  };
}

function permissionsOf(user) {
  const isAdmin = ['owner', 'admin'].includes(user.role) || user.is_platform_admin;
  return {
    can_manage_members: isAdmin,
    can_view_cost: user.plan === 'plus' || user.plan === 'enterprise' || isAdmin,
    can_export: user.plan !== 'free' || (user.export_purchased || 0) > 0,
    can_approve: user.plan === 'enterprise' || isAdmin,
    can_edit_library: true,
    can_use_ai: (user.credits || 0) > 0,
    is_platform_admin: !!user.is_platform_admin,
  };
}

function defaultOrgSettings() {
  return {
    labor_wage_standards: [
      { trade: '水电工', daily_wage: 320 },
      { trade: '泥瓦工', daily_wage: 300 },
      { trade: '木工', daily_wage: 330 },
      { trade: '油漆工', daily_wage: 290 },
      { trade: '杂工', daily_wage: 200 },
    ],
    quote_prefix: 'BJ',
    default_tax_rate: 0,
    show_cost_to_client: false,
    quote_terms: '本报价自出具之日起 15 日内有效；施工中不额外增项，变更需双方签署变更单后执行。',
  };
}

module.exports.PLANS = PLANS;
module.exports.grantMonthlyCredits = grantMonthlyCredits;
