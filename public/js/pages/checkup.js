/**
 * 报价体检
 */
import { api, icon, esc, fmt, toast, emptyState, loadingRow } from '../core.js';

let quotes = [];
let selected = '';
let local = null;
let ai = null;

export async function render(el, ctx) {
  ctx.setTitle('报价体检', '出单前检查成本、毛利、材料用量与疑似漏项');
  ctx.setActions(`<button class="btn btn-secondary" id="ckRefresh">${icon('refresh', 15)} 刷新</button>`);
  el.innerHTML = loadingRow('正在读取报价列表…');

  try {
    const r = await api.get('/quotes?range=all');
    quotes = r.items || [];
    if (quotes.length && !selected) selected = quotes[0].id;
  } catch (e) {
    el.innerHTML = emptyState('alert', '加载失败', e.message);
    return;
  }

  ctx.bind('#ckRefresh', 'onclick', () => render(el, ctx));

  if (!quotes.length) {
    el.innerHTML = `<div class="panel"><div class="panel-body">${emptyState('shield', '还没有可体检的报价',
      '先在报价管理里新建一张报价，再回到这里体检成本、毛利和材料用量',
      `<a class="btn btn-primary" href="#/app/estimate">${icon('sparkles', 15)} 去新建报价</a>`)}</div></div>`;
    return;
  }

  el.innerHTML = `
    <div class="panel" style="margin-bottom:16px">
      <div class="toolbar">
        <span class="t-sm dim">选择报价：</span>
        <select class="select" id="ckQuote" style="min-width:340px">
          ${quotes.map((q) => `<option value="${q.id}" ${q.id === selected ? 'selected' : ''}>
            ${esc(q.quote_number)} · ${esc(q.title || '')}（¥${fmt.money(q.grand_total || q.total_amount || 0, 0)}）</option>`).join('')}
        </select>
        <div class="toolbar-right">
          <button class="btn btn-secondary btn-sm" id="ckLocal">${icon('shield', 14)} 本地体检（免费）</button>
          <button class="btn btn-primary btn-sm" id="ckAi">${icon('sparkles', 14)} AI 深度复核（15 积分）</button>
        </div>
      </div>
    </div>
    <div id="ckBody"></div>
  `;

  el.querySelector('#ckQuote').onchange = async (e) => {
    selected = e.target.value; local = null; ai = null;
    await runLocal(el);
  };
  el.querySelector('#ckLocal').onclick = () => runLocal(el);
  el.querySelector('#ckAi').onclick = () => runAi(el);

  await runLocal(el);
}

async function runLocal(el) {
  const box = el.querySelector('#ckBody');
  box.innerHTML = loadingRow('正在检测当前报价…');
  try {
    local = await api.get(`/quotes/${selected}/pricing-audit`);
  } catch (e) {
    box.innerHTML = emptyState('alert', '体检失败', e.message);
    return;
  }
  drawResult(el);
}

async function runAi(el) {
  const btn = el.querySelector('#ckAi');
  btn.disabled = true; btn.innerHTML = `<span class="spinner"></span>复核中…`;
  try {
    const q = await api.get(`/quotes/${selected}`);
    ai = await api.post('/ai/quote-review', {
      items: (q.items || []).map((i) => ({
        group_name: i.group_name, name: i.name, unit: i.unit,
        qty: i.qty, unit_price: i.unit_price, cost_price: i.cost_price,
      })),
    });
    toast('AI 复核完成', 'success');
    drawResult(el);
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `${icon('sparkles', 14)} AI 深度复核（15 积分）`;
  }
}

function drawResult(el) {
  const box = el.querySelector('#ckBody');
  const l = local || {};
  const a = ai;

  let html = '';

  if (a) {
    const tone = a.score >= 80 ? 'linear-gradient(120deg,#16a34a,#22c55e)'
      : a.score >= 60 ? 'linear-gradient(120deg,#d97706,#f59e0b)'
        : 'linear-gradient(120deg,#dc2626,#f87171)';
    html += `<div class="check-score" style="background:${tone}">
      <div class="num">${a.score}</div>
      <div class="info">
        <h3>AI 综合评分</h3>
        <p>${a.item_count} 条明细 · 毛利 ${a.margin_rate}% · ${a.margin_verdict}</p>
      </div>
      <div class="ring">${icon(a.score >= 80 ? 'award' : 'alert', 40)}</div>
    </div>`;
  }

  html += `<div class="grid c2">
    <div class="panel">
      <div class="panel-head"><div><h2>成本与结构</h2>
        <p class="panel-note">本地规则检查，不消耗积分</p></div></div>
      <div class="panel-body">
        <div class="row between" style="margin-bottom:9px"><span class="dim">明细条数</span><b class="num">${l.item_count || 0}</b></div>
        <div class="row between" style="margin-bottom:9px"><span class="dim">报价总额</span><b class="num">¥${fmt.money(l.total || 0)}</b></div>
        <div class="t-sm b" style="margin:14px 0 8px">分类构成</div>
        ${(l.group_distribution || []).map((g) => `<div class="dist-row">
          <div class="dist-top"><span>${esc(g.name)}</span><b>¥${fmt.money(g.amount, 0)} · ${g.ratio}%</b></div>
          <div class="bar"><i style="width:${Math.max(3, g.ratio)}%"></i></div>
        </div>`).join('') || '<div class="t-sm muted">暂无数据</div>'}
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><div><h2>检查项</h2>
        <p class="panel-note">${l.issues && l.issues.length ? `发现 ${l.issues.length} 处待复核` : '未发现明显异常'}</p></div></div>
      <div class="panel-body" style="max-height:340px;overflow:auto">
        ${(l.issues || []).length
    ? l.issues.map((i) => `<div class="issue-item ${i.level === 'high' ? 'high' : i.level === 'low' ? 'low' : 'warn'}">
            ${icon('alert', 16)}
            <div><b>${esc(i.item || '')}</b><span>${esc(i.msg || '')}${i.reference ? `（基准 ¥${fmt.money(i.reference)}，当前 ¥${fmt.money(i.current)}）` : ''}</span></div>
          </div>`).join('')
    : `<div class="empty" style="padding:24px"><div class="empty-desc">未发现明显异常，可以出单了。</div></div>`}
      </div>
    </div>
  </div>`;

  if (a) {
    html += `<div class="grid c2" style="margin-top:16px">
      <div class="panel">
        <div class="panel-head"><div><h2>疑似漏项</h2></div></div>
        <div class="panel-body">
          ${(a.missing || []).length
    ? a.missing.map((m) => `<div class="issue-item warn">${icon('alert', 16)}
            <div><b>${esc(m.type)}</b><span>${esc(m.detail)}</span></div></div>`).join('')
    : '<div class="t-sm muted">暂未发现明显漏项。</div>'}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><div><h2>客户解释建议</h2></div></div>
        <div class="panel-body">
          <div class="t-sm" style="line-height:1.8;color:var(--text-2)">${esc(a.client_explain || '')}</div>
          <div class="t-sm b" style="margin:14px 0 8px">优化建议</div>
          ${(a.suggestions || []).map((s) => `<div class="assumption-item">${esc(s)}</div>`).join('')}
        </div>
      </div>
    </div>`;
  }

  box.innerHTML = html;
}
