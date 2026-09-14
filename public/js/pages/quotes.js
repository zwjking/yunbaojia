/**
 * 报价管理 · 列表
 */
import { api, icon, esc, fmt, toast, emptyState, loadingRow, confirmBox, exportCSV, printQuote, modal } from '../core.js';
import { STATUS_MAP } from './dashboard.js';

let state = { keyword: '', status: 'all', range: 'all', list: [] };

export async function render(el, ctx) {
  ctx.setTitle('报价管理', '创建、编辑与跟踪所有报价');
  ctx.setActions(`
    <button class="btn btn-secondary" id="btnRefresh">${icon('refresh', 15)} 刷新</button>
    <button class="btn btn-primary" id="btnNew">${icon('plus', 15)} 新建报价</button>
  `);
  el.innerHTML = loadingRow('正在读取报价列表…');

  ctx.bind('#btnNew', 'onclick', () => newQuoteModal(el, ctx));
  ctx.bind('#btnRefresh', 'onclick', () => load(el, ctx));

  await load(el, ctx);
}

async function load(el, ctx) {
  try {
    const qs = new URLSearchParams({ status: state.status, range: state.range, keyword: state.keyword }).toString();
    const r = await api.get('/quotes?' + qs);
    state.list = r.items || [];
    el.innerHTML = shell(r.stats || {});
    bind(el, ctx);
  } catch (e) {
    el.innerHTML = emptyState('alert', '加载失败', e.message);
  }
}

function shell(stats) {
  return `
    <div class="grid c4" style="margin-bottom:16px">
      <div class="stat-card"><div class="stat-card-top"><span class="stat-label">全部报价</span>
        <span class="stat-icon">${icon('file', 16)}</span></div>
        <div class="stat-value">${stats.total || 0}</div></div>
      <div class="stat-card"><div class="stat-card-top"><span class="stat-label">草稿</span>
        <span class="stat-icon amber">${icon('edit', 16)}</span></div>
        <div class="stat-value">${stats.draft || 0}</div></div>
      <div class="stat-card"><div class="stat-card-top"><span class="stat-label">已签发</span>
        <span class="stat-icon violet">${icon('share', 16)}</span></div>
        <div class="stat-value">${stats.issued || 0}</div></div>
      <div class="stat-card"><div class="stat-card-top"><span class="stat-label">已成交</span>
        <span class="stat-icon green">${icon('award', 16)}</span></div>
        <div class="stat-value">${stats.won || 0}</div>
        <div class="stat-hint">赢单率 ${stats.win_rate || 0}%</div></div>
    </div>

    <div class="panel">
      <div class="toolbar">
        <input class="input search" id="qKeyword" placeholder="搜索单号 / 项目 / 客户 / 小区" value="${esc(state.keyword)}">
        <select class="select" id="qStatus">
          ${['all', 'draft', 'pending_approval', 'approved', 'final', 'issued', 'won', 'lost', 'paused']
    .map((s) => `<option value="${s}" ${state.status === s ? 'selected' : ''}>${s === 'all' ? '全部状态' : (STATUS_MAP[s] || [s])[0]}</option>`).join('')}
        </select>
        <select class="select" id="qRange">
          ${[['all', '全部时间'], ['month', '本月'], ['quarter', '本季'], ['year', '本年']]
    .map(([v, t]) => `<option value="${v}" ${state.range === v ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
        <div class="toolbar-right">
          <button class="btn btn-secondary btn-sm" id="btnExportAll">${icon('download', 14)} 导出清单</button>
        </div>
      </div>
      <div class="table-wrap" id="qTable"></div>
    </div>
  `;
}

function bind(el, ctx) {
  const table = el.querySelector('#qTable');
  const drawTable = () => {
    if (!state.list.length) {
      table.innerHTML = emptyState('file', '没有符合条件的报价', '换个筛选条件，或直接新建一张报价',
        `<button class="btn btn-primary" id="emptyNew">${icon('plus', 15)} 新建报价</button>`);
      const b = table.querySelector('#emptyNew');
      if (b) b.onclick = () => newQuoteModal(el, ctx);
      return;
    }
    table.innerHTML = `<table class="tbl">
      <thead><tr>
        <th>单号</th><th>项目</th><th>客户</th><th class="c">面积</th>
        <th class="r">金额</th><th class="r">毛利</th><th class="c">状态</th>
        <th class="c">更新</th><th class="c">操作</th>
      </tr></thead>
      <tbody>${state.list.map(rowHtml).join('')}</tbody>
    </table>`;

    table.querySelectorAll('[data-act]').forEach((btn) => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const id = btn.closest('tr').dataset.id;
        const act = btn.dataset.act;
        await onAction(act, id, el, ctx);
      };
    });
  };
  drawTable();

  const kw = el.querySelector('#qKeyword');
  let t;
  kw.oninput = () => {
    clearTimeout(t);
    t = setTimeout(() => { state.keyword = kw.value.trim(); load(el, ctx); }, 350);
  };
  el.querySelector('#qStatus').onchange = (e) => { state.status = e.target.value; load(el, ctx); };
  el.querySelector('#qRange').onchange = (e) => { state.range = e.target.value; load(el, ctx); };

  el.querySelector('#btnExportAll').onclick = () => {
    if (!state.list.length) return toast('没有可导出的数据', 'error');
    exportCSV(`报价清单_${new Date().toISOString().slice(0, 10)}.csv`,
      ['单号', '项目', '客户', '小区', '城市', '面积', '户型', '档次', '金额', '成本', '毛利率', '状态', '创建时间'],
      state.list.map((q) => [
        q.quote_number, q.title, q.customer_name || '', q.community || '', q.city || '',
        q.building_area || '', q.layout || '', q.tier || '',
        (q.grand_total || q.total_amount || 0).toFixed(2), (q.cost_amount || 0).toFixed(2),
        (q.margin_rate || 0) + '%', (STATUS_MAP[q.status] || [q.status])[0], fmt.date(q.created_at),
      ]));
    toast('已导出 CSV', 'success');
  };
}

function rowHtml(q) {
  const st = STATUS_MAP[q.status] || [q.status, ''];
  const mg = Number(q.margin_rate) || 0;
  return `<tr data-id="${q.id}">
    <td class="num t-sm muted">${esc(q.quote_number)}</td>
    <td><a href="#/app/editor/${q.id}" class="strong">${esc(q.title || '未命名')}</a>
      <div class="t-xs muted">${esc(q.layout || '')} · ${esc(q.tier || '')} · ${esc(q.house_type || '')}</div></td>
    <td>${esc(q.customer_name || '—')}<div class="t-xs muted">${esc(q.community || '')}</div></td>
    <td class="c num">${q.building_area || '—'}</td>
    <td class="r num strong">¥${fmt.money(q.grand_total || q.total_amount || 0, 0)}</td>
    <td class="r num ${mg < 15 ? 'muted' : ''}">${mg}%</td>
    <td class="c"><span class="badge ${st[1]}">${st[0]}</span></td>
    <td class="c t-sm muted">${fmt.ago(q.updated_at || q.created_at)}</td>
    <td class="c">
      <div class="row gap8" style="justify-content:center">
        <button class="btn btn-ghost btn-sm" data-act="edit" title="编辑">${icon('edit', 14)}</button>
        <button class="btn btn-ghost btn-sm" data-act="copy" title="复制">${icon('copy', 14)}</button>
        <button class="btn btn-ghost btn-sm" data-act="print" title="打印/导出PDF">${icon('download', 14)}</button>
        <button class="btn btn-ghost btn-sm" data-act="del" title="删除">${icon('trash', 14)}</button>
      </div>
    </td>
  </tr>`;
}

async function onAction(act, id, el, ctx) {
  if (act === 'edit') { location.hash = `#/app/editor/${id}`; return; }

  if (act === 'copy') {
    try {
      const r = await api.post(`/quotes/${id}/duplicate`, {});
      toast(`已复制为「${r.title}」`, 'success');
      load(el, ctx);
    } catch (e) { toast(e.message, 'error'); }
    return;
  }

  if (act === 'del') {
    const ok = await confirmBox('删除报价', '删除后不可恢复，确定要删除这张报价吗？', true);
    if (!ok) return;
    try {
      await api.del(`/quotes/${id}`);
      toast('已删除', 'success');
      load(el, ctx);
    } catch (e) { toast(e.message, 'error'); }
    return;
  }

  if (act === 'print') {
    try {
      const q = await api.get(`/quotes/${id}`);
      const org = await api.get('/org/profile').catch(() => ({}));
      printQuote(q, q.items || [], org);
    } catch (e) { toast(e.message, 'error'); }
  }
}

function newQuoteModal(el, ctx) {
  modal({
    title: '新建报价',
    width: 520,
    body: `
      <div class="form-grid">
        <div class="field">
          <label class="field-label">项目名称</label>
          <input class="input" id="nqTitle" placeholder="如：华润·幸福里 108㎡ 装修报价">
        </div>
        <div class="form-grid c2">
          <div class="field"><label class="field-label">客户姓名</label>
            <input class="input" id="nqCustomer" placeholder="选填"></div>
          <div class="field"><label class="field-label">联系电话</label>
            <input class="input" id="nqPhone" placeholder="选填"></div>
        </div>
        <div class="form-grid c2">
          <div class="field"><label class="field-label">城市</label>
            <input class="input" id="nqCity" placeholder="如：合肥"></div>
          <div class="field"><label class="field-label">建筑面积（m²）</label>
            <input class="input" id="nqArea" type="number" placeholder="如：108"></div>
        </div>
        <div class="form-grid c2">
          <div class="field"><label class="field-label">户型</label>
            <select class="select" id="nqLayout">
              ${['一室一厅一卫', '两室一厅一卫', '两室两厅一卫', '三室两厅一卫', '三室两厅两卫', '四室两厅两卫', '复式', '别墅']
    .map((x) => `<option>${x}</option>`).join('')}
            </select></div>
          <div class="field"><label class="field-label">装修档次</label>
            <select class="select" id="nqTier">
              ${['简装', '中档', '高档', '定制'].map((x) => `<option ${x === '中档' ? 'selected' : ''}>${x}</option>`).join('')}
            </select></div>
        </div>
      </div>
      <p class="t-xs muted" style="margin-top:14px">
        提示：新建后可进入编辑器手工添加明细，也可以到「智能造价」让 AI 自动生成完整草稿。
      </p>`,
    footer: `<button class="btn btn-secondary" data-close>取消</button>
      <button class="btn btn-primary" id="nqOk">创建并编辑</button>`,
    onMount(m, close) {
      m.querySelector('#nqOk').onclick = async () => {
        const body = {
          title: m.querySelector('#nqTitle').value.trim() || '未命名报价',
          customer_name: m.querySelector('#nqCustomer').value.trim(),
          customer_phone: m.querySelector('#nqPhone').value.trim(),
          city: m.querySelector('#nqCity').value.trim(),
          building_area: Number(m.querySelector('#nqArea').value) || 0,
          layout: m.querySelector('#nqLayout').value,
          tier: m.querySelector('#nqTier').value,
        };
        try {
          const q = await api.post('/quotes', body);
          close();
          toast('已创建，进入编辑器', 'success');
          location.hash = `#/app/editor/${q.id}`;
        } catch (e) { toast(e.message, 'error'); }
      };
    },
  });
}
