/**
 * 云报价 · 家装报价系统 —— Node HTTP 服务入口（PocketBay / CloudBase 通用）
 *
 * 运行约定：
 * - 读取环境变量 PORT 监听（PocketBay 注入），绑定 0.0.0.0
 * - 数据库二选一：
 *   · 文件模式（默认本机开发 / PocketBay 持久卷 POCKETBAY_DATA_DIR）→ JSON 文件存储
 *   · 云模式（HQ_DB_MODE=cloud）→ @cloudbase/js-sdk 访问 CloudBase PG
 *     环境变量：CLOUDBASE_ENV_ID, CLOUDBASE_ACCESS_KEY, CLOUDBASE_SECRET_KEY
 * - JWT 签名秘钥：HQ_SECRET（缺省时自动生成并持久化）
 */
const http = require('http');
const path = require('path');
const url = require('url');

// 初始化 CloudBase（必须在 require routes 之前）；file 模式（本地/PocketBay 持久卷）跳过，避免强依赖云 SDK
const DB_MODE = process.env.HQ_DB_MODE || (process.env.POCKETBAY_DATA_DIR ? 'file' : 'cloud');
if (DB_MODE !== 'file') {
  require('./cloud-db');
}

const { db, uid, now } = require('./lib/db');
const { Router, json, ok, fail, readBody, serveStatic } = require('./lib/http');
const A = require('./lib/auth');
const { initSystemLibrary, seedLibraryForOrg, seedDemoQuotes } = require('./lib/seed');

const PORT = Number(process.env.PORT) || 9000;
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
    db: DB_MODE === 'file' ? 'file-json' : 'cloudbase-pg',
    counts: {
      users: await db.users.count(),
      orgs: await db.orgs.count(),
      quotes: await db.quotes.count(),
      library: await db.library.count(),
    },
  });
});

/* ---------------- 服务 ---------------- */
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = decodeURIComponent(parsed.pathname);
  req.query = parsed.query;

  // CORS
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
async function bootstrap() {
  await initSystemLibrary();

  // 无用户时创建演示账号
  const userCount = await db.users.count();
  if (userCount === 0) {
    const orgId = uid();
    await db.orgs.insert({ id: orgId, name: '演示装饰设计工作室', plan: 'plus', created_at: now() });
    await seedLibraryForOrg(orgId);
    const user = await db.users.insert({
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
    const n = await seedDemoQuotes(user.id, orgId);
    console.log(`[bootstrap] 已创建演示账号：13800000000 / 123456（含 ${n} 张示例报价）`);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('  ┌─────────────────────────────────────────────┐');
    console.log('  │  云报价 · 家装报价系统 (Node 服务)            │');
    console.log('  ├─────────────────────────────────────────────┤');
    console.log(`  │  端口： ${PORT}                               │`);
    console.log(`  │  接口前缀： ${API_PREFIX}                        │`);
    console.log(`  │  数据库： ${DB_MODE === 'file' ? '本地文件存储' : 'CloudBase PG'}                        │`);
    console.log('  └─────────────────────────────────────────────┘');
    console.log('');
  });
}

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n端口 ${PORT} 已被占用\n`);
    process.exit(1);
  }
  throw e;
});

bootstrap().catch(console.error);

module.exports = server;
