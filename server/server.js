/**
 * 云报价 · 家装报价系统 —— 后端服务
 *
 * 零依赖启动：node server.js  [port]
 * API 前缀：/api/v1
 */
const http = require('http');
const path = require('path');
const url = require('url');

const { db, uid, now } = require('./lib/db');
const { Router, json, ok, fail, readBody, serveStatic } = require('./lib/http');
const A = require('./lib/auth');
const { initSystemLibrary, seedLibraryForOrg, seedDemoQuotes } = require('./lib/seed');

const PORT = Number(process.argv[2] || process.env.PORT || 5178);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const API_PREFIX = '/api/v1';

const api = new Router();

/* ---------------- 注册业务路由 ---------------- */
require('./routes/auth')(api);
require('./routes/quotes')(api);
require('./routes/library')(api);
require('./routes/customers')(api);
require('./routes/ai')(api);
require('./routes/billing')(api);
require('./routes/admin')(api);

/* 健康检查 */
api.get('/health', async (req, res) => {
  ok(res, {
    status: 'ok',
    time: now(),
    uptime: Math.round(process.uptime()),
    version: '1.0.0',
    ai_engine: require('./lib/ai').provider.enabled ? 'llm' : 'local-rule-engine',
    counts: {
      users: db.users.count(),
      orgs: db.orgs.count(),
      quotes: db.quotes.count(),
      library: db.library.count(),
    },
  });
});

/* ---------------- 服务 ---------------- */
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = decodeURIComponent(parsed.pathname);
  req.query = parsed.query;

  // CORS（本地开发允许任意来源）
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // API
  if (pathname.startsWith(API_PREFIX)) {
    const apiPath = pathname.slice(API_PREFIX.length) || '/';
    const matched = api.match(req.method, apiPath);
    if (!matched) {
      return json(res, { error: `接口不存在：${req.method} ${apiPath}`, code: 'NOT_FOUND' }, 404);
    }
    let body = {};
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      try {
        body = await readBody(req);
      } catch (e) {
        return json(res, { error: e.message }, 400);
      }
    }
    try {
      await matched.handler(req, res, body, matched.params);
    } catch (e) {
      console.error('[api error]', req.method, apiPath, e);
      if (!res.headersSent) {
        json(res, { error: e.message || '服务端异常', code: 'SERVER_ERROR' }, 500);
      }
    }
    return;
  }

  // 静态资源 + SPA 回退
  if (!serveStatic(req, res, PUBLIC_DIR, { spa: true })) {
    json(res, { error: 'Not Found' }, 404);
  }
});

/* ---------------- 启动 ---------------- */
function bootstrap() {
  initSystemLibrary();

  // 无用户时创建演示账号，便于本地自测
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
    console.log(`[bootstrap] 已创建演示账号：13800000000 / 123456（含 ${n} 张示例报价）`);
  }

  server.listen(PORT, () => {
    console.log('');
    console.log('  ┌─────────────────────────────────────────────┐');
    console.log('  │  云报价 · 家装报价系统                        │');
    console.log('  ├─────────────────────────────────────────────┤');
    console.log(`  │  本地地址： http://localhost:${PORT}            │`);
    console.log(`  │  接口前缀： http://localhost:${PORT}${API_PREFIX}   │`);
    console.log(`  │  AI 引擎：  ${require('./lib/ai').provider.enabled ? '大模型' : '本地规则引擎'}                        │`);
    console.log('  └─────────────────────────────────────────────┘');
    console.log('');
    console.log('  演示账号：13800000000  密码：123456');
    console.log('  （也可在登录页用任意手机号 + 验证码登录，本地模式验证码会直接显示）');
    console.log('');
  });
}

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n端口 ${PORT} 已被占用，请换一个端口：node server.js 5179\n`);
    process.exit(1);
  }
  throw e;
});

bootstrap();

module.exports = server;
