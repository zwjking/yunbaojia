/* eslint-disable */
/**
 * 云报价 · 静态演示版运行时（自动生成，请勿手改）
 * 重新生成：node tools/build-demo.mjs
 *
 * 本文件包含：迷你 CommonJS 运行时 + Node 内置模块垫片 + 服务端业务模块。
 * 业务代码原样搬运，未做任何转译。
 */

/* ================= demo/runtime.js ================= */
/* ============================================================================
 * 演示模式运行时（构建时被拼接进 public/js/demo/bundle.js）
 *
 * 目标：让 server/ 下真实的 CommonJS 路由代码，原封不动跑在浏览器里。
 * 手段：迷你 CommonJS 运行时 + Node 内置模块垫片（fs/path/url/crypto/http）。
 * 因此 82 个接口的业务逻辑零重写，功能与服务端版本完全一致。
 * ========================================================================== */

/* ---------------- 迷你 CommonJS 运行时 ---------------- */

const __factories = {};
const __cache = {};

/** 归一化路径：消掉 . 与 ..，统一用 / 分隔 */
function __normPath(p) {
  const out = [];
  for (const seg of String(p).split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  return out.join('/');
}

function __dirOf(id) {
  const i = id.lastIndexOf('/');
  return i < 0 ? '' : id.slice(0, i);
}

/** 模块 ID 解析：以 . 开头按相对路径解析，其余一律当内置模块 */
function __resolveId(fromDir, spec) {
  if (spec.startsWith('.')) return __normPath((fromDir ? fromDir + '/' : '') + spec);
  if (spec.startsWith('/')) return __normPath(spec);
  return '@' + spec.replace(/^node:/, '');
}

function __define(id, factory) {
  __factories[id] = factory;
}

function __require(spec, fromDir) {
  const dir = fromDir || '';
  const base = __resolveId(dir, spec);
  // 依次尝试：解析结果 → 补 .js → 原始 spec（完整模块 ID）
  const candidates = [base, base + '.js', spec, spec + '.js'];

  let id = null;
  for (const c of candidates) {
    if (__factories[c]) { id = c; break; }
  }
  if (!id) {
    throw new Error(`[demo-bundle] 找不到模块：${spec}（来源：${dir || '入口'}）`);
  }
  if (__cache[id]) return __cache[id].exports;
  const module = { exports: {} };
  __cache[id] = module;
  const selfDir = __dirOf(id);
  // 第 4、5 个参数模拟 Node 的 __dirname / __filename，让原样搬运的 CJS 代码不出错
  __factories[id](module, module.exports, (s) => __require(s, selfDir), '/' + selfDir, '/' + id);
  return module.exports;
}

/* ---------------- Node 全局垫片 ---------------- */

const __te = new TextEncoder();
const __td = new TextDecoder();

/** process 垫片：env 为空 → AI 走本地规则引擎，不会触发任何外部请求 */
const process = {
  env: {},
  argv: [],
  version: 'v0.0.0-demo',
  platform: 'browser',
  uptime: () => Math.round(performance.now() / 1000),
  cwd: () => '/',
  nextTick: (fn, ...args) => setTimeout(() => fn(...args), 0),
};

/** Buffer 垫片：只覆盖 auth.js 实际用到的 from/byteLength/concat */
class __Bytes {
  constructor(u8) { this.u8 = u8; }
  get length() { return this.u8.length; }
  toString(enc) {
    if (enc === 'hex') {
      let s = '';
      for (const b of this.u8) s += b.toString(16).padStart(2, '0');
      return s;
    }
    if (enc === 'base64') {
      let s = '';
      for (const b of this.u8) s += String.fromCharCode(b);
      return btoa(s);
    }
    return __td.decode(this.u8);
  }
}

const Buffer = {
  from(x, enc) {
    if (typeof x === 'string') {
      if (enc === 'hex') {
        const n = Math.floor(x.length / 2);
        const u = new Uint8Array(n);
        for (let i = 0; i < n; i++) u[i] = parseInt(x.substr(i * 2, 2), 16) || 0;
        return new __Bytes(u);
      }
      if (enc === 'base64') {
        const pad = x.length % 4 ? '='.repeat(4 - (x.length % 4)) : '';
        const bin = atob(x + pad);
        const u = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        return new __Bytes(u);
      }
      return new __Bytes(__te.encode(x));
    }
    if (x instanceof __Bytes) return new __Bytes(x.u8);
    if (x instanceof Uint8Array) return new __Bytes(x);
    if (x && x.buffer) return new __Bytes(new Uint8Array(x.buffer));
    return new __Bytes(new Uint8Array(0));
  },
  byteLength(s) { return __te.encode(String(s)).length; },
  concat(list) {
    let n = 0;
    for (const a of list) n += (a.u8 || a).length;
    const u = new Uint8Array(n);
    let off = 0;
    for (const a of list) { const b = a.u8 || a; u.set(b, off); off += b.length; }
    return new __Bytes(u);
  },
  isBuffer: () => true,
};

/* ---------------- 纯 JS SHA-256 / HMAC / PBKDF2 ---------------- */

const __SHA_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function __rotr(x, n) { return ((x >>> n) | (x << (32 - n))) >>> 0; }

function __sha256(bytes) {
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const len = bytes.length;
  const total = (((len + 8) >> 6) + 1) << 6;
  const msg = new Uint8Array(total);
  msg.set(bytes);
  msg[len] = 0x80;
  const dv = new DataView(msg.buffer);
  const bitLen = len * 8;
  dv.setUint32(total - 4, bitLen >>> 0, false);
  dv.setUint32(total - 8, Math.floor(bitLen / 4294967296), false);

  const w = new Uint32Array(64);
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = (__rotr(w[i - 15], 7) ^ __rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)) >>> 0;
      const s1 = (__rotr(w[i - 2], 17) ^ __rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)) >>> 0;
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (let i = 0; i < 64; i++) {
      const S1 = (__rotr(e, 6) ^ __rotr(e, 11) ^ __rotr(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const t1 = (h + S1 + ch + __SHA_K[i] + w[i]) >>> 0;
      const S0 = (__rotr(a, 2) ^ __rotr(a, 13) ^ __rotr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  const out = new Uint8Array(32);
  const odv = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) odv.setUint32(i * 4, H[i], false);
  return out;
}

function __cat(a, b) {
  const u = new Uint8Array(a.length + b.length);
  u.set(a, 0); u.set(b, a.length);
  return u;
}

function __hmacSha256(key, msg) {
  const k = key.length > 64 ? __sha256(key) : key;
  const kp = new Uint8Array(64);
  kp.set(k);
  const ip = new Uint8Array(64);
  const op = new Uint8Array(64);
  for (let i = 0; i < 64; i++) { ip[i] = kp[i] ^ 0x36; op[i] = kp[i] ^ 0x5c; }
  return __sha256(__cat(op, __sha256(__cat(ip, msg))));
}

/** PBKDF2-HMAC-SHA256，用于替代服务端的 scrypt（浏览器端同步、无依赖） */
function __pbkdf2(pwdBytes, saltBytes, outLen, iters) {
  const blocks = Math.ceil(outLen / 32);
  const out = new Uint8Array(blocks * 32);
  for (let i = 1; i <= blocks; i++) {
    const idx = new Uint8Array([(i >>> 24) & 255, (i >>> 16) & 255, (i >>> 8) & 255, i & 255]);
    let u = __hmacSha256(pwdBytes, __cat(saltBytes, idx));
    const acc = u.slice();
    for (let j = 1; j < iters; j++) {
      u = __hmacSha256(pwdBytes, u);
      for (let k = 0; k < 32; k++) acc[k] ^= u[k];
    }
    out.set(acc, (i - 1) * 32);
  }
  return out.slice(0, outLen);
}

/* ================= demo/shims.js ================= */
/* ============================================================================
 * Node 内置模块垫片（构建时拼进 public/js/demo/bundle.js）
 *
 * 只实现被 server/ 实际用到的 API。写操作一律抛错，是为了让"意外调用服务端
 * 专属能力"在本地验证阶段就暴露出来，而不是静默失败。
 * ========================================================================== */

/* ---------------- fs（演示模式不使用文件系统） ---------------- */
__define('@fs', function (module, exports) {
  const boom = (fn) => () => { throw new Error(`[demo] 演示模式（纯浏览器）不支持 fs.${fn}()`); };
  module.exports = {
    existsSync: () => false,
    statSync: boom('statSync'),
    readFileSync: boom('readFileSync'),
    writeFileSync: boom('writeFileSync'),
    copyFileSync: boom('copyFileSync'),
    mkdirSync: boom('mkdirSync'),
    readdirSync: () => [],
    createReadStream: boom('createReadStream'),
    promises: null,
  };
});

/* ---------------- path ---------------- */
__define('@path', function (module, exports) {
  const path = {
    sep: '/',
    delimiter: ':',
    join: (...a) => __normPath(a.filter((x) => x !== undefined && x !== null && x !== '').join('/')),
    resolve: (...a) => '/' + __normPath(a.filter(Boolean).join('/')),
    normalize: (p) => __normPath(p),
    extname(p) {
      const b = String(p).split('/').pop() || '';
      const i = b.lastIndexOf('.');
      return i > 0 ? b.slice(i) : '';
    },
    basename(p, ext) {
      let b = String(p).split('/').pop() || '';
      if (ext && b.endsWith(ext)) b = b.slice(0, -ext.length);
      return b;
    },
    dirname(p) {
      const i = String(p).lastIndexOf('/');
      return i < 0 ? '.' : (String(p).slice(0, i) || '/');
    },
    relative(from, to) { return __normPath(to); },
    isAbsolute: (p) => String(p).startsWith('/'),
  };
  path.posix = path;
  module.exports = path;
});

/* ---------------- url ---------------- */
__define('@url', function (module, exports) {
  module.exports = {
    parse(u, parseQuery) {
      const s = String(u || '');
      const qi = s.indexOf('?');
      const pathname = decodeURIComponent(qi < 0 ? s : s.slice(0, qi));
      const search = qi < 0 ? '' : s.slice(qi);
      const query = {};
      if (parseQuery && search) {
        new URLSearchParams(search.slice(1)).forEach((v, k) => { query[k] = v; });
      }
      return { pathname, search, query, href: s, protocol: 'https:', host: location.host };
    },
    format: (o) => String(o && o.href) || '',
    URLSearchParams: window.URLSearchParams,
  };
});

/* ---------------- crypto（纯 JS 实现，保证浏览器可同步调用） ---------------- */
__define('@crypto', function (module, exports) {
  const toBytes = (x) => {
    if (typeof x === 'string') return __te.encode(x);
    if (x && x.u8) return x.u8;
    if (x instanceof Uint8Array) return x;
    return __te.encode(String(x));
  };

  module.exports = {
    randomBytes(n) {
      const u = new Uint8Array(n);
      crypto.getRandomValues(u);
      return new __Bytes(u);
    },
    /** 替代 Node 的 scryptSync：同为「加盐慢哈希」，形态一致即可 */
    scryptSync(pwd, salt, keylen) {
      return new __Bytes(__pbkdf2(toBytes(pwd), toBytes(salt), keylen || 64, 1000));
    },
    createHmac(alg, key) {
      const k = toBytes(key);
      const chunks = [];
      return {
        update(d) { chunks.push(toBytes(d)); return this; },
        digest() {
          let total = 0;
          for (const c of chunks) total += c.length;
          const msg = new Uint8Array(total);
          let off = 0;
          for (const c of chunks) { msg.set(c, off); off += c.length; }
          return __hmacSha256(k, msg);
        },
      };
    },
    timingSafeEqual(a, b) {
      const x = a && a.u8 ? a.u8 : a;
      const y = b && b.u8 ? b.u8 : b;
      if (!x || !y || x.length !== y.length) return false;
      let r = 0;
      for (let i = 0; i < x.length; i++) r |= x[i] ^ y[i];
      return r === 0;
    },
    createHash(alg) {
      const chunks = [];
      return {
        update(d) { chunks.push(toBytes(d)); return this; },
        digest(enc) {
          let total = 0;
          for (const c of chunks) total += c.length;
          const msg = new Uint8Array(total);
          let off = 0;
          for (const c of chunks) { msg.set(c, off); off += c.length; }
          const out = new __Bytes(__sha256(msg));
          return enc ? out.toString(enc) : out;
        },
      };
    },
  };
});

/* ---------------- http（浏览器里没有服务器） ---------------- */
__define('@http', function () {
  throw new Error('[demo] 演示模式为纯静态托管，不需要 http.createServer()');
});

/* ================= demo/db.browser.js → 替换 server/lib/db.js ================= */
__define("server/lib/db.js", function (module, exports, require, __dirname, __filename) {
/* ============================================================================
 * 浏览器端数据层（构建时以 server/lib/db.js 的身份注册）
 *
 * 对外 API 与服务端 lib/db.js 完全一致（all/find/findOne/insert/insertMany/
 * update/remove/removeWhere/count/nextSeq），因此上层路由与 AI 引擎无需任何改动。
 * 区别只在存储介质：Node 写 data/*.json → 浏览器写 localStorage。
 * ========================================================================== */

const __DB_PREFIX = 'hq_demo_v1:';
const __DB_SCHEMA = '1';
const __PERSIST_MAX = 900 * 1024; // 单集合持久化上限，超出则裁剪历史日志

function __storage() {
  try {
    localStorage.setItem('__hq_probe', '1');
    localStorage.removeItem('__hq_probe');
    return localStorage;
  } catch (e) {
    return null; // 隐私模式等场景：退化为纯内存，功能仍可用
  }
}

const __ls = __storage();
const __memory = {};

function __readRaw(key) {
  if (!__ls) return __memory[key] === undefined ? null : __memory[key];
  return __ls.getItem(key);
}
function __writeRaw(key, val) {
  if (!__ls) { __memory[key] = val; return true; }
  try { __ls.setItem(key, val); return true; } catch (e) { return false; }
}
function __removeRaw(key) {
  if (!__ls) { delete __memory[key]; return; }
  __ls.removeItem(key);
}

class Collection {
  constructor(name, seedFn) {
    this.name = name;
    this.key = __DB_PREFIX + name;
    this.dirty = false;
    this.timer = null;
    const raw = __readRaw(this.key);
    if (raw) {
      try {
        this.items = JSON.parse(raw);
      } catch (e) {
        console.warn(`[demo-db] ${name} 解析失败，已重建`, e.message);
        this.items = seedFn ? seedFn() : [];
        this.flush();
      }
    } else {
      this.items = seedFn ? seedFn() : [];
      this.flush();
    }
  }

  flush() {
    let payload = JSON.stringify(this.items);
    // 超出上限时裁剪最旧记录（仅日志类集合会触发）
    if (payload.length > __PERSIST_MAX && this.items.length > 50) {
      this.items = this.items.slice(-50);
      payload = JSON.stringify(this.items);
    }
    const okWrite = __writeRaw(this.key, payload);
    if (!okWrite) {
      console.warn(`[demo-db] ${this.name} 写入失败（可能存储已满），本次仅保留在内存中`);
    }
    this.dirty = false;
  }

  /** 延迟合并写入：种子数据批量插入时只落盘一次 */
  save() {
    this.dirty = true;
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.dirty) this.flush();
    }, 40);
  }

  all() { return this.items; }

  find(pred) {
    if (typeof pred === 'function') return this.items.filter(pred);
    return this.items.filter((it) => Object.keys(pred).every((k) => it[k] === pred[k]));
  }

  findOne(pred) {
    if (typeof pred === 'function') return this.items.find(pred) || null;
    return this.items.find((it) => Object.keys(pred).every((k) => it[k] === pred[k])) || null;
  }

  insert(doc) {
    if (!doc.id) doc.id = uid();
    if (!doc.created_at) doc.created_at = now();
    doc.updated_at = now();
    this.items.push(doc);
    this.save();
    return doc;
  }

  insertMany(docs) {
    docs.forEach((d) => {
      if (!d.id) d.id = uid();
      if (!d.created_at) d.created_at = now();
    });
    this.items.push(...docs);
    this.save();
    return docs;
  }

  update(id, patch) {
    const idx = this.items.findIndex((it) => it.id === id);
    if (idx === -1) return null;
    this.items[idx] = { ...this.items[idx], ...patch, updated_at: now() };
    this.save();
    return this.items[idx];
  }

  remove(id) {
    const idx = this.items.findIndex((it) => it.id === id);
    if (idx === -1) return false;
    this.items.splice(idx, 1);
    this.save();
    return true;
  }

  removeWhere(pred) {
    const before = this.items.length;
    this.items = this.items.filter((it) => !pred(it));
    if (this.items.length !== before) this.save();
    return before - this.items.length;
  }

  count(pred) { return pred ? this.find(pred).length : this.items.length; }

  nextSeq(key, start = 1) {
    const meta = db.meta.findOne({ id: 'seq' }) || db.meta.insert({ id: 'seq', data: {} });
    const cur = (meta.data && meta.data[key]) || start - 1;
    const next = cur + 1;
    meta.data[key] = next;
    db.meta.update('seq', { data: meta.data });
    return next;
  }
}

function uid() {
  return (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).toUpperCase();
}

function now() { return new Date().toISOString(); }

const db = {
  users: new Collection('users'),
  orgs: new Collection('orgs'),
  quotes: new Collection('quotes'),
  quote_items: new Collection('quote_items'),
  customers: new Collection('customers'),
  templates: new Collection('templates'),
  library: new Collection('library'),
  orders: new Collection('orders'),
  credits: new Collection('credits'),
  ai_logs: new Collection('ai_logs'),
  sessions: new Collection('sessions'),
  meta: new Collection('meta'),
  notifications: new Collection('notifications'),
};

/** 页面关闭前强制落盘，避免防抖窗口内数据丢失 */
function flushAll() {
  Object.values(db).forEach((c) => { if (c.timer) { clearTimeout(c.timer); c.timer = null; } if (c.dirty) c.flush(); });
}

/** 清空全部演示数据（下次访问重新播种） */
function resetAll() {
  Object.keys(db).forEach((k) => __removeRaw(__DB_PREFIX + k));
  __removeRaw(__DB_PREFIX + 'schema');
}

if (typeof addEventListener === 'function') {
  addEventListener('pagehide', flushAll);
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushAll(); });
}

module.exports = { db, uid, now, DATA_DIR: 'localStorage', flushAll, resetAll, SCHEMA: __DB_SCHEMA, PREFIX: __DB_PREFIX };
});

/* ================= server/lib/http.js ================= */
__define("server/lib/http.js", function (module, exports, require, __dirname, __filename) {
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
});

/* ================= server/lib/auth.js ================= */
__define("server/lib/auth.js", function (module, exports, require, __dirname, __filename) {
/**
 * 认证与授权：密码哈希 + JWT（HS256，零依赖手写）
 */
const crypto = require('crypto');
const { db, uid, now } = require('./db');
const { fail } = require('./http');

const SECRET = process.env.HQ_SECRET || 'homequote-cloud-dev-secret-2026';
const TOKEN_TTL = 60 * 60 * 24 * 7;      // 7 天
const REFRESH_TTL = 60 * 60 * 24 * 30;   // 30 天

/* ---------------- 密码 ---------------- */
function hashPassword(pwd) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pwd), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(pwd, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hash] = parts;
  try {
    const test = crypto.scryptSync(String(pwd), salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
  } catch (e) {
    return false;
  }
}

/* ---------------- JWT ---------------- */
function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function sign(payload, ttl = TOKEN_TTL) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(
    JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + ttl })
  );
  const sig = b64url(crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

function verify(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expect = b64url(crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest());
  if (expect !== sig) return null;
  try {
    const payload = JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function issueTokens(user) {
  return {
    access_token: sign({ sub: user.id, role: user.role, org: user.org_id }, TOKEN_TTL),
    refresh_token: sign({ sub: user.id, type: 'refresh' }, REFRESH_TTL),
    expires_in: TOKEN_TTL,
  };
}

/* ---------------- 中间件 ---------------- */
function parseAuth(req) {
  const raw = req.headers.authorization || req.headers.Authorization || '';
  const token = raw.startsWith('Bearer ') ? raw.slice(7) : (raw || '');
  if (!token) return null;
  const payload = verify(token);
  if (!payload || !payload.sub) return null;
  const user = db.users.findOne({ id: payload.sub });
  if (!user) return null;
  if (user.status === 'disabled') return null;
  return user;
}

function requireAuth(req, res) {
  const user = parseAuth(req);
  if (!user) {
    fail(res, '登录状态已失效，请重新登录。', 401, 'UNAUTHORIZED');
    return null;
  }
  req.user = user;
  return user;
}

function requireAdmin(req, res) {
  const user = requireAuth(req, res);
  if (!user) return null;
  if (!['owner', 'admin'].includes(user.role) && !user.is_platform_admin) {
    fail(res, '仅管理员可执行此操作。', 403, 'FORBIDDEN');
    return null;
  }
  return user;
}

function requirePlatformAdmin(req, res) {
  const user = requireAuth(req, res);
  if (!user) return null;
  if (!user.is_platform_admin) {
    fail(res, '仅平台管理员可执行此操作。', 403, 'FORBIDDEN');
    return null;
  }
  return user;
}

/* ---------------- 校验 ---------------- */
function validPhone(p) { return /^1[3-9]\d{9}$/.test(String(p || '').trim()); }
function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim()); }

function publicUser(u) {
  if (!u) return null;
  const { password_hash, ...rest } = u;
  return rest;
}

module.exports = {
  hashPassword, verifyPassword,
  sign, verify, issueTokens,
  parseAuth, requireAuth, requireAdmin, requirePlatformAdmin,
  validPhone, validEmail, publicUser,
};
});

/* ================= server/lib/seed.js ================= */
__define("server/lib/seed.js", function (module, exports, require, __dirname, __filename) {
/**
 * 数据初始化：系统内置工艺库 + 组织副本 + 演示数据
 */
const { db, uid, now } = require('./db');
const { buildItems, GROUPS } = require('../../seed/library');

/** 确保系统内置工艺库存在（org_id 为 null） */
function initSystemLibrary() {
  const exist = db.library.count((it) => !it.org_id);
  if (exist > 0) return exist;
  const items = buildItems().map((it) => ({ ...it, org_id: null, created_at: now() }));
  db.library.insertMany(items);
  db.library.flush();
  console.log(`[seed] 已初始化系统工艺库 ${items.length} 条`);
  return items.length;
}

/** 为新组织复制一份可编辑的工艺库副本 */
function seedLibraryForOrg(orgId, opts = {}) {
  const exist = db.library.count((it) => it.org_id === orgId);
  if (exist > 0 && !opts.force) return exist;
  if (exist > 0) db.library.removeWhere((it) => it.org_id === orgId);

  const systemItems = db.library.find((it) => !it.org_id);
  const src = systemItems.length ? systemItems : buildItems().map((it) => ({ ...it, org_id: null }));
  const copies = src.map((it) => ({
    ...it,
    id: uid(),
    org_id: orgId,
    source: 'copy',
    group_key: it.group_key || (GROUPS.find((g) => g.name === it.group_name) || {}).key || 'misc',
    created_at: now(),
  }));
  db.library.insertMany(copies);
  db.library.flush();
  return copies.length;
}

/** 重置组织工艺库到系统默认 */
function resetOrgLibrary(orgId) {
  return seedLibraryForOrg(orgId, { force: true });
}

/** 为演示账号生成示例空间模板（用于模板管理页与智能造价复用） */
function seedDemoTemplates(userId, orgId) {
  if (db.templates.count((t) => t.org_id === orgId)) return 0;

  const tpls = [
    {
      name: '刚需三房 · 现代简约',
      layout: '三室两厅两卫', building_area: 108, tier: '中档',
      note: '面向首次装修的三居室，主打收纳与动线效率，主材国产一线品牌。',
      spaces: [
        { name: '玄关', area: 4 }, { name: '客厅', area: 26 }, { name: '餐厅', area: 12 },
        { name: '主卧', area: 16 }, { name: '次卧', area: 12 }, { name: '次卧2', area: 10 },
        { name: '厨房', area: 8 }, { name: '主卫', area: 5 }, { name: '客卫', area: 4 },
        { name: '阳台', area: 6 }, { name: '走廊', area: 5 },
      ],
    },
    {
      name: '婚房两居 · 轻奢奶油风',
      layout: '两室两厅一卫', building_area: 89, tier: '高档',
      note: '老房翻新，全屋重做水电，重点投入客餐厅与主卧氛围。',
      spaces: [
        { name: '玄关', area: 3.5 }, { name: '客厅', area: 22 }, { name: '餐厅', area: 10 },
        { name: '主卧', area: 14 }, { name: '次卧', area: 11 }, { name: '厨房', area: 7 },
        { name: '卫生间', area: 4.5 }, { name: '阳台', area: 5 }, { name: '走廊', area: 4 },
        { name: '储物间', area: 8 },
      ],
    },
    {
      name: '改善四房 · 全屋定制',
      layout: '四室两厅两卫', building_area: 132, tier: '高档',
      note: '改善型四居，含独立书房与全屋定制柜体，注重静音与收纳。',
      spaces: [
        { name: '玄关', area: 4 }, { name: '客厅', area: 28 }, { name: '餐厅', area: 14 },
        { name: '主卧', area: 18 }, { name: '次卧', area: 13 }, { name: '次卧2', area: 12 },
        { name: '书房', area: 11 }, { name: '厨房', area: 9 }, { name: '主卫', area: 6 },
        { name: '客卫', area: 5 }, { name: '阳台', area: 7 }, { name: '走廊', area: 5 },
      ],
    },
  ];

  const docs = tpls.map((t) => db.templates.insert({
    id: uid(),
    org_id: orgId,
    user_id: userId,
    building_type: '高层',
    house_type: '新房',
    city: '合肥',
    source: 'preset',
    created_at: now(),
    ...t,
  }));
  db.templates.flush();
  return docs.length;
}

/** 为演示账号生成示例报价 */
function seedDemoQuotes(userId, orgId) {
  if (db.quotes.count((q) => q.org_id === orgId)) return 0;

  seedDemoTemplates(userId, orgId);

  const customers = [
    { name: '王女士', phone: '13805610001', community: '华润·幸福里', building_area: 108, layout: '三室两厅两卫' },
    { name: '李先生', phone: '13905610002', community: '万科·森林公园', building_area: 89, layout: '两室两厅一卫' },
    { name: '张女士', phone: '13705610003', community: '保利·西山林语', building_area: 132, layout: '四室两厅两卫' },
  ].map((c) => db.customers.insert({ id: uid(), org_id: orgId, ...c, source: '到店', status: 'following', created_at: now() }));

  const ai = require('./ai');
  const demo = [
    { customer: customers[0], city: '合肥', tier: '中档', house_type: '新房', status: 'issued', days: 2 },
    { customer: customers[1], city: '合肥', tier: '简装', house_type: '老房', house_age: 15, status: 'won', days: 12 },
    { customer: customers[2], city: '合肥', tier: '高档', house_type: '新房', status: 'draft', days: 0 },
  ];

  let n = 0;
  for (const d of demo) {
    const est = ai.estimate({
      city: d.city,
      building_area: d.customer.building_area,
      layout: d.customer.layout,
      tier: d.tier,
      house_type: d.house_type,
      house_age: d.house_age || 0,
      building_type: '高层',
      floor: 8,
      has_elevator: true,
    });
    const qid = uid();
    const total = est.total;
    const quote = db.quotes.insert({
      id: qid,
      org_id: orgId,
      user_id: userId,
      quote_number: genQuoteNo(orgId),
      title: `${d.customer.community} ${d.customer.building_area}㎡ ${d.customer.layout} 装修报价`,
      customer_id: d.customer.id,
      customer_name: d.customer.name,
      customer_phone: d.customer.phone,
      community: d.customer.community,
      city: d.city,
      province: '安徽',
      building_area: d.customer.building_area,
      layout: d.customer.layout,
      tier: d.tier,
      house_type: d.house_type,
      house_age: d.house_age || 0,
      floor: 8,
      building_type: '高层',
      status: d.status,
      total_amount: total,
      cost_amount: est.cost_total,
      margin_rate: est.gross_margin,
      item_count: est.items.length,
      notes: '',
      created_at: new Date(Date.now() - d.days * 86400000).toISOString(),
      updated_at: now(),
    });
    db.quote_items.insertMany(
      est.items.map((it) => ({ ...it, id: uid(), quote_id: qid, org_id: orgId, created_at: now() }))
    );
    n += 1;
  }
  db.quotes.flush();
  db.quote_items.flush();
  return n;
}

function genQuoteNo(orgId) {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const seq = db.quotes.count((q) => q.org_id === orgId) + 1;
  return `BJ${ymd}${String(seq).padStart(3, '0')}`;
}

module.exports = { initSystemLibrary, seedLibraryForOrg, resetOrgLibrary, seedDemoQuotes, seedDemoTemplates, genQuoteNo };
});

/* ================= server/lib/ai.js ================= */
__define("server/lib/ai.js", function (module, exports, require, __dirname, __filename) {
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
   二、工程量计算模型
   ========================================================= */

function libItem(name, orgId) {
  // 优先取系统内置基准库，其次取组织自有库
  return (
    db.library.findOne((it) => it.name === name && !it.org_id) ||
    (orgId ? db.library.findOne((it) => it.name === name && it.org_id === orgId) : null) ||
    db.library.findOne((it) => it.name === name) ||
    null
  );
}

function libPrice(name, fallback) {
  const it = libItem(name);
  return it ? it.price : fallback;
}

function libCost(name, fallbackRatio = 0.66) {
  const it = libItem(name);
  if (it) return it.cost || Math.round(it.price * 0.68 * 100) / 100;
  return Math.round((libPrice(name, 0) || 0) * fallbackRatio * 100) / 100;
}

function libUnit(name, fallback) {
  const it = libItem(name);
  return it ? it.unit : fallback;
}

/**
 * 取当前组织可用的工艺库：优先该组织自有副本，否则回落到系统基准库
 * 注意：绝不返回全库，否则会把其他组织的数据混进来
 */
function scopeItems(orgId) {
  const own = orgId ? db.library.find((it) => it.org_id === orgId) : [];
  if (own.length) return own;
  return db.library.find((it) => !it.org_id);
}

/**
 * 按空间生成报价条目
 * @param {Object} p 项目参数
 * @returns {{items:Array, assumptions:Array}}
 */
function generateQuoteItems(p) {
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
  const push = (group, name, qty, unitOverride) => {
    const unit = unitOverride || libUnit(name, '项');
    const price = Math.round(libPrice(name, 50) * k * 100) / 100;
    const cost = Math.round(libCost(name) * k * 100) / 100;
    if (qty <= 0) return;
    items.push({
      group_name: group,
      name,
      unit,
      qty: Math.round(qty * 100) / 100,
      unit_price: price,
      cost_price: cost,
      amount: Math.round(price * qty * 100) / 100,
      craft: (libItem(name) || {}).craft || '',
      source: 'ai',
    });
  };

  /* --- 1. 拆除与保护（老房 / 翻新） --- */
  if (isOld) {
    push('拆除与保护', '旧墙皮铲除', totalUsable * 2.4);
    push('拆除与保护', '地面瓷砖拆除', totalUsable * 0.9);
    push('拆除与保护', '墙体拆除（非承重）', Math.max(0, totalUsable * 0.06));
    push('拆除与保护', '洁具拆除', 2);
    push('拆除与保护', '垃圾装袋外运', Math.max(3, area * 0.09));
  }
  push('拆除与保护', '成品保护（地面）', totalUsable * 0.9);
  push('拆除与保护', '成品保护（门窗家具）', 1);
  if (!has_elevator && floor > 3) {
    push('拆除与保护', '上楼费（3层以上每层）', floor - 3);
  }

  /* --- 2. 水电工程 --- */
  const wireLen = isOld ? area * 4.2 : area * 3.2;
  const pipeLen = isOld ? area * 0.85 : area * 0.6;
  push('水电工程', '强电布线 2.5mm²（暗线含开槽）', wireLen);
  push('水电工程', '强电布线 4mm²（空调/厨房）', area * 0.9);
  push('水电工程', '给水管改造 PPR（暗管含开槽）', pipeLen);
  push('水电工程', '排水管改造 PVC', area * 0.35);
  push('水电工程', '弱电布线（超五类网线）', area * 0.8);
  push('水电工程', '电线开槽（砖墙）', wireLen * 0.7);
  push('水电工程', '底盒安装', Math.round(area * 0.55));
  push('水电工程', '水管试压', 1);
  push('水电工程', '配电箱安装', isOld ? 1 : 0);
  push('水电工程', '开关插座安装（五孔）', Math.round(area * 0.45));
  push('水电工程', '地漏安装', Math.max(2, Math.round(bathArea / 3)));

  /* --- 3. 泥瓦工程 --- */
  push('泥瓦工程', '地面现拌砂浆找平', totalUsable * 0.9);
  push('泥瓦工程', '厨卫墙地面防水（聚合物水泥基三遍）', (kitchenArea + bathArea) * 1.75);
  push('泥瓦工程', '闭水试验', 1);
  push('泥瓦工程', '墙砖薄贴（300×600）', kitchenArea * 2.2 + bathArea * 3.4);
  push('泥瓦工程', '地砖薄贴（800×800）', totalUsable * 0.78);
  push('泥瓦工程', '瓷砖美缝', (kitchenArea * 2.2 + bathArea * 3.4 + totalUsable * 0.78) * 0.85);
  push('泥瓦工程', '踢脚线安装（瓷砖/石材）', totalUsable * 0.32);
  push('泥瓦工程', '门槛石/窗台石安装', Math.max(4, Object.keys(spaceMap).length * 0.9));
  push('泥瓦工程', '厨卫包立管', Math.max(1, Math.round((kitchenArea + bathArea) / 12)));
  push('泥瓦工程', '墙面拉毛处理', kitchenArea * 2.2 + bathArea * 3.4);
  push('泥瓦工程', '墙面界面剂（墙固）', totalUsable * 2.4);

  /* --- 4. 木作吊顶 --- */
  const ceilArea = totalUsable * (tier === '简装' ? 0.12 : tier === '中档' ? 0.22 : 0.34);
  if (ceilArea > 3) {
    push('木作吊顶', '轻钢龙骨石膏板平吊顶', ceilArea * 0.7);
    push('木作吊顶', '局部吊顶（边顶/灯槽）', totalUsable * 0.28);
  }
  push('木作吊顶', '铝扣板吊顶（厨卫）', kitchenArea + bathArea);
  push('木作吊顶', '石膏线安装', totalUsable * 0.42);
  push('木作吊顶', '木作窗帘盒', Object.keys(spaceMap).filter((n) => !n.includes('卫') && !n.includes('厨')).length * 3.2);
  if (tier === '高档' || tier === '定制') {
    push('木作吊顶', '电视背景墙基层', 8);
  }

  /* --- 5. 油漆涂装 --- */
  const wallArea = totalUsable * 2.5;
  push('油漆涂装', '墙面基层修补', wallArea * 0.35);
  push('油漆涂装', '墙面挂网（防裂）', wallArea * (isOld ? 1 : 0.35));
  push('油漆涂装', '腻子批刮（三遍）', wallArea);
  push('油漆涂装', '墙面打磨', wallArea);
  push('油漆涂装', '墙面刷乳胶漆（底漆一遍+面漆两遍）', wallArea * 0.82);
  push('油漆涂装', '顶面刷乳胶漆', totalUsable * 0.9);
  push('油漆涂装', '乳胶漆调色（每色）', tier === '简装' ? 0 : 1);
  push('油漆涂装', '石膏线刷漆', totalUsable * 0.42);

  /* --- 6. 安装五金 --- */
  push('安装五金', '筒灯/射灯安装', Math.round(area * 0.28));
  push('安装五金', '主灯安装', Math.max(3, Object.keys(spaceMap).length - 2));
  push('安装五金', '开关插座面板安装', Math.round(area * 0.45));
  push('安装五金', '木地板安装', totalUsable * (tier === '简装' ? 0.45 : 0.62));
  push('安装五金', '室内门安装', Math.max(2, Object.keys(spaceMap).filter((n) => n.includes('卧') || n.includes('书房')).length + 1));
  push('安装五金', '窗台石英石安装', Math.max(3, Object.keys(spaceMap).length * 0.7));
  push('安装五金', '马桶安装', layout.includes('两卫') ? 2 : 1);
  push('安装五金', '浴室柜/台盆安装', layout.includes('两卫') ? 2 : 1);
  push('安装五金', '淋浴花洒安装', layout.includes('两卫') ? 2 : 1);
  push('安装五金', '窗帘杆/轨道安装', Math.max(4, Object.keys(spaceMap).length * 2.4));
  push('安装五金', '晾衣架安装', 1);
  push('安装五金', '毛巾架/五金挂件安装', layout.includes('两卫') ? 6 : 4);

  /* --- 7. 定制主材（中高档才含） --- */
  if (pkg && (pkg.code === 'hardcover-all' || tier === '高档' || tier === '定制')) {
    push('定制主材', '橱柜地柜（含台面）', Math.max(2.5, kitchenArea * 0.55));
    push('定制主材', '橱柜吊柜', Math.max(1.8, kitchenArea * 0.4));
    push('定制主材', '衣柜柜体（投影面积）', Math.max(4, totalUsable * 0.075));
    push('定制主材', '玄关柜/鞋柜', 1.6);
  }

  /* --- 8. 措施与其他 --- */
  push('措施与其他', '施工管理费', area);
  push('措施与其他', '竣工开荒保洁', totalUsable);
  push('措施与其他', '材料运输费', 1);
  push('措施与其他', '施工水电费', 1);
  if (!isOld) push('措施与其他', '成品保护费', 1);

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
function estimate(p) {
  const { items, assumptions } = generateQuoteItems(p);
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
    const res = estimate({ ...p, pkg });
    return {
      ...res,
      summary: `按 ${p.city || '当地'} ${p.building_area}m² ${p.layout || ''} ${p.tier || '中档'} 口径，综合空间清单与工艺库生成，共 ${res.items.length} 条明细。`,
    };
  },

  'full-estimate': async (p) => FEATURES['smart-estimate'](p),

  'estimate-cost': async (p) => {
    const res = estimate(p);
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
    const all = db.library.all();
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
    const lib = db.library.findOne((x) => x.name === p.item_name) ||
      db.library.findOne((x) => (x.tags || []).some((t) => String(p.item_name || '').includes(t)));
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
    const lib = db.library.findOne((x) => x.name === name);
    if (!lib) return { suggestions: [] };
    const cf = cityFactor(p.city);
    const sug = db.library
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

    const anomalies = items
      .filter((i) => {
        const lib = db.library.findOne((x) => x.name === i.name);
        if (!lib) return false;
        const price = Number(i.unit_price) || 0;
        return price > lib.price * 1.35 || price < lib.price * 0.62;
      })
      .map((i) => {
        const lib = db.library.findOne((x) => x.name === i.name);
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
    const items = scopeItems(p.org_id);
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
    const items = scopeItems(p.org_id);
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
    const logs = db.ai_logs.all().slice(-500);
    const byUser = {};
    logs.forEach((l) => { byUser[l.user_id] = (byUser[l.user_id] || 0) + 1; });
    const alerts = [];
    Object.entries(byUser).forEach(([uid, count]) => {
      if (count > 60) {
        const u = db.users.findOne({ id: uid });
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
  provider,
};
});

/* ================= server/routes/auth.js ================= */
__define("server/routes/auth.js", function (module, exports, require, __dirname, __filename) {
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
});

/* ================= server/routes/quotes.js ================= */
__define("server/routes/quotes.js", function (module, exports, require, __dirname, __filename) {
/**
 * 报价管理：CRUD + 状态机 + 明细 + 付款条款 + 审计 + 分享
 */
const { db, uid, now } = require('../lib/db');
const A = require('../lib/auth');
const { ok, fail } = require('../lib/http');
const { genQuoteNo } = require('../lib/seed');

const STATUS_LABEL = {
  draft: '草稿',
  pending_approval: '待审批',
  approved: '已通过',
  rejected: '已驳回',
  final: '终稿',
  issued: '已签发',
  won: '已成交',
  lost: '未成交',
  paused: '已暂停',
  abandoned: '已放弃',
  archived: '已归档',
};

/** 允许的状态流转 */
const TRANSITIONS = {
  draft: ['pending_approval', 'final', 'issued', 'archived'],
  pending_approval: ['approved', 'rejected', 'draft'],
  approved: ['final', 'draft'],
  rejected: ['draft'],
  final: ['issued', 'draft'],
  issued: ['won', 'lost', 'paused', 'abandoned'],
  paused: ['issued', 'lost'],
  won: [],
  lost: [],
  abandoned: ['draft'],
  archived: ['draft'],
};

function itemsOf(quoteId) {
  return db.quote_items.find({ quote_id: quoteId }).map((i) => ({
    ...i,
    subtotal: Math.round((Number(i.unit_price) || 0) * (Number(i.qty) || 0) * 100) / 100,
  }));
}

function recalc(quoteId) {
  const items = itemsOf(quoteId);
  const total = Math.round(items.reduce((s, i) => s + (Number(i.unit_price) || 0) * (Number(i.qty) || 0), 0) * 100) / 100;
  const cost = Math.round(items.reduce((s, i) => s + (Number(i.cost_price) || 0) * (Number(i.qty) || 0), 0) * 100) / 100;
  const q = db.quotes.findOne({ id: quoteId });
  const taxRate = Number(q && q.tax_rate) || 0;
  const manageFee = Number(q && q.manage_fee) || 0;
  const grand = Math.round((total + manageFee) * (1 + taxRate / 100) * 100) / 100;
  return db.quotes.update(quoteId, {
    total_amount: total,
    cost_amount: cost,
    grand_total: grand,
    margin_rate: grand ? Math.round((grand - cost) / grand * 1000) / 10 : 0,
    item_count: items.length,
  });
}

function withItems(q) {
  if (!q) return null;
  return { ...q, items: itemsOf(q.id), status_label: STATUS_LABEL[q.status] || q.status };
}

module.exports = function register(api) {

  /* ---------------- 列表 ---------------- */
  api.get('/quotes', async (req, res) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const q = req.query || {};
    let list = db.quotes.find((x) => x.org_id === user.org_id && x.status !== 'archived');

    if (q.status && q.status !== 'all') list = list.filter((x) => x.status === q.status);
    if (q.keyword) {
      const kw = String(q.keyword).toLowerCase();
      list = list.filter((x) =>
        [x.title, x.customer_name, x.community, x.quote_number, x.city].some((v) => String(v || '').toLowerCase().includes(kw))
      );
    }
    if (q.range && q.range !== 'all') list = filterByRange(list, q.range);

    list.sort((a, b) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)));
    ok(res, {
      items: list,
      total: list.length,
      stats: quoteStats(db.quotes.find((x) => x.org_id === user.org_id)),
    });
  });

  api.get('/quotes/stats', async (req, res) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const q = req.query || {};
    let list = db.quotes.find((x) => x.org_id === user.org_id);
    if (q.range && q.range !== 'all') list = filterByRange(list, q.range);
    ok(res, quoteStats(list));
  });

  /* ---------------- 详情 ---------------- */
  api.get('/quotes/:id', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const q = db.quotes.findOne({ id: params.id });
    if (!q || q.org_id !== user.org_id) return fail(res, '报价不存在。', 404);
    ok(res, withItems(q));
  });

  /* ---------------- 新建 ---------------- */
  api.post('/quotes', async (req, res, body) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const quote = db.quotes.insert({
      id: uid(),
      org_id: user.org_id,
      user_id: user.id,
      quote_number: genQuoteNo(user.org_id),
      title: body.title || '未命名报价',
      customer_id: body.customer_id || '',
      customer_name: body.customer_name || '',
      customer_phone: body.customer_phone || '',
      community: body.community || '',
      province: body.province || '',
      city: body.city || '',
      building_area: Number(body.building_area) || 0,
      layout: body.layout || '',
      tier: body.tier || '中档',
      house_type: body.house_type || '新房',
      house_age: Number(body.house_age) || 0,
      floor: Number(body.floor) || 0,
      building_type: body.building_type || '高层',
      has_elevator: body.has_elevator !== false,
      status: 'draft',
      total_amount: 0, cost_amount: 0, grand_total: 0, margin_rate: 0,
      manage_fee: Number(body.manage_fee) || 0,
      tax_rate: Number(body.tax_rate) || 0,
      notes: body.notes || '',
      share_token: '',
      export_unlocked: false,
      created_at: now(), updated_at: now(),
    });
    ok(res, withItems(quote), 201);
  });

  /* ---------------- 更新 ---------------- */
  api.put('/quotes/:id', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const q = db.quotes.findOne({ id: params.id });
    if (!q || q.org_id !== user.org_id) return fail(res, '报价不存在。', 404);
    if (['won', 'lost'].includes(q.status)) return fail(res, '已结案的报价不可再修改，请先撤回状态。');

    const allow = ['title', 'customer_id', 'customer_name', 'customer_phone', 'community', 'province',
      'city', 'building_area', 'layout', 'tier', 'house_type', 'house_age', 'floor', 'building_type',
      'has_elevator', 'notes', 'manage_fee', 'tax_rate', 'valid_days', 'payment_terms'];
    const patch = {};
    allow.forEach((k) => { if (body[k] !== undefined) patch[k] = body[k]; });

    db.quotes.update(params.id, patch);
    recalc(params.id);
    logHistory(params.id, user, 'update', '更新报价信息');
    ok(res, withItems(db.quotes.findOne({ id: params.id })));
  });

  api.del('/quotes/:id', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const q = db.quotes.findOne({ id: params.id });
    if (!q || q.org_id !== user.org_id) return fail(res, '报价不存在。', 404);
    if (!['owner', 'admin'].includes(user.role) && q.user_id !== user.id) {
      return fail(res, '仅管理员或创建人可删除。', 403);
    }
    if (q.status === 'won') return fail(res, '已成交的报价不可删除（财务与业绩留痕要求）。如需作废，请先改为「未成交」或「已归档」。', 403);
    if (q.status === 'issued') return fail(res, '已签发的报价不可直接删除，请先置为「已归档」再删除。', 403);
    db.quote_items.removeWhere((it) => it.quote_id === params.id);
    db.quotes.remove(params.id);
    ok(res, { ok: true });
  });

  api.post('/quotes/:id/duplicate', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const src = db.quotes.findOne({ id: params.id });
    if (!src || src.org_id !== user.org_id) return fail(res, '报价不存在。', 404);
    const { id, created_at, updated_at, quote_number, ...rest } = src;
    const copy = db.quotes.insert({
      ...rest,
      id: uid(),
      quote_number: genQuoteNo(user.org_id),
      title: `${src.title}（副本）`,
      status: 'draft',
      share_token: '',
      export_unlocked: false,
      created_at: now(), updated_at: now(),
    });
    db.quote_items.insertMany(
      itemsOf(params.id).map((it) => ({ ...it, id: uid(), quote_id: copy.id, created_at: now() }))
    );
    ok(res, withItems(copy), 201);
  });

  /* ---------------- 明细 ---------------- */
  api.get('/quotes/:id/items', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    ok(res, itemsOf(params.id));
  });

  api.post('/quotes/:id/items', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const q = db.quotes.findOne({ id: params.id });
    if (!q || q.org_id !== user.org_id) return fail(res, '报价不存在。', 404);
    const item = db.quote_items.insert({
      id: uid(),
      quote_id: params.id,
      org_id: user.org_id,
      group_name: body.group_name || '未分类',
      name: body.name || '新项目',
      unit: body.unit || '项',
      qty: Number(body.qty) || 1,
      unit_price: Number(body.unit_price) || 0,
      cost_price: Number(body.cost_price) || 0,
      craft: body.craft || '',
      remark: body.remark || '',
      source: body.source || 'manual',
      created_at: now(),
      amount: Math.round((Number(body.unit_price) || 0) * (Number(body.qty) || 1) * 100) / 100,
    });
    recalc(params.id);
    ok(res, { ...item, subtotal: item.amount }, 201);
  });

  api.put('/quotes/:id/items/:itemId', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const item = db.quote_items.findOne({ id: params.itemId });
    if (!item || item.quote_id !== params.id) return fail(res, '明细不存在。', 404);
    const allow = ['group_name', 'name', 'unit', 'qty', 'unit_price', 'cost_price', 'craft', 'remark'];
    const patch = {};
    allow.forEach((k) => { if (body[k] !== undefined) patch[k] = body[k]; });
    patch.amount = Math.round((Number(patch.unit_price ?? updated.unit_price) || 0) * (Number(patch.qty ?? updated.qty) || 0) * 100) / 100;
    const updated = db.quote_items.update(params.itemId, patch);
    recalc(params.id);
    ok(res, { ...updated, subtotal: updated.amount });
  });

  api.del('/quotes/:id/items/:itemId', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    db.quote_items.remove(params.itemId);
    recalc(params.id);
    ok(res, { ok: true });
  });

  /** 批量保存明细（编辑器整表保存） */
  api.post('/quotes/:id/items/batch', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const q = db.quotes.findOne({ id: params.id });
    if (!q || q.org_id !== user.org_id) return fail(res, '报价不存在。', 404);
    const list = Array.isArray(body.items) ? body.items : [];
    const keepIds = new Set();
    for (const it of list) {
      if (it.id && db.quote_items.findOne({ id: it.id })) {
        keepIds.add(it.id);
        db.quote_items.update(it.id, {
          group_name: it.group_name, name: it.name, unit: it.unit,
          qty: Number(it.qty) || 0, unit_price: Number(it.unit_price) || 0,
          cost_price: Number(it.cost_price) || 0, craft: it.craft || '', remark: it.remark || '',
        });
      } else {
        const n = db.quote_items.insert({
          id: uid(), quote_id: params.id, org_id: user.org_id,
          group_name: it.group_name || '未分类', name: it.name || '新项目', unit: it.unit || '项',
          qty: Number(it.qty) || 0, unit_price: Number(it.unit_price) || 0,
          cost_price: Number(it.cost_price) || 0, craft: it.craft || '', remark: it.remark || '',
          source: it.source || 'manual', created_at: now(),
        });
        keepIds.add(n.id);
      }
    }
    if (body.replace) {
      db.quote_items.removeWhere((it) => it.quote_id === params.id && !keepIds.has(it.id));
    }
    recalc(params.id);
    ok(res, itemsOf(params.id));
  });

  /* ---------------- 状态流转 ---------------- */
  const doTransition = (to, label, extra = {}) => async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const q = db.quotes.findOne({ id: params.id });
    if (!q || q.org_id !== user.org_id) return fail(res, '报价不存在。', 404);
    const allowed = TRANSITIONS[q.status] || [];
    if (!allowed.includes(to)) {
      return fail(res, `当前状态「${STATUS_LABEL[q.status] || q.status}」不能变更为「${label}」。`);
    }
    if (to === 'issued' && !itemsOf(params.id).length) {
      return fail(res, '报价还没有明细，先添加项目再签发。');
    }
    db.quotes.update(params.id, { status: to, ...extra, updated_at: now() });
    logHistory(params.id, user, to, label);
    ok(res, withItems(db.quotes.findOne({ id: params.id })));
  };

  api.post('/quotes/:id/submit', doTransition('pending_approval', '提交审批'));
  api.post('/quotes/:id/approve', doTransition('approved', '审批通过'));
  api.post('/quotes/:id/reject', doTransition('rejected', '驳回', { reject_reason: '' }));
  api.post('/quotes/:id/finalize', doTransition('final', '定稿'));
  api.post('/quotes/:id/issue', (req, res, body, params) => {
    const h = doTransition('issued', '签发给客户');
    return h(req, res, body, params);
  });
  api.post('/quotes/:id/win', doTransition('won', '标记成交'));
  api.post('/quotes/:id/lose', doTransition('lost', '标记未成交'));
  api.post('/quotes/:id/pause', doTransition('paused', '暂停跟进'));
  api.post('/quotes/:id/resume', doTransition('issued', '恢复跟进'));
  api.post('/quotes/:id/abandon', doTransition('abandoned', '放弃'));

  api.post('/quotes/:id/archive', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    db.quotes.update(params.id, { status: 'archived', updated_at: now() });
    logHistory(params.id, user, 'archive', '归档');
    ok(res, { ok: true });
  });

  api.post('/quotes/:id/unarchive', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    db.quotes.update(params.id, { status: 'draft', updated_at: now() });
    ok(res, { ok: true });
  });

  /** 变更单：记录变更并回到可编辑状态 */
  api.post('/quotes/:id/change-order', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const q = db.quotes.findOne({ id: params.id });
    if (!q || q.org_id !== user.org_id) return fail(res, '报价不存在。', 404);
    db.notifications.insert({
      id: uid(), org_id: user.org_id, type: 'change_order', quote_id: params.id,
      reason: body.reason || '', amount_delta: Number(body.amount_delta) || 0,
      status: 'recorded', created_by: user.id, created_at: now(),
    });
    db.quotes.update(params.id, { status: 'draft', updated_at: now() });
    logHistory(params.id, user, 'change_order', `发起变更：${body.reason || '未填写原因'}`);
    ok(res, withItems(db.quotes.findOne({ id: params.id })));
  });

  /* ---------------- 历史 / 审计 / 用量 ---------------- */
  api.get('/quotes/:id/history', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    ok(res, db.notifications.find({ quote_id: params.id, type: 'quote_log' })
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))));
  });

  api.get('/quotes/:id/pricing-audit', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const items = itemsOf(params.id);
    const issues = [];
    const byGroup = {};
    items.forEach((i) => {
      byGroup[i.group_name] = (byGroup[i.group_name] || 0) + i.unit_price * i.qty;
      const lib = db.library.findOne((x) => x.name === i.name && (x.org_id === user.org_id || !x.org_id));
      if (lib && i.unit_price > lib.price * 1.4) {
        issues.push({ level: 'high', item: i.name, current: i.unit_price, reference: lib.price, msg: '单价高于工艺库基准 40% 以上' });
      } else if (lib && i.unit_price < lib.price * 0.6) {
        issues.push({ level: 'low', item: i.name, current: i.unit_price, reference: lib.price, msg: '单价低于工艺库基准 40%，注意漏项或亏损' });
      }
      if (!i.cost_price || i.cost_price <= 0) {
        issues.push({ level: 'warn', item: i.name, msg: '未填写成本，毛利统计不准' });
      }
    });
    const total = items.reduce((s, i) => s + i.unit_price * i.qty, 0);
    ok(res, {
      item_count: items.length,
      total: Math.round(total * 100) / 100,
      group_distribution: Object.entries(byGroup).map(([name, amount]) => ({
        name, amount: Math.round(amount * 100) / 100,
        ratio: total ? Math.round(amount / total * 1000) / 10 : 0,
      })).sort((a, b) => b.amount - a.amount),
      issues,
    });
  });

  api.get('/quotes/:id/material-takeoff', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const items = itemsOf(params.id);
    const RULES = [
      { re: /乳胶漆|刷漆/, mat: '乳胶漆（L）', per: 0.14, unit: 'L' },
      { re: /腻子/, mat: '腻子粉（kg）', per: 1.6, unit: 'kg' },
      { re: /贴砖|铺贴/, mat: '瓷砖胶（kg）', per: 4.2, unit: 'kg' },
      { re: /防水/, mat: '防水涂料（kg）', per: 2.1, unit: 'kg' },
      { re: /布线|电线/, mat: '电线（m）', per: 1.05, unit: 'm' },
      { re: /PPR|给水管/, mat: 'PPR 管（m）', per: 1.02, unit: 'm' },
      { re: /吊顶|石膏板/, mat: '石膏板（张）', per: 0.35, unit: '张' },
      { re: /找平/, mat: '水泥砂浆（m³）', per: 0.032, unit: 'm³' },
      { re: /美缝/, mat: '美缝剂（支）', per: 0.22, unit: '支' },
    ];
    const agg = {};
    items.forEach((i) => {
      RULES.forEach((r) => {
        if (r.re.test(i.name)) {
          agg[r.mat] = agg[r.mat] || { material: r.mat, unit: r.unit, qty: 0, for_items: [] };
          agg[r.mat].qty += i.qty * r.per;
          if (agg[r.mat].for_items.length < 3) agg[r.mat].for_items.push(i.name);
        }
      });
    });
    ok(res, {
      materials: Object.values(agg).map((x) => ({ ...x, qty: Math.round(x.qty * 100) / 100 }))
        .sort((a, b) => b.qty - a.qty),
      note: '材料用量为经验系数估算，仅作采购备料参考，实际以现场施工为准',
    });
  });

  /* ---------------- 出单 / 导出解锁 ---------------- */
  api.post('/quotes/:id/unlock-export', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const q = db.quotes.findOne({ id: params.id });
    if (!q || q.org_id !== user.org_id) return fail(res, '报价不存在。', 404);
    if (q.export_unlocked) return ok(res, { unlocked: true, message: '该报价已解锁，可反复导出。' });

    const plan = user.plan || 'free';
    if (plan === 'plus' || plan === 'enterprise') {
      db.quotes.update(params.id, { export_unlocked: true });
      return ok(res, { unlocked: true, message: 'Plus/企业版不限次导出，已解锁。' });
    }
    const purchased = user.export_purchased || 0;
    const used = user.export_used || 0;
    if (purchased - used <= 0) {
      return fail(res, '出单次数不足，请先购买出单次数或升级 Plus 版。', 402, 'NEED_PURCHASE');
    }
    db.users.update(user.id, { export_used: used + 1 });
    db.quotes.update(params.id, { export_unlocked: true });
    ok(res, { unlocked: true, remaining: purchased - used - 1, message: '已解锁，同一份报价可反复导出。' });
  });

  /* ---------------- 客户分享 ---------------- */
  api.post('/quotes/:id/share', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const q = db.quotes.findOne({ id: params.id });
    if (!q || q.org_id !== user.org_id) return fail(res, '报价不存在。', 404);
    const token = q.share_token || uid() + uid().slice(0, 6);
    db.quotes.update(params.id, { share_token: token, share_enabled: true });
    ok(res, { token, url: `/q/${token}` });
  });

  api.get('/quotes/share/:token', async (req, res, body, params) => {
    const q = db.quotes.findOne({ share_token: params.token });
    if (!q || !q.share_enabled) return fail(res, '报价不存在或已取消分享。', 404);
    const org = db.orgs.findOne({ id: q.org_id }) || {};
    const items = itemsOf(q.id);
    const showCost = !!(org.settings && org.settings.show_cost_to_client);
    ok(res, {
      quote: {
        quote_number: q.quote_number, title: q.title, customer_name: q.customer_name,
        community: q.community, city: q.city, building_area: q.building_area, layout: q.layout,
        tier: q.tier, house_type: q.house_type, total_amount: q.total_amount,
        grand_total: q.grand_total, status: q.status, notes: q.notes,
        created_at: q.created_at,
      },
      org: { name: org.name, phone: org.phone, address: org.address, intro: org.intro },
      items: items.map((i) => ({
        group_name: i.group_name, name: i.name, unit: i.unit, qty: i.qty,
        unit_price: i.unit_price, amount: Math.round(i.unit_price * i.qty * 100) / 100,
        craft: i.craft, cost_price: showCost ? i.cost_price : undefined,
      })),
      share: true,
    });
  });

  api.post('/quotes/share/:token/unlock', async (req, res, body, params) => {
    ok(res, { ok: true });
  });
};

/* ---------------- 工具 ---------------- */

function filterByRange(list, range) {
  const nowMs = Date.now();
  const start = {
    month: new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime(),
    quarter: new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3, 1).getTime(),
    year: new Date(new Date().getFullYear(), 0, 1).getTime(),
  }[range] || 0;
  return list.filter((x) => new Date(x.created_at).getTime() >= start);
}

function quoteStats(list) {
  const total = list.length;
  const draft = list.filter((x) => x.status === 'draft').length;
  const pending = list.filter((x) => x.status === 'pending_approval').length;
  const issued = list.filter((x) => x.status === 'issued').length;
  const won = list.filter((x) => x.status === 'won').length;
  const lost = list.filter((x) => ['lost', 'abandoned'].includes(x.status)).length;
  const closed = won + lost;
  const amount = list.reduce((s, x) => s + (Number(x.grand_total) || Number(x.total_amount) || 0), 0);
  const wonAmount = list.filter((x) => x.status === 'won').reduce((s, x) => s + (Number(x.grand_total) || Number(x.total_amount) || 0), 0);
  const costAmount = list.reduce((s, x) => s + (Number(x.cost_amount) || 0), 0);
  return {
    total, draft, pending, issued, won, lost,
    win_rate: closed ? Math.round(won / closed * 100) : 0,
    convert_rate: total ? Math.round((total - draft) / total * 100) : 0,
    amount: Math.round(amount * 100) / 100,
    won_amount: Math.round(wonAmount * 100) / 100,
    avg_amount: total ? Math.round(amount / total * 100) / 100 : 0,
    margin_rate: amount ? Math.round((amount - costAmount) / amount * 1000) / 10 : 0,
  };
}

function logHistory(quoteId, user, action, label) {
  db.notifications.insert({
    id: uid(), type: 'quote_log', quote_id: quoteId,
    action, label, user_id: user.id, user_name: user.name || user.phone,
    created_at: now(),
  });
}

module.exports.STATUS_LABEL = STATUS_LABEL;
});

/* ================= server/routes/library.js ================= */
__define("server/routes/library.js", function (module, exports, require, __dirname, __filename) {
/**
 * 工艺价格库 + 户型模板
 */
const { db, uid, now } = require('../lib/db');
const A = require('../lib/auth');
const { ok, fail } = require('../lib/http');
const { seedLibraryForOrg, resetOrgLibrary } = require('../lib/seed');
const { GROUPS } = require('../../seed/library');

function orgLibrary(user) {
  return db.library.find((it) => it.org_id === user.org_id);
}

module.exports = function register(api) {

  /* ================= 工艺价格库 ================= */

  api.get('/price-library', async (req, res) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const q = req.query || {};
    let list = orgLibrary(user);
    if (!list.length) { seedLibraryForOrg(user.org_id); list = orgLibrary(user); }
    if (q.keyword) {
      const kw = String(q.keyword).toLowerCase();
      list = list.filter((x) => x.name.toLowerCase().includes(kw) || (x.tags || []).some((t) => t.includes(kw)));
    }
    if (q.group && q.group !== 'all') list = list.filter((x) => x.group_key === q.group || x.group_name === q.group);

    const groups = GROUPS.map((g) => ({
      ...g,
      count: list.filter((x) => x.group_key === g.key).length,
    }));
    ok(res, { items: list, groups, total: list.length });
  });

  api.get('/price-library/presets', async (req, res) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    ok(res, [
      { code: 'default', name: '系统标准库', desc: '内置 180 条常用工艺，覆盖八大分类' },
      { code: 'economy', name: '经济型价格', desc: '整体下浮 12%，适合简装/出租房报价' },
      { code: 'quality', name: '品质型价格', desc: '整体上浮 15%，适合中高端客户' },
      { code: 'premium', name: '高端价格', desc: '整体上浮 35%，含品牌主材工艺' },
    ]);
  });

  api.post('/price-library/apply-preset', async (req, res, body) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const factor = { default: 1, economy: 0.88, quality: 1.15, premium: 1.35 }[body.code] || 1;
    const list = orgLibrary(user);
    const base = db.library.find((it) => !it.org_id);
    list.forEach((it) => {
      const sys = base.find((x) => x.name === it.name);
      const p = sys ? sys.price : it.price / factor;
      db.library.update(it.id, {
        price: Math.round(p * factor * 100) / 100,
        cost: Math.round((sys ? sys.cost : it.cost / factor) * factor * 100) / 100,
      });
    });
    db.library.flush();
    ok(res, { applied: body.code, count: list.length, message: `已应用预设，共更新 ${list.length} 条工艺价格。` });
  });

  api.post('/price-library/reset', async (req, res) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const n = resetOrgLibrary(user.org_id);
    ok(res, { ok: true, count: n, message: `已重置为系统标准库，共 ${n} 条。` });
  });

  api.post('/price-library/import', async (req, res, body) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const rows = Array.isArray(body.items) ? body.items : [];
    if (!rows.length) return fail(res, '没有可导入的数据。');
    let added = 0, updated = 0;
    for (const r of rows) {
      if (!r.name) continue;
      const exist = db.library.findOne((x) => x.org_id === user.org_id && x.name === r.name);
      const data = {
        group_key: r.group_key || 'misc',
        group_name: r.group_name || '未分类',
        name: r.name,
        unit: r.unit || '项',
        price: Number(r.price) || 0,
        cost: Number(r.cost) || 0,
        craft: r.craft || '',
        tags: r.tags || [],
      };
      if (exist) { db.library.update(exist.id, data); updated += 1; }
      else { db.library.insert({ id: uid(), org_id: user.org_id, source: 'import', created_at: now(), ...data }); added += 1; }
    }
    db.library.flush();
    ok(res, { added, updated, message: `导入完成：新增 ${added} 条，更新 ${updated} 条。` });
  });

  api.get('/price-library/:id', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const it = db.library.findOne({ id: params.id });
    if (!it) return fail(res, '工艺不存在。', 404);
    ok(res, it);
  });

  api.post('/price-library', async (req, res, body) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    if (!body.name) return fail(res, '请填写工艺名称。');
    const item = db.library.insert({
      id: uid(), org_id: user.org_id, source: 'custom', created_at: now(),
      group_key: body.group_key || 'misc',
      group_name: body.group_name || GROUPS.find((g) => g.key === body.group_key)?.name || '未分类',
      name: body.name, unit: body.unit || '项',
      price: Number(body.price) || 0, cost: Number(body.cost) || 0,
      craft: body.craft || '', tags: body.tags || [],
    });
    ok(res, item, 201);
  });

  api.put('/price-library/:id', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const it = db.library.findOne({ id: params.id });
    if (!it) return fail(res, '工艺不存在。', 404);
    const allow = ['name', 'unit', 'price', 'cost', 'craft', 'tags', 'group_key', 'group_name'];
    const patch = {};
    allow.forEach((k) => { if (body[k] !== undefined) patch[k] = body[k]; });
    ok(res, db.library.update(params.id, patch));
  });

  api.del('/price-library/:id', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    db.library.remove(params.id);
    ok(res, { ok: true });
  });

  /* ================= 户型模板 ================= */

  api.get('/room-templates', async (req, res) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    ok(res, db.templates.find((t) => t.org_id === user.org_id)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))));
  });

  api.post('/room-templates', async (req, res, body) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const tpl = db.templates.insert({
      id: uid(), org_id: user.org_id, user_id: user.id, created_at: now(),
      name: body.name || '未命名模板',
      layout: body.layout || '',
      building_area: Number(body.building_area) || 0,
      building_type: body.building_type || '高层',
      house_type: body.house_type || '新房',
      city: body.city || '',
      tier: body.tier || '中档',
      spaces: body.spaces || [],
      note: body.note || '',
      source: body.source || 'manual',
    });
    ok(res, tpl, 201);
  });

  api.put('/room-templates/:id', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const t = db.templates.findOne({ id: params.id });
    if (!t || t.org_id !== user.org_id) return fail(res, '模板不存在。', 404);
    const allow = ['name', 'layout', 'building_area', 'building_type', 'house_type', 'city', 'tier', 'spaces', 'note'];
    const patch = {};
    allow.forEach((k) => { if (body[k] !== undefined) patch[k] = body[k]; });
    ok(res, db.templates.update(params.id, patch));
  });

  api.del('/room-templates/:id', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    db.templates.remove(params.id);
    ok(res, { ok: true });
  });

  /** 本地匹配：按面积 / 户型 / 装修类型打分（免费，不扣点数） */
  api.post('/ai/templates/match-rank', async (req, res, body) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const all = db.templates.find((t) => t.org_id === user.org_id);
    const area = Number(body.building_area) || 0;
    const layout = String(body.layout || '');
    const houseType = String(body.house_type || '');

    const ranked = all.map((t) => {
      let score = 40;
      const reasons = [];
      if (layout && t.layout === layout) { score += 30; reasons.push('户型一致'); }
      else if (layout && sameRoomCount(layout, t.layout)) { score += 15; reasons.push('居室数量一致'); }

      const ta = Number(t.building_area) || 0;
      if (area && ta) {
        const diff = Math.abs(ta - area) / area;
        if (diff <= 0.08) { score += 25; reasons.push('面积接近'); }
        else if (diff <= 0.2) { score += 15; reasons.push(`面积偏差 ${(diff * 100).toFixed(0)}%`); }
        else if (diff <= 0.5) { score += 5; reasons.push(`面积偏差 ${(diff * 100).toFixed(0)}%，需调整`); }
        else { score -= 10; reasons.push('面积偏差较大'); }
      }
      if (houseType && t.house_type === houseType) { score += 10; reasons.push('装修类型一致'); }
      else if (houseType && t.house_type) { score -= 8; reasons.push(`装修类型冲突（模板偏${t.house_type}）`); }

      return { ...t, score: Math.max(0, Math.min(100, score)), reasons, area_diff: area && ta ? Math.round((ta - area) / area * 1000) / 10 : null };
    }).sort((a, b) => b.score - a.score);

    ok(res, {
      matches: ranked.slice(0, 5),
      best: ranked[0] || null,
      total: all.length,
      message: all.length ? `本地匹配到 ${all.length} 个模板，最高匹配度 ${ranked[0] ? ranked[0].score : 0} 分` : '你还没有任何模板。',
    });
  });
};

function sameRoomCount(a, b) {
  const ca = (a.match(/[一二三四五]室/) || [''])[0];
  const cb = (b.match(/[一二三四五]室/) || [''])[0];
  return ca && ca === cb;
}
});

/* ================= server/routes/customers.js ================= */
__define("server/routes/customers.js", function (module, exports, require, __dirname, __filename) {
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
});

/* ================= server/routes/ai.js ================= */
__define("server/routes/ai.js", function (module, exports, require, __dirname, __filename) {
/**
 * AI 能力路由：统一调用入口 + 点数扣减 + 使用日志
 * 计费原则：调用成功返回结果才扣点数，失败不扣
 */
const { db, uid, now } = require('../lib/db');
const A = require('../lib/auth');
const { ok, fail } = require('../lib/http');
const AI = require('../lib/ai');
const { genQuoteNo } = require('../lib/seed');

/** 功能中文名，用于日志与前端展示 */
const FEATURE_NAMES = {
  'smart-estimate': '智能造价估算',
  'full-estimate': '完整自助估算',
  'estimate-cost': '快速造价估算',
  'room-breakdown': '户型智能拆解',
  'tier-matching': '装修档次匹配',
  'budget-reverse': '预算反推',
  'risk-report': '增项风险预测',
  'nl-to-items': '自然语言加项',
  'price-suggestion': '单点价格建议',
  'item-suggestion': '相似项推荐',
  'quote-review': '整张报价复核',
  'validate-quote': '漏项检查',
  'customer-copy': '客户话术润色',
  'price-library-audit': '价格库体检',
  'city-calibration': '城市价格校准',
  'audit-risk': '审计异常预警',
  'template-generate': '模板 AI 生成',
};

module.exports = function register(api) {

  /* ---------------- 元信息 ---------------- */
  api.get('/ai/feature-costs', async (req, res) => {
    ok(res, Object.entries(AI.FEATURE_COSTS).map(([key, cost]) => ({
      key, cost, name: FEATURE_NAMES[key] || key,
    })));
  });

  api.get('/ai/provider-status', async (req, res) => {
    ok(res, {
      provider: AI.provider.enabled ? 'llm' : 'local-rule-engine',
      model: AI.provider.name,
      llm_enabled: AI.provider.enabled,
      note: AI.provider.enabled
        ? `已接入大模型 ${AI.provider.name}`
        : '当前使用本地规则引擎：结果确定、可复核、不消耗外部额度。配置 HQ_AI_API_KEY 与 HQ_AI_BASE_URL 后可切换到大模型。',
    });
  });

  api.get('/ai/quota-status', async (req, res) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const plan = { free: 30, personal: 0, plus: 1000, enterprise: 5000 }[user.plan] || 30;
    ok(res, {
      plan: user.plan,
      credits: user.credits || 0,
      monthly_credits: plan,
      unlimited: !!user.platform_admin_unlimited,
      usage_this_month: db.ai_logs.find((l) => l.user_id === user.id && l.month === curMonth()).length,
      cost_list: AI.FEATURE_COSTS,
    });
  });

  api.get('/ai/quote-packages', async (req, res) => {
    ok(res, AI.PACKAGES);
  });

  /* ---------------- 统一调用入口（动态路由，静态路径由 Router 优先匹配） ---------------- */
  const runFeature = async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const feature = params.feature;
    if (!AI.FEATURES[feature]) return fail(res, `未知的 AI 功能：${feature}`, 404);

    const cost = AI.costOf(feature);
    const unlimited = !!user.is_platform_admin;
    if (!unlimited && (user.credits || 0) < cost) {
      return fail(res, `积分不足：${FEATURE_NAMES[feature] || feature} 需要 ${cost} 积分，当前剩余 ${user.credits || 0} 积分。请先充值或升级。`, 402, 'INSUFFICIENT_CREDITS');
    }

    const started = Date.now();
    try {
      const payload = { ...body, org_id: user.org_id, user_id: user.id };
      const result = await AI.run(feature, payload);

      const elapsed = Date.now() - started;
      // 日志记录真实消耗额（便于用量看板统计），管理员免扣余额
      db.ai_logs.insert({
        id: uid(), org_id: user.org_id, user_id: user.id,
        feature, feature_name: FEATURE_NAMES[feature] || feature,
        cost, billed: unlimited ? 0 : cost, status: 'success',
        engine: result._engine, elapsed_ms: elapsed,
        month: curMonth(), created_at: now(),
      });
      if (!unlimited) db.users.update(user.id, { credits: (user.credits || 0) - cost });
      db.ai_logs.flush();

      ok(res, { ...result, cost: unlimited ? 0 : cost, list_cost: cost, unlimited, elapsed_ms: elapsed });
    } catch (e) {
      db.ai_logs.insert({
        id: uid(), org_id: user.org_id, user_id: user.id,
        feature, feature_name: FEATURE_NAMES[feature] || feature,
        cost: 0, status: 'failed', error: e.message,
        month: curMonth(), created_at: now(),
      });
      db.ai_logs.flush();
      fail(res, e.message || 'AI 调用失败，请稍后重试。', 500, 'AI_FAILED');
    }
  };

  api.post('/ai/:feature', runFeature);

  /* ---------------- 兼容原站独立路径 ---------------- */
  const alias = (path, feature) => {
    api.post(path, (req, res, body) => runFeature(req, res, body, { feature }));
  };

  alias('/ai/smart-estimate', 'smart-estimate');
  alias('/ai/full-estimate', 'full-estimate');
  alias('/ai/estimate-cost', 'estimate-cost');
  alias('/ai/room-breakdown', 'room-breakdown');
  alias('/ai/tier-matching', 'tier-matching');
  alias('/ai/budget-reverse', 'budget-reverse');
  alias('/ai/risk-report', 'risk-report');
  alias('/ai/nl-to-items', 'nl-to-items');
  alias('/ai/price-suggestion', 'price-suggestion');
  alias('/ai/item-suggestion', 'item-suggestion');
  alias('/ai/quote-review', 'quote-review');
  alias('/ai/validate-quote', 'validate-quote');
  alias('/ai/customer-copy', 'customer-copy');
  alias('/ai/audit-risk', 'audit-risk');
  alias('/ai/library/audit', 'price-library-audit');
  alias('/ai/library/calibrate-by-city', 'city-calibration');
  alias('/ai/templates/ai-generate', 'template-generate');

  /* ---------------- 估算结果 → 正式报价 ---------------- */
  api.post('/ai/estimate-to-quote', async (req, res, body) => {
    const user = A.requireAuth(req, res);
    if (!user) return;

    const payload = body.params || body;
    const est = AI.estimate({ ...payload, pkg: AI.PACKAGES.find((p) => p.code === payload.package_code) });

    const qid = uid();
    const quote = db.quotes.insert({
      id: qid, org_id: user.org_id, user_id: user.id,
      quote_number: genQuoteNo(user.org_id),
      title: `${payload.city || ''}${payload.building_area || ''}㎡ ${payload.layout || ''} ${payload.tier || ''}报价草稿`,
      city: payload.city || '', province: payload.province || '',
      building_area: Number(payload.building_area) || 0,
      layout: payload.layout || '',
      tier: payload.tier || '中档',
      house_type: payload.house_type || '新房',
      house_age: Number(payload.house_age) || 0,
      floor: Number(payload.floor) || 0,
      building_type: payload.building_type || '高层',
      has_elevator: payload.has_elevator !== false,
      customer_name: body.client_name && body.client_name !== '待填写客户' ? body.client_name : '',
      status: 'draft',
      total_amount: est.total, cost_amount: est.cost_total, grand_total: est.total,
      margin_rate: est.gross_margin, item_count: est.items.length,
      notes: payload.notes || '',
      created_at: now(), updated_at: now(),
    });

    db.quote_items.insertMany(
      est.items.map((it) => ({
        ...it, id: uid(), quote_id: qid, org_id: user.org_id,
        amount: Math.round(it.unit_price * it.qty * 100) / 100,
        created_at: now(),
      }))
    );
    db.quote_items.flush();

    ok(res, { quote, items_count: est.items.length, total: est.total, assumptions: est.assumptions });
  });

  /* ---------------- 用量看板（管理视角） ---------------- */
  api.get('/ai/usage-summary', async (req, res) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    if (!['owner', 'admin'].includes(user.role) && !user.is_platform_admin) {
      return fail(res, '仅管理员可查看用量看板。', 403);
    }
    const logs = db.ai_logs.find((l) => l.org_id === user.org_id);
    const byFeature = {};
    const byUser = {};
    const byDay = {};
    let tokens = 0;
    logs.forEach((l) => {
      byFeature[l.feature_name] = byFeature[l.feature_name] || { name: l.feature_name, calls: 0, credits: 0 };
      byFeature[l.feature_name].calls += 1;
      byFeature[l.feature_name].credits += l.cost || 0;
      byUser[l.user_id] = byUser[l.user_id] || { user_id: l.user_id, name: (db.users.findOne({ id: l.user_id }) || {}).name || l.user_id, calls: 0, credits: 0 };
      byUser[l.user_id].calls += 1;
      byUser[l.user_id].credits += l.cost || 0;
      const d = (l.created_at || '').slice(0, 10);
      byDay[d] = byDay[d] || { date: d, calls: 0, credits: 0 };
      byDay[d].calls += 1;
      byDay[d].credits += l.cost || 0;
      tokens += 1;
    });
    ok(res, {
      total_calls: logs.length,
      total_credits: logs.reduce((s, l) => s + (l.cost || 0), 0),
      estimated_cost_cny: Math.round(logs.reduce((s, l) => s + (l.cost || 0), 0) * 0.01 * 100) / 100,
      by_feature: Object.values(byFeature).sort((a, b) => b.calls - a.calls),
      by_user: Object.values(byUser).sort((a, b) => b.calls - a.calls),
      by_day: Object.values(byDay).sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(-30),
      engine: AI.provider.enabled ? AI.provider.name : '本地规则引擎',
    });
  });
};

function curMonth() { return new Date().toISOString().slice(0, 7); }

module.exports.FEATURE_NAMES = FEATURE_NAMES;
});

/* ================= server/routes/billing.js ================= */
__define("server/routes/billing.js", function (module, exports, require, __dirname, __filename) {
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
    monthly: 0, yearly: 0,
    note: '随便新建、编辑、在线预览报价；出成品（导出 / 分享）时再按次购买。',
    cta: '免费开始', borderColor: '#94a3b8', glowColor: 'rgba(148,163,184,0.3)',
    aiQuota: { label: '赠送 30 积分 / 月', detail: '约 3 次智能造价试用，可另购积分包' },
    features: ['1 个账号', '不限新建 / 编辑报价', '在线预览报价', '示例工艺库与户型模板可查看', '出 PDF/Excel、分享给客户需购买出单次数'],
  },
  {
    key: 'personal', name: '普通版（按次）', tag: '按需出单', price: '¥9.9', cycle: '/ 1 次出单',
    monthly: 0, yearly: 0,
    note: '9.9 元买 1 次，1 次 = 出一份报价（导出/出单）；同一份解锁后反复导出不重复扣次。',
    cta: '购买出单次数', borderColor: '#1565f5', glowColor: 'rgba(21,101,245,0.22)',
    aiQuota: { label: 'AI 按积分计费', detail: '智能造价按积分扣，单独购买积分包，与出单次数互不影响' },
    features: ['不限新建 / 编辑报价', 'PDF / Excel 导出', '客户报价页分享', '客户档案管理', '同一份解锁后反复导出免费', '用完再买、不订阅不扣月费'],
  },
  {
    key: 'plus', name: 'Plus 版', tag: '推荐 · 不限次', price: '¥38', cycle: '/ 月',
    monthly: 38, yearlyMonthly: 32, yearlyTotal: 388,
    note: '包月不限次导出，AI 全程协助、漏项提醒、价格风险预警，高频出单更划算。',
    cta: '开通 Plus 版', highlight: true, borderColor: '#7c3aed', glowColor: 'rgba(124,58,237,0.28)',
    aiQuota: { label: '赠送 1000 积分 / 月', detail: '约 100 次智能造价，AI 全程协助' },
    features: ['1 个账号', '不限次导出 / 出单', '不限报价项目', '个人报价模板 10 套', 'AI 协助填写项目', '完整漏项提醒 + 价格风险提示', 'Excel / PDF 导出', '客户资料管理'],
  },
  {
    key: 'enterprise', name: '企业版', tag: '团队使用', price: '定制', cycle: '按需报价',
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
    const user = A.requireAuth(req, res);
    if (!user) return;
    ok(res, db.orders.find((o) => o.org_id === user.org_id && o.kind === 'subscription')
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))));
  });

  api.post('/subscriptions/purchase', async (req, res, body) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const plan = PLANS.find((p) => p.key === body.plan);
    if (!plan) return fail(res, '套餐不存在。');
    const cycle = body.cycle === 'yearly' ? 'yearly' : 'monthly';
    const amount = cycle === 'yearly' ? (plan.yearlyTotal || plan.monthly * 12) : plan.monthly;
    if (!amount) return fail(res, '该套餐不支持在线购买，请联系我们开通。');
    const order = db.orders.insert({
      id: uid(), org_id: user.org_id, user_id: user.id, kind: 'subscription',
      order_no: genOrderNo('SUB'), plan: plan.key, plan_name: plan.name, cycle,
      amount, status: 'pending', created_at: now(),
    });
    ok(res, order, 201);
  });

  const settleSubscription = (order) => {
    const months = order.cycle === 'yearly' ? 12 : 1;
    const expires = new Date(Date.now() + months * 30 * 86400000).toISOString();
    db.users.update(order.user_id, {
      plan: order.plan,
      plan_expires_at: expires,
      credits: (db.users.findOne({ id: order.user_id }).credits || 0) +
        (PLANS.find((p) => p.key === order.plan) || {}).monthly_credits_bonus || 0,
    });
    const org = db.orgs.findOne({ id: order.org_id });
    if (org) db.orgs.update(org.id, { plan: order.plan });
  };

  api.post('/subscriptions/orders/:id/pay', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const order = db.orders.findOne({ id: params.id });
    if (!order || order.org_id !== user.org_id) return fail(res, '订单不存在。', 404);
    db.orders.update(order.id, { status: 'paid', paid_at: now(), pay_method: body.method || '模拟支付' });
    settleSubscription(order);
    ok(res, { ...db.orders.findOne({ id: order.id }), message: '支付成功，套餐已生效。' });
  });

  api.post('/subscriptions/orders/:id/cancel', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const order = db.orders.findOne({ id: params.id });
    if (!order || order.org_id !== user.org_id) return fail(res, '订单不存在。', 404);
    ok(res, db.orders.update(order.id, { status: 'cancelled' }));
  });

  /* ---------------- 积分 ---------------- */
  api.get('/ai-credits/packs', async (req, res) => ok(res, CREDIT_PACKS));

  api.get('/ai-credits/balance', async (req, res) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    ok(res, { credits: user.credits || 0, unlimited: !!user.is_platform_admin, month: user.credits_month });
  });

  api.get('/ai-credits/purchases', async (req, res) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    ok(res, db.orders.find((o) => o.org_id === user.org_id && o.kind === 'credits')
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))));
  });

  api.post('/ai-credits/purchases', async (req, res, body) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const pack = CREDIT_PACKS.find((p) => p.code === body.pack_code);
    if (!pack) return fail(res, '充值包不存在。');
    const order = db.orders.insert({
      id: uid(), org_id: user.org_id, user_id: user.id, kind: 'credits',
      order_no: genOrderNo('CRD'), pack_code: pack.code, pack_name: pack.name,
      call_count: pack.credits + (pack.bonus || 0), amount: pack.price,
      status: 'pending', created_at: now(),
    });
    ok(res, order, 201);
  });

  api.post('/ai-credits/purchases/:id/pay', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const order = db.orders.findOne({ id: params.id });
    if (!order || order.org_id !== user.org_id) return fail(res, '订单不存在。', 404);
    db.orders.update(order.id, { status: 'paid', paid_at: now(), pay_method: body.method || '模拟支付' });
    db.users.update(user.id, { credits: (user.credits || 0) + (order.call_count || 0) });
    ok(res, { ...db.orders.findOne({ id: order.id }), message: `支付成功！${order.call_count} 积分已到账。` });
  });

  api.post('/ai-credits/purchases/:id/cancel', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    ok(res, db.orders.update(params.id, { status: 'cancelled' }));
  });

  /* ---------------- 出单次数 ---------------- */
  api.get('/report-credits/packs', async (req, res) => ok(res, EXPORT_PACKS));

  api.get('/report-credits/balance', async (req, res) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    ok(res, {
      purchased: user.export_purchased || 0,
      used: user.export_used || 0,
      remaining: (user.export_purchased || 0) - (user.export_used || 0),
      unlimited: ['plus', 'enterprise'].includes(user.plan),
    });
  });

  api.get('/report-credits/purchases', async (req, res) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    ok(res, db.orders.find((o) => o.org_id === user.org_id && o.kind === 'export'));
  });

  api.post('/report-credits/purchases', async (req, res, body) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const pack = EXPORT_PACKS.find((p) => p.code === body.pack_code);
    if (!pack) return fail(res, '次数包不存在。');
    const order = db.orders.insert({
      id: uid(), org_id: user.org_id, user_id: user.id, kind: 'export',
      order_no: genOrderNo('EXP'), pack_code: pack.code, pack_name: pack.name,
      call_count: pack.count, amount: pack.price, status: 'pending', created_at: now(),
    });
    ok(res, order, 201);
  });

  api.post('/report-credits/purchases/:id/pay', async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const order = db.orders.findOne({ id: params.id });
    if (!order || order.org_id !== user.org_id) return fail(res, '订单不存在。', 404);
    db.orders.update(order.id, { status: 'paid', paid_at: now(), pay_method: body.method || '模拟支付' });
    db.users.update(user.id, { export_purchased: (user.export_purchased || 0) + (order.call_count || 0) });
    ok(res, { ...db.orders.findOne({ id: order.id }), message: `支付成功！${order.call_count} 次出单额度已到账。` });
  });

  /* ---------------- 发票 ---------------- */
  api.get('/invoices/records', async (req, res) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    ok(res, db.orders.find((o) => o.org_id === user.org_id && o.invoice_requested)
      .map((o) => ({
        id: o.id, order_no: o.order_no, amount: o.amount,
        status: o.invoice_status || 'pending', created_at: o.paid_at || o.created_at,
        title: o.invoice_title || '', tax_no: o.invoice_tax_no || '',
      })));
  });

  api.get('/invoices/invoiceable-orders', async (req, res) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    ok(res, db.orders.find((o) => o.org_id === user.org_id && o.status === 'paid' && !o.invoice_requested));
  });

  api.post('/invoices/records', async (req, res, body) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const ids = Array.isArray(body.order_ids) ? body.order_ids : [];
    if (!ids.length) return fail(res, '请选择要开票的订单。');
    ids.forEach((id) => db.orders.update(id, {
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
    const user = A.requireAuth(req, res);
    if (!user) return;
    const order = db.orders.findOne({ id: body.order_id });
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
});

/* ================= server/routes/admin.js ================= */
__define("server/routes/admin.js", function (module, exports, require, __dirname, __filename) {
/**
 * 平台管理后台（仅 platform_admin）
 */
const { db, uid, now } = require('../lib/db');
const A = require('../lib/auth');
const { ok, fail } = require('../lib/http');

module.exports = function register(api) {
  api.get('/admin/overview', async (req, res) => {
    const admin = A.requirePlatformAdmin(req, res);
    if (!admin) return;

    const users = db.users.all();
    const orgs = db.orgs.all();
    const quotes = db.quotes.all();
    const orders = db.orders.all();
    const logs = db.ai_logs.all();

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
      library: { total: db.library.all().length, system: db.library.find((x) => !x.org_id).length },
    });
  });

  api.get('/admin/users', async (req, res) => {
    const admin = A.requirePlatformAdmin(req, res);
    if (!admin) return;
    const list = db.users.all().map((u) => {
      const org = db.orgs.findOne({ id: u.org_id });
      return {
        ...A.publicUser(u),
        org_name: org ? org.name : '',
        quote_count: db.quotes.count((q) => q.org_id === u.org_id),
      };
    }).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    ok(res, list);
  });

  api.put('/admin/users/:id/status', async (req, res, body, params) => {
    const admin = A.requirePlatformAdmin(req, res);
    if (!admin) return;
    if (params.id === admin.id) return fail(res, '不能停用自己。');
    ok(res, A.publicUser(db.users.update(params.id, { status: body.status === 'disabled' ? 'disabled' : 'active' })));
  });

  api.put('/admin/users/:id/platform-admin', async (req, res, body, params) => {
    const admin = A.requirePlatformAdmin(req, res);
    if (!admin) return;
    ok(res, A.publicUser(db.users.update(params.id, { is_platform_admin: !!body.enabled })));
  });

  api.get('/admin/organizations', async (req, res) => {
    const admin = A.requirePlatformAdmin(req, res);
    if (!admin) return;
    ok(res, db.orgs.all().map((o) => ({
      ...o,
      user_count: db.users.count((u) => u.org_id === o.id),
      quote_count: db.quotes.count((q) => q.org_id === o.id),
      library_count: db.library.count((x) => x.org_id === o.id),
    })));
  });

  api.put('/admin/organizations/:id/plan', async (req, res, body, params) => {
    const admin = A.requirePlatformAdmin(req, res);
    if (!admin) return;
    const org = db.orgs.findOne({ id: params.id });
    if (!org) return fail(res, '组织不存在。', 404);
    db.orgs.update(org.id, { plan: body.plan });
    db.users.find({ org_id: org.id }).forEach((u) => db.users.update(u.id, { plan: body.plan }));
    ok(res, db.orgs.findOne({ id: org.id }));
  });

  api.put('/admin/organizations/:id/status', async (req, res, body, params) => {
    const admin = A.requirePlatformAdmin(req, res);
    if (!admin) return;
    ok(res, db.orgs.update(params.id, { status: body.status || 'active' }));
  });

  api.get('/admin/credit-grants', async (req, res) => {
    const admin = A.requirePlatformAdmin(req, res);
    if (!admin) return;
    ok(res, db.notifications.find((n) => n.type === 'credit_grant')
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))));
  });

  api.post('/admin/credit-grants', async (req, res, body) => {
    const admin = A.requirePlatformAdmin(req, res);
    if (!admin) return;
    const user = db.users.findOne({ phone: body.phone }) || db.users.findOne({ id: body.user_id });
    if (!user) return fail(res, '用户不存在。', 404);
    const amount = Number(body.amount) || 0;
    if (!amount) return fail(res, '请填写发放数量。');
    db.users.update(user.id, { credits: (user.credits || 0) + amount });
    ok(res, db.notifications.insert({
      id: uid(), type: 'credit_grant', user_id: user.id, phone: user.phone,
      amount, reason: body.reason || '管理员发放', granted_by: admin.id, created_at: now(),
    }), 201);
  });

  api.get('/admin/refund-requests', async (req, res) => {
    const admin = A.requirePlatformAdmin(req, res);
    if (!admin) return;
    ok(res, db.notifications.find((n) => n.type === 'refund_request'));
  });

  api.post('/admin/refund-requests/:id/review', async (req, res, body, params) => {
    const admin = A.requirePlatformAdmin(req, res);
    if (!admin) return;
    const req0 = db.notifications.findOne({ id: params.id });
    if (!req0) return fail(res, '申请不存在。', 404);
    const approved = body.approve === true;
    if (approved && req0.order_id) {
      db.orders.update(req0.order_id, { status: 'refunded', refunded_at: now() });
    }
    ok(res, db.notifications.update(params.id, {
      status: approved ? 'approved' : 'rejected',
      reviewed_by: admin.id, review_note: body.note || '', reviewed_at: now(),
    }));
  });

  /* 平台管理员：AI 用量总览 */
  api.get('/admin/ai-usage', async (req, res) => {
    const admin = A.requirePlatformAdmin(req, res);
    if (!admin) return;
    const logs = db.ai_logs.all();
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
});

/* ================= seed/library.js ================= */
__define("seed/library.js", function (module, exports, require, __dirname, __filename) {
/**
 * 内置家装工艺价格库种子数据
 * 价格基准：华东二线城市（合肥 / 南京 / 苏州），城市系数 1.00
 * 格式：[工艺名称, 单位, 参考售价, 参考成本价, 工艺说明, 关键词标签]
 * 关键词标签用于 AI 分类匹配与漏项检查
 */

const GROUPS = [
  {
    key: 'demolition',
    name: '拆除与保护',
    icon: '🔨',
    desc: '拆除、搬运、成品保护、垃圾清运、保洁',
    items: [
      ['墙体拆除（非承重）', 'm²', 45, 32, '放线切割后分层拆除，含垃圾装袋归堆', '拆除 拆墙'],
      ['墙体拆除（混凝土/承重）', 'm²', 120, 88, '水钻切割分段拆除，含支撑防护', '拆除 承重'],
      ['地面瓷砖拆除', 'm²', 28, 20, '电镐破除至结构层，含装袋', '拆除 地砖'],
      ['木地板拆除', 'm²', 12, 8, '含踢脚线拆除与归堆', '拆除 地板'],
      ['吊顶拆除', 'm²', 18, 13, '拆除龙骨及面板，含垃圾装袋', '拆除 吊顶'],
      ['柜体拆除', 'm', 35, 25, '拆柜体及五金，含归堆', '拆除 柜子'],
      ['洁具拆除', '套', 80, 55, '马桶/浴室柜/花洒整体拆除', '拆除 洁具'],
      ['门窗拆除', '樘', 60, 42, '含门套窗套及五金拆除', '拆除 门窗'],
      ['旧墙皮铲除', 'm²', 12, 8.5, '铲至水泥砂浆基层，含清理', '拆除 铲墙'],
      ['旧涂料打磨', 'm²', 8, 5.5, '砂纸打磨至无浮灰', '打磨 旧墙'],
      ['垃圾装袋外运', 'm³', 180, 130, '装袋、搬运至小区指定堆放点', '垃圾 清运'],
      ['垃圾外运（整车）', '车', 350, 280, '4.2m 货车整车轮次', '垃圾 外运'],
      ['成品保护（地面）', 'm²', 8, 5.5, '保护膜满铺并固定接缝', '保护 地面'],
      ['成品保护（门窗家具）', '项', 260, 180, '珍珠棉+胶带全包裹', '保护 家具'],
      ['电梯及公共区域保护', '项', 180, 130, '电梯内壁及过道地面保护', '保护 电梯'],
      ['施工围挡', '项', 320, 220, '现场围挡及警示标识', '文明施工'],
      ['进场保洁', '项', 280, 200, '开工前场地清扫整理', '保洁'],
      ['竣工开荒保洁', 'm²', 8, 6, '全屋精细保洁含玻璃', '保洁 开荒'],
      ['材料二次搬运（无电梯）', '项', 480, 380, '人工搬运上楼', '搬运 上楼'],
      ['上楼费（3层以上每层）', '层', 60, 45, '无电梯楼层加收', '搬运 楼层'],
    ],
  },
  {
    key: 'mep',
    name: '水电工程',
    icon: '⚡',
    desc: '给排水、强电、弱电、开槽布管、智能预留',
    items: [
      ['给水管改造 PPR（明管）', 'm', 42, 28, '热熔连接，含管卡固定与试压', '水管 给水 PPR'],
      ['给水管改造 PPR（暗管含开槽）', 'm', 68, 46, '开槽布管、热熔连接、砂浆封槽', '水管 暗管 开槽'],
      ['排水管改造 PVC', 'm', 55, 36, '含坡度控制与管卡固定', '排水 PVC'],
      ['下水移位', '处', 180, 120, '含开槽、接管、闭水检查', '下水 移位'],
      ['水管试压', '项', 120, 80, '0.8MPa 保压 30 分钟无渗漏', '试压 验收'],
      ['强电布线 2.5mm²（明线）', 'm', 28, 18, '穿管保护，含接线端子', '强电 布线'],
      ['强电布线 2.5mm²（暗线含开槽）', 'm', 45, 30, '开槽布管穿线，砂浆封槽', '强电 暗线'],
      ['强电布线 4mm²（空调/厨房）', 'm', 62, 40, '大功率回路专线', '强电 空调 厨房'],
      ['弱电布线（超五类网线）', 'm', 32, 20, '含水晶头制作与测试', '弱电 网线'],
      ['弱电布线（高清线/音响线）', 'm', 38, 24, '含穿管与面板预留', '弱电 影音'],
      ['电线开槽（砖墙）', 'm', 22, 15, '切割机开槽，深度≥30mm', '开槽 砖墙'],
      ['电线开槽（混凝土墙）', 'm', 38, 26, '水钻+电镐开槽', '开槽 混凝土'],
      ['底盒安装', '个', 18, 11, '86 型底盒固定与校平', '底盒'],
      ['配电箱安装', '套', 480, 320, '含空开漏保与回路标识', '配电箱 电箱'],
      ['配电箱移位', '项', 680, 460, '含进户线延长与恢复', '配电箱 移位'],
      ['等电位端子箱', '套', 180, 120, '卫生间局部等电位联结', '等电位 安全'],
      ['开关插座安装（五孔）', '个', 12, 7.5, '接线紧固、面板调平', '开关 插座'],
      ['筒灯/射灯接线安装', '个', 18, 11, '含开孔与接线', '筒灯 射灯'],
      ['主灯接线安装', '套', 90, 60, '含加固与调试', '主灯 灯具'],
      ['水路打压试验与验收', '项', 100, 65, '出具打压记录', '打压 验收'],
      ['地漏安装', '个', 45, 30, '含找坡与密封', '地漏 排水'],
      ['角阀软管安装', '套', 35, 22, '冷热水角阀及软管', '角阀 软管'],
      ['热水器水路接驳', '项', 220, 150, '含冷热水管与阀门', '热水器 水路'],
      ['中央空调用电预留', '项', 320, 220, '含专线与空开', '中央空调 用电'],
      ['智能家居弱电预留', '项', 560, 380, '含总线预留与底盒', '智能 弱电'],
      ['全屋水路走顶', '项', 888, 610, '顶面布管便于检修（按户）', '水路 走顶'],
      ['全屋电路重排', '项', 2888, 1980, '老房全屋重新布线（按户）', '电路 重排'],
      ['强弱电交叉屏蔽处理', '处', 38, 25, '锡箔屏蔽防干扰', '屏蔽 弱电'],
      ['下水管道隔音处理', 'm', 28, 18, '阻尼片+隔音棉包裹', '隔音 下水'],
    ],
  },
  {
    key: 'masonry',
    name: '泥瓦工程',
    icon: '🧱',
    desc: '砌筑、找平、防水、铺贴、回填',
    items: [
      ['地面现拌砂浆找平', 'm²', 32, 22, '均厚 30mm 内，含养护', '找平 地面'],
      ['地面自流平找平', 'm²', 48, 34, '厚度 5mm 内，含界面剂', '自流平 找平'],
      ['厨卫墙地面防水（聚合物水泥基三遍）', 'm²', 58, 38, '墙面返高 1.8m，地面满做，含闭水', '防水 厨卫'],
      ['阳台/露台防水', 'm²', 62, 42, '柔性防水两遍，含排水坡度', '防水 阳台'],
      ['闭水试验', '项', 120, 80, '蓄水 48 小时无渗漏', '闭水 试验'],
      ['墙面拉毛处理', 'm²', 18, 12, '水泥浆拉毛增强附着力', '拉毛 基层'],
      ['墙砖薄贴（300×600）', 'm²', 68, 45, '薄贴法，含十字卡与调平', '贴砖 墙砖'],
      ['地砖薄贴（800×800）', 'm²', 62, 42, '含找平与留缝', '贴砖 地砖'],
      ['大板瓷砖铺贴（750×1500）', 'm²', 118, 78, '含背胶与调平器', '大板 薄贴'],
      ['马赛克/小规格砖铺贴', 'm²', 128, 88, '含排版与细部收口', '马赛克 小砖'],
      ['踢脚线安装（瓷砖/石材）', 'm', 26, 17, '含开槽入墙或明装收口', '踢脚线'],
      ['门槛石/窗台石安装', 'm', 45, 30, '含磨边与安装', '门槛石 窗台'],
      ['轻质隔墙砌筑（加气块）', 'm²', 128, 88, '含植筋与抹灰', '隔墙 砌筑'],
      ['红砖墙砌筑', 'm²', 148, 102, '含过梁与拉结筋', '砌墙 红砖'],
      ['墙面抹灰找平', 'm²', 38, 26, '水泥砂浆抹灰，厚 20mm 内', '抹灰 找平'],
      ['门洞修整/封堵', '个', 180, 120, '含过梁与抹灰恢复', '门洞 封堵'],
      ['厨卫包立管', '根', 180, 120, '红砖/水泥板包管含检修口', '包管 立管'],
      ['烟道止逆阀安装', '个', 85, 55, '含密封处理', '烟道 止逆阀'],
      ['瓷砖美缝', 'm²', 28, 18, '清缝后美缝剂满填', '美缝 填缝'],
      ['石材铺贴（门槛/背景墙）', 'm²', 168, 115, '含干挂或湿贴工艺', '石材 铺贴'],
      ['地暖回填找平', 'm²', 55, 38, '豆石混凝土回填', '地暖 回填'],
      ['马桶坑距改造', '项', 260, 175, '含移位器与防水恢复', '马桶 坑距'],
      ['卫生间陶粒回填', 'm³', 280, 190, '陶粒回填+钢筋网+找平', '回填 陶粒'],
      ['卫生间架空工艺', 'm²', 168, 115, '预制板架空，便于检修', '架空 卫生间'],
      ['二次排水/暗地漏', '个', 128, 85, '沉箱二次排水防积水', '二次排水'],
      ['墙面界面剂（墙固）', 'm²', 8, 5, '滚涂界面剂增强附着力', '墙固 界面剂'],
      ['地面固化（地固）', 'm²', 8, 5, '固化地面防尘起砂', '地固 固化'],
      ['阴阳角护角条', 'm', 12, 8, 'PVC 护角条找直', '护角 阴阳角'],
    ],
  },
  {
    key: 'carpentry',
    name: '木作吊顶',
    icon: '🪚',
    desc: '吊顶、隔墙、背景墙、柜体基层、门窗套',
    items: [
      ['轻钢龙骨石膏板平吊顶', 'm²', 128, 88, '国标轻钢龙骨，9.5mm 石膏板', '吊顶 石膏板'],
      ['轻钢龙骨石膏板造型吊顶', 'm²', 168, 115, '含跌级与灯槽造型', '吊顶 造型'],
      ['局部吊顶（边顶/灯槽）', 'm', 128, 88, '宽度 400mm 内', '边顶 灯槽'],
      ['铝扣板吊顶（厨卫）', 'm²', 138, 95, '含龙骨与收边条', '铝扣板 厨卫'],
      ['集成吊顶（含电器）', 'm²', 268, 185, '含照明/换气/取暖模块', '集成吊顶'],
      ['石膏线安装', 'm', 22, 14, '含拼接与修补', '石膏线 线条'],
      ['木作窗帘盒', 'm', 88, 58, '木工板打底，含石膏板封面', '窗帘盒'],
      ['电视背景墙基层', 'm²', 168, 115, '木龙骨/木工板打底', '背景墙 基层'],
      ['木饰面背景墙', 'm²', 288, 198, '含基层与饰面板', '木饰面 背景'],
      ['石膏板隔墙（含隔音棉）', 'm²', 148, 102, '双面石膏板+隔音棉', '隔墙 石膏板'],
      ['榻榻米/地台木作', 'm²', 388, 268, '含储物结构与面板', '榻榻米 地台'],
      ['门套制作安装', '樘', 388, 265, '含基层与饰面', '门套 木作'],
      ['窗套制作安装', '套', 288, 198, '含基层与饰面', '窗套 木作'],
      ['木作柜体基层', 'm²', 188, 128, '柜体结构基层', '柜体 基层'],
      ['吊顶检修口', '个', 88, 58, '成品检修口安装', '检修口'],
      ['吊灯加固基层', '项', 128, 85, '承重加固预埋', '吊灯 加固'],
      ['中央空调出风口木作', '个', 148, 100, '风口木作基层', '风口 空调'],
      ['隐形门木作', '樘', 888, 620, '含隐形合页与整体饰面', '隐形门'],
      ['背景墙石材干挂', 'm²', 588, 400, '钢骨架干挂石材', '石材 干挂'],
      ['楼梯扶手安装', 'm', 388, 265, '实木/金属扶手安装', '楼梯 扶手'],
    ],
  },
  {
    key: 'paint',
    name: '油漆涂装',
    icon: '🎨',
    desc: '腻子、乳胶漆、木器漆、壁纸、艺术漆',
    items: [
      ['墙面基层修补', 'm²', 12, 8, '修补孔洞、裂缝、阴阳角', '修补 基层'],
      ['墙面挂网（防裂）', 'm²', 18, 12, '耐碱玻纤网满挂', '挂网 防裂'],
      ['腻子批刮（三遍）', 'm²', 32, 22, '含打磨前找平', '腻子 批刮'],
      ['墙面打磨', 'm²', 12, 8, '砂纸打磨至平整', '打磨 砂纸'],
      ['墙面刷乳胶漆（底漆一遍+面漆两遍）', 'm²', 28, 18, '滚涂工艺，含调色', '乳胶漆 墙面'],
      ['顶面刷乳胶漆', 'm²', 32, 21, '含石膏板接缝处理', '乳胶漆 顶面'],
      ['乳胶漆调色（每色）', '项', 180, 120, '电脑调色', '调色 乳胶漆'],
      ['木器清漆', 'm²', 88, 58, '三底两面，含打磨', '清漆 木器'],
      ['木器白漆', 'm²', 108, 72, '含原子灰与底漆', '白漆 木器'],
      ['壁纸铺贴', 'm²', 48, 32, '含基膜与对花', '壁纸 铺贴'],
      ['壁布/无缝墙布铺贴', 'm²', 68, 45, '含基膜与拼接处理', '壁布 墙布'],
      ['硅藻泥施工', 'm²', 128, 88, '含肌理造型', '硅藻泥'],
      ['艺术漆/肌理漆', 'm²', 188, 128, '含专用底漆与罩面', '艺术漆 肌理'],
      ['石膏线刷漆', 'm', 8, 5, '随墙面同色涂刷', '石膏线 刷漆'],
      ['踢脚线刷漆', 'm', 12, 8, '含修补与打磨', '踢脚线 刷漆'],
      ['阳台/外墙涂料', 'm²', 42, 28, '外墙乳胶漆两遍', '外墙 涂料'],
      ['防锈处理（钉眼/接缝）', '项', 180, 120, '防锈漆+绷带处理', '防锈 接缝'],
    ],
  },
  {
    key: 'install',
    name: '安装五金',
    icon: '🔧',
    desc: '灯具、洁具、开关、厨电、地板、门窗安装',
    items: [
      ['主灯安装', '套', 128, 85, '含加固与接线调试', '主灯 安装'],
      ['筒灯/射灯安装', '个', 22, 14, '含开孔', '筒灯 射灯'],
      ['灯带安装', 'm', 28, 18, '含卡槽与变压器', '灯带 安装'],
      ['开关插座面板安装', '个', 12, 7.5, '面板调平固定', '面板 安装'],
      ['马桶安装', '套', 168, 110, '含法兰密封圈与打胶', '马桶 安装'],
      ['浴室柜/台盆安装', '套', 218, 145, '含下水与角阀连接', '浴室柜 台盆'],
      ['淋浴花洒安装', '套', 128, 85, '含混水阀固定', '花洒 淋浴'],
      ['浴缸安装', '套', 388, 265, '含下水与周边打胶', '浴缸 安装'],
      ['淋浴房安装', '套', 288, 198, '含玻璃与五金固定', '淋浴房'],
      ['水龙头安装', '个', 58, 38, '含角阀与软管', '龙头 安装'],
      ['油烟机安装', '台', 188, 125, '含烟管连接与固定', '烟机 安装'],
      ['燃气灶安装', '台', 128, 85, '含气源接头检漏', '灶具 安装'],
      ['洗碗机安装', '台', 268, 180, '含上下水接驳', '洗碗机'],
      ['热水器安装', '台', 218, 145, '含烟管与安全阀', '热水器'],
      ['中央空调室内机安装', '台', 388, 265, '含吊装与管路接驳', '中央空调 内机'],
      ['窗帘杆/轨道安装', 'm', 38, 25, '含支架固定', '窗帘 轨道'],
      ['毛巾架/五金挂件安装', '件', 38, 25, '含打孔固定', '五金 挂件'],
      ['镜子安装', '块', 68, 45, '含镜子胶与固定件', '镜子 安装'],
      ['门锁/五金安装', '把', 68, 45, '含开孔与调试', '门锁 五金'],
      ['晾衣架安装', '套', 128, 85, '手摇/电动晾衣架', '晾衣架'],
      ['木地板安装', 'm²', 38, 25, '含防潮垫与收边条', '地板 安装'],
      ['地板防潮垫铺设', 'm²', 12, 8, '含接缝胶带密封', '防潮垫'],
      ['室内门安装', '樘', 188, 125, '含门锁合页调试', '室内门 安装'],
      ['推拉门/移门安装', '套', 288, 198, '含轨道与调试', '推拉门 移门'],
      ['防盗门安装', '樘', 288, 198, '含灌浆与调试', '防盗门'],
      ['窗台石英石安装', 'm', 88, 58, '含磨边与安装', '窗台石 石英石'],
      ['智能门锁安装', '把', 1288, 880, '含开孔改造与调试', '智能锁'],
      ['电动窗帘轨道', 'm', 388, 265, '含电机与轨道', '电动窗帘'],
      ['阳台封窗（断桥铝）', 'm²', 688, 470, '断桥铝 70 系列，含五金', '封窗 断桥铝'],
      ['纱窗安装', '扇', 188, 125, '金刚网/隐形纱窗', '纱窗'],
      ['防盗窗/隐形防护网', 'm²', 188, 125, '含固定件', '防护网 防盗窗'],
    ],
  },
  {
    key: 'custom',
    name: '定制主材',
    icon: '🛋️',
    desc: '橱柜、衣柜、玄关柜、榻榻米、全屋定制',
    items: [
      ['橱柜地柜（含台面）', 'm', 1280, 880, '实木颗粒板柜体+石英石台面', '橱柜 地柜'],
      ['橱柜吊柜', 'm', 880, 600, '含门板与五金', '橱柜 吊柜'],
      ['石英石台面', 'm', 588, 400, '含开孔与磨边', '台面 石英石'],
      ['衣柜柜体（投影面积）', 'm²', 688, 470, 'E0 级板材，含基础五金', '衣柜 柜体'],
      ['衣柜门板', 'm²', 388, 265, '含铰链与拉手', '衣柜 门板'],
      ['玄关柜/鞋柜', 'm²', 688, 470, '含换鞋凳与挂衣区', '玄关柜 鞋柜'],
      ['书柜/储物柜', 'm²', 588, 400, '含层板与背板', '书柜 储物'],
      ['榻榻米柜体', 'm²', 788, 540, '含储物格与升降台位', '榻榻米 定制'],
      ['餐边柜', 'm²', 688, 470, '含酒格与抽屉', '餐边柜'],
      ['阳台柜', 'm²', 588, 400, '含洗衣柜与吊柜', '阳台柜'],
      ['隐形床/壁床', '套', 2888, 1980, '含五金翻板结构', '隐形床 壁床'],
      ['衣帽间整体定制', 'm²', 888, 610, '含柜体、挂杆、抽屉', '衣帽间 定制'],
      ['橱柜五金（拉篮/抽屉）', '套', 388, 265, '阻尼导轨与拉篮', '橱柜 五金'],
      ['全屋智能中控', '套', 3888, 2680, '含主机与场景面板', '智能 中控'],
      ['全屋净水前置过滤器', '台', 688, 470, '含安装与接头', '净水 前置'],
      ['中央软水机', '台', 5888, 4050, '含安装与调试', '软水机'],
      ['新风管道铺设', 'm²', 88, 58, '含管路与风口', '新风 管道'],
      ['中央空调管道（每米）', 'm', 188, 128, '含铜管与保温', '中央空调 铜管'],
      ['水地暖铺设', 'm²', 188, 128, '含盘管与保温板', '地暖 水地暖'],
      ['地暖分水器', '套', 888, 610, '含分水器与温控', '地暖 分水器'],
    ],
  },
  {
    key: 'misc',
    name: '措施与其他',
    icon: '📋',
    desc: '设计费、管理费、措施费、加固、验收',
    items: [
      ['设计费（平层）', 'm²', 88, 0, '含平面方案、效果图、施工图', '设计费'],
      ['设计费（复式/别墅）', 'm²', 128, 0, '含全案设计与现场跟进', '设计费 别墅'],
      ['施工管理费', 'm²', 38, 0, '含项目经理与工序协调', '管理费'],
      ['材料运输费', '项', 480, 330, '主材配送到现场', '运输费'],
      ['成品保护费', '项', 380, 260, '全屋成品保护', '保护费'],
      ['施工水电费', '项', 380, 260, '施工期间水电消耗', '水电费'],
      ['高空作业费', '项', 680, 470, '含脚手架与安全措施', '高空 措施'],
      ['冬季施工措施费', '项', 580, 400, '含保温与防冻措施', '冬季 措施'],
      ['老房墙体加固', '项', 1288, 880, '含裂缝加固处理', '加固 老房'],
      ['承重墙碳纤维加固', 'm²', 588, 400, '碳纤维布加固（需专业资质）', '加固 碳纤维'],
      ['防水保修延长（5年）', '项', 888, 610, '延长保修服务', '保修 防水'],
      ['竣工验收费', '项', 388, 265, '含分项验收与整改跟进', '验收 竣工'],
      ['院子/露台铺装', 'm²', 188, 128, '含找坡与铺装', '院子 露台'],
      ['搬家/临时仓储', '项', 880, 610, '施工期间家具暂存', '搬家 仓储'],
      ['宠物/绿植临时安置', '项', 380, 260, '施工期间临时安置', '临时安置'],
    ],
  },
];

/** 展开为条目对象数组 */
function buildItems() {
  const list = [];
  let i = 0;
  for (const g of GROUPS) {
    for (const it of g.items) {
      i += 1;
      list.push({
        id: `LIB${String(i).padStart(3, '0')}`,
        group_key: g.key,
        group_name: g.name,
        name: it[0],
        unit: it[1],
        price: it[2],
        cost: it[3],
        craft: it[4],
        tags: (it[5] || '').split(/\s+/).filter(Boolean),
        source: 'builtin',
      });
    }
  }
  return list;
}

module.exports = { GROUPS, buildItems };
});

/* ================= demo/entry.js ================= */
__define("demo/entry.js", function (module, exports, require, __dirname, __filename) {
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
});


/* ================= 挂载到全局 ================= */
window.__HQ_DEMO__ = __require("demo/entry.js");
