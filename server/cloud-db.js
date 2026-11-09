/**
 * CloudBase PG 数据访问层
 * 模拟原有 db.js 的 Collection 接口，底层使用 CloudBase JS SDK v3 app.rdb()
 *
 * 设计原则：
 * 1. 保持与原有 db.js 相同的 API（find/findOne/insert/update/remove/count 等）
 * 2. 本地开发时 fallback 到 JSON 文件存储（HQ_DB_MODE=file）
 * 3. 云函数环境自动使用 PG 存储
 */
const cloudbase = require('@cloudbase/js-sdk');

/* ================= 初始化 ================= */

let app = null;
let db = null;

function initCloudBase() {
  if (app) return app;
  const envId = process.env.CLOUDBASE_ENV_ID;
  if (!envId) {
    console.error('[cloud-db] 缺少 CLOUDBASE_ENV_ID 环境变量');
    return null;
  }
  app = cloudbase.init({
    env: envId,
    accessKey: process.env.CLOUDBASE_ACCESS_KEY,
    secretKey: process.env.CLOUDBASE_SECRET_KEY,
  });
  db = app.rdb();
  return app;
}

/* ================= 工具函数 ================= */

function uid() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  ).toUpperCase();
}

function now() {
  return new Date().toISOString();
}

/* ================= Collection 类 ================= */

class Collection {
  constructor(name) {
    this.name = name;
  }

  /** 执行查询，支持函数谓词或对象谓词 */
  async _query(pred) {
    const table = this.name;
    let q = db.from(table).select('*');

    if (pred) {
      if (typeof pred === 'function') {
        // 函数谓词：先取全部，再过滤（简单实现）
        const { data, error } = await q;
        if (error) throw error;
        return (data || []).filter(pred);
      }
      // 对象谓词：等值匹配
      const conditions = Object.entries(pred);
      for (const [key, value] of conditions) {
        if (value === null || value === undefined) {
          q = q.is(key, null);
        } else {
          q = q.eq(key, value);
        }
      }
    }

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  all() {
    return this._query();
  }

  find(pred) {
    return this._query(pred);
  }

  async findOne(pred) {
    const items = await this._query(pred);
    return items[0] || null;
  }

  async insert(doc) {
    const table = this.name;
    if (!doc.id) doc.id = uid();
    if (!doc.created_at) doc.created_at = now();
    doc.updated_at = now();
    const { data, error } = await db.from(table).insert(doc);
    if (error) throw error;
    return doc;
  }

  async insertMany(docs) {
    const table = this.name;
    docs.forEach((d) => {
      if (!d.id) d.id = uid();
      if (!d.created_at) d.created_at = now();
    });
    const { data, error } = await db.from(table).insert(docs);
    if (error) throw error;
    return docs;
  }

  async update(id, patch) {
    const table = this.name;
    const { data, error } = await db
      .from(table)
      .update({ ...patch, updated_at: now() })
      .eq('id', id);
    if (error) throw error;
    return (data && data[0]) || null;
  }

  async remove(id) {
    const table = this.name;
    const { error } = await db.from(table).delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  async removeWhere(pred) {
    const items = await this._query(pred);
    for (const item of items) {
      await this.remove(item.id);
    }
    return items.length;
  }

  filter(fn) {
    // 返回一个 Promise，调用时先取全部数据再按函数过滤
    return this.all().then((items) => items.filter(fn));
  }

  count(pred) {
    if (!pred) {
      return this.all().then((items) => items.length);
    }
    return this.find(pred).then((items) => items.length);
  }

  /** no-op：CloudBase PG 无需持久化，保留此方法兼容旧代码 */
  flush() {
    return Promise.resolve();
  }
}

/* ================= 导出 ================= */

const dbObj = {
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

module.exports = {
  db: dbObj,
  uid,
  now,
  initCloudBase,
};
