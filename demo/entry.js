/* ============================================================================
 * 演示模式入口（构建时以 demo/entry.js 的身份注册）
 *
 * 这里做的事，等价于 server/server.js 的「挂载路由 + bootstrap」两段，
 * 只是把 TCP 换成了内存调用：
 *   HTTP 请求  →  handle(method, apiPath, body, headers)
 * 因此前端拿到的响应结构与真实后端逐字段一致。
 * ========================================================================== */

const { db, uid, now, flushAll, resetAll } = require('server/lib/db.js');
const { Router, ok, json } = require('server/lib/http.js');
const A = require('server/lib/auth.js');
const { initSystemLibrary, seedLibraryForOrg, seedDemoQuotes } = require('server/lib/seed.js');

const api = new Router();

/* ---------------- 挂载与 server.js 完全相同的业务路由 ---------------- */
require('server/routes/auth.js')(api);
require('server/routes/quotes.js')(api);
require('server/routes/library.js')(api);
require('server/routes/customers.js')(api);
require('server/routes/ai.js')(api);
require('server/routes/billing.js')(api);
require('server/routes/admin.js')(api);

api.get('/health', async (req, res) => {
  ok(res, {
    status: 'ok',
    mode: 'static-demo',
    time: now(),
    version: '1.0.0-static',
    ai_engine: require('server/lib/ai.js').provider.enabled ? 'llm' : 'local-rule-engine',
    counts: {
      users: db.users.count(),
      orgs: db.orgs.count(),
      quotes: db.quotes.count(),
      library: db.library.count(),
    },
  });
});

/* ---------------- 首次访问播种（对照 server.js 的 bootstrap） ---------------- */
let booted = false;

function bootstrap() {
  if (booted) return;
  booted = true;
  initSystemLibrary();
  if (!db.users.count()) {
    const orgId = uid();
    db.orgs.insert({ id: orgId, name: '演示装饰设计工作室', plan: 'plus', created_at: now() });
    seedLibraryForOrg(orgId);
    const user = db.users.insert({
      id: uid(),
      phone: '13800000000',
      name: '演示账号',
      password_hash: A.hashPassword('123456'),
      role: 'owner',
      org_id: orgId,
      plan: 'plus',
      status: 'active',
      credits: 1000,
      credits_month: new Date().toISOString().slice(0, 7),
      export_used: 0,
      export_purchased: 10,
      is_platform_admin: true,
      created_at: now(),
    });
    const n = seedDemoQuotes(user.id, orgId);
    console.log(`[demo] 演示账号已就绪：13800000000 / 123456（含 ${n} 张示例报价）`);
  }
  flushAll();
}

/* ---------------- 请求分发 ---------------- */
async function handle(method, apiPath, body, headers) {
  bootstrap();

  const m0 = String(method || 'GET').toUpperCase();
  const raw = String(apiPath || '/');
  const qi = raw.indexOf('?');
  const pure = qi < 0 ? raw : raw.slice(0, qi);
  const query = {};
  if (qi >= 0) new URLSearchParams(raw.slice(qi + 1)).forEach((v, k) => { query[k] = v; });

  const matched = api.match(m0, pure || '/');
  if (!matched) {
    return { status: 404, data: { error: `接口不存在：${m0} ${pure}`, code: 'NOT_FOUND' } };
  }

  let captured = null;
  const req = { method: m0, url: raw, headers: headers || {}, query, user: null };
  const res = {
    statusCode: 200,
    headersSent: false,
    setHeader() { return this; },
    getHeader() { return undefined; },
    writeHead(code) { this.statusCode = Number(code) || 200; return this; },
    end(payload) {
      this.headersSent = true;
      captured = { status: this.statusCode, raw: payload === undefined ? '' : payload };
    },
  };

  try {
    await matched.handler(req, res, body || {}, matched.params);
  } catch (e) {
    console.error('[demo-api] 处理异常', m0, pure, e);
    if (!captured) {
      return { status: 500, data: { error: e.message || '演示模式内部错误', code: 'DEMO_ERROR' } };
    }
  }

  if (!captured) return { status: 500, data: { error: '接口未返回响应', code: 'NO_RESPONSE' } };

  let data;
  try {
    data = captured.raw ? JSON.parse(captured.raw) : {};
  } catch (e) {
    data = { error: '响应解析失败', raw: String(captured.raw).slice(0, 200) };
  }
  return { status: captured.status, data };
}

function stats() {
  return {
    users: db.users.count(),
    orgs: db.orgs.count(),
    quotes: db.quotes.count(),
    library: db.library.count(),
    customers: db.customers.count(),
    templates: db.templates.count(),
    ai_logs: db.ai_logs.count(),
  };
}

module.exports = { handle, stats, flushAll, resetAll };
