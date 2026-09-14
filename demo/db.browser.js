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
