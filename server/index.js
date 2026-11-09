/**
 * CloudBase Event 云函数入口
 * 路由映射：将 CloudBase APIGW event 转换为 Node http 对象
 * 事件函数走免密临时凭证路径，cloudbase.init({env}) 即可访问 PG
 */
const { db, uid, now, initCloudBase, getInitError } = require('./lib/db');
const { Router, json, ok, fail, readBody, serveStatic } = require('./lib/http');
const A = require('./lib/auth');
const { initSystemLibrary, seedLibraryForOrg, seedDemoQuotes } = require('./lib/seed');

const path = require('path');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const API_PREFIX = '/api/v1';

const api = new Router();
require('./routes/auth')(api);
require('./routes/quotes')(api);
require('./routes/library')(api);
require('./routes/customers')(api);
require('./routes/ai')(api);
require('./routes/billing')(api);
require('./routes/admin')(api);

let bootstrapping = false;
let bootstrapDone = false;
let bootstrapError = null;

async function bootstrap(context) {
  if (bootstrapDone) return;
  if (bootstrapping) return;
  bootstrapping = true;
  try {
    initCloudBase(context);
    await initSystemLibrary();
    const count = await db.users.count();
    if (count === 0) {
      const orgId = uid();
      await db.orgs.insert({ id: orgId, name: '演示装饰设计工作室', plan: 'plus', created_at: now() });
      await seedLibraryForOrg(orgId);
      const user = await db.users.insert({
        id: uid(), phone: '13800000000', name: '演示账号',
        password_hash: A.hashPassword('123456'), role: 'owner', org_id: orgId,
        plan: 'plus', status: 'active', credits: 1000,
        credits_month: new Date().toISOString().slice(0, 7),
        export_used: 0, export_purchased: 10, is_platform_admin: true, created_at: now(),
      });
      await seedDemoQuotes(user.id, orgId);
      console.log('[bootstrap] 演示账号: 13800000000 / 123456');
    }
    bootstrapDone = true;
  } catch (e) {
    bootstrapError = (e && e.message) || String(e);
    console.error('[bootstrap error]', bootstrapError);
  } finally {
    // 确保 bootstrap 不会永久重试（即使失败也标记为已完成）
    bootstrapDone = true;
  }
}

api.get('/health', async (req, res) => {
  const base = {
    status: 'ok', time: now(), version: '1.0.0',
    db: 'cloudbase-pg',
    bootstrap: bootstrapDone ? 'done' : (bootstrapping ? 'running' : 'pending'),
    bootstrapError,
    initError: getInitError(),
  };
  if (bootstrapDone) {
    try {
      base.counts = {
        users: await db.users.count(),
        orgs: await db.orgs.count(),
        quotes: await db.quotes.count(),
        library: await db.library.count(),
      };
    } catch (e) {
      base.countsError = (e && e.message) || String(e);
    }
  }
  ok(res, base);
});

async function handler(event, context) {
  if (!bootstrapDone && !bootstrapping) {
    bootstrap(context);
  }

  const method = (event.headers?.['x-http-method'] || event.httpMethod || 'GET').toUpperCase();
  const pathname = decodeURIComponent(event.path || '/');
  const headers = { ...(event.headers || {}), origin: event.headers?.origin || '*' };

  let body = {};
  if (['POST', 'PUT', 'PATCH'].includes(method) && event.body) {
    try { body = JSON.parse(event.body); } catch (e) { body = {}; }
  }

  const query = {};
  const qi = pathname.indexOf('?');
  if (qi > 0) {
    pathname.split('?')[1].split('&').forEach(pair => {
      const [k, v] = pair.split('=');
      if (k) query[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
  }

  const res = {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    _body: '',
    end(data) { this._body = data !== undefined ? JSON.stringify(data) : this._body; },
    writeHead(code, hdrs) { this.statusCode = code; Object.assign(this.headers, hdrs || {}); },
    setHeader(k, v) { this.headers[k] = v; },
    getHeader(k) { return this.headers[k]; },
    get headersSent() { return !!this._body || this.statusCode !== 200; },
  };

  const req = { method, url: pathname, query, headers, body, parsedUrl: { pathname, query } };

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': headers.origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    });
    res.end();
    return { statusCode: 204, headers: res.headers, body: '' };
  }

  if (pathname.startsWith(API_PREFIX)) {
    const apiPath = pathname.slice(API_PREFIX.length) || '/';
    const matched = api.match(method, apiPath);
    if (!matched) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: '接口不存在：' + method + ' ' + apiPath, code: 'NOT_FOUND' }));
      return { statusCode: 404, headers: res.headers, body: res._body };
    }
    try {
      await matched.handler(req, res, body, matched.params || {});
      return { statusCode: res.statusCode, headers: res.headers, body: res._body };
    } catch (e) {
      console.error('[api error]', method, apiPath, e.message);
      if (!res.headersSent) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message || '服务端异常', code: 'SERVER_ERROR' }));
      }
      return { statusCode: res.statusCode, headers: res.headers, body: res._body };
    }
  }

  const staticReq = { ...req, headers };
  const served = serveStatic(staticReq, res, PUBLIC_DIR, { spa: true });
  if (served) {
    return { statusCode: res.statusCode, headers: res.headers, body: res._body };
  }
  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not Found' }));
  return { statusCode: 404, headers: res.headers, body: res._body };
}

exports.main = handler;