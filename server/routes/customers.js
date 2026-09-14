/**
 * 客户管理
 */
const { db, uid, now } = require('../lib/db');
const A = require('../lib/auth');
const { ok, fail } = require('../lib/http');

module.exports = function register(api) {
  api.get('/customers', async (req, res) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const q = req.query || {};
    let list = db.customers.find((c) => c.org_id === user.org_id);
    if (q.keyword) {
      const kw = String(q.keyword).toLowerCase();
      list = list.filter((c) => [c.name, c.phone, c.community].some((v) => String(v || '').toLowerCase().includes(kw)));
    }
    if (q.status && q.status !== 'all') list = list.filter((c) => c.status === q.status);

    // 附带报价统计
    const list2 = list.map((c) => {
      const qs = db.quotes.find((x) => x.customer_id === c.id);
      return {
        ...c,
        quote_count: qs.length,
        won_count: qs.filter((x) => x.status === 'won').length,
        total_amount: Math.round(qs.reduce((s, x) => s + (Number(x.grand_total) || Number(x.total_amount) || 0), 0) * 100) / 100,
        last_quote_at: qs.length ? qs.map((x) => x.created_at).sort().slice(-1)[0] : null,
      };
    }).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

    ok(res, { items: list2, total: list2.length });
  });

  api.get('/customers/:id', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const c = db.customers.findOne({ id: params.id });
    if (!c || c.org_id !== user.org_id) return fail(res, '客户不存在。', 404);
    ok(res, c);
  });

  api.get('/customers/:id/quotes', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    ok(res, db.quotes.find((x) => x.customer_id === params.id && x.org_id === user.org_id)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))));
  });

  api.post('/customers', async (req, res, body) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    if (!body.name) return fail(res, '请填写客户姓名。');
    const c = db.customers.insert({
      id: uid(), org_id: user.org_id, created_at: now(),
      name: body.name,
      phone: body.phone || '',
      community: body.community || '',
      address: body.address || '',
      building_area: Number(body.building_area) || 0,
      layout: body.layout || '',
      budget: Number(body.budget) || 0,
      source: body.source || '',
      status: body.status || 'following',
      level: body.level || 'normal',
      remark: body.remark || '',
      owner_id: user.id,
    });
    ok(res, c, 201);
  });

  api.put('/customers/:id', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const c = db.customers.findOne({ id: params.id });
    if (!c || c.org_id !== user.org_id) return fail(res, '客户不存在。', 404);
    const allow = ['name', 'phone', 'community', 'address', 'building_area', 'layout', 'budget',
      'source', 'status', 'level', 'remark'];
    const patch = {};
    allow.forEach((k) => { if (body[k] !== undefined) patch[k] = body[k]; });
    ok(res, db.customers.update(params.id, patch));
  });

  api.del('/customers/:id', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const c = db.customers.findOne({ id: params.id });
    if (!c || c.org_id !== user.org_id) return fail(res, '客户不存在。', 404);
    db.customers.remove(params.id);
    ok(res, { ok: true });
  });
};
