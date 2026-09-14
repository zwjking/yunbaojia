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
