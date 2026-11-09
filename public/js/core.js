/**
 * 前端核心：API 客户端 / UI 组件 / 图标 / 格式化 / 简易路由
 */
import { buildQuoteXlsx } from './xlsx.js';

/* ================= API ================= */
const TOKEN_KEY = 'hq_token';
const USER_KEY = 'hq_user';

// 支持通过环境变量或本地配置指定 API 基础地址
// 云函数部署时可通过构建脚本注入 CLOUDBASE_API_BASE
const API_BASE = window.__HQ_API_BASE__ || '/api/v1';

export const api = {
  get token() { return localStorage.getItem(TOKEN_KEY) || ''; },
  set token(v) { v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY); },
  get user() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch (e) { return null; }
  },
  set user(v) { v ? localStorage.setItem(USER_KEY, JSON.stringify(v)) : localStorage.removeItem(USER_KEY); },

  async call(method, path, body) {
    const url = API_BASE.startsWith('http') ? API_BASE + path : API_BASE + path;
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    let data;
    const text = await res.text();
    try { data = JSON.parse(text); } catch (e) { data = { error: text || '请求失败' }; }

    if (res.status === 401) {
      this.token = ''; this.user = null;
      if (!location.hash.startsWith('#/login')) location.hash = '#/login';
      throw new Error(data.error || '登录状态已失效，请重新登录。');
    }
    if (!res.ok) throw new Error(data.error || data.message || '请求失败，请稍后重试。');
    return data;
  },

  get: (p) => api.call('GET', p),
  post: (p, b) => api.call('POST', p, b),
  put: (p, b) => api.call('PUT', p, b),
  del: (p) => api.call('DELETE', p),

  logout() {
    this.token = ''; this.user = null;
    location.hash = '#/login';
  },
};

/* ================= 格式化 ================= */
export const fmt = {
  money(n, dec = 2) {
    const v = Number(n) || 0;
    return v.toLocaleString('zh-CN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  },
  int(n) { return (Number(n) || 0).toLocaleString('zh-CN'); },
  num(n, dec = 2) {
    const v = Number(n) || 0;
    return v.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: dec });
  },
  date(s) {
    if (!s) return '—';
    const d = new Date(s);
    if (isNaN(d)) return '—';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },
  dateTime(s) {
    if (!s) return '—';
    const d = new Date(s);
    if (isNaN(d)) return '—';
    return `${fmt.date(s)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  },
  ago(s) {
    if (!s) return '—';
    const diff = Date.now() - new Date(s).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return '刚刚';
    if (m < 60) return `${m} 分钟前`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} 小时前`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d} 天前`;
    return fmt.date(s);
  },
  wan(n) {
    const v = Number(n) || 0;
    if (v >= 10000) return `${(v / 10000).toFixed(1)} 万`;
    return fmt.int(v);
  },
};

/* ================= DOM ================= */
export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function $(sel, root = document) { return root.querySelector(sel); }
export function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

/** 事件委托：在 root 上监听 data-action */
export function delegate(root, action, handler) {
  root.addEventListener('click', (e) => {
    const el = e.target.closest(`[data-action="${action}"]`);
    if (!el) return;
    handler(el, e);
  });
}

/* ================= 图标 ================= */
const P = {
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 13h8"/><path d="M8 17h5"/>',
  layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  sparkles: '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  card: '<rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
  share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  arrowLeft: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  trending: '<path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/>',
  package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  calculator: '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M8 6h8"/><path d="M8 10h.01"/><path d="M12 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>',
  wand: '<path d="m3 21 9-9"/><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h0"/><path d="M17.8 6.2 19 5"/><path d="m3 21 3-1"/><path d="m13 21-9-9 1.4-1.4a2 2 0 0 1 2.8 0l6 6a2 2 0 0 1 0 2.8Z"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  pie: '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
  building: '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  save: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  ruler: '<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17V7"/>',
  filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
};

export function icon(name, size = 16, cls = '') {
  const d = P[name] || P.file;
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
}

/* ================= Toast ================= */
export function toast(msg, type = 'info', ms = 2600) {
  const host = document.getElementById('toast-host');
  if (!host) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success: icon('check', 15), error: icon('alert', 15), info: icon('zap', 15) };
  el.innerHTML = `${icons[type] || ''}<span>${esc(msg)}</span>`;
  host.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .25s, transform .25s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(-10px)';
    setTimeout(() => el.remove(), 260);
  }, ms);
}

/* ================= Modal ================= */
export function modal({ title, body, footer, width = 480, onMount }) {
  const host = document.getElementById('modal-host');
  const mask = document.createElement('div');
  mask.className = 'modal-mask';
  mask.innerHTML = `
    <div class="modal" style="max-width:${width}px">
      <div class="modal-head">
        <h3>${esc(title)}</h3>
        <button class="modal-close" data-close>${icon('x', 18)}</button>
      </div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
    </div>`;
  host.appendChild(mask);

  const close = () => mask.remove();
  mask.addEventListener('click', (e) => {
    if (e.target === mask || e.target.closest('[data-close]')) close();
  });
  const escHandler = (e) => {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); }
  };
  document.addEventListener('keydown', escHandler);

  if (onMount) onMount(mask, close);
  return { el: mask, close };
}

export function confirmBox(title, message, danger = false) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal({
      title,
      body: `<p style="font-size:13.5px;color:var(--text-2);line-height:1.7">${esc(message)}</p>`,
      footer: `
        <button class="btn btn-secondary" data-no>取消</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes>确定</button>`,
      onMount(el, close) {
        el.querySelector('[data-yes]').onclick = () => { done = true; close(); resolve(true); };
        el.querySelector('[data-no]').onclick = () => { done = true; close(); resolve(false); };
      },
    });
    // 点遮罩关闭时视为取消
    const obs = new MutationObserver(() => {
      if (!document.body.contains(m.el) && !done) { obs.disconnect(); resolve(false); }
    });
    obs.observe(document.getElementById('modal-host'), { childList: true });
  });
}

/* ================= 表格 / 空状态 ================= */
export function emptyState(iconName, title, desc, actionHtml = '') {
  return `<div class="empty">
    <div class="empty-icon">${icon(iconName, 24)}</div>
    <div class="empty-title">${esc(title)}</div>
    <div class="empty-desc">${esc(desc)}</div>
    ${actionHtml}
  </div>`;
}

export function loadingRow(text = '加载中…') {
  return `<div class="empty"><div class="spinner dark" style="width:22px;height:22px"></div>
    <div class="empty-desc">${esc(text)}</div></div>`;
}

/* ================= 路由 ================= */
const routes = [];
export function route(pattern, loader) { routes.push({ pattern, loader }); }

export function matchRoute(hash) {
  const path = (hash || '#/').replace(/^#/, '') || '/';
  for (const r of routes) {
    if (typeof r.pattern === 'string') {
      if (r.pattern === path) return { loader: r.loader, params: {} };
    } else {
      const m = r.pattern.exec(path);
      if (m) return { loader: r.loader, params: m.groups || {} };
    }
  }
  return null;
}

export function navigate(hash) { location.hash = hash; }
export function currentPath() { return (location.hash || '#/').replace(/^#/, '') || '/'; }

/* ================= 工具 ================= */
export function debounce(fn, ms = 300) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

/**
 * 在「新窗口」内触发下载。
 * 资料库版的 iframe sandbox 没有 allow-downloads，直接 <a download> 会被静默拦截；
 * 但 sandbox 里带了 allow-popups-to-escape-sandbox —— window.open 出来的新窗口
 * 已脱离沙箱约束，在其中触发下载即可正常落盘（已实测：文件真实写入下载目录）。
 * 返回 true 表示已打开下载窗口（视为成功），false 表示弹窗被拦、需降级处理。
 */
function popupDownload(filename, url) {
  try {
    const w = window.open('', '_blank');
    if (!w) return false;
    const name = esc(filename);
    w.document.open();
    w.document.write(
      '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">' +
      '<title>' + name + '</title></head>' +
      '<body style="font-family:"Microsoft YaHei",sans-serif;padding:48px 20px;text-align:center;color:#334155">' +
      '<p style="font-size:14px;margin-bottom:18px">文件正在下载…若没有自动开始，请点下面的按钮</p>' +
      '<a id="__hqdl" download="' + name + '" href="' + url + '" ' +
      'style="display:inline-block;padding:10px 20px;background:#4f46e5;color:#fff;' +
      'border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">下载 ' + name + '</a>' +
      '<scr' + 'ipt>setTimeout(function(){var d=document.getElementById("__hqdl");' +
      'if(d)d.click();setTimeout(function(){window.close()},3000);},80);</scr' + 'ipt>' +
      '</body></html>'
    );
    w.document.close();
    return true;
  } catch (e) {
    return false;
  }
}

export function downloadFile(filename, content, mime = 'text/plain') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);

  // 沙箱环境（资料库版）：改由新窗口触发下载
  if (isSandboxExport()) {
    if (popupDownload(filename, url)) {
      setTimeout(() => { URL.revokeObjectURL(url); }, 60000);
      return true;
    }
    URL.revokeObjectURL(url);
    return false;
  }

  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  return true;
}

/**
 * 是否为「资料库版」沙箱环境。
 * 资料库版以纯静态托管方式运行，iframe sandbox 没有 allow-downloads，
 * 直接触发 <a download> 会被浏览器拦截；此时导出改为「复制到剪贴板 / 弹窗复制」。
 * 判断依据：演示模式标志位仅在纯静态托管时置位（PocketBay / localhost 不置位）。
 */
export function isSandboxExport() {
  return window.__HQ_DEMO_MODE__ === true;
}

/** 把二维数组转成 TSV（剪贴板粘贴到 Excel / WPS 即分列） */
function rowsToTsv(rows) {
  return rows.map((r) => r.map((cell) => {
    const s = String(cell == null ? '' : cell);
    return /[\t\r\n"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join('\t')).join('\r\n');
}

/** 把二维数组转成 CSV（带 BOM，Excel 打开中文不乱码） */
function rowsToCsv(rows) {
  return rows.map((r) => r.map((cell) => {
    const s = String(cell == null ? '' : cell);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\r\n');
}

/** downloadFile 的二进制版：接受 Uint8Array / Blob（xlsx 等真二进制格式用） */
export function downloadBlob(filename, data, mime = 'application/octet-stream') {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);

  // 沙箱环境（资料库版）：与 downloadFile 相同，改由新窗口触发下载
  if (isSandboxExport()) {
    if (popupDownload(filename, url)) {
      setTimeout(() => { URL.revokeObjectURL(url); }, 60000);
      return true;
    }
    URL.revokeObjectURL(url);
    return false;
  }

  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  return true;
}

/**
 * 通用表格导出：
 *  - 正常环境（PocketBay / localhost）：直接下载 .csv 文件（Excel / WPS 可打开）
 *  - 沙箱环境（资料库版）：走新窗口下载（逃出 iframe sandbox 的 allow-downloads 限制）；
 *    弹窗被拦时才降级为「复制到剪贴板 → 弹窗手动复制」
 * rows: 二维数组（含表头）
 */
export async function exportSpreadsheet(filename, rows, opts = {}) {
  const tsv = rowsToTsv(rows);
  const csv = rowsToCsv(rows);
  const dlName = filename.toLowerCase().endsWith('.csv') ? filename : `${filename}.csv`;

  // 统一走 downloadFile（内部自动适配沙箱环境）
  if (downloadFile(dlName, '\ufeff' + csv, 'text/csv')) {
    toast(opts.successMsg || '已导出 Excel 文件', 'success');
    return;
  }

  // 降级：复制到剪贴板
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(tsv);
      toast(opts.clipboardMsg || 'Excel 数据已复制到剪贴板，打开 Excel / WPS 粘贴即可', 'success');
      return;
    }
    throw new Error('clipboard 不可用');
  } catch (e) {
    // 兜底：弹窗展示可复制的数据
    const w = window.open('', '_blank');
    if (!w) { toast('请允许弹出窗口以导出数据', 'error'); return; }
    w.document.write(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
      <title>导出数据</title></head><body style="margin:0">
      <div style="padding:12px;font-family:sans-serif;color:#334;font-size:13px">全选下方内容复制，粘贴到 Excel / WPS 即可。</div>
      <pre style="margin:0;padding:12px 16px;font:13px/1.6 Consolas,Menlo,monospace;white-space:pre;background:#f8fafc">${esc(tsv)}</pre>
      </body></html>`);
    w.document.close();
    toast(opts.popupMsg || '已打开数据窗口，全选复制后粘到 Excel', 'info');
  }
}

/** 导出 CSV（Excel 可直接打开），保持原调用签名，自动适配沙箱 */
export function exportCSV(filename, headers, rows) {
  return exportSpreadsheet(filename, [headers, ...rows]);
}

/**
 * 导出完整报价单为「真 Excel」（.xlsx，零依赖生成，见 xlsx.js）：
 * 标题合并 + 信息区 + 分类明细（表头底纹/冻结窗格/金额千分位）+ 汇总。
 * 生成失败时自动降级为原 CSV 导出（exportSpreadsheet），保证任何环境都有产出。
 */
export async function exportExcel(quote, items, org) {
  const fallback = () => {
    const c = items.reduce((s, i) => s + (Number(i.unit_price) || 0) * (Number(i.qty) || 0), 0);
    const manage = Number(quote.manage_fee) || 0;
    const tax = Number(quote.tax_rate) || 0;
    const subtotal = c;
    const grand = (subtotal + manage) * (1 + tax / 100);

    const head = [
      ['装修报价单', org && org.name ? org.name : '云报价'],
      ['报价编号', quote.quote_number || ''],
      ['项目名称', quote.title || ''],
      ['客户', quote.customer_name || ''],
      ['小区 / 地址', quote.community || ''],
      ['城市', quote.city || ''],
      ['建筑面积 (m²)', quote.building_area || ''],
      ['户型', quote.layout || ''],
      ['装修档次', quote.tier || ''],
      [],
      ['分类', '项目', '单位', '数量', '单价(元)', '金额(元)', '成本(元)', '工艺说明'],
    ];

    const itemRows = items.map((i) => [
      i.group_name || '未分类',
      i.name || '',
      i.unit || '',
      Number(i.qty) || 0,
      Number(i.unit_price) || 0,
      Number((Number(i.unit_price) || 0) * (Number(i.qty) || 0)).toFixed(2),
      Number(i.cost_price) || 0,
      i.craft || '',
    ]);

    const tail = [
      [],
      ['工程小计', subtotal.toFixed(2)],
      ['管理费 (元)', manage.toFixed(2)],
      ['税率 (%)', tax],
      ['合计 (元)', grand.toFixed(2)],
      ['备注', quote.notes || ''],
    ];

    const rows = head.concat(itemRows, tail);
    return exportSpreadsheet(`${quote.quote_number || '报价'}_报价单`, rows, {
      successMsg: '已导出报价单 Excel 文件',
      clipboardMsg: '报价单数据已复制到剪贴板，打开 Excel / WPS 粘贴即可',
      popupMsg: '已打开报价单数据窗口，全选复制后粘到 Excel',
    });
  };

  try {
    const bytes = buildQuoteXlsx(quote, items, org);
    const name = `${quote.quote_number || '报价'}_报价单.xlsx`;
    if (downloadBlob(name, bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
      toast('已导出报价单 Excel（.xlsx）', 'success');
      return;
    }
    // 弹窗被拦 → 走剪贴板降级
    return fallback();
  } catch (e) {
    console.error('xlsx 生成失败，降级 CSV：', e);
    return fallback();
  }
}

/**
 * 生成「客户报价页」自包含单文件 HTML（离线可打开，不依赖任何后端）。
 *
 * 背景：资料库版是纯静态托管（iframe 跨域 + 宿主 hash 不转发 + 数据 SDK 依赖父页），
 * 无法产出可在线访问的客户链接。因此把整份报价渲染成一个独立网页文件，
 * 微信 / 邮件发给客户，用浏览器打开即看，含完整明细与合计。
 */
export function buildClientQuoteHtml(quote, items, org) {
  const o = org || {};
  const snapAt = new Date().toLocaleString('zh-CN', { hour12: false });
  const groups = {};
  items.forEach((it) => {
    const g = it.group_name || '未分类';
    (groups[g] = groups[g] || []).push(it);
  });

  const groupHtml = Object.entries(groups).map(([g, list]) => {
    const sub = list.reduce((s, i) => s + (Number(i.unit_price) || 0) * (Number(i.qty) || 0), 0);
    const rows = list.map((i) => {
      const amt = (Number(i.unit_price) || 0) * (Number(i.qty) || 0);
      return `<tr>
        <td><b>${esc(i.name)}</b>${i.craft ? `<div class="craft">${esc(i.craft)}</div>` : ''}</td>
        <td class="c">${esc(i.unit || '')}</td>
        <td class="r num">${fmt.num(i.qty)}</td>
        <td class="r num">${fmt.money(i.unit_price)}</td>
        <td class="r num strong">${fmt.money(amt)}</td>
      </tr>`;
    }).join('');
    return `<section class="grp">
      <div class="grp-hd"><span>${esc(g)}</span><span class="num">¥ ${fmt.money(sub)}</span></div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>项目</th><th class="c w60">单位</th><th class="r w80">数量</th><th class="r w96">单价</th><th class="r w110">金额</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </section>`;
  }).join('');

  const grand = Number(quote.grand_total || quote.total_amount || 0);
  const cards = [
    ['客户', quote.customer_name || '—'],
    ['小区 / 地址', quote.community || '—'],
    ['建筑面积', quote.building_area ? `${quote.building_area} m²` : '—'],
    ['户型', quote.layout || '—'],
    ['城市', quote.city || '—'],
    ['装修档次', quote.tier || '—'],
    ['房屋类型', quote.house_type || '—'],
    ['明细条数', `${items.length} 项`],
  ].map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(quote.title || '装修报价单')} · ${esc(quote.quote_number || '')}</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;background:#f1f5f9;color:#0f172a;
    font-family:"Microsoft YaHei","PingFang SC","Helvetica Neue",Arial,sans-serif;font-size:14px;line-height:1.6}
  .page{max-width:1000px;margin:0 auto;background:#fff;min-height:100vh;
    box-shadow:0 1px 3px rgba(15,23,42,.08)}
  .hd{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;
    padding:24px 26px 18px;border-bottom:3px solid #4f46e5}
  .hd h1{margin:0 0 4px;font-size:21px;letter-spacing:.2px}
  .hd .org{color:#64748b;font-size:12.5px}
  .hd .meta{text-align:right;color:#64748b;font-size:12px}
  .hd .meta .no{font-size:15px;font-weight:700;color:#0f172a;font-family:Consolas,Menlo,monospace}
  .cards{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:18px 26px 6px}
  .cards>div{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 11px}
  .cards span{display:block;color:#94a3b8;font-size:11px;margin-bottom:2px}
  .cards b{font-size:13.5px;font-weight:600;word-break:break-all}
  .grp{padding:14px 26px 0}
  .grp-hd{display:flex;justify-content:space-between;align-items:center;gap:10px;
    padding:7px 0;border-bottom:2px solid #4f46e5;font-weight:700;font-size:14.5px}
  .tbl-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
  table{width:100%;border-collapse:collapse;margin-top:2px}
  th{background:#f1f5f9;text-align:left;font-size:11.5px;color:#475569;font-weight:600;
    padding:7px 8px;border-bottom:1px solid #cbd5e1;white-space:nowrap}
  td{padding:7px 8px;border-bottom:1px solid #eef2f7;font-size:13px;vertical-align:top}
  tr:last-child td{border-bottom:0}
  .craft{color:#94a3b8;font-size:11.5px;margin-top:2px;line-height:1.5}
  .num{font-family:Consolas,Menlo,monospace}
  .strong{font-weight:700}
  .c{text-align:center}.r{text-align:right}.w60{width:60px}.w80{width:80px}.w96{width:96px}.w110{width:110px}
  .total{display:flex;justify-content:space-between;align-items:center;
    margin:22px 26px 0;padding:16px 20px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px}
  .total span{color:#4338ca;font-size:13.5px;font-weight:600}
  .total b{font-size:25px;font-weight:800;color:#4f46e5;font-family:Consolas,Menlo,monospace}
  .notes{padding:18px 26px 0}
  .notes h4{margin:0 0 6px;font-size:13.5px}
  .notes p{margin:0;color:#475569;font-size:12.5px;line-height:1.8;white-space:pre-wrap}
  .foot{padding:20px 26px 30px;color:#94a3b8;font-size:11.5px;line-height:1.8;
    border-top:1px solid #e2e8f0;margin-top:22px}
  .act{display:flex;gap:10px;padding:16px 26px 0}
  .act button{padding:9px 18px;border:1px solid #cbd5e1;background:#fff;border-radius:8px;
    font-size:13px;color:#334155;cursor:pointer;font-family:inherit}
  .act button:hover{background:#f8fafc}
  .act{flex-wrap:wrap;align-items:center}
  .act-tip{color:#94a3b8;font-size:11.5px}
  @media (max-width:640px){
    .hd{padding:18px 16px 14px}
    .hd h1{font-size:19px}
    .cards{grid-template-columns:repeat(2,1fr);padding:14px 16px 4px}
    .grp{padding:12px 16px 0}
    .total{margin:18px 16px 0;padding:13px 16px;flex-direction:column;gap:4px;align-items:flex-start}
    .total b{font-size:22px}.notes,.act{padding-left:16px;padding-right:16px}
    .foot{padding:16px 16px 24px}
    /* 窄屏：表格改卡片式。固定列宽（60+80+96+110+内边距）合计约 426px，
       真机 390~414px 下会把「项目」列挤到几乎为零、名称逐字换行 —— 必须换布局 */
    .tbl-wrap{overflow:visible}
    table{min-width:0}
    thead{display:none}
    table,tbody,tr,td{display:block}
    tbody tr{position:relative;padding:10px 92px 11px 0;border-bottom:1px solid #eef2f7}
    tr:last-child{border-bottom:0}
    tbody td{border:0;padding:0;width:auto!important;text-align:left!important}
    tbody td:nth-child(1){font-size:14px;line-height:1.5}
    tbody td:nth-child(1) b{font-weight:600}
    tbody td:nth-child(5){position:absolute;top:10px;right:0;
      font-size:14.5px;font-weight:800;text-align:right;color:#0f172a}
    tbody td:nth-child(2),tbody td:nth-child(3),tbody td:nth-child(4){
      display:inline;color:#64748b;font-size:12px}
    tbody td:nth-child(2){margin-top:4px}
    tbody td:nth-child(2)::after{content:" · "}
    tbody td:nth-child(4)::before{content:" × ¥"}
    .craft{margin-top:3px}
  }
  @media print{body{background:#fff}.page{box-shadow:none;max-width:none}.act{display:none}}
</style>
</head>
<body>
<div class="page">
  <header class="hd">
    <div>
      <h1>${esc(quote.title || '装修报价单')}</h1>
      <div class="org">${esc(o.name || '')}${o.phone ? ` · ${esc(o.phone)}` : ''}${o.address ? ` · ${esc(o.address)}` : ''}</div>
    </div>
    <div class="meta">
      <div>报价单号</div>
      <div class="no">${esc(quote.quote_number || '—')}</div>
      <div>${esc(fmt.date(quote.created_at || new Date().toISOString()))}</div>
    </div>
  </header>

  <div class="cards">${cards}</div>

  ${groupHtml}

  <div class="total"><span>合计金额（含管理费与税）</span><b>¥ ${fmt.money(grand)}</b></div>

  ${quote.notes ? `<div class="notes"><h4>备注</h4><p>${esc(quote.notes)}</p></div>` : ''}

  <div class="act">
    <button type="button" onclick="window.print()">打印 / 保存 PDF</button>
    <span class="act-tip">手机上可直接转发本页链接，或点左侧按钮存成 PDF</span>
  </div>

  <div class="foot">
    本报价由云报价系统生成，价格以双方确认的正式文件为准。如对明细有疑问，请联系报价方确认。<br>
    本页为报价快照，生成时间 ${esc(snapAt)}。
  </div>
</div>
</body>
</html>`;
}

/** 报价单纯文本摘要（可直接粘贴到微信发给客户） */
export function buildClientQuoteText(quote, items, org) {
  const o = org || {};
  const groups = {};
  items.forEach((it) => {
    const g = it.group_name || '未分类';
    (groups[g] = groups[g] || []).push(it);
  });
  const lines = [];
  lines.push(`【${quote.title || '装修报价单'}】`);
  lines.push(`报价单号：${quote.quote_number || '—'}`);
  if (quote.customer_name) lines.push(`客户：${quote.customer_name}`);
  if (quote.community) lines.push(`小区：${quote.community}`);
  if (quote.building_area) lines.push(`建筑面积：${quote.building_area} m²`);
  if (quote.layout) lines.push(`户型：${quote.layout}`);
  if (quote.tier) lines.push(`装修档次：${quote.tier}`);
  lines.push('');
  Object.entries(groups).forEach(([g, list], gi) => {
    const sub = list.reduce((s, i) => s + (Number(i.unit_price) || 0) * (Number(i.qty) || 0), 0);
    lines.push(`${gi + 1}. ${g}  ¥${fmt.money(sub, 0)}`);
    list.forEach((i, idx) => {
      const amt = (Number(i.unit_price) || 0) * (Number(i.qty) || 0);
      lines.push(`   ${idx + 1}) ${i.name}  ${fmt.num(i.qty)}${i.unit || ''} × ¥${fmt.money(i.unit_price)} = ¥${fmt.money(amt)}`);
    });
    lines.push('');
  });
  lines.push(`合计金额：¥${fmt.money(quote.grand_total || quote.total_amount || 0)}`);
  if (quote.notes) lines.push(`备注：${quote.notes}`);
  if (o.name) lines.push(`—— ${o.name}${o.phone ? ` ${o.phone}` : ''}`);
  return lines.join('\n');
}

/* ================= 客户链接（报价长图） ================= */

/** 资料库页面 SDK（沙箱环境注入；非沙箱返回 null） */
export function pageDbSdk() {
  try {
    return (window.__SMART_PAGE__ && window.__SMART_PAGE__.database) || null;
  } catch (e) { return null; }
}

/** 字符串 → UTF-8 字节的 base64（uploadImage 要求不含 data: 前缀） */
function toBase64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/** 报价单 → 手机可读的 SVG 长图（客户长图 / 客户链接用图） */
export function buildQuoteSvg(quote, items, org) {
  const o = org || {};
  const W = 640;
  const P = 26;
  const CW = W - P * 2;
  const BRAND = '#4f46e5';
  const body = [];

  const xml = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

  // 文本宽度估算（CJK 约等于字号，拉丁约 0.56 字号）
  const textW = (str, size) => {
    let w = 0;
    for (const ch of String(str)) {
      const code = ch.codePointAt(0);
      if (code > 0x2e80) w += size;
      else if (/[A-Za-z0-9]/.test(ch)) w += size * 0.56;
      else w += size * 0.42;
    }
    return w;
  };

  const wrap = (str, maxW, size) => {
    const lines = [];
    let cur = '';
    for (const ch of String(str)) {
      if (cur && textW(cur + ch, size) > maxW) { lines.push(cur); cur = ch; } else cur += ch;
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [''];
  };

  const FONT = 'Microsoft YaHei,PingFang SC,SimHei,sans-serif';
  let y = 0;
  const t = (x, yy, str, size, color, weight, anchor) =>
    `<text x="${x}" y="${yy}" font-size="${size}" fill="${color}"${weight ? ` font-weight="${weight}"` : ''}${anchor ? ` text-anchor="${anchor}"` : ''} font-family="${FONT}">${xml(str)}</text>`;
  const rect = (x, yy, w, h, fill, r) =>
    `<rect x="${x}" y="${yy}" width="${w}" height="${h}" fill="${fill}"${r ? ` rx="${r}"` : ''}/>`;
  const line = (yy, color) =>
    `<rect x="${P}" y="${yy}" width="${CW}" height="1" fill="${color || '#e2e8f0'}"/>`;

  // ---- 顶部品牌条 ----
  body.push(rect(0, 0, W, 10, BRAND));
  y = 64;

  // ---- 标题区 ----
  wrap(quote.title || '装修报价单', CW, 30).forEach((ln) => {
    body.push(t(P, y, ln, 30, '#0f172a', 800));
    y += 40;
  });
  const orgLine = [o.name, o.phone].filter(Boolean).join('  ·  ');
  if (orgLine) { body.push(t(P, y, orgLine, 17, '#64748b')); y += 27; }
  body.push(t(P, y, `报价单号 ${quote.quote_number || '—'}    ${fmt.date(quote.created_at || new Date().toISOString())}`, 15, '#94a3b8'));
  y += 22;
  body.push(rect(P, y, CW, 2, BRAND));
  y += 34;

  // ---- 信息卡（两列三行）----
  const cards = [
    ['客户', quote.customer_name || '—'],
    ['小区 / 地址', quote.community || '—'],
    ['建筑面积', quote.building_area ? `${quote.building_area} m²` : '—'],
    ['户型', quote.layout || '—'],
    ['城市', quote.city || '—'],
    ['装修档次', quote.tier || '—'],
  ];
  const gap = 12;
  const cardW = (CW - gap) / 2;
  const cardH = 64;
  cards.forEach((c, i) => {
    const cx = P + (i % 2) * (cardW + gap);
    const cy = y + Math.floor(i / 2) * (cardH + gap);
    body.push(rect(cx, cy, cardW, cardH, '#f8fafc', 10));
    body.push(`<rect x="${cx}" y="${cy}" width="${cardW}" height="${cardH}" rx="10" fill="none" stroke="#e2e8f0"/>`);
    body.push(t(cx + 14, cy + 25, c[0], 15, '#94a3b8'));
    wrap(c[1], cardW - 28, 20).slice(0, 2).forEach((ln, k) => {
      body.push(t(cx + 14, cy + 52 + k * 24, ln, 20, '#0f172a', 700));
    });
  });
  y += Math.ceil(cards.length / 2) * (cardH + gap) + 8;

  // ---- 明细（单列卡片式，适配手机竖屏阅读）----
  const groups = {};
  items.forEach((it) => {
    const g = it.group_name || '未分类';
    (groups[g] = groups[g] || []).push(it);
  });

  Object.entries(groups).forEach(([g, list]) => {
    const sub = list.reduce((s, i) => s + (Number(i.unit_price) || 0) * (Number(i.qty) || 0), 0);
    body.push(rect(P, y, CW, 50, '#eef2ff', 8));
    body.push(t(P + 14, y + 33, g, 23, '#312e81', 800));
    body.push(t(W - P - 14, y + 33, `¥ ${fmt.money(sub)}`, 23, '#312e81', 800, 'end'));
    y += 50;

    list.forEach((i, idx) => {
      const amt = (Number(i.unit_price) || 0) * (Number(i.qty) || 0);
      const nameLines = wrap(i.name || '', CW - 44, 21);
      const craftLines = i.craft ? wrap(i.craft, CW - 44, 17).slice(0, 3) : [];
      const rowH = 30 + nameLines.length * 28 + 26 + craftLines.length * 23 + 12;
      const top = y;

      body.push(t(P + 2, y + 25, String(idx + 1), 17, '#cbd5e1', 700));
      let ny = y + 25;
      nameLines.forEach((ln, k) => body.push(t(P + 30, ny + k * 28, ln, 21, '#0f172a', 700)));
      ny += nameLines.length * 28 + 5;
      body.push(t(P + 30, ny, `${fmt.num(i.qty)}${i.unit || ''} × ¥${fmt.money(i.unit_price)}`, 18, '#64748b'));
      body.push(t(W - P, ny, `¥ ${fmt.money(amt)}`, 21, '#0f172a', 800, 'end'));
      craftLines.forEach((ln, k) => body.push(t(P + 30, ny + 25 + k * 23, ln, 17, '#94a3b8')));

      y = top + rowH;
      body.push(line(y - 7, '#eef2f7'));
    });
    y += 16;
  });

  // ---- 合计 ----
  y += 6;
  const grand = Number(quote.grand_total || quote.total_amount || 0);
  body.push(rect(P, y, CW, 104, '#eef2ff', 12));
  body.push(`<rect x="${P}" y="${y}" width="${CW}" height="104" rx="12" fill="none" stroke="#c7d2fe"/>`);
  body.push(t(P + 20, y + 37, '合计金额（含管理费与税）', 19, '#4338ca', 700));
  body.push(t(P + 20, y + 84, `¥ ${fmt.money(grand)}`, 40, BRAND, 800));
  y += 104 + 28;

  // ---- 备注 ----
  if (quote.notes) {
    body.push(t(P, y, '备注', 20, '#0f172a', 800));
    y += 28;
    wrap(quote.notes, CW, 18).forEach((ln) => { body.push(t(P, y, ln, 18, '#475569')); y += 26; });
    y += 14;
  }

  if (o.address) {
    body.push(t(P, y, o.address, 17, '#94a3b8'));
    y += 24;
  }

  // ---- 页脚 ----
  body.push(line(y, '#e2e8f0'));
  y += 26;
  const foot = '本报价由云报价系统生成，价格以双方确认的正式文件为准。如对明细有疑问，请联系报价方确认。';
  wrap(foot, CW, 16).forEach((ln) => { body.push(t(P, y, ln, 16, '#94a3b8')); y += 23; });
  y += 30;

  const H = Math.max(y, 600);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
    + `<rect width="${W}" height="${H}" fill="#ffffff"/>`
    + body.join('')
    + '</svg>';
}

/** SVG 长图 → PNG base64（画布被污染 / 体积超限时 reject，交由上层降级为 SVG） */
function svgToPngBase64(svg, scale) {
  return new Promise((resolve, reject) => {
    const m = /width="(\d+)"\s+height="(\d+)"/.exec(svg);
    const w = m ? Number(m[1]) : 880;
    const h = m ? Number(m[2]) : 1200;
    // 动态倍率：画布高度控制在浏览器上限内，同时尽量高清
    const s = scale || Math.max(0.8, Math.min(2, 15000 / Math.max(h, 1)));
    const img = new Image();
    img.onload = () => {
      try {
        const cv = document.createElement('canvas');
        cv.width = Math.round(w * s);
        cv.height = Math.round(h * s);
        const ctx = cv.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        const b64 = String(cv.toDataURL('image/png')).split(',')[1] || '';
        if (!b64) return reject(new Error('PNG 导出为空'));
        if (b64.length * 0.75 > 9 * 1024 * 1024) return reject(new Error('长图超过 9MB'));
        return resolve(b64);
      } catch (e) { return reject(e); }
    };
    img.onerror = () => reject(new Error('长图渲染失败'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

/** 把生成好的长图另存为本地文件（沙箱内走新窗口下载，绕过 iframe 的 allow-downloads 限制） */
export function downloadQuoteImage(filename, dataUrl) {
  const name = /\.png$/i.test(filename) ? filename : `${filename}.png`;
  if (isSandboxExport()) {
    if (popupDownload(name, dataUrl)) { toast('长图已开始下载', 'success'); return true; }
    toast('浏览器拦截了弹窗，请允许弹出窗口后重试', 'error');
    return false;
  }
  const a = document.createElement('a');
  a.href = dataUrl; a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => a.remove(), 1500);
  toast('长图已保存到下载目录', 'success');
  return true;
}

/** 上传失败时给用户看得懂的原因（401=未登录最常见） */
function uploadFailHint(err) {
  const m = String((err && (err.message || err)) || '');
  if (/401|not login|未登录|unauthor/i.test(m)) {
    return '当前未登录，暂时无法上传生成公网链接。已为你准备好报价长图，可直接保存后发给客户；登录后重新生成即可得到链接。';
  }
  return `生成链接失败：${m || '未知错误'}`;
}

/**
 * 生成客户链接。
 *
 * 资料库（沙箱）版按「越接近真实网页越好」的顺序尝试上传：
 *   ① 自包含报价网页（text/html）—— 客户点开就是一份完整报价页：手机自适应、可放大、
 *      页面自带「打印 / 保存 PDF」。这是首选，体验等同正经网站。
 *   ② 兜底一：报价长图 PNG —— 聊天工具可直接预览、长按可保存转发。
 *   ③ 兜底二：报价长图 SVG —— 体积最小，浏览器可缩放。
 *   ④ 全部失败（多为未登录）：返回本地长图，至少能直接发图片给客户。
 *
 * 有真实后端的版本走 /quotes/:id/share 拿 token，拼站内分享链接。
 *
 * 返回 { url, kind, format, image?, reason? }
 *  kind='html'  网页链接（首选）
 *  kind='image' 图片链接
 *  kind='local' 上传失败，url 为空，只有本地长图
 *  kind='page'  真实后端的站内分享链接
 */
export async function createClientLink(quote, items, org) {
  const no = quote.quote_number || 'quote';
  const db = pageDbSdk();

  if (db && typeof db.uploadImage === 'function') {
    let lastErr = null;

    // ① 自包含报价网页：真·网页，客户可缩放、可打印存 PDF，无需登录
    try {
      const html = buildClientQuoteHtml(quote, items, org);
      const r = await db.uploadImage({
        data: toBase64Utf8(html),
        contentType: 'text/html',
        fileName: `${no}.html`,
      });
      const url = r && (r.url || r.Url);
      if (url) return { url, kind: 'html', format: 'html' };
      lastErr = new Error('上传未返回链接');
    } catch (e) { lastErr = e; }

    // ② 网页上传被拒时才渲染长图（画布开销大，能省则省）
    const svg = buildQuoteSvg(quote, items, org);
    let png = '';
    try { png = `data:image/png;base64,${await svgToPngBase64(svg)}`; } catch (e) { /* 画布不可用 */ }

    const tries = [];
    if (png) tries.push({ data: png.split(',')[1], contentType: 'image/png', fileName: `${no}.png`, format: 'png' });
    tries.push({ data: toBase64Utf8(svg), contentType: 'image/svg+xml', fileName: `${no}.svg`, format: 'svg' });

    for (const a of tries) {
      try {
        const r = await db.uploadImage({ data: a.data, contentType: a.contentType, fileName: a.fileName });
        const url = r && (r.url || r.Url);
        if (url) return { url, kind: 'image', format: a.format, image: png || undefined };
      } catch (e) { lastErr = e; }
    }

    // ③ 上传全败（多为未登录）→ 降级为本地长图，至少能直接发给客户
    if (png) return { url: '', kind: 'local', format: 'png', image: png, reason: uploadFailHint(lastErr) };
    throw new Error(uploadFailHint(lastErr));
  }

  // ④ 真实后端：走报价分享 token
  const r = await api.post(`/quotes/${quote.id}/share`, {});
  const token = r && r.token;
  if (!token) throw new Error('生成分享链接失败');
  return { url: `${location.origin}${location.pathname}#/q/${token}`, kind: 'page', format: 'page' };
}

/** 生成可打印的报价单 HTML（用于 PDF / 打印） */
export function printQuote(quote, items, org) {
  const groupMap = {};
  items.forEach((i) => {
    (groupMap[i.group_name || '未分类'] = groupMap[i.group_name || '未分类'] || []).push(i);
  });
  const rowsHtml = Object.entries(groupMap).map(([g, list]) => {
    const sub = list.reduce((s, i) => s + i.unit_price * i.qty, 0);
    return `<tr class="grp"><td colspan="5">${g}<span style="float:right">¥${fmt.money(sub)}</span></td></tr>` +
      list.map((i, idx) => `<tr>
        <td>${idx + 1}</td>
        <td>${i.name}${i.craft ? `<div class="craft">${i.craft}</div>` : ''}</td>
        <td>${i.unit}</td>
        <td class="r">${fmt.num(i.qty)}</td>
        <td class="r">${fmt.money(i.unit_price)}</td>
        <td class="r">${fmt.money(i.unit_price * i.qty)}</td>
      </tr>`).join('');
  }).join('');

  const w = window.open('', '_blank');
  if (!w) { toast('请允许弹出窗口以打印报价单', 'error'); return; }
  w.document.write(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
  <title${''}>${quote.quote_number} ${quote.title}</title${''}>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { font-family: "Microsoft YaHei","PingFang SC",sans-serif; color:#0f172a; font-size:12px; margin:0; }
    h1 { font-size:19px; margin:0 0 4px; }
    .meta { color:#64748b; font-size:11.5px; margin-bottom:14px; }
    .hd { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #4f46e5; padding-bottom:12px; margin-bottom:16px; }
    .info { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:16px; }
    .info div { background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:7px 10px; }
    .info span { display:block; color:#94a3b8; font-size:10.5px; }
    .info b { font-size:12.5px; }
    table { width:100%; border-collapse:collapse; }
    th { background:#f1f5f9; text-align:left; padding:7px 8px; font-size:11px; border-bottom:1px solid #cbd5e1; }
    td { padding:6px 8px; border-bottom:1px solid #eef2f7; }
    .r { text-align:right; }
    .grp td { background:#f8fafc; font-weight:700; padding:6px 8px; }
    .craft { color:#94a3b8; font-size:10px; margin-top:2px; }
    .total { margin-top:16px; text-align:right; }
    .total .lbl { color:#64748b; }
    .total .num { font-size:24px; font-weight:700; color:#4f46e5; }
    .foot { margin-top:22px; padding-top:12px; border-top:1px solid #e2e8f0; color:#64748b; font-size:10.5px; line-height:1.7; }
    @media print { .noprint { display:none } }
  </style></head><body>
    <div class="hd">
      <div>
        <h1>${org && org.name ? org.name : '装修报价单'}</h1>
        <div class="meta">${quote.quote_number} · ${quote.title || ''}</div>
      </div>
      <div style="text-align:right;font-size:11px;color:#64748b">
        ${org && org.phone ? '联系电话：' + org.phone + '<br>' : ''}
        ${org && org.address ? org.address : ''}
      </div>
    </div>
    <div class="info">
      <div><span>客户</span><b>${quote.customer_name || '—'}</b></div>
      <div><span>小区 / 地址</span><b>${quote.community || '—'}</b></div>
      <div><span>城市</span><b>${quote.city || '—'}</b></div>
      <div><span>建筑面积</span><b>${quote.building_area || '—'} m²</b></div>
      <div><span>户型</span><b>${quote.layout || '—'}</b></div>
      <div><span>装修档次</span><b>${quote.tier || '—'}</b></div>
    </div>
    <table>
      <thead><tr><th style="width:34px">#</th><th>项目</th><th style="width:46px">单位</th>
      <th style="width:70px" class="r">数量</th><th style="width:80px" class="r">单价</th><th style="width:92px" class="r">金额</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <div class="total">
      <div class="lbl">合计（含管理费 ${fmt.money(quote.manage_fee || 0)}，税 ${quote.tax_rate || 0}%）</div>
      <div class="num">¥ ${fmt.money(quote.grand_total || quote.total_amount || 0)}</div>
    </div>
    ${quote.notes ? `<div class="foot"><b>备注：</b>${quote.notes}</div>` : ''}
    <div class="foot">
      本报价单由云报价系统生成，价格以双方确认的正式文件为准。报价有效期以合同约定为准。
    </div>
    <div class="noprint" style="margin-top:18px;text-align:center">
      <button onclick="window.print()" style="padding:9px 22px;border:none;border-radius:8px;background:#4f46e5;color:#fff;font-size:13px;cursor:pointer">打印 / 另存为 PDF</button>
    </div>
  </body></html>`);
  w.document.close();
}
