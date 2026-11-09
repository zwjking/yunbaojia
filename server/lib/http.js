/**
 * 零依赖 HTTP 工具：路由表、请求体解析、JSON 响应、静态文件
 */
const fs = require('fs');
const path = require('path');
const url = require('url');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
};

class Router {
  constructor(prefix = '') {
    this.prefix = prefix;
    this.routes = [];
  }

  add(method, pattern, handler) {
    const keys = [];
    const regex = new RegExp(
      '^' +
        pattern
          .split('/')
          .map((seg) => {
            if (seg.startsWith(':')) {
              keys.push(seg.slice(1));
              return '([^/]+)';
            }
            return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          })
          .join('/') +
        '/?$'
    );
    this.routes.push({ method, pattern, regex, keys, handler });
  }

  get(p, h) { this.add('GET', p, h); }
  post(p, h) { this.add('POST', p, h); }
  put(p, h) { this.add('PUT', p, h); }
  del(p, h) { this.add('DELETE', p, h); }
  patch(p, h) { this.add('PATCH', p, h); }

  /**
   * 两轮匹配：先静态路径、再动态路径。
   * 避免 /ai/:feature 这类动态路由抢先吞掉 /ai/estimate-to-quote 等静态路径。
   */
  match(method, pathname) {
    const m0 = method === 'DEL' ? 'DELETE' : method;
    const cands = this.routes.filter(
      (r) => r.method === m0 || (m0 === 'HEAD' && r.method === 'GET')
    );
    for (const pass of [0, 1]) {
      for (const r of cands) {
        if ((pass === 0) !== (r.keys.length === 0)) continue;
        const m = r.regex.exec(pathname);
        if (m) {
          const params = {};
          r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
          return { handler: r.handler, params };
        }
      }
    }
    return null;
  }
}

function json(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(body);
}

function ok(res, data) { json(res, data === undefined ? { ok: true } : data); }
function fail(res, message, status = 400, code) {
  json(res, { error: message, code: code || 'ERROR' }, status);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 12 * 1024 * 1024) { reject(new Error('请求体过大')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      const raw = Buffer.concat(chunks).toString('utf8');
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(new Error('请求参数格式错误'));
      }
    });
    req.on('error', reject);
  });
}

/** 静态文件服务（SPA fallback） */
function serveStatic(req, res, root, opts = {}) {
  const pathname = decodeURIComponent(url.parse(req.url).pathname);
  let rel = pathname === '/' ? '/index.html' : pathname;
  let file = path.join(root, rel);

  // 防目录穿越
  if (!file.startsWith(path.resolve(root))) {
    res.writeHead(403); res.end('Forbidden'); return true;
  }

  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    if (opts.spa && !path.extname(rel)) {
      file = path.join(root, 'index.html');
    } else {
      return false;
    }
  }

  const ext = path.extname(file).toLowerCase();
  const stat = fs.statSync(file);
  const etag = `W/"${stat.size}-${stat.mtimeMs}"`;
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304); res.end(); return true;
  }
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400',
    ETag: etag,
  });
  fs.createReadStream(file).pipe(res);
  return true;
}

module.exports = { Router, json, ok, fail, readBody, serveStatic, MIME };
