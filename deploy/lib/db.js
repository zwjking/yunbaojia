/**
 * 数据访问层 — 模式选择
 *
 * 环境变量：
 * - HQ_DB_MODE=file → 本地开发，使用 JSON 文件存储（db-file.js）
 * - HQ_DB_MODE=cloud（默认）→ 云函数，使用 CloudBase PG（cloud-db.js）
 */
const mode = process.env.HQ_DB_MODE || 'cloud';

if (mode === 'file') {
  // 本地开发：使用原有 JSON 文件存储
  const { db, uid, now } = require('./db-file');
  module.exports = { db, uid, now };
} else {
  // 云函数：使用 CloudBase PG
  const { db, uid, now } = require('../cloud-db');
  module.exports = { db, uid, now };
}
