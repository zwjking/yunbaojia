/**
 * 工作台外壳：侧边栏 + 顶栏
 */
import { icon, esc, fmt, api, toast, confirmBox } from './core.js';

const MENU = [
  {
    title: '工作台',
    items: [
      { key: 'dashboard', label: '仪表盘', icon: 'grid' },
      { key: 'estimate', label: '智能造价', icon: 'sparkles' },
      { key: 'quotes', label: '报价管理', icon: 'file' },
      { key: 'checkup', label: '报价体检', icon: 'shield' },
    ],
  },
  {
    title: '数据',
    items: [
      { key: 'templates', label: '模板管理', icon: 'layers' },
      { key: 'library', label: '工艺价格库', icon: 'book' },
      { key: 'customers', label: '客户管理', icon: 'users' },
    ],
  },
  {
    title: '智能',
    items: [{ key: 'ailab', label: 'AI 实验室', icon: 'wand' }],
  },
  {
    title: '账户',
    items: [
      { key: 'billing', label: '会员与计费', icon: 'card' },
      { key: 'settings', label: '系统设置', icon: 'settings' },
    ],
  },
];

const ADMIN_MENU = { title: '平台', items: [{ key: 'admin', label: '平台管理', icon: 'building' }] };

export function layout(active) {
  return `<div class="app-shell">
    <aside class="sidebar">
      <div class="side-brand">
        <span class="brand-mark">${icon('home', 16)}</span>
        <b>云报价</b>
        <span class="ver">v1.0</span>
      </div>
      <div class="side-scroll" id="sideScroll"></div>
      <div class="side-foot">
        <button class="side-user" id="sideUser"></button>
        <div class="side-credits" id="sideCredits"></div>
      </div>
    </aside>
    <div class="main">
      <div class="topbar">
        <div>
          <h1 id="pageTitle">仪表盘</h1>
          <div class="sub" id="pageSub"></div>
        </div>
        <div class="topbar-actions" id="pageActions"></div>
      </div>
      <div class="page" id="appMain"></div>
    </div>
  </div>`;
}

export function bindShell(root, me) {
  const menus = me.is_platform_admin ? [...MENU, ADMIN_MENU] : MENU;
  const active = (location.hash.split('/')[2] || 'dashboard');

  root.querySelector('#sideScroll').innerHTML = menus.map((g) => `
    <div class="side-group">
      <div class="side-group-title">${g.title}</div>
      ${g.items.map((it) => `<a class="side-item ${active === it.key ? 'active' : ''}" href="#/app/${it.key}">
        ${icon(it.icon, 16)}${it.label}
      </a>`).join('')}
    </div>`).join('');

  const userEl = root.querySelector('#sideUser');
  userEl.innerHTML = `
    <span class="avatar">${esc((me.name || me.phone || 'U').slice(0, 1))}</span>
    <span style="flex:1;min-width:0">
      <span class="side-user-name trunc" style="display:block">${esc(me.name || me.phone)}</span>
      <span class="side-user-plan">${planName(me.plan)}</span>
    </span>
    ${icon('chevronRight', 14)}`;
  userEl.onclick = async () => {
    const ok = await confirmBox('退出登录', '确定要退出当前账号吗？');
    if (ok) api.logout();
  };

  const creditsEl = root.querySelector('#sideCredits');
  const credits = me.credits || 0;
  creditsEl.innerHTML = `<span>⚡ 积分余额</span><b>${fmt.int(credits)}</b>`;
  creditsEl.title = 'AI 功能按积分计费，成功才扣；套餐每月自动赠送';
  creditsEl.style.cursor = 'pointer';
  creditsEl.onclick = () => { location.hash = '#/app/billing'; };
}

function planName(p) {
  return { free: '免费版', personal: '普通版（按次）', plus: 'Plus 版', enterprise: '企业版' }[p] || '免费版';
}

export function setActiveMenu(root, key) {
  root.querySelectorAll('.side-item').forEach((a) => {
    a.classList.toggle('active', a.getAttribute('href') === `#/app/${key}`);
  });
}
