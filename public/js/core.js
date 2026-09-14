/**
 * 前端核心：API 客户端 / UI 组件 / 图标 / 格式化 / 简易路由
 */

/* ================= API ================= */
const TOKEN_KEY = 'hq_token';
const USER_KEY = 'hq_user';

export const api = {
  get token() { return localStorage.getItem(TOKEN_KEY) || ''; },
  set token(v) { v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY); },
  get user() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch (e) { return null; }
  },
  set user(v) { v ? localStorage.setItem(USER_KEY, JSON.stringify(v)) : localStorage.removeItem(USER_KEY); },

  async call(method, path, body) {
    const res = await fetch('/api/v1' + path, {
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

export function downloadFile(filename, content, mime = 'text/plain') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
}

/** 导出 CSV（Excel 可直接打开） */
export function exportCSV(filename, headers, rows) {
  const esc2 = (v) => {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.map(esc2).join(',')]
    .concat(rows.map((r) => r.map(esc2).join(',')))
    .join('\r\n');
  downloadFile(filename, '\ufeff' + csv, 'text/csv');
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
  <title>${quote.quote_number} ${quote.title}</title>
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
