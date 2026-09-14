/**
 * 客户管理
 */
import { api, icon, esc, fmt, toast, emptyState, loadingRow, modal, confirmBox } from '../core.js';

let list = [];
let kw = '';
let status = 'all';

const STATUS = {
  following: ['跟进中', 'badge-brand'], quoted: ['已报价', 'badge-info'],
  won: ['已成交', 'badge-success'], lost: ['已流失', 'badge-danger'],
};
const SOURCES = ['到店', '线上咨询', '朋友介绍', '老客户推荐', '小区扫楼', '异业合作', '其他'];

export async function render(el, ctx) {
  ctx.setTitle('客户管理', '客户档案、跟进状态与关联报价');
  ctx.setActions(`<button class="btn btn-primary" id="csAdd">${icon('plus', 15)} 新增客户</button>`);
  el.innerHTML = loadingRow('正在读取客户…');
  ctx.bind('#csAdd', 'onclick', () => editModal(null, () => load(el)));
  await load(el);
}

async function load(el) {
  try {
    const qs = new URLSearchParams({ keyword: kw, status }).toString();
    const r = await api.get('/customers?' + qs);
    list = r.items || [];
    draw(el);
  } catch (e) {
    el.innerHTML = emptyState('alert', '加载失败', e.message);
  }
}

function draw(el) {
  el.innerHTML = `<div class="panel">
    <div class="toolbar">
      <input class="input search" id="csKw" placeholder="搜索姓名 / 电话 / 小区" value="${esc(kw)}">
      <select class="select" id="csStatus">
        <option value="all">全部状态</option>
        ${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${status === k ? 'selected' : ''}>${v[0]}</option>`).join('')}
      </select>
      <div class="toolbar-right"><span class="t-sm muted">共 ${list.length} 位客户</span></div>
    </div>
    <div class="table-wrap">${tableHtml()}</div>
  </div>`;

  const inp = el.querySelector('#csKw');
  let t;
  inp.oninput = () => { clearTimeout(t); t = setTimeout(() => { kw = inp.value.trim(); load(el); }, 320); };
  el.querySelector('#csStatus').onchange = (e) => { status = e.target.value; load(el); };

  el.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => {
    const c = list.find((x) => x.id === b.dataset.edit);
    editModal(c, () => load(el));
  });
  el.querySelectorAll('[data-quotes]').forEach((b) => b.onclick = () => quotesModal(b.dataset.quotes, b.dataset.name));
  el.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    const ok = await confirmBox('删除客户', '删除后该客户的报价不会被删除，但会解除关联。确定删除吗？', true);
    if (!ok) return;
    try { await api.del(`/customers/${b.dataset.del}`); toast('已删除', 'success'); load(el); }
    catch (e) { toast(e.message, 'error'); }
  });
}

function tableHtml() {
  if (!list.length) {
    return emptyState('users', '还没有客户', '把正在跟进的客户记下来，关联的报价会自动汇总在这里',
      `<button class="btn btn-primary" id="emptyAdd">${icon('plus', 15)} 新增客户</button>`);
  }
  return `<table class="tbl">
    <thead><tr>
      <th>客户</th><th>小区 / 地址</th><th class="c">面积</th><th class="c">预算</th>
      <th class="c">来源</th><th class="c">状态</th><th class="r">报价数</th>
      <th class="r">累计金额</th><th class="c">最近报价</th><th class="c">操作</th>
    </tr></thead>
    <tbody>${list.map((c) => {
    const st = STATUS[c.status] || [c.status, ''];
    return `<tr>
      <td><b>${esc(c.name)}</b><div class="t-xs muted">${esc(c.phone || '')}</div></td>
      <td>${esc(c.community || '—')}<div class="t-xs muted">${esc(c.layout || '')}</div></td>
      <td class="c num">${c.building_area || '—'}</td>
      <td class="c num">${c.budget ? '¥' + fmt.wan(c.budget) : '—'}</td>
      <td class="c"><span class="badge">${esc(c.source || '—')}</span></td>
      <td class="c"><span class="badge ${st[1]}">${st[0]}</span></td>
      <td class="r num">${c.quote_count || 0}</td>
      <td class="r num strong">¥${fmt.money(c.total_amount || 0, 0)}</td>
      <td class="c t-sm muted">${c.last_quote_at ? fmt.ago(c.last_quote_at) : '—'}</td>
      <td class="c"><div class="row gap8" style="justify-content:center">
        <button class="btn btn-ghost btn-sm" data-quotes="${c.id}" data-name="${esc(c.name)}" title="查看报价">${icon('file', 14)}</button>
        <button class="btn btn-ghost btn-sm" data-edit="${c.id}">${icon('edit', 14)}</button>
        <button class="btn btn-ghost btn-sm" data-del="${c.id}">${icon('trash', 14)}</button>
      </div></td>
    </tr>`;
  }).join('')}</tbody>
  </table>`;
}

function editModal(cust, reload) {
  const c = cust || {
    name: '', phone: '', community: '', address: '', building_area: '',
    layout: '', budget: '', source: '到店', status: 'following', remark: '',
  };
  modal({
    title: cust ? '编辑客户' : '新增客户',
    width: 560,
    body: `
      <div class="form-grid c2">
        <div class="field"><label class="field-label">客户姓名 *</label>
          <input class="input" id="cName" value="${esc(c.name)}"></div>
        <div class="field"><label class="field-label">联系电话</label>
          <input class="input" id="cPhone" value="${esc(c.phone)}"></div>
        <div class="field"><label class="field-label">小区 / 楼盘</label>
          <input class="input" id="cCommunity" value="${esc(c.community)}"></div>
        <div class="field"><label class="field-label">详细地址</label>
          <input class="input" id="cAddress" value="${esc(c.address || '')}"></div>
        <div class="field"><label class="field-label">建筑面积 m²</label>
          <input class="input" id="cArea" type="number" value="${c.building_area || ''}"></div>
        <div class="field"><label class="field-label">户型</label>
          <input class="input" id="cLayout" value="${esc(c.layout || '')}"></div>
        <div class="field"><label class="field-label">预算（元）</label>
          <input class="input" id="cBudget" type="number" value="${c.budget || ''}"></div>
        <div class="field"><label class="field-label">来源</label>
          <select class="select" id="cSource">
            ${SOURCES.map((s) => `<option ${s === c.source ? 'selected' : ''}>${s}</option>`).join('')}
          </select></div>
        <div class="field"><label class="field-label">状态</label>
          <select class="select" id="cStatus">
            ${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${k === c.status ? 'selected' : ''}>${v[0]}</option>`).join('')}
          </select></div>
      </div>
      <div class="field mt12"><label class="field-label">跟进备注</label>
        <textarea class="textarea" id="cRemark">${esc(c.remark || '')}</textarea></div>`,
    footer: `<button class="btn btn-secondary" data-close>取消</button>
      <button class="btn btn-primary" id="cSave">保存</button>`,
    onMount(m, close) {
      m.querySelector('#cSave').onclick = async () => {
        const body = {
          name: m.querySelector('#cName').value.trim(),
          phone: m.querySelector('#cPhone').value.trim(),
          community: m.querySelector('#cCommunity').value.trim(),
          address: m.querySelector('#cAddress').value.trim(),
          building_area: Number(m.querySelector('#cArea').value) || 0,
          layout: m.querySelector('#cLayout').value.trim(),
          budget: Number(m.querySelector('#cBudget').value) || 0,
          source: m.querySelector('#cSource').value,
          status: m.querySelector('#cStatus').value,
          remark: m.querySelector('#cRemark').value,
        };
        if (!body.name) return toast('请填写客户姓名', 'error');
        try {
          if (cust) await api.put(`/customers/${cust.id}`, body);
          else await api.post('/customers', body);
          close(); toast('已保存', 'success'); reload();
        } catch (e) { toast(e.message, 'error'); }
      };
    },
  });
}

async function quotesModal(id, name) {
  let qs = [];
  try { qs = await api.get(`/customers/${id}/quotes`); } catch (e) { /* ignore */ }
  modal({
    title: `${name} 的报价记录`,
    width: 720,
    body: qs.length ? `<table class="tbl">
      <thead><tr><th>单号</th><th>项目</th><th class="r">金额</th><th class="c">状态</th><th class="c">时间</th><th></th></tr></thead>
      <tbody>${qs.map((q) => `<tr>
        <td class="num t-sm muted">${esc(q.quote_number)}</td>
        <td>${esc(q.title || '')}</td>
        <td class="r num">¥${fmt.money(q.grand_total || q.total_amount || 0, 0)}</td>
        <td class="c"><span class="badge">${esc(q.status)}</span></td>
        <td class="c t-sm muted">${fmt.date(q.created_at)}</td>
        <td class="c"><a class="btn btn-ghost btn-sm" href="#/app/editor/${q.id}">${icon('chevronRight', 14)}</a></td>
      </tr>`).join('')}</tbody></table>`
      : '<p class="t-sm dim">该客户还没有报价记录。</p>',
    footer: `<button class="btn btn-primary" data-close>关闭</button>`,
  });
}
