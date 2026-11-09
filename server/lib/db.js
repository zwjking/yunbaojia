/**
 * 数据访问层 — 模式选择
 *
 * 环境变量：
 * - HQ_DB_MODE=file → 本地开发，使用 JSON 文件存储（db-file.js）
 * - HQ_DB_MODE=cloud（默认）→ 云函数，使用 CloudBase PG（cloud-db.js）
 */
// 默认 cloud（CloudBase PG）；若检测到 PocketBay 持久卷变量则自动切到本地 JSON 文件存储
let mode = process.env.HQ_DB_MODE || (process.env.POCKETBAY_DATA_DIR ? 'file' : 'cloud');

if (mode === 'cloud') {
  // 云函数：使用 CloudBase PG；若云 SDK/文件不可用则回退文件存储，避免启动即崩溃
  try {
    const { db, uid, now } = require('../cloud-db');
    module.exports = { db, uid, now };
  } catch (e) {
    console.warn('[db] cloud-db 不可用，回退到文件存储：' + ((e && e.message) || e));
    mode = 'file';
  }
}
if (mode === 'file') {
  // 本地开发 / PocketBay 持久卷：使用 JSON 文件存储
  const { db, uid, now } = require('./db-file');
  module.exports = { db, uid, now };
}
