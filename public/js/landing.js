/**
 * 营销站页面（无需登录）
 */
import { icon, esc, fmt, toast, api } from './core.js';

/* ====================== 公共组件 ====================== */

const NAV = [
  { href: '#/', label: '首页', key: '/' },
  { href: '#/product', label: '产品功能', key: '/product' },
  { href: '#/scenarios', label: '适用场景', key: '/scenarios' },
  { href: '#/samples', label: '报价样例', key: '/samples' },
  { href: '#/pricing', label: '价格方案', key: '/pricing' },
  { href: '#/resources', label: '资料中心', key: '/resources' },
];

export function header(active) {
  const logined = !!api.token;
  return `<header class="site-header" id="siteHeader">
    <div class="header-inner">
      <a class="brand" href="#/">
        <span class="brand-mark">${icon('home', 18)}</span>
        <span>云报价<span class="brand-sub"> · 家装报价系统</span></span>
      </a>
      <nav class="nav-links" id="navLinks">
        ${NAV.map((n) => `<a href="${n.href}" class="${active === n.key ? 'active' : ''}">${n.label}</a>`).join('')}
      </nav>
      <div class="header-actions">
        ${logined
    ? `<a class="btn btn-primary" href="#/app/dashboard">进入工作台 ${icon('arrowRight', 15)}</a>`
    : `<a class="btn btn-ghost" href="#/login">登录</a>
             <a class="btn btn-primary" href="#/register">免费试用 ${icon('arrowRight', 15)}</a>`}
      </div>
      <button class="nav-toggle" id="navToggle">${icon('grid', 18)}</button>
    </div>
  </header>`;
}

export function footer() {
  return `<footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-brand">
        <div class="brand" style="color:#fff">
          <span class="brand-mark">${icon('home', 18)}</span><span>云报价</span>
        </div>
        <p>专为家装设计师、装企与施工负责人打造的报价工具。<br>
        从智能估算到客户签单，一套系统跑完整个流程。</p>
      </div>
      <div class="footer-col">
        <h4>产品</h4>
        <a href="#/product">产品功能</a>
        <a href="#/scenarios">适用场景</a>
        <a href="#/samples">报价样例</a>
        <a href="#/pricing">价格方案</a>
      </div>
      <div class="footer-col">
        <h4>资源</h4>
        <a href="#/resources">资料中心</a>
        <a href="#/pricing">套餐对比</a>
        <a href="#/ai-disclaimer">AI 使用声明</a>
      </div>
      <div class="footer-col">
        <h4>关于</h4>
        <a href="#/privacy">隐私政策</a>
        <a href="#/terms">服务条款</a>
        <a href="#/login">登录 / 注册</a>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© ${new Date().getFullYear()} 云报价 · 家装报价系统　保留所有权利</span>
      <span>本站为本地部署的演示与自用系统，数据保存在你自己的服务器。</span>
    </div>
  </footer>`;
}

function pageShell(active, inner, { plain = false } = {}) {
  return `${header(active)}${inner}${footer()}`;
}

function heroMock() {
  const rows = [
    ['拆除与保护', '旧墙皮铲除', '186 m²', '1,860'],
    ['水电工程', '强电布线 2.5mm²（暗线含开槽）', '346 m', '15,570'],
    ['泥瓦工程', '厨卫墙地面防水（三遍）', '48 m²', '2,784'],
    ['油漆涂装', '墙面刷乳胶漆（底漆+两面）', '225 m²', '6,300'],
    ['安装五金', '开关插座面板安装', '48 个', '576'],
  ];
  return `<div class="hero-visual">
    <div class="mock-float f1">
      <span class="ai-tag">${icon('sparkles', 12)} AI 生成中</span>
      <b>10 秒完成估算</b>
      <span>180+ 工艺自动匹配</span>
    </div>
    <div class="mock-float f2">
      <b>毛利 28.6%</b>
      <span>成本实时可见</span>
    </div>
    <div class="mock-card">
      <div class="mock-head">
        <div class="mock-dots"><i></i><i></i><i></i></div>
        <span class="mock-title">报价单 BJ20260913001 · 华润·幸福里</span>
      </div>
      <div class="mock-body">
        <div class="mock-meta">
          <div><span>建筑面积</span><b>108 m²</b></div>
          <div><span>户型</span><b>三室两厅两卫</b></div>
          <div><span>档次</span><b>中档</b></div>
        </div>
        ${rows.map((r) => `<div class="mock-row">
          <i class="g"></i><span class="n">${r[1]}</span><span class="v">${r[2]} · ¥${r[3]}</span>
        </div>`).join('')}
        <div class="mock-total">
          <span>合计（含管理费）</span><b>¥ 128,650</b>
        </div>
      </div>
    </div>
  </div>`;
}

/* ====================== 首页 ====================== */

export function home() {
  const features = [
    { i: 'sparkles', t: 'AI 智能造价', d: '输入城市、面积、户型与现场备注，AI 结合工艺库自动拆解工程量，10 秒生成报价草稿。' },
    { i: 'layers', t: '户型模板复用', d: '把常用户型存成模板，下次接单直接套用；本地匹配打分，不消耗 AI 额度。' },
    { i: 'book', t: '工艺价格库', d: '内置 180+ 条家装工艺，含单位、参考价、成本价与工艺说明，可按城市系数一键校准。' },
    { i: 'shield', t: '报价体检', d: '出单前跑一次体检：成本快照、毛利可信度、材料用量、疑似漏项，异常项高亮提示。' },
    { i: 'share', t: '客户报价页', d: '生成分享链接，客户手机直接打开，先看总价再看明细，工艺说明写得明明白白。' },
    { i: 'pie', t: '利润与统计', d: '每张报价实时显示成本与毛利，仪表盘统计赢单率、转化率与分类金额占比。' },
  ];

  const aiItems = [
    { e: '🎯', t: '完整自助估算', c: 10, d: '综合城市、面积、户型、空间与备注生成造价' },
    { e: '📐', t: '户型智能拆解', c: 3, d: '一句话户型自动拆出每个空间面积' },
    { e: '🏷️', t: '装修档次匹配', c: 3, d: '简装 / 中档 / 高档三档价格区间对比' },
    { e: '💰', t: '预算反推', c: 5, d: '业主给硬预算，评估可行性并给分项分配' },
    { e: '⚠️', t: '增项风险预测', c: 8, d: '老房、楼层、季节等隐性增项费用预估' },
    { e: '💬', t: '自然语言加项', c: 5, d: '一句话描述拆成结构化报价条目' },
    { e: '📊', t: '单点价格建议', c: 2, d: '单个工艺项的城市级价格区间' },
    { e: '✅', t: '整单复核 / 漏项', c: 15, d: '综合评分、漏项检查与异常单价提示' },
    { e: '✍️', t: '客户话术润色', c: 3, d: '内部工艺名改成业主看得懂的话' },
  ];

  const faqs = [
    ['免费版能用多久？', '免费版无时间限制，可创建报价、查看历史、在线预览；AI 造价每月赠送 30 积分。出成品（导出 / 分享）时按次购买即可。'],
    ['工艺价格库能自己改吗？', '可以。每个账号都有独立可编辑的工艺价格库，可以改单价、成本、工艺说明，也能导入自己的 Excel 清单。'],
    ['升级版本后，原来的数据还在吗？', '完全保留。历史报价、模板、工艺价格库和客户资料不受版本变更影响 —— 不管是升级还是降级，数据都不会丢失。'],
    ['AI 算出来的价格能直接给客户吗？', 'AI 输出是建议，不是最终结论。系统会明确标注需要人工复核的假设项，建议结合现场实测与当地行情复核后再出正式报价。'],
    ['可以多人协作吗？', '企业版支持 5 个账号起、角色权限、老板审批与团队客户库；个人版 / Plus 版为单人使用。'],
    ['数据存在哪里？', '本系统可部署在你自己的服务器上，所有数据保存在本地，不上传第三方。'],
  ];

  return pageShell('/', `
    <section class="hero">
      <div class="hero-inner">
        <div>
          <div class="hero-badge"><b>AI 驱动</b> 15 项智能造价能力 · 180+ 条内置工艺</div>
          <h1>3 分钟出一份<br><span class="grad">专业家装报价</span></h1>
          <p class="hero-desc">
            从智能估算、明细编辑，到漏项体检、客户分享与成交跟踪 ——
            一套系统跑完整个报价流程。少改报价，多签单。
          </p>
          <div class="hero-cta">
            <a class="btn btn-primary btn-lg" href="#/register">免费开始使用 ${icon('arrowRight', 16)}</a>
            <a class="btn btn-secondary btn-lg" href="#/samples">看报价样例</a>
          </div>
          <div class="hero-note">注册后 5 分钟内就能出第一张报价 · 不需要绑定信用卡</div>
          <div class="hero-stats">
            <div class="hero-stat"><b>3 分钟</b><span>出一份完整报价</span></div>
            <div class="hero-stat"><b>180+</b><span>内置工艺条目</span></div>
            <div class="hero-stat"><b>15 项</b><span>AI 造价能力</span></div>
          </div>
        </div>
        ${heroMock()}
      </div>
    </section>

    <section class="stat-strip">
      <div class="stat-strip-inner">
        <div class="stat-item"><b>8 大类</b><span>覆盖拆除到竣工全流程</span></div>
        <div class="stat-item"><b>12 种状态</b><span>从草稿到成交全程跟踪</span></div>
        <div class="stat-item"><b>实时毛利</b><span>每张报价成本利润可见</span></div>
        <div class="stat-item"><b>本地部署</b><span>数据保存在你自己的服务器</span></div>
      </div>
    </section>

    <section class="section">
      <div class="section-inner">
        <div class="section-head">
          <span class="section-tag">核心能力</span>
          <h2>报价这件事，值得一套专业的工具</h2>
          <p>不是简单的计算器，而是围绕"出单"这个目标，把估算、编辑、审核、分享、跟踪串成一条流水线。</p>
        </div>
        <div class="feature-grid">
          ${features.map((f) => `<div class="feature-card">
            <div class="fc-icon">${icon(f.i, 21)}</div>
            <h3>${f.t}</h3><p>${f.d}</p>
          </div>`).join('')}
        </div>
      </div>
    </section>

    <section class="section soft">
      <div class="section-inner">
        <div class="section-head">
          <span class="section-tag">使用场景</span>
          <h2>不管你是设计师还是施工方，都有对应的解法</h2>
        </div>
        <div class="scenario-tabs" id="homeScenarioTabs">
          ${SCENARIOS.map((s, i) => `<button class="scenario-tab ${i === 0 ? 'active' : ''}" data-i="${i}">${s.role}</button>`).join('')}
        </div>
        <div class="scenario-panel" id="homeScenarioPanel"></div>
      </div>
    </section>

    <section class="section">
      <div class="section-inner">
        <div class="section-head">
          <span class="section-tag">三步出单</span>
          <h2>从录入到签单，流程就这么简单</h2>
        </div>
        <div class="steps">
          <div class="step"><div class="step-num">1</div><h4>录入项目</h4><p>选择套餐，填入城市、面积、户型与房龄，或直接套用户型模板。</p></div>
          <div class="step"><div class="step-num">2</div><h4>AI 生成</h4><p>维护空间清单与现场备注，AI 结合工艺库生成报价草稿，约 10 秒。</p></div>
          <div class="step"><div class="step-num">3</div><h4>体检出单</h4><p>跑一次报价体检，确认漏项与毛利，导出 PDF / Excel 或发链接给客户。</p></div>
          <div class="step"><div class="step-num">4</div><h4>跟踪成交</h4><p>状态从草稿跟到成交，仪表盘自动统计赢单率与分类金额占比。</p></div>
        </div>
      </div>
    </section>

    <section class="section soft">
      <div class="section-inner">
        <div class="section-head">
          <span class="section-tag">AI 能力</span>
          <h2>15 项 AI 功能，按"积分"计费，成功才扣</h2>
          <p>所有 AI 输出都会标注假设与需复核项 —— 它是助手，不是替代你做判断。</p>
        </div>
        <div class="ai-grid">
          ${aiItems.map((a) => `<div class="ai-item">
            <div class="ai-emoji">${a.e}</div>
            <div><b>${a.t}</b><span>${a.d}</span><span class="ai-cost">⚡ ${a.c} 积分</span></div>
          </div>`).join('')}
        </div>
        <div style="text-align:center;margin-top:28px">
          <a class="btn btn-secondary" href="#/product">查看全部 AI 功能 ${icon('arrowRight', 15)}</a>
        </div>
      </div>
    </section>

    ${pricingPreview()}

    <section class="section">
      <div class="section-inner">
        <div class="section-head"><span class="section-tag">常见问题</span><h2>你可能想问</h2></div>
        <div class="faq-list">
          ${faqs.map((f, i) => `<div class="faq-item ${i === 0 ? 'open' : ''}">
            <button class="faq-q">${f[0]}${icon('chevronDown', 18)}</button>
            <div class="faq-a">${f[1]}</div>
          </div>`).join('')}
        </div>
      </div>
    </section>

    <section class="cta-band">
      <h2>现在就开始，5 分钟出第一张报价</h2>
      <p>免费版永久可用，出成品时再按次付费 —— 不需要绑定信用卡。</p>
      <div class="row gap12" style="justify-content:center;flex-wrap:wrap">
        <a class="btn btn-primary btn-lg" href="#/register">免费注册 ${icon('arrowRight', 16)}</a>
        <a class="btn btn-secondary btn-lg" href="#/pricing">查看价格方案</a>
      </div>
    </section>
  `);
}

export function bindHome(root) {
  const tabs = root.querySelector('#homeScenarioTabs');
  const panel = root.querySelector('#homeScenarioPanel');
  if (!tabs || !panel) return;
  const render = (i) => {
    const s = SCENARIOS[i];
    panel.innerHTML = `
      <div class="scenario-left">
        <div class="tagline">${s.tagline}</div>
        <h3>${s.headline}</h3>
        <p>${s.desc}</p>
        <div class="scenario-pains">
          <h4>常见痛点</h4>
          <ul>${s.pains.map((p) => `<li>${p}</li>`).join('')}</ul>
        </div>
      </div>
      <div class="scenario-features">
        ${s.features.map((f) => `<div class="sf-card">
          <span class="sf-tag">${f.tag}</span><b>${f.title}</b><span>${f.text}</span>
        </div>`).join('')}
      </div>`;
  };
  render(0);
  tabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.scenario-tab');
    if (!btn) return;
    tabs.querySelectorAll('.scenario-tab').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    render(Number(btn.dataset.i));
  });

  root.querySelectorAll('.faq-q').forEach((q) => {
    q.addEventListener('click', () => q.parentElement.classList.toggle('open'));
  });
}

/* ====================== 产品页 ====================== */

export function product() {
  const modules = [
    { i: 'grid', t: '仪表盘', d: '报价总数、草稿 / 已发出 / 已成交、赢单率、转化率、分类金额占比，支持本月 / 本季 / 本年 / 全部切换。' },
    { i: 'sparkles', t: '智能造价', d: '选套餐 → 填项目 → 维护空间清单 → 写现场备注 → AI 生成草稿，一键转为正式报价。' },
    { i: 'file', t: '报价管理', d: '12 种状态流转：草稿、待审批、已通过、终稿、已签发、已成交、未成交、已暂停……支持复制、变更单、归档。' },
    { i: 'edit', t: '报价编辑器', d: '按分类分组编辑明细：项目、单位、数量、单价、成本、工艺说明，实时计算合计与毛利。' },
    { i: 'shield', t: '报价体检', d: '本地体检免费不扣点数：成本快照、毛利可信度、人工分摊、材料用量；AI 深度复核可找漏项与异常单价。' },
    { i: 'layers', t: '模板管理', d: '户型模板保存空间配置，本地匹配打分（免费），也可用 AI 生成新模板。' },
    { i: 'book', t: '工艺价格库', d: '八大分类 180+ 条工艺，支持编辑、导入、预设套用、城市系数校准与 AI 体检。' },
    { i: 'users', t: '客户管理', d: '客户档案、来源、状态、跟进备注，自动关联该客户的历史报价与成交金额。' },
    { i: 'wand', t: 'AI 实验室', d: '15 项 AI 功能集中入口，按分组组织，调用前显示本次消耗点数。' },
    { i: 'card', t: '会员与计费', d: '套餐订阅、积分充值、出单次数、订单与发票管理，本地部署采用模拟支付。' },
    { i: 'settings', t: '系统设置', d: '组织信息、成员与角色、人工工资标准、报价默认条款。' },
    { i: 'shield', t: '平台管理', d: '总览数据看板、用户与组织管理、点数发放、退款审核（仅平台管理员）。' },
  ];

  return pageShell('/product', `
    <section class="section" style="padding-top:64px">
      <div class="section-inner">
        <div class="section-head">
          <span class="section-tag">产品功能</span>
          <h2>一个完整的报价业务闭环</h2>
          <p>从第一次询价到最后签单，中间每一步都在系统里留痕。</p>
        </div>
        <div class="feature-grid">
          ${modules.map((m) => `<div class="feature-card">
            <div class="fc-icon">${icon(m.i, 21)}</div><h3>${m.t}</h3><p>${m.d}</p>
          </div>`).join('')}
        </div>
      </div>
    </section>

    <section class="section soft">
      <div class="section-inner">
        <div class="section-head"><span class="section-tag">报价状态机</span><h2>报价不是"做完就完了"，它是有状态的</h2></div>
        <div class="card card-pad" style="text-align:center">
          <div class="row gap8 wrap" style="justify-content:center">
            ${['草稿', '待审批', '已通过', '终稿', '已签发', '已成交'].map((s, i) =>
    `<span class="badge ${i === 0 ? '' : 'badge-brand'}">${s}</span>${i < 5 ? '<span style="color:var(--text-3)">→</span>' : ''}`).join('')}
          </div>
          <p class="muted t-sm" style="margin-top:14px">另有：已驳回、未成交、已暂停、已放弃、已归档等状态，覆盖真实业务场景。</p>
        </div>
      </div>
    </section>

    <section class="cta-band">
      <h2>想看看实际效果？</h2>
      <p>注册一个账号，用演示数据把所有功能点一遍。</p>
      <a class="btn btn-primary btn-lg" href="#/register">免费注册 ${icon('arrowRight', 16)}</a>
    </section>
  `);
}

/* ====================== 场景页 ====================== */

export function scenarios() {
  return pageShell('/scenarios', `
    <section class="section" style="padding-top:64px">
      <div class="section-inner">
        <div class="section-head">
          <span class="section-tag">适用场景</span>
          <h2>四类典型用户，四种解法</h2>
          <p>选一个和你最接近的角色，看看系统怎么帮你解决问题。</p>
        </div>
        <div class="scenario-tabs" id="scTabs">
          ${SCENARIOS.map((s, i) => `<button class="scenario-tab ${i === 0 ? 'active' : ''}" data-i="${i}">${s.role}</button>`).join('')}
        </div>
        <div class="scenario-panel" id="scPanel"></div>
      </div>
    </section>
  `);
}

export function bindScenarios(root) {
  const tabs = root.querySelector('#scTabs');
  const panel = root.querySelector('#scPanel');
  if (!tabs || !panel) return;
  const render = (i) => {
    const s = SCENARIOS[i];
    panel.innerHTML = `
      <div class="scenario-left">
        <div class="tagline">${s.tagline}</div>
        <h3>${s.headline}</h3>
        <p>${s.desc}</p>
        <div style="margin-top:20px">
          <h4 style="font-size:12.5px;color:var(--text-3);margin-bottom:10px;letter-spacing:.04em">你的工作流</h4>
          <div class="row gap8 wrap">
            ${s.steps.map((st, k) => `<span class="badge badge-brand">${k + 1}. ${st}</span>`).join('')}
          </div>
        </div>
        <div class="scenario-pains">
          <h4>常见痛点</h4>
          <ul>${s.pains.map((p) => `<li>${p}</li>`).join('')}</ul>
        </div>
        <a class="btn btn-primary" style="margin-top:22px" href="#/register">立即试用 ${icon('arrowRight', 15)}</a>
      </div>
      <div class="scenario-features">
        ${s.features.map((f) => `<div class="sf-card">
          <span class="sf-tag">${f.tag}</span><b>${f.title}</b><span>${f.text}</span>
        </div>`).join('')}
      </div>`;
  };
  render(0);
  tabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.scenario-tab');
    if (!btn) return;
    tabs.querySelectorAll('.scenario-tab').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    render(Number(btn.dataset.i));
  });
}

/* ====================== 样例页 ====================== */

export function samples() {
  const list = [
    { title: '华润·幸福里 108㎡ 三室两厅两卫', city: '合肥', area: 108, layout: '三室两厅两卫', tier: '中档', type: '新房', total: 128650, badge: '中档整装', badgeCls: 'badge-brand',
      rows: [['拆除与保护', 4200], ['水电工程', 24600], ['泥瓦工程', 31200], ['木作吊顶', 18400], ['油漆涂装', 15800], ['安装五金', 21600], ['措施与其他', 12850]] },
    { title: '万科·森林公园 89㎡ 两室两厅一卫', city: '合肥', area: 89, layout: '两室两厅一卫', tier: '简装', type: '老房（15年）', total: 96400, badge: '老房翻新', badgeCls: 'badge-warn',
      rows: [['拆除与保护', 12600], ['水电工程', 21800], ['泥瓦工程', 23400], ['木作吊顶', 9200], ['油漆涂装', 13600], ['安装五金', 15800]] },
    { title: '保利·西山林语 132㎡ 四室两厅两卫', city: '合肥', area: 132, layout: '四室两厅两卫', tier: '高档', type: '新房', total: 268400, badge: '高端定制', badgeCls: 'badge-violet',
      rows: [['拆除与保护', 6800], ['水电工程', 38200], ['泥瓦工程', 56800], ['木作吊顶', 42400], ['油漆涂装', 28600], ['安装五金', 38400], ['定制主材', 56800], ['措施与其他', 20200]] },
    { title: '阳光苑 68㎡ 两室一厅一卫', city: '合肥', area: 68, layout: '两室一厅一卫', tier: '简装', type: '新房', total: 62800, badge: '小户型', badgeCls: 'badge-success',
      rows: [['拆除与保护', 3200], ['水电工程', 14600], ['泥瓦工程', 16800], ['木作吊顶', 6800], ['油漆涂装', 9800], ['安装五金', 11600]] },
  ];

  return pageShell('/samples', `
    <section class="section" style="padding-top:64px">
      <div class="section-inner">
        <div class="section-head">
          <span class="section-tag">报价样例</span>
          <h2>看看系统生成的报价长什么样</h2>
          <p>以下为系统按合肥地区工艺库自动生成的示例，实际价格以你自己的价格库与现场复核为准。</p>
        </div>
        <div class="sample-grid">
          ${list.map((s) => `<div class="sample-card">
            <div class="sample-head">
              <h3>${s.title}</h3>
              <span class="badge ${s.badgeCls}">${s.badge}</span>
            </div>
            <div class="sample-meta">
              <div><span>建筑面积</span><b>${s.area} m²</b></div>
              <div><span>户型</span><b>${s.layout}</b></div>
              <div><span>类型</span><b>${s.type}</b></div>
            </div>
            <div class="sample-rows">
              ${s.rows.map((r) => `<div><span>${r[0]}</span><b class="num">¥ ${fmt.money(r[1], 0)}</b></div>`).join('')}
            </div>
            <div class="sample-total">
              <span>合计 · 折合 ${Math.round(s.total / s.area)} 元/m²</span><b>¥ ${fmt.money(s.total, 0)}</b>
            </div>
          </div>`).join('')}
        </div>
        <div class="card card-pad" style="margin-top:24px;background:var(--warn-50);border-color:#fde68a">
          <div class="row gap8">
            ${icon('alert', 18)}
            <span class="t-sm" style="color:#92400e">
              以上样例由本地规则引擎按经验系数生成，仅用于展示结构与格式。正式报价请以现场实测工程量与当地行情为准。
            </span>
          </div>
        </div>
      </div>
    </section>
  `);
}

/* ====================== 定价页 ====================== */

export function pricingPreview() {
  return `<section class="section soft">
    <div class="section-inner">
      <div class="section-head">
        <span class="section-tag">价格方案</span>
        <h2>先用起来，再决定怎么付费</h2>
        <p>免费版永久可用；出成品时按次付费，高频出单再升级包月。</p>
      </div>
      ${planCards()}
      <div style="text-align:center;margin-top:28px">
        <a class="btn btn-secondary" href="#/pricing">查看完整功能对比 ${icon('arrowRight', 15)}</a>
      </div>
    </div>
  </section>`;
}

function planCards() {
  return `<div class="pricing-cards">
    ${PLANS.map((p) => `<div class="price-card ${p.highlight ? 'highlight' : ''}" style="${p.highlight ? '' : `border-color:${p.borderColor}`}">
      ${p.highlight ? `<span class="pc-tag">${p.tag}</span>` : ''}
      <div class="pc-name">${p.name}</div>
      <div class="pc-note">${p.note}</div>
      <div class="pc-price"><b>${p.price}</b><span>${p.cycle}</span></div>
      <div class="pc-yearly">${p.yearly || '&nbsp;'}</div>
      <div class="pc-ai"><b>${p.aiQuota.label}</b><span>${p.aiQuota.detail}</span></div>
      <ul class="pc-features">
        ${p.features.slice(0, p.highlight ? 8 : 5).map((f) => `<li>${icon('check', 14)}${f}</li>`).join('')}
      </ul>
      <a class="btn ${p.highlight ? 'btn-primary' : 'btn-secondary'} btn-block"
         href="#/${p.key === 'free' ? 'register' : 'app/billing'}">${p.cta}</a>
    </div>`).join('')}
  </div>`;
}

export function pricing() {
  return pageShell('/pricing', `
    <section class="section" style="padding-top:64px">
      <div class="section-inner">
        <div class="section-head">
          <span class="section-tag">价格方案</span>
          <h2>简单透明，按需付费</h2>
          <p>三层计费：套餐订阅解锁不限次、出单次数按次买断、AI 能力按积分消耗 —— 用多少付多少。</p>
        </div>
        ${planCards()}

        <div style="margin-top:56px">
          <div class="section-head"><h2 style="font-size:24px">功能对比</h2></div>
          <div class="compare-wrap">
            <table class="compare-table">
              <thead><tr>
                <th style="width:160px">功能</th>
                <th>免费版</th><th>普通版（按次）</th><th class="hl">Plus 版</th><th>企业版</th>
              </tr></thead>
              <tbody>
                ${COMPARE.map((row) => {
    if (row.group) return `<tr class="group-row"><td colspan="5">${row.group}</td></tr>`;
    return `<tr><td>${row.f}</td><td>${row.free}</td><td>${row.personal}</td>
                  <td class="hl">${row.plus}</td><td>${row.ent}</td></tr>`;
  }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div style="margin-top:56px">
          <div class="section-head">
            <span class="section-tag">AI 积分</span>
            <h2 style="font-size:24px">AI 功能单独按积分计费，成功才扣</h2>
            <p>套餐每月赠送额度，不够再买充值包，180 天内有效。</p>
          </div>
          <div class="credit-packs">
            ${CREDIT_PACKS.map((c) => `<div class="pack-card">
              <b>${c.credits}${c.bonus ? `<span style="font-size:13px;color:var(--success)"> +${c.bonus}</span>` : ''}</b>
              <span>积分${c.bonus ? '（含赠送）' : ''}</span>
              <div class="price">¥ ${c.price}</div>
              <div class="t-xs muted" style="margin-top:6px">约 ${Math.round((c.credits + (c.bonus || 0)) / 10)} 次智能造价</div>
            </div>`).join('')}
          </div>
        </div>

        <div style="margin-top:56px">
          <div class="section-head"><h2 style="font-size:24px">关于计费的常见问题</h2></div>
          <div class="faq-list">
            ${PRICING_FAQ.map((f, i) => `<div class="faq-item ${i === 0 ? 'open' : ''}">
              <button class="faq-q">${f[0]}${icon('chevronDown', 18)}</button>
              <div class="faq-a">${f[1]}</div>
            </div>`).join('')}
          </div>
        </div>
      </div>
    </section>

    <section class="cta-band">
      <h2>先用免费版跑一遍完整流程</h2>
      <p>确认适合业务需要，再决定升级 —— 数据全程保留。</p>
      <a class="btn btn-primary btn-lg" href="#/register">免费注册 ${icon('arrowRight', 16)}</a>
    </section>
  `);
}

export function bindPricing(root) {
  root.querySelectorAll('.faq-q').forEach((q) => {
    q.addEventListener('click', () => q.parentElement.classList.toggle('open'));
  });
}

/* ====================== 资料中心 ====================== */

export function resources() {
  const items = [
    { i: 'book', t: '家装工艺库速查', d: '八大分类 180+ 条工艺项，含单位、参考价、工艺说明，可作为日常报价的基准参考。', tag: '工艺库' },
    { i: 'calculator', t: '工程量估算系数表', d: '墙面展开系数、地面铺贴系数、水电点位密度等常用换算关系，附使用说明。', tag: '算法' },
    { i: 'file', t: '报价单模板', d: '分类清晰的标准报价单结构：工程分类 → 项目明细 → 工艺说明 → 金额汇总。', tag: '模板' },
    { i: 'shield', t: '出单前自检清单', d: '防水、闭水试验、打压试验、成品保护、垃圾清运等高频漏项检查清单。', tag: '清单' },
    { i: 'message', t: '客户沟通话术', d: '把内部工艺名翻译成业主听得懂的话，减少"看不懂就砍价"的情况。', tag: '话术' },
    { i: 'trending', t: '毛利测算方法', d: '成本、管理费、税费与毛利的核算口径，避免报价好看不赚钱。', tag: '经营' },
  ];
  return pageShell('/resources', `
    <section class="section" style="padding-top:64px">
      <div class="section-inner">
        <div class="section-head">
          <span class="section-tag">资料中心</span>
          <h2>做报价要用的东西，都整理在这里</h2>
          <p>注册后这些能力直接长在系统里 —— 智能造价会自动应用这些系数与清单。</p>
        </div>
        <div class="feature-grid">
          ${items.map((x) => `<div class="feature-card">
            <div class="fc-icon">${icon(x.i, 21)}</div>
            <span class="badge badge-brand" style="margin-bottom:8px">${x.tag}</span>
            <h3>${x.t}</h3><p>${x.d}</p>
          </div>`).join('')}
        </div>
        <div style="text-align:center;margin-top:32px">
          <a class="btn btn-primary btn-lg" href="#/register">注册后直接使用 ${icon('arrowRight', 16)}</a>
        </div>
      </div>
    </section>
  `);
}

/* ====================== 法务页 ====================== */

export function privacy() {
  return pageShell('', `<div class="legal-page">
    <h1>隐私政策</h1>
    <div class="legal-meta">生效日期：${new Date().getFullYear()}-01-01 · 版本 v1.0</div>
    <p>本系统可由你自行部署在私有服务器，数据保存在你自己的环境中。以下说明系统在处理数据时的基本原则。</p>
    <h2>1. 我们收集的信息</h2>
    <ul>
      <li><b>账号信息</b>：注册时提供的手机号、邮箱、密码（加密存储）、昵称、组织名称等。</li>
      <li><b>业务数据</b>：你创建的报价、模板、工艺价格库、客户资料等，仅用于向你提供报价服务。</li>
      <li><b>使用记录</b>：AI 功能调用日志，用于额度统计与异常预警。</li>
    </ul>
    <h2>2. 信息的使用</h2>
    <p>用于账号登录校验、报价生成、数据统计与问题排查。我们不会将你的业务数据用于其他商业目的。</p>
    <h2>3. 信息的存储与安全</h2>
    <p>密码采用加盐哈希存储，接口令牌采用签名机制。数据文件保存在服务器本地目录，建议定期备份。</p>
    <h2>4. 你的权利</h2>
    <p>你可以随时导出自己的报价数据（Excel / CSV）、修改账号信息、删除不需要的报价与客户资料。</p>
    <h2>5. Cookie 与本地存储</h2>
    <p>浏览器本地仅保存登录令牌与界面偏好，用于保持登录状态，不涉及第三方追踪。</p>
  </div>`);
}

export function terms() {
  return pageShell('', `<div class="legal-page">
    <h1>服务条款</h1>
    <div class="legal-meta">生效日期：${new Date().getFullYear()}-01-01 · 版本 v1.0</div>
    <h2>1. 服务内容</h2>
    <p>本系统提供家装报价的创建、编辑、估算、审核、分享与统计功能，包含基于规则的智能造价辅助能力。</p>
    <h2>2. 账号与使用</h2>
    <ul>
      <li>你需要妥善保管账号与密码，因账号泄露造成的损失由你自行承担。</li>
      <li>不得利用本系统生成、传播违法违规、虚假误导或侵权内容。</li>
      <li>不得通过批量调用、绕过计费、抓取接口等方式干扰系统正常运行。</li>
    </ul>
    <h2>3. 订阅与付费</h2>
    <ul>
      <li><b>订阅按月 / 按年支付</b>：到期不续费即自动停用付费功能，账号与数据不会被删除。</li>
      <li><b>升级 / 续费</b>：支持随时升级，已付费用按剩余天数折抵。</li>
      <li><b>退款</b>：除法律法规另有规定外，已开通或已消耗的套餐费 / 充值费不予退还。</li>
      <li><b>价格调整</b>：调价仅对调价之后的新订单生效，已购买的按购买时价格继续有效。</li>
    </ul>
    <h2>4. 数据所有权</h2>
    <p>你创建的业务数据归你所有，可随时导出。系统仅在你使用期间为提供服务而处理这些数据。</p>
    <h2>5. 责任限制</h2>
    <p>系统提供的估算与检查结果为辅助建议，不构成工程造价结论、价格承诺或施工方案审批。正式报价应由具备经验的人员复核后出具。</p>
  </div>`);
}

export function aiDisclaimer() {
  return pageShell('', `<div class="legal-page">
    <h1>AI 功能使用免责声明</h1>
    <div class="legal-meta">生效日期：${new Date().getFullYear()}-01-01 · 版本 v1.0</div>
    <p>本声明是《服务条款》的补充。你使用智能造价、报价体检、城市校准、模板生成等 AI 功能时，即表示你已阅读并理解以下风险。<b>AI 只提供辅助建议，不替代现场勘测、专业判断和双方确认的正式报价。</b></p>
    <h2>1. AI 输出是建议，不是最终结论</h2>
    <ul>
      <li>输出可能受训练数据时效、城市差异、户型复杂度和材料行情变化影响。</li>
      <li>可能生成看似合理但实际不适用或不适用的工艺、规范编号、价格建议。</li>
      <li>输出不构成法律意见、工程造价决定、价格承诺、施工方案审批或安全规范结论。</li>
    </ul>
    <h2>2. 你需要自行复核</h2>
    <ul>
      <li>报价前应以现场实测工程量、当地人工材料行情、实际施工条件为准。</li>
      <li>对客户出具正式报价前，应由具备经验的人员复核 AI 生成或建议采纳的内容。</li>
      <li>涉及合同、招投标、政府工程或法定造价咨询资质场景时，请勿直接使用 AI 输出作为依据。</li>
    </ul>
    <h2>3. 数据与扣费说明</h2>
    <ul>
      <li>使用 AI 功能时，你输入的户型、面积、城市、档次、备注等业务描述会发送给模型服务商处理（如已配置外部模型）。</li>
      <li>请勿在 AI 输入框中填写客户身份证号、银行卡号、完整门牌号等敏感个人信息。</li>
      <li>调用成功返回结果后，按页面显示的积分规则扣除；若系统或模型故障导致无可用结果，不扣费。</li>
    </ul>
    <h2>4. 禁止用途</h2>
    <ul>
      <li>不得利用 AI 功能生成、传播违法违规、虚假误导、侵权、恶意竞争或损害公共利益的内容。</li>
      <li>不得将 AI 输出包装为系统出具的工程造价结论、官方审核意见、资质报告或价格承诺。</li>
    </ul>
    <h2>5. 责任承担</h2>
    <p>你依据 AI 输出与客户达成的商业承诺、合同约定或施工安排，由你自行承担责任。</p>
  </div>`);
}

/* ====================== 数据 ====================== */

const SCENARIOS = [
  {
    role: '室内设计师',
    tagline: '接单就出报价，改 10 次也不乱。',
    headline: '客户问价时，先把报价范围给出来',
    desc: '设计师最怕客户等太久，也怕改一次需求就重做一遍报价。系统按模块组织明细，改哪一项都不用推倒重来。',
    steps: ['录入户型', '生成范围', '调整明细', '分享客户'],
    pains: ['手动做报价太慢', '客户一改需求就要重算', '项目漏了后期不好解释', '报价页客户看不明白'],
    features: [
      { tag: '快速报价', title: '3 分钟先出范围', text: '先给客户一个专业报价范围，不让客户一直等。' },
      { tag: '模块编辑', title: '改项目更轻松', text: '房间、数量、工艺都能按模块调整。' },
      { tag: '漏项提醒', title: '少漏项目', text: '常见漏项自动提醒，减少后期补项尴尬。' },
      { tag: '客户报价页', title: '客户看得懂', text: '客户先看总价，再看明细，沟通更顺。' },
    ],
  },
  {
    role: '家装顾问',
    tagline: '报价写清楚，客户才不只谈价格。',
    headline: '客户看得懂的报价，比口头解释更有说服力',
    desc: '一张分项清晰的报价单，是最好的成交工具。工艺说明写进报价，客户不再只盯着总价砍。',
    steps: ['了解需求', '快速出价', '导出文件', '客户确认'],
    pains: ['手动做报价太慢，客户等不住', '报价格式不统一，显得不专业', '客户看不懂明细，总想压价', '改一次需求就要重做一遍'],
    features: [
      { tag: '快速出价', title: '3 分钟出一份报价', text: '模板套用，AI 辅助填项，先给客户专业范围。' },
      { tag: '专业形象', title: '分项清晰更有说服力', text: '分项展示工程内容和单价，客户看得懂才信任。' },
      { tag: '客户链接', title: '发链接不发表格', text: '手机直接打开，客户看总价再看明细。' },
      { tag: '快速修改', title: '改需求不重做', text: '按模块调整，不用从头来，跟单节奏更快。' },
    ],
  },
  {
    role: '工作室主理人',
    tagline: '一个人接单设计，报价不能成瓶颈。',
    headline: '一人工作室，报价要快、要准、要留得住客户',
    desc: '接单、设计、报价、跟进全靠自己，时间最贵。把常用户型存成模板，下次接单直接套用。',
    steps: ['收到询价', '套模板出价', '发给客户', '确认开工'],
    pains: ['报价占用设计时间，顾此失彼', '每次都从头做，没有可复用模板', '客户改一次需求就要重算一遍', '想记客户信息但没有合适工具'],
    features: [
      { tag: '模板复用', title: '做一次，用很多次', text: '把常用套餐存成模板，下次接单直接套用。' },
      { tag: 'AI 填写', title: 'AI 帮你推算工程量', text: '填面积，AI 自动拆解各类工程量，省掉手动推算。' },
      { tag: '客户资料', title: '客户跟进一处管', text: '每个客户的报价和沟通记录都在一起。' },
      { tag: '利润可见', title: '每单成本自己清楚', text: '成本和毛利实时可见，接单心里有底。' },
    ],
  },
  {
    role: '独立施工负责人',
    tagline: '干活前把话说清楚，省掉九成扯皮。',
    headline: '报价写清楚，施工前少留隐患',
    desc: '最怕项目没写全、价格说不清楚。逐项列清再报价，工艺做法写进报价单，现场才能安心干活。',
    steps: ['现场勘量', '列项报价', '客户确认', '开工执行'],
    pains: ['项目漏写，后期补单客户不认', '工程量说不清，价格容易被压', '工艺做法没说明，客户误解多', '靠手写或微信截图，显得不正规'],
    features: [
      { tag: '项目清单', title: '逐项列清再报价', text: '拆除、水电、墙地面、安装等分类列明，不漏项。' },
      { tag: '工艺说明', title: '做法写进报价单', text: '每项工程附带工艺说明，减少口头约定引发的误会。' },
      { tag: '客户确认', title: '发链接留痕', text: '客户在线查看，确认后开工，减少后期争议。' },
      { tag: '正规形象', title: '导出正式文件', text: '一键导出 PDF，比微信截图专业得多。' },
    ],
  },
];

const PLANS = [
  {
    name: '免费版', tag: '体验入门', price: '¥0', cycle: '永久免费', borderColor: '#94a3b8',
    note: '随便新建、编辑、在线预览报价；出成品（导出 / 分享）时再按次购买。',
    aiQuota: { label: '赠送 30 积分 / 月', detail: '约 3 次智能造价试用' },
    features: ['1 个账号', '不限新建 / 编辑报价', '在线预览报价', '示例工艺库可查看', '出 PDF/Excel 需买次数'],
    cta: '免费开始',
  },
  {
    name: '普通版（按次）', tag: '按需出单', price: '¥9.9', cycle: '/ 1 次出单', borderColor: '#1565f5',
    note: '9.9 元买 1 次，1 次 = 出一份报价；同一份解锁后反复导出不重复扣次。',
    aiQuota: { label: 'AI 按积分计费', detail: '单独购买积分包，与出单次数互不影响' },
    features: ['不限新建 / 编辑报价', 'PDF / Excel 导出', '客户报价页分享', '客户档案管理', '同一份解锁后反复导出免费'],
    cta: '购买出单次数',
  },
  {
    name: 'Plus 版', tag: '推荐 · 不限次', price: '¥38', cycle: '/ 月',
    yearly: '年付 ¥32/月 · 年总 388 元，省 2 个月', borderColor: '#7c3aed', highlight: true,
    note: '包月不限次导出，AI 全程协助、漏项提醒、价格风险预警，高频出单更划算。',
    aiQuota: { label: '赠送 1000 积分 / 月', detail: '约 100 次智能造价，AI 全程协助' },
    features: ['1 个账号', '不限次导出 / 出单', '不限报价项目', '个人报价模板 10 套', 'AI 协助填写项目', '完整漏项提醒 + 价格风险提示', 'Excel / PDF 导出', '客户资料管理'],
    cta: '开通 Plus 版',
  },
  {
    name: '企业版', tag: '团队使用', price: '定制', cycle: '按需报价', borderColor: '#0891b2',
    note: '席位 / 价格库 / 审批流按团队规模定制，价格一对一沟通。',
    aiQuota: { label: '赠送 5000 积分 / 月', detail: '约 500 次智能造价，团队共享额度' },
    features: ['5 个账号起', '不限报价项目', '企业统一价格库', '企业报价模板库', '老板审批报价', '员工角色权限'],
    cta: '联系开通',
  },
];

const COMPARE = [
  { group: '基础配置' },
  { f: '适合对象', free: '想先看看效果', personal: '按需出单的个人', plus: '频繁接单的设计师', ent: '装修公司 / 设计团队' },
  { f: '账号数量', free: '1 个', personal: '1 个', plus: '1 个', ent: '5 个起' },
  { f: '报价项目数量', free: '不限（仅预览）', personal: '不限', plus: '不限', ent: '不限' },
  { f: '出单 / 导出', free: '需购买出单次数', personal: '¥9.9 / 次（解锁后反复导）', plus: '不限次', ent: '不限次' },
  { group: '工艺造价' },
  { f: '报价模板', free: '1 套示例模板', personal: '10 套个人模板', plus: '10 套个人模板', ent: '企业模板库' },
  { f: '工艺价格库', free: '示例库', personal: '可编辑个人价格库', plus: '个人价格库 + 常用分类', ent: '企业统一价格库' },
  { f: '历史报价保存', free: '近 7 天', personal: '长期保存', plus: '长期保存 + 一键复用', ent: '长期保存 + 版本管理' },
  { f: '漏项提醒', free: '不提醒', personal: '完整提醒', plus: '完整提醒', ent: '可按企业规则配置' },
  { group: 'AI 与数据' },
  { f: 'AI 协助填写', free: '赠 30 积分 / 月', personal: '按积分计费', plus: '完整协助 + 1000 积分 / 月', ent: '按企业价格库协助' },
  { f: '成本 / 毛利', free: '不开放', personal: '本人可见', plus: '本人可见', ent: '按角色权限可见' },
  { f: '数据导出', free: '购买次数后可导', personal: 'PDF / Excel（按次解锁）', plus: 'Excel / PDF 不限次', ent: '批量导出' },
  { group: '客户体验' },
  { f: '客户报价页', free: '仅本地预览', personal: '可分享（按次解锁）', plus: '可分享 + 更完整明细', ent: '企业品牌报价页' },
  { f: '报价风险提示', free: '不开放', personal: '不开放', plus: '基础风险提示', ent: '红黄绿蓝风险预警' },
  { group: '团队管理' },
  { f: '报价审批', free: '不开放', personal: '不开放', plus: '不开放', ent: '老板审批' },
  { f: '员工权限', free: '不开放', personal: '不开放', plus: '不开放', ent: '按角色设置' },
  { f: '客户资料管理', free: '不开放', personal: '个人客户库', plus: '个人客户库 + 跟进记录', ent: '团队客户库' },
  { group: '服务支持' },
  { f: '服务支持', free: '社群支持', personal: '标准支持', plus: '优先支持', ent: '专属开通支持' },
];

const CREDIT_PACKS = [
  { credits: 100, price: 9.9, bonus: 0 },
  { credits: 500, price: 39, bonus: 0 },
  { credits: 1200, price: 88, bonus: 50 },
  { credits: 3000, price: 198, bonus: 200 },
  { credits: 8000, price: 468, bonus: 800 },
  { credits: 20000, price: 998, bonus: 2500 },
];

const PRICING_FAQ = [
  ['可以随时取消吗？', '可以。月付版到期不续费即自动停用，不会额外扣费。年付版按自然年计，到期前不续费即止，中途仍可正常使用全部功能。'],
  ['年付能退款吗？', '暂不支持年付退款。建议先用免费版完整体验报价流程，确认适合业务需要后再升级年付，避免浪费。'],
  ['出单次数是怎么算的？', '1 次 = 对一份报价完成一次出单（导出或分享解锁）。同一份报价解锁后可反复导出，不重复扣次。'],
  ['积分用不完会过期吗？', '套餐每月赠送的积分按月重置；单独购买的充值包 180 天内有效。'],
  ['企业版账号怎么计费？', '企业版基础包含 5 个账号坐席。团队规模更大可按实际坐席数灵活追加，不强制捆绑套餐。'],
  ['升级版本后，原来的数据还在吗？', '完全保留。历史报价、模板、工艺价格库和客户资料不受版本变更影响 —— 不管是升级还是降级，数据都不会丢失。'],
];
