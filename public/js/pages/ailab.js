/**
 * AI 实验室 —— 15 项 AI 能力集中入口
 */
import { api, icon, esc, fmt, toast, emptyState, loadingRow } from '../core.js';

const FEATURES = [
  {
    group: '估算', key: 'full-estimate', emoji: '🎯', name: '完整自助估算', cost: 10,
    desc: '综合城市、面积、户型、空间清单与现场备注，生成完整造价估算',
    fields: [
      { k: 'city', label: '城市', def: '合肥' },
      { k: 'building_area', label: '建筑面积 m²', type: 'number', def: 108 },
      { k: 'layout', label: '户型', type: 'select', options: ['一室一厅一卫', '两室一厅一卫', '两室两厅一卫', '三室两厅一卫', '三室两厅两卫', '四室两厅两卫'], def: '三室两厅两卫' },
      { k: 'tier', label: '装修档次', type: 'select', options: ['简装', '中档', '高档', '定制'], def: '中档' },
      { k: 'house_type', label: '房屋类型', type: 'select', options: ['新房', '老房'], def: '新房' },
      { k: 'house_age', label: '房龄（年）', type: 'number', def: 0 },
      { k: 'notes', label: '现场备注', type: 'textarea', def: '' },
    ],
    render: (r) => `
      <div class="kpi-grid">
        <div class="ai-result__kpi"><div class="ai-result__kpi-label">估算总价</div>
          <div class="ai-result__kpi-value" style="color:var(--brand)">¥${fmt.money(r.total, 0)}</div></div>
        <div class="ai-result__kpi"><div class="ai-result__kpi-label">单方造价</div>
          <div class="ai-result__kpi-value">${fmt.int(r.per_sqm)}<span style="font-size:12px"> 元/m²</span></div></div>
        <div class="ai-result__kpi"><div class="ai-result__kpi-label">成本合计</div>
          <div class="ai-result__kpi-value">¥${fmt.money(r.cost_total, 0)}</div></div>
        <div class="ai-result__kpi"><div class="ai-result__kpi-label">毛利率</div>
          <div class="ai-result__kpi-value">${r.gross_margin}%</div></div>
        <div class="ai-result__kpi"><div class="ai-result__kpi-label">明细条数</div>
          <div class="ai-result__kpi-value">${(r.items || []).length}</div></div>
      </div>
      ${section('分类构成', (r.breakdown || []).map((b) => `<div class="dist-row">
        <div class="dist-top"><span>${esc(b.name)}</span><b>¥${fmt.money(b.amount, 0)} · ${b.ratio}%</b></div>
        <div class="bar"><i style="width:${Math.max(3, b.ratio)}%"></i></div></div>`).join(''))}
      ${section('估算假设（请人工复核）', (r.assumptions || []).map((a) => `<div class="assumption-item">${esc(a)}</div>`).join(''))}
      ${section('明细预览（前 10 条）', `<table class="tbl"><thead><tr>
        <th>分类</th><th>项目</th><th class="c">单位</th><th class="r">数量</th><th class="r">单价</th><th class="r">小计</th>
        </tr></thead><tbody>${(r.items || []).slice(0, 10).map((i) => `<tr>
        <td><span class="badge">${esc(i.group_name)}</span></td>
        <td>${esc(i.name)}</td><td class="c">${esc(i.unit)}</td>
        <td class="r num">${fmt.num(i.qty)}</td><td class="r num">${fmt.money(i.unit_price)}</td>
        <td class="r num">¥${fmt.money(i.unit_price * i.qty)}</td></tr>`).join('')}</tbody></table>`)}`,
  },
  {
    group: '估算', key: 'room-breakdown', emoji: '📐', name: '户型智能拆解', cost: 3,
    desc: '输入户型与面积，自动拆出每个空间的面积',
    fields: [
      { k: 'building_area', label: '建筑面积 m²', type: 'number', def: 100 },
      { k: 'layout', label: '户型', type: 'select', options: ['一室一厅一卫', '两室一厅一卫', '两室两厅一卫', '三室两厅一卫', '三室两厅两卫', '四室两厅两卫'], def: '三室两厅两卫' },
      { k: 'building_type', label: '建筑类型', type: 'select', options: ['高层', '多层', '低层', '别墅'], def: '高层' },
    ],
    render: (r) => `
      <div class="kpi-grid">
        <div class="ai-result__kpi"><div class="ai-result__kpi-label">套内面积</div>
          <div class="ai-result__kpi-value">${r.usable_area}<span style="font-size:12px"> m²</span></div></div>
        <div class="ai-result__kpi"><div class="ai-result__kpi-label">空间数量</div>
          <div class="ai-result__kpi-value">${(r.spaces || []).length}</div></div>
      </div>
      ${section('空间清单', `<div class="row wrap gap8">${(r.spaces || []).map((s) =>
    `<span class="badge badge-brand" style="height:26px;padding:0 12px">${esc(s.name)} ${s.area} m²</span>`).join('')}</div>`)}
      ${section('假设', (r.assumptions || []).map((a) => `<div class="assumption-item">${esc(a)}</div>`).join(''))}`,
  },
  {
    group: '估算', key: 'tier-matching', emoji: '🏷️', name: '装修档次匹配', cost: 3,
    desc: '对比简装 / 中档 / 高档 / 定制四档的价格区间',
    fields: [
      { k: 'city', label: '城市', def: '合肥' },
      { k: 'building_area', label: '建筑面积 m²', type: 'number', def: 108 },
      { k: 'budget', label: '业主预算（元，选填）', type: 'number', def: '' },
    ],
    render: (r) => `
      <div class="t-sm dim mb12">推荐档次：<b style="color:var(--brand)">${esc(r.recommended)}</b> · ${esc(r.reason)}</div>
      ${section('四档对比', `<table class="tbl"><thead><tr>
        <th>档次</th><th class="r">单方造价</th><th class="r">总价区间</th><th class="r">中位值</th></tr></thead>
        <tbody>${(r.tiers || []).map((t) => `<tr>
          <td><b>${esc(t.tier)}</b><div class="t-xs muted">${esc(t.label)}</div></td>
          <td class="r num">${fmt.int(t.per_sqm[0])}–${fmt.int(t.per_sqm[1])}</td>
          <td class="r num">¥${fmt.money(t.total_low, 0)} – ¥${fmt.money(t.total_high, 0)}</td>
          <td class="r num strong">¥${fmt.money(t.mid, 0)}</td></tr>`).join('')}</tbody></table>`)}`,
  },
  {
    group: '估算', key: 'budget-reverse', emoji: '💰', name: '预算反推', cost: 5,
    desc: '业主给了硬预算，评估可行性并给出分项资金分配',
    fields: [
      { k: 'budget', label: '业主预算（元）', type: 'number', def: 120000 },
      { k: 'building_area', label: '建筑面积 m²', type: 'number', def: 108 },
      { k: 'city', label: '城市', def: '合肥' },
      { k: 'tier', label: '目标档次', type: 'select', options: ['简装', '中档', '高档', '定制'], def: '中档' },
    ],
    render: (r) => `
      <div class="kpi-grid">
        <div class="ai-result__kpi"><div class="ai-result__kpi-label">可行性</div>
          <div class="ai-result__kpi-value" style="font-size:16px;color:${r.feasible ? 'var(--success)' : 'var(--danger)'}">${esc(r.verdict)}</div></div>
        <div class="ai-result__kpi"><div class="ai-result__kpi-label">单方预算</div>
          <div class="ai-result__kpi-value">${fmt.int(r.per_sqm)}<span style="font-size:12px"> 元/m²</span></div></div>
        <div class="ai-result__kpi"><div class="ai-result__kpi-label">预计需要</div>
          <div class="ai-result__kpi-value">¥${fmt.money(r.expected_total, 0)}</div></div>
      </div>
      ${section('建议', `<div class="t-sm" style="line-height:1.8;color:var(--text-2)">${esc(r.advice)}</div>`)}
      ${section('分项资金分配', (r.allocation || []).map((a) => `<div class="dist-row">
        <div class="dist-top"><span>${esc(a.name)} · ${Math.round(a.ratio * 100)}%</span><b>¥${fmt.money(a.amount, 0)}</b></div>
        <div class="bar"><i style="width:${a.ratio * 100}%"></i></div></div>`).join(''))}`,
  },
  {
    group: '估算', key: 'risk-report', emoji: '⚠️', name: '增项风险预测', cost: 8,
    desc: '老房、楼层、季节等常见隐性增项，预估额外费用区间',
    fields: [
      { k: 'city', label: '城市', def: '合肥' },
      { k: 'building_area', label: '建筑面积 m²', type: 'number', def: 108 },
      { k: 'house_type', label: '房屋类型', type: 'select', options: ['新房', '老房'], def: '老房' },
      { k: 'house_age', label: '房龄（年）', type: 'number', def: 20 },
      { k: 'floor', label: '楼层', type: 'number', def: 6 },
      { k: 'has_elevator', label: '电梯', type: 'select', options: ['true', 'false'], def: 'true' },
      { k: 'budget', label: '当前预算（元）', type: 'number', def: 120000 },
      { k: 'notes', label: '备注', type: 'textarea', def: '' },
    ],
    render: (r) => `
      <div class="kpi-grid">
        <div class="ai-result__kpi"><div class="ai-result__kpi-label">预估增项</div>
          <div class="ai-result__kpi-value" style="color:var(--warn)">¥${fmt.money(r.extra_low, 0)} – ${fmt.money(r.extra_high, 0)}</div></div>
        <div class="ai-result__kpi"><div class="ai-result__kpi-label">占预算比</div>
          <div class="ai-result__kpi-value">${r.ratio_low}% – ${r.ratio_high}%</div></div>
      </div>
      ${section('建议', `<div class="t-sm" style="line-height:1.8;color:var(--text-2)">${esc(r.advice)}</div>`)}
      ${section('风险清单', `<table class="tbl"><thead><tr>
        <th>风险项</th><th class="c">概率</th><th class="r">费用区间</th><th>说明</th></tr></thead>
        <tbody>${(r.risks || []).map((x) => `<tr>
          <td><b>${esc(x.item)}</b></td>
          <td class="c"><span class="badge ${x.prob === '高' ? 'badge-danger' : x.prob === '中' ? 'badge-warn' : ''}">${esc(x.prob)}</span></td>
          <td class="r num">¥${fmt.money(x.low, 0)} – ${fmt.money(x.high, 0)}</td>
          <td class="t-sm muted">${esc(x.why)}</td></tr>`).join('')}</tbody></table>`)}`,
  },
  {
    group: '报价辅助', key: 'nl-to-items', emoji: '💬', name: '自然语言加项', cost: 5,
    desc: '一句话描述，拆成结构化报价条目',
    fields: [
      { k: 'text', label: '描述', type: 'textarea', def: '客厅墙面刷乳胶漆 35 平米，加踢脚线和成品门；厨卫做防水和贴砖' },
      { k: 'city', label: '城市', def: '合肥' },
    ],
    render: (r) => `
      ${section(`识别结果（${(r.items || []).length} 条）`, (r.items || []).length ? `<table class="tbl"><thead><tr>
        <th>项目</th><th class="c">单位</th><th class="c">数量</th><th class="r">单价</th><th class="r">小计</th></tr></thead>
        <tbody>${(r.items || []).map((i) => `<tr>
          <td><b>${esc(i.name)}</b><div class="t-xs muted">${esc(i.group_name)}</div></td>
          <td class="c">${esc(i.unit)}</td><td class="c num">${fmt.num(i.qty)}</td>
          <td class="r num">${fmt.money(i.unit_price)}</td>
          <td class="r num">¥${fmt.money(i.unit_price * i.qty)}</td></tr>`).join('')}</tbody></table>` : '未匹配到工艺条目' )}
      ${(r.assumptions || []).length ? section('假设', r.assumptions.map((a) => `<div class="assumption-item">${esc(a)}</div>`).join('')) : ''}`,
  },
  {
    group: '报价辅助', key: 'price-suggestion', emoji: '📊', name: '单点价格建议', cost: 2,
    desc: '单个工艺项的城市级价格区间',
    fields: [
      { k: 'item_name', label: '工艺名称', def: '厨卫墙地面防水（聚合物水泥基三遍）' },
      { k: 'city', label: '城市', def: '合肥' },
      { k: 'current_price', label: '你当前的报价（选填）', type: 'number', def: '' },
    ],
    render: (r) => `
      <div class="kpi-grid">
        <div class="ai-result__kpi"><div class="ai-result__kpi-label">建议区间</div>
          <div class="ai-result__kpi-value" style="font-size:16px">¥${fmt.money(r.suggested_low)} – ${fmt.money(r.suggested_high)}</div></div>
        <div class="ai-result__kpi"><div class="ai-result__kpi-label">中位建议</div>
          <div class="ai-result__kpi-value">¥${fmt.money(r.suggested_mid)}</div></div>
        <div class="ai-result__kpi"><div class="ai-result__kpi-label">判定</div>
          <div class="ai-result__kpi-value" style="font-size:15px">${{ ok: '✅ 合理', high: '⚠️ 偏高', low: '⚠️ 偏低', unknown: '❓ 未填报价' }[r.verdict] || r.verdict}</div></div>
      </div>
      ${section('依据', `<div class="t-sm" style="line-height:1.8;color:var(--text-2)">${esc(r.basis)}${r.craft ? `<br>工艺：${esc(r.craft)}` : ''}</div>`)}`,
  },
  {
    group: '报价辅助', key: 'item-suggestion', emoji: '🔍', name: '相似项推荐', cost: 2,
    desc: '根据工艺项推荐同类的相似条目',
    fields: [{ k: 'item_name', label: '工艺名称', def: '墙面刷乳胶漆（底漆一遍+面漆两遍）' }, { k: 'city', label: '城市', def: '合肥' }],
    render: (r) => section('相似工艺', (r.suggestions || []).length ? `<table class="tbl"><thead><tr>
      <th>项目</th><th class="c">单位</th><th class="r">价格</th><th>工艺说明</th></tr></thead>
      <tbody>${(r.suggestions || []).map((s) => `<tr><td><b>${esc(s.name)}</b></td><td class="c">${esc(s.unit)}</td>
      <td class="r num">¥${fmt.money(s.price)}</td><td class="t-sm muted">${esc((s.craft || '').slice(0, 40))}</td></tr>`).join('')}</tbody></table>` : '未找到相似项'),
  },
  {
    group: '审核', key: 'quote-review', emoji: '✅', name: '整张报价复核', cost: 15,
    desc: '综合评分、漏项检查、异常单价与客户解释建议',
    fields: [{ k: 'quote_id', label: '选择报价', type: 'quote', def: '' }],
    needQuote: true,
    render: (r) => `
      <div class="kpi-grid">
        <div class="ai-result__kpi"><div class="ai-result__kpi-label">综合评分</div>
          <div class="ai-result__kpi-value" style="color:${r.score >= 80 ? 'var(--success)' : r.score >= 60 ? 'var(--warn)' : 'var(--danger)'}">${r.score}</div></div>
        <div class="ai-result__kpi"><div class="ai-result__kpi-label">毛利</div>
          <div class="ai-result__kpi-value">${r.margin_rate}%</div></div>
        <div class="ai-result__kpi"><div class="ai-result__kpi-label">明细数</div>
          <div class="ai-result__kpi-value">${r.item_count}</div></div>
        <div class="ai-result__kpi"><div class="ai-result__kpi-label">漏项</div>
          <div class="ai-result__kpi-value">${(r.missing || []).length}</div></div>
        <div class="ai-result__kpi"><div class="ai-result__kpi-label">单价异常</div>
          <div class="ai-result__kpi-value">${(r.anomalies || []).length}</div></div>
      </div>
      ${section('漏项', (r.missing || []).length
    ? r.missing.map((m) => `<div class="issue-item warn">${icon('alert', 16)}<div><b>${esc(m.type)}</b><span>${esc(m.detail)}</span></div></div>`).join('')
    : '<div class="t-sm muted">暂未发现明显漏项。</div>')}
      ${section('单价异常', (r.anomalies || []).length
    ? r.anomalies.map((a) => `<div class="issue-item ${a.level === 'high' ? 'high' : 'low'}">${icon('alert', 16)}
        <div><b>${esc(a.name)}</b><span>当前 ¥${fmt.money(a.current)}，工艺库基准 ¥${fmt.money(a.reference)}</span></div></div>`).join('')
    : '<div class="t-sm muted">暂未发现明显单价异常。</div>')}
      ${section('客户解释建议', `<div class="t-sm" style="line-height:1.8;color:var(--text-2)">${esc(r.client_explain)}</div>`)}`,
  },
  {
    group: '审核', key: 'validate-quote', emoji: '🧾', name: '漏项检查', cost: 8,
    desc: '只做漏项与异常检查，输出精简结论',
    fields: [{ k: 'quote_id', label: '选择报价', type: 'quote', def: '' }],
    needQuote: true,
    render: (r) => `
      <div class="kpi-grid">
        <div class="ai-result__kpi"><div class="ai-result__kpi-label">漏项数</div>
          <div class="ai-result__kpi-value">${(r.missing || []).length}</div></div>
        <div class="ai-result__kpi"><div class="ai-result__kpi-label">异常数</div>
          <div class="ai-result__kpi-value">${(r.anomalies || []).length}</div></div>
        <div class="ai-result__kpi"><div class="ai-result__kpi-label">评分</div>
          <div class="ai-result__kpi-value">${r.score}</div></div>
      </div>
      ${section('漏项', (r.missing || []).length
    ? r.missing.map((m) => `<div class="issue-item warn">${icon('alert', 16)}<div><b>${esc(m.type)}</b><span>${esc(m.detail)}</span></div></div>`).join('')
    : '<div class="t-sm muted">暂未发现明显漏项。</div>')}`,
  },
  {
    group: '审核', key: 'customer-copy', emoji: '✍️', name: '客户话术润色', cost: 3,
    desc: '把内部工艺名改成业主看得懂的话',
    fields: [
      { k: 'items_text', label: '工艺项清单（每行一条）', type: 'textarea', def: '墙面刷乳胶漆\n厨卫防水\nPPR 给水管改造\n瓷砖薄贴' },
      { k: 'project_name', label: '项目名（可选）', def: '' },
      { k: 'city', label: '城市（可选）', def: '合肥' },
    ],
    render: (r) => `
      ${section('开场白', `<div class="t-sm" style="line-height:1.8;color:var(--text-2)">${esc(r.intro)}</div>`)}
      ${section('逐项话术', (r.lines || []).map((l, i) => `<div class="issue-item" style="background:var(--brand-50)">
        ${icon('message', 16)}<div><b>第 ${i + 1} 项</b><span>${esc(l)}</span></div></div>`).join(''))}
      ${section('收尾', `<div class="t-sm" style="line-height:1.8;color:var(--text-2)">${esc(r.closing)}</div>`)}`,
  },
  {
    group: '管理视角', key: 'audit-risk', emoji: '🛡️', name: '审计异常预警', cost: 5,
    desc: '识别高频调用、失败率异常等风险',
    fields: [],
    render: (r) => `
      <div class="kpi-grid">
        <div class="ai-result__kpi"><div class="ai-result__kpi-label">总调用</div>
          <div class="ai-result__kpi-value">${r.total_calls}</div></div>
        <div class="ai-result__kpi"><div class="ai-result__kpi-label">失败数</div>
          <div class="ai-result__kpi-value">${r.failed_calls}</div></div>
        <div class="ai-result__kpi"><div class="ai-result__kpi-label">预警</div>
          <div class="ai-result__kpi-value">${(r.alerts || []).length}</div></div>
      </div>
      ${section('预警明细', (r.alerts || []).length
    ? r.alerts.map((a) => `<div class="issue-item ${a.level === '高' ? 'high' : 'warn'}">${icon('alert', 16)}
        <div><b>${esc(a.type)}</b><span>${esc(a.advice || a.detail || '')}</span></div></div>`).join('')
    : `<div class="t-sm muted">${esc(r.summary)}</div>`)}`,
  },
];

let current = FEATURES[0];
let quoteOptions = [];

export async function render(el, ctx) {
  ctx.setTitle('AI 实验室', '15 项 AI 能力，按积分计费，成功才扣');
  el.innerHTML = loadingRow('正在读取配置…');

  let quota = { credits: 0 };
  try {
    const [q, qs] = await Promise.all([
      api.get('/ai/quota-status'),
      api.get('/quotes?range=all').catch(() => ({ items: [] })),
    ]);
    quota = q;
    quoteOptions = (qs.items || []).map((x) => ({ id: x.id, label: `${x.quote_number} · ${x.title || ''}` }));
  } catch (e) { /* ignore */ }

  const groups = [...new Set(FEATURES.map((f) => f.group))];

  el.innerHTML = `
    <div class="ai-layout">
      <div class="ai-side">
        <div class="panel">
          <div class="panel-body" style="padding:14px">
            <div class="row between" style="margin-bottom:6px">
              <span class="t-xs muted">积分余额</span>
              <b style="color:var(--violet)">${fmt.int(quota.credits)}</b>
            </div>
            <div class="bar"><i style="width:${Math.min(100, quota.credits / 10)}%"></i></div>
            <a class="btn btn-secondary btn-sm btn-block mt12" href="#/app/billing">${icon('zap', 14)} 充值积分</a>
          </div>
        </div>
        <div class="panel mt16">
          <div class="panel-body" style="padding:10px">
            ${groups.map((g) => `
              <div class="ai-group-title">${g}</div>
              <div class="ai-feature-list">
                ${FEATURES.filter((f) => f.group === g).map((f) => `
                  <button class="ai-feature-item ${current.key === f.key ? 'active' : ''}" data-key="${f.key}">
                    <span class="em">${f.emoji}</span>${f.name}
                    <span class="cost">${f.cost}⚡</span>
                  </button>`).join('')}
              </div>`).join('')}
          </div>
        </div>
      </div>

      <div>
        <div class="panel">
          <div class="panel-head">
            <div><h2>${current.emoji} ${current.name}</h2>
              <p class="panel-note">${esc(current.desc)}</p></div>
            <div class="panel-actions">
              <span class="ai-quota-badge">${icon('zap', 13)} 本次消耗 ${current.cost} 积分</span>
            </div>
          </div>
          <div class="panel-body">
            <div class="ai-form" id="aiForm"></div>
            <div class="ai-submit-bar">
              <button class="btn btn-primary" id="aiRun">${icon('sparkles', 15)} 开始调用（${current.cost} 积分）</button>
              <span class="ai-submit-cost">成功才扣，失败不扣</span>
            </div>
          </div>
        </div>
        <div id="aiResult" class="mt16"></div>
      </div>
    </div>
  `;

  el.querySelectorAll('[data-key]').forEach((b) => {
    b.onclick = () => {
      current = FEATURES.find((f) => f.key === b.dataset.key);
      render(el, ctx);
    };
  });

  drawForm(el);

  el.querySelector('#aiRun').onclick = () => run(el);
}

function drawForm(el) {
  const box = el.querySelector('#aiForm');
  if (!current.fields.length) {
    box.innerHTML = `<div class="t-sm muted">该功能无需输入参数，直接点击调用即可。</div>`;
    return;
  }
  box.innerHTML = current.fields.map((f) => {
    if (f.type === 'quote') {
      return `<div class="ai-form__row"><label class="ai-form__label">${esc(f.label)}</label>
        <select class="select" data-f="${f.k}">
          ${quoteOptions.map((o) => `<option value="${o.id}">${esc(o.label)}</option>`).join('') || '<option value="">暂无报价</option>'}
        </select></div>`;
    }
    if (f.type === 'select') {
      return `<div class="ai-form__row"><label class="ai-form__label">${esc(f.label)}</label>
        <select class="select" data-f="${f.k}">
          ${f.options.map((o) => `<option ${o === f.def ? 'selected' : ''}>${o}</option>`).join('')}
        </select></div>`;
    }
    if (f.type === 'textarea') {
      return `<div class="ai-form__row"><label class="ai-form__label">${esc(f.label)}</label>
        <textarea class="textarea" data-f="${f.k}" placeholder="${esc(f.def || '')}">${esc(f.def || '')}</textarea></div>`;
    }
    return `<div class="ai-form__row"><label class="ai-form__label">${esc(f.label)}</label>
      <input class="input" type="${f.type || 'text'}" data-f="${f.k}" value="${esc(f.def == null ? '' : f.def)}"></div>`;
  }).join('');
}

async function run(el) {
  const btn = el.querySelector('#aiRun');
  const box = el.querySelector('#aiResult');
  const payload = {};

  el.querySelectorAll('[data-f]').forEach((inp) => {
    const k = inp.dataset.f;
    let v = inp.value;
    const f = (current.fields || []).find((x) => x.k === k);
    if (f && f.type === 'number') v = v === '' ? undefined : Number(v);
    if (f && k === 'has_elevator') v = v === 'true';
    payload[k] = v;
  });

  // 需要报价的功能：拉取明细
  if (current.needQuote) {
    const qid = payload.quote_id;
    if (!qid) return toast('请先创建一张报价', 'error');
    try {
      const q = await api.get(`/quotes/${qid}`);
      payload.items = (q.items || []).map((i) => ({
        group_name: i.group_name, name: i.name, unit: i.unit,
        qty: i.qty, unit_price: i.unit_price, cost_price: i.cost_price,
      }));
      delete payload.quote_id;
    } catch (e) { return toast(e.message, 'error'); }
  }

  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span>AI 处理中…`;
  box.innerHTML = `<div class="panel"><div class="panel-body">
    <div class="empty"><div class="spinner dark" style="width:24px;height:24px"></div>
    <div class="empty-desc">AI 正在处理，请稍候…</div></div></div></div>`;

  try {
    const r = await api.post(`/ai/${current.key}`, payload);
    box.innerHTML = `<div class="panel">
      <div class="panel-head">
        <div><h2>调用结果</h2>
          <p class="panel-note">引擎：${esc(r._engine === 'local' ? '本地规则引擎' : r._engine)} · 耗时 ${r.elapsed_ms} ms · 消耗 ${r.cost} 积分</p></div>
        <div class="panel-actions">
          <button class="btn btn-secondary btn-sm" id="copyJson">${icon('copy', 14)} 复制 JSON</button>
        </div>
      </div>
      <div class="panel-body"><div class="ai-result">${current.render(r)}</div></div>
    </div>`;
    const cp = box.querySelector('#copyJson');
    if (cp) cp.onclick = () => {
      navigator.clipboard.writeText(JSON.stringify(r, null, 2))
        .then(() => toast('已复制 JSON', 'success')).catch(() => toast('复制失败', 'error'));
    };
    toast('调用成功', 'success');
  } catch (e) {
    box.innerHTML = `<div class="panel"><div class="panel-body">
      <div class="issue-item high">${icon('alert', 16)}<div><b>调用失败</b><span>${esc(e.message)}</span></div></div>
    </div></div>`;
    toast(e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `${icon('sparkles', 15)} 开始调用（${current.cost} 积分）`;
  }
}

function section(title, html) {
  return `<div class="ai-result__section">
    <h4 class="ai-result__section-title">${esc(title)}</h4>${html}</div>`;
}
