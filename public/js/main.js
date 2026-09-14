/**
 * 应用入口：路由分发
 */
import { api, toast, icon } from './core.js';

const app = document.getElementById('app');

const PAGES = {
  '/': () => import('./landing.js').then((m) => ({ html: m.home(), bind: m.bindHome })),
  '/product': () => import('./landing.js').then((m) => ({ html: m.product() })),
  '/scenarios': () => import('./landing.js').then((m) => ({ html: m.scenarios(), bind: m.bindScenarios })),
  '/samples': () => import('./landing.js').then((m) => ({ html: m.samples() })),
  '/pricing': () => import('./landing.js').then((m) => ({ html: m.pricing(), bind: m.bindPricing })),
  '/resources': () => import('./landing.js').then((m) => ({ html: m.resources() })),
  '/privacy': () => import('./landing.js').then((m) => ({ html: m.privacy() })),
  '/terms': () => import('./landing.js').then((m) => ({ html: m.terms() })),
  '/ai-disclaimer': () => import('./landing.js').then((m) => ({ html: m.aiDisclaimer() })),
  '/login': () => import('./auth.js').then((m) => ({ html: m.authPage('login'), bind: (r) => m.bindAuth(r, 'login') })),
  '/register': () => import('./auth.js').then((m) => ({ html: m.authPage('register'), bind: (r) => m.bindAuth(r, 'register') })),
};

const APP_PAGES = {
  dashboard: () => import('./pages/dashboard.js'),
  estimate: () => import('./pages/estimate.js'),
  quotes: () => import('./pages/quotes.js'),
  editor: () => import('./pages/editor.js'),
  templates: () => import('./pages/templates.js'),
  library: () => import('./pages/library.js'),
  customers: () => import('./pages/customers.js'),
  checkup: () => import('./pages/checkup.js'),
  ailab: () => import('./pages/ailab.js'),
  billing: () => import('./pages/billing.js'),
  settings: () => import('./pages/settings.js'),
  admin: () => import('./pages/admin.js'),
  share: () => import('./pages/share.js'),
};

let currentPath = '';

async function render() {
  const hash = location.hash || '#/';
  const path = hash.replace(/^#/, '') || '/';
  if (path === currentPath && app.dataset.rendered === '1') return;
  currentPath = path;

  // 滚动到顶
  window.scrollTo(0, 0);

  try {
    if (path.startsWith('/app/')) {
      if (!api.token) { location.hash = '#/login'; return; }
      await renderApp(path);
    } else if (path.startsWith('/q/')) {
      const token = path.slice(3);
      const m = await APP_PAGES.share();
      // share.render 是 async 且自行写入容器，必须 await（否则会把 Promise 塞进 DOM）
      await m.render(app, token);
    } else if (PAGES[path]) {
      const pg = await PAGES[path]();
      app.innerHTML = pg.html;
      if (pg.bind) pg.bind(app);
      bindCommon(app);
    } else {
      // 未知路径回首页
      app.innerHTML = `<div style="padding:80px;text-align:center">
        <h2>页面不存在</h2>
        <p style="margin:12px 0 20px;color:var(--text-3)">${path}</p>
        <a class="btn btn-primary" href="#/">返回首页</a>
      </div>`;
    }
    app.dataset.rendered = '1';
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div style="padding:80px;text-align:center">
      <h2>页面加载失败</h2>
      <p style="margin:12px 0 20px;color:var(--text-3)">${e.message}</p>
      <a class="btn btn-primary" href="#/">返回首页</a>
    </div>`;
    toast(e.message, 'error');
  }
}

async function renderApp(path) {
  const parts = path.split('/').filter(Boolean); // ['app','quotes','id']
  const key = parts[1] || 'dashboard';
  const arg = parts[2] || '';

  // 加载工作台外壳
  const shell = await import('./app.js');
  const me = await fetchMe();
  if (!me) return;

  app.innerHTML = shell.layout(key);
  shell.bindShell(app, me);

  const main = app.querySelector('#appMain');
  const titleEl = app.querySelector('#pageTitle');
  const subEl = app.querySelector('#pageSub');
  const actionsEl = app.querySelector('#pageActions');

  const loader = APP_PAGES[key] || APP_PAGES.dashboard;
  const mod = await loader();
  main.innerHTML = `<div class="empty"><div class="spinner dark" style="width:22px;height:22px"></div>
    <div class="empty-desc">加载中…</div></div>`;

  const ctx = {
    me,
    arg,
    // actions 指向顶栏按钮区，页面内的 setActions 按钮必须在 ctx.actions 里查找
    actions: actionsEl,
    setTitle: (t, s) => { titleEl.textContent = t; subEl.textContent = s || ''; },
    setActions: (h) => { actionsEl.innerHTML = h; return actionsEl; },
    /** 安全绑定：找不到元素时返回 null 而不是抛错 */
    bind(sel, event, handler) {
      const node = actionsEl.querySelector(sel) || main.querySelector(sel);
      if (!node) { console.warn('[bind] 未找到元素', sel); return null; }
      node[event] = handler;
      return node;
    },
  };
  await mod.render(main, ctx);
}

async function fetchMe() {
  try {
    const r = await api.get('/users/me');
    api.user = { ...(api.user || {}), ...r };
    return r;
  } catch (e) {
    api.token = '';
    location.hash = '#/login';
    return null;
  }
}

/** 营销站通用交互 */
function bindCommon(root) {
  const header = root.querySelector('#siteHeader');
  if (header) {
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
  const toggle = root.querySelector('#navToggle');
  const links = root.querySelector('#navLinks');
  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('show'));
  }
}

window.addEventListener('hashchange', render);
render();
