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
