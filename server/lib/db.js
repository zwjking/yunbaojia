/**
 * 极简 JSON 文档存储
 * 零依赖：内存缓存 + 防抖落盘，支持集合式增删改查
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

class Collection {
  constructor(name, seedFn) {
    this.name = name;
    this.file = path.join(DATA_DIR, `${name}.json`);
    this.dirty = false;
    this.timer = null;
    if (fs.existsSync(this.file)) {
      try {
        this.items = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      } catch (e) {
        console.error(`[db] ${name}.json 解析失败，已备份并重建：`, e.message);
        const bak = `${this.file}.corrupt.${Date.now()}`;
        fs.copyFileSync(this.file, bak);
        this.items = seedFn ? seedFn() : [];
        this.flush();
      }
    } else {
      this.items = seedFn ? seedFn() : [];
      this.flush();
    }
  }

  flush() {
    ensureDir();
    fs.writeFileSync(this.file, JSON.stringify(this.items, null, 2), 'utf8');
    this.dirty = false;
  }

  /** 延迟落盘，避免高频写 */
  save() {
    this.dirty = true;
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.dirty) this.flush();
    }, 200);
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

  /** 原子性自增序号（用于报价单号等） */
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
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  ).toUpperCase();
}

function now() { return new Date().toISOString(); }

ensureDir();

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

module.exports = { db, uid, now, DATA_DIR };
