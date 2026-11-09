/**
 * 平台管理后台（仅 platform_admin）
 */
const { db, uid, now } = require('../lib/db');
const A = require('../lib/auth');
const { ok, fail } = require('../lib/http');

module.exports = function register(api) {
  api.get('/admin/overview', async (req, res) => {
    const admin = await A.requirePlatformAdmin(req, res);
    if (!admin) return;

    const users = await db.users.all();
    const orgs = await db.orgs.all();
    const quotes = await db.quotes.all();
    const orders = await db.orders.all();
    const logs = await db.ai_logs.all();

    const today = new Date().toISOString().slice(0, 10);
    ok(res, {
      users: {
        total: users.length,
        today: users.filter((u) => (u.created_at || '').slice(0, 10) === today).length,
        active: users.filter((u) => u.status !== 'disabled').length,
        by_plan: countBy(users, 'plan'),
      },
      orgs: { total: orgs.length, by_plan: countBy(orgs, 'plan') },
      quotes: {
        total: quotes.length,
        by_status: countBy(quotes, 'status'),
        amount: Math.round(quotes.reduce((s, q) => s + (Number(q.grand_total) || Number(q.total_amount) || 0), 0) * 100) / 100,
      },
      revenue: {
        paid_orders: orders.filter((o) => o.status === 'paid').length,
        amount: Math.round(orders.filter((o) => o.status === 'paid').reduce((s, o) => s + (Number(o.amount) || 0), 0) * 100) / 100,
        pending: orders.filter((o) => o.status === 'pending').length,
      },
      ai: {
        calls: logs.length,
        credits_used: logs.reduce((s, l) => s + (l.cost || 0), 0),
        failed: logs.filter((l) => l.status === 'failed').length,
        engine: require('../lib/ai').provider.enabled ? 'llm' : 'local-rule-engine',
      },
      library: { total: (await db.library.all()).length, system: (await db.library.find((x) => !x.org_id)).length },
    });
  });

  api.get('/admin/users', async (req, res) => {
    const admin = await A.requirePlatformAdmin(req, res);
    if (!admin) return;
    const userList = await Promise.all((await db.users.all()).map(async (u) => {
      const org = await db.orgs.findOne({ id: u.org_id });
      return {
        ...A.publicUser(u),
        org_name: org ? org.name : '',
        quote_count: await db.quotes.count((q) => q.org_id === u.org_id),
      };
    }));
    ok(res, userList.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))));
  });

  api.put('/admin/users/:id/status', async (req, res, body, params) => {
    const admin = await A.requirePlatformAdmin(req, res);
    if (!admin) return;
    if (params.id === admin.id) return fail(res, '不能停用自己。');
    ok(res, A.publicUser(await db.users.update(params.id, { status: body.status === 'disabled' ? 'disabled' : 'active' })));
  });

  api.put('/admin/users/:id/platform-admin', async (req, res, body, params) => {
    const admin = await A.requirePlatformAdmin(req, res);
    if (!admin) return;
    ok(res, A.publicUser(await db.users.update(params.id, { is_platform_admin: !!body.enabled })));
  });

  api.get('/admin/organizations', async (req, res) => {
    const admin = await A.requirePlatformAdmin(req, res);
    if (!admin) return;
    ok(res, (await db.orgs.all()).map((o) => ({
      ...o,
      user_count: db.users.count((u) => u.org_id === o.id),
      quote_count: db.quotes.count((q) => q.org_id === o.id),
      library_count: db.library.count((x) => x.org_id === o.id),
    })));
  });

  api.put('/admin/organizations/:id/plan', async (req, res, body, params) => {
    const admin = await A.requirePlatformAdmin(req, res);
    if (!admin) return;
    const org = await db.orgs.findOne({ id: params.id });
    if (!org) return fail(res, '组织不存在。', 404);
    /* 团队套餐与成员账号必须一起改到位。
     * 【坑】原实现两次写库的返回值都不检查 —— 成员账号同步失败时接口照样返回
     *       已经改好的团队记录，管理页看着「改成功了」，而账号仍是旧套餐
     *       （线上 18956081752 就是这样卡在 free 的）。现在失败即报错。 */
    const okOrg = await db.orgs.update(org.id, { plan: body.plan });
    if (!okOrg) return fail(res, '团队套餐更新失败，请重试。', 500);
    const users = await db.users.find({ org_id: org.id });
    const failed = [];
    for (const u of users) {
      const r = await db.users.update(u.id, { plan: body.plan });
      if (!r) failed.push(u.name || u.phone || u.id);
    }
    if (failed.length) {
      return fail(res, '团队套餐已更新，但 ' + failed.length + ' 个成员账号同步失败（' + failed.join('、') + '），请重试。', 500);
    }
    ok(res, await db.orgs.findOne({ id: org.id }));
  });

  api.put('/admin/organizations/:id/status', async (req, res, body, params) => {
    const admin = await A.requirePlatformAdmin(req, res);
    if (!admin) return;
    ok(res, await db.orgs.update(params.id, { status: body.status || 'active' }));
  });

  api.get('/admin/credit-grants', async (req, res) => {
    const admin = await A.requirePlatformAdmin(req, res);
    if (!admin) return;
    ok(res, (await db.notifications.find((n) => n.type === "credit_grant"))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))));
  });

  api.post('/admin/credit-grants', async (req, res, body) => {
    const admin = await A.requirePlatformAdmin(req, res);
    if (!admin) return;
    const user = await db.users.findOne({ phone: body.phone }) || await db.users.findOne({ id: body.user_id });
    if (!user) return fail(res, '用户不存在。', 404);
    const amount = Number(body.amount) || 0;
    if (!amount) return fail(res, '请填写发放数量。');
    await db.users.update(user.id, { credits: (user.credits || 0) + amount });
    ok(res, await db.notifications.insert({
      id: uid(), type: 'credit_grant', user_id: user.id, phone: user.phone,
      amount, reason: body.reason || '管理员发放', granted_by: admin.id, created_at: now(),
    }), 201);
  });

  api.get('/admin/refund-requests', async (req, res) => {
    const admin = await A.requirePlatformAdmin(req, res);
    if (!admin) return;
    ok(res, (await db.notifications.find((n) => n.type === "refund_request")));
  });

  api.post('/admin/refund-requests/:id/review', async (req, res, body, params) => {
    const admin = await A.requirePlatformAdmin(req, res);
    if (!admin) return;
    const req0 = await db.notifications.findOne({ id: params.id });
    if (!req0) return fail(res, '申请不存在。', 404);
    const approved = body.approve === true;
    if (approved && req0.order_id) {
      await db.orders.update(req0.order_id, { status: 'refunded', refunded_at: now() });
    }
    ok(res, await db.notifications.update(params.id, {
      status: approved ? 'approved' : 'rejected',
      reviewed_by: admin.id, review_note: body.note || '', reviewed_at: now(),
    }));
  });

  /* 平台管理员：AI 用量总览 */
  api.get('/admin/ai-usage', async (req, res) => {
    const admin = await A.requirePlatformAdmin(req, res);
    if (!admin) return;
    const logs = await db.ai_logs.all();
    const byFeature = {};
    logs.forEach((l) => {
      byFeature[l.feature_name] = byFeature[l.feature_name] || { name: l.feature_name, calls: 0, credits: 0 };
      byFeature[l.feature_name].calls += 1;
      byFeature[l.feature_name].credits += l.cost || 0;
    });
    ok(res, {
      total: logs.length,
      by_feature: Object.values(byFeature).sort((a, b) => b.calls - a.calls),
      recent: logs.slice(-50).reverse(),
    });
  });
};

function countBy(list, key) {
  const m = {};
  list.forEach((x) => { const k = x[key] || 'unknown'; m[k] = (m[k] || 0) + 1; });
  return m;
}
