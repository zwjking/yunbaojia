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
