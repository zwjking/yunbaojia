/**
 * 报价编辑器
 */
import {
  api, icon, esc, fmt, toast, emptyState, loadingRow, confirmBox,
  exportCSV, exportExcel, printQuote, modal, createClientLink, buildClientQuoteText,
  downloadQuoteImage,
} from '../core.js';
import { STATUS_MAP } from './dashboard.js';

let quote = null;
let items = [];
let libCache = [];
let dirty = false;

export async function render(el, ctx) {
  const id = ctx.arg;
  if (!id) {
    el.innerHTML = emptyState('alert', '缺少报价 ID', '请从报价列表进入编辑器');
    return;
  }
  el.innerHTML = loadingRow('正在读取报价…');

  try {
    const [q, lib] = await Promise.all([
      api.get(`/quotes/${id}`),
      api.get('/price-library').catch(() => ({ items: [] })),
    ]);
    quote = q;
    items = (q.items || []).map((i) => ({ ...i }));
    libCache = lib.items || [];
  } catch (e) {
    el.innerHTML = emptyState('alert', '加载失败', e.message);
    return;
  }

  draw(el, ctx);
}

function groupsOf() {
  const map = {};
  items.forEach((it) => {
    const g = it.group_name || '未分类';
    (map[g] = map[g] || []).push(it);
  });
  return map;
}

function calc() {
  const subtotal = items.reduce((s, i) => s + (Number(i.unit_price) || 0) * (Number(i.qty) || 0), 0);
  const cost = items.reduce((s, i) => s + (Number(i.cost_price) || 0) * (Number(i.qty) || 0), 0);
  const manage = Number(quote.manage_fee) || 0;
  const tax = Number(quote.tax_rate) || 0;
  const total = subtotal + manage;
  const grand = total * (1 + tax / 100);
  return { subtotal, cost, manage, tax, total, grand, margin: grand ? (grand - cost) / grand * 100 : 0 };
}

function draw(el, ctx) {
  ctx.setTitle(quote.title || '报价编辑', `${quote.quote_number} · ${(STATUS_MAP[quote.status] || [quote.status])[0]}`);
  ctx.setActions(`
    <button class="btn btn-secondary" id="edBack">${icon('arrowLeft', 15)} 返回列表</button>
    <button class="btn btn-secondary" id="edShare">${icon('share', 15)} 分享给客户</button>
    <button class="btn btn-secondary" id="edExcel">${icon('file', 15)} 导出 Excel</button>
    <button class="btn btn-secondary" id="edPrint">${icon('download', 15)} 打印 / PDF</button>
    <button class="btn btn-primary" id="edSave">${icon('save', 15)} 保存</button>
  `);
  const c = calc();
  el.innerHTML = `
    <div class="grid c32">
      <div>
        ${basicCard()}
      </div>
      <div>
        <div class="panel" style="margin-bottom:16px">
          <div class="panel-head"><div><h2>金额汇总</h2></div></div>
          <div class="panel-body">
            <div class="row between" style="margin-bottom:9px"><span class="dim">工程小计</span><b class="num">¥ ${fmt.money(c.subtotal)}</b></div>
            <div class="row between" style="margin-bottom:9px"><span class="dim">成本合计</span><b class="num">¥ ${fmt.money(c.cost)}</b></div>
            <div class="row between" style="margin-bottom:9px"><span class="dim">管理费</span><b class="num">¥ ${fmt.money(c.manage)}</b></div>
            <div class="row between" style="margin-bottom:9px"><span class="dim">税率</span><b class="num">${c.tax}%</b></div>
            <div style="border-top:1px solid var(--border);margin:12px 0;padding-top:12px" class="row between">
              <span class="b">合计</span><b class="num" style="font-size:20px;color:var(--brand)">¥ ${fmt.money(c.grand)}</b>
            </div>
            <div class="row between" style="margin-bottom:6px">
              <span class="dim t-sm">毛利率</span><b class="num ${c.margin < 15 ? '' : ''}">${c.margin.toFixed(1)}%</b>
            </div>
            <div class="bar ${c.margin < 15 ? 'red' : c.margin > 45 ? 'amber' : 'green'}"><i style="width:${Math.min(100, c.margin)}%"></i></div>
            <div class="t-xs muted mt8">${c.margin < 15 ? '毛利偏低，注意利润空间' : c.margin > 45 ? '毛利偏高，留意客户议价' : '毛利在合理区间'}</div>
            ${quote.building_area ? `<div class="row between mt16" style="padding-top:12px;border-top:1px solid var(--border)">
              <span class="dim t-sm">单方造价</span><b class="num">${Math.round(c.grand / quote.building_area)} 元/m²</b></div>` : ''}
          </div>
        </div>

        ${statusCard()}
      </div>
    </div>

    <div class="panel" style="margin-top:16px">
      <div class="panel-head">
        <div><h2>报价明细</h2><p class="panel-note">共 ${items.length} 条 · 按工程分类组织，可直接修改数量与单价</p></div>
        <div class="panel-actions">
          <button class="btn btn-secondary btn-sm" id="edAddLib">${icon('book', 14)} 从工艺库添加</button>
          <button class="btn btn-secondary btn-sm" id="edAiAdd">${icon('sparkles', 14)} AI 识别加项</button>
          <button class="btn btn-primary btn-sm" id="edAddRow">${icon('plus', 14)} 新增空白项</button>
        </div>
      </div>
      <div class="toolbar">
        <input class="input search" id="edFilter" placeholder="筛选明细（项目名称 / 工艺说明）">
        <div class="toolbar-right">
          <button class="btn btn-secondary btn-sm" id="edCsv">${icon('download', 14)} 导出明细 CSV</button>
        </div>
      </div>
      <div style="overflow-x:auto;max-height:620px;overflow-y:auto" id="edTable"></div>
      <div class="editor-summary">
        <div class="item"><span>明细条数</span><b id="sumCount">${items.length}</b></div>
        <div class="item"><span>工程小计</span><b>¥ <span id="sumSub">${fmt.money(c.subtotal)}</span></b></div>
        <div class="item"><span>成本合计</span><b>¥ <span id="sumCost">${fmt.money(c.cost)}</span></b></div>
        <div class="item total"><span>合计（含管理费与税）</span><b>¥ <span id="sumGrand">${fmt.money(c.grand)}</span></b></div>
        <div style="margin-left:auto">
          <button class="btn btn-primary" id="edSave2">${icon('save', 15)} 保存修改</button>
        </div>
      </div>
    </div>
  `;

  drawTable(el);
  bindEditor(el, ctx);
}

function basicCard() {
  return `<div class="panel" style="margin-bottom:16px">
    <div class="panel-head"><div><h2>基本信息</h2></div>
      <div class="panel-actions"><span class="badge ${(STATUS_MAP[quote.status] || ['', ''])[1]}">${(STATUS_MAP[quote.status] || [quote.status])[0]}</span></div>
    </div>
    <div class="panel-body">
      <div class="form-grid">
        <div class="field"><label class="field-label">项目名称</label>
          <input class="input" id="fTitle" value="${esc(quote.title || '')}"></div>
        <div class="form-grid c2">
          <div class="field"><label class="field-label">客户姓名</label>
            <input class="input" id="fCustomer" value="${esc(quote.customer_name || '')}"></div>
          <div class="field"><label class="field-label">联系电话</label>
            <input class="input" id="fPhone" value="${esc(quote.customer_phone || '')}"></div>
        </div>
        <div class="form-grid c2">
          <div class="field"><label class="field-label">小区 / 地址</label>
            <input class="input" id="fCommunity" value="${esc(quote.community || '')}"></div>
          <div class="field"><label class="field-label">城市</label>
            <input class="input" id="fCity" value="${esc(quote.city || '')}"></div>
        </div>
        <div class="form-grid c3">
          <div class="field"><label class="field-label">建筑面积 m²</label>
            <input class="input" id="fArea" type="number" value="${quote.building_area || ''}"></div>
          <div class="field"><label class="field-label">户型</label>
            <input class="input" id="fLayout" value="${esc(quote.layout || '')}"></div>
          <div class="field"><label class="field-label">档次</label>
            <select class="select" id="fTier">
              ${['简装', '中档', '高档', '定制'].map((x) => `<option ${x === quote.tier ? 'selected' : ''}>${x}</option>`).join('')}
            </select></div>
        </div>
        <div class="form-grid c3">
          <div class="field"><label class="field-label">管理费（元）</label>
            <input class="input" id="fManage" type="number" value="${quote.manage_fee || 0}"></div>
          <div class="field"><label class="field-label">税率（%）</label>
            <input class="input" id="fTax" type="number" value="${quote.tax_rate || 0}"></div>
          <div class="field"><label class="field-label">房屋类型</label>
            <select class="select" id="fHouseType">
              ${['新房', '老房', '二手房翻新', '别墅'].map((x) => `<option ${x === quote.house_type ? 'selected' : ''}>${x}</option>`).join('')}
            </select></div>
        </div>
        <div class="field"><label class="field-label">备注（会显示在客户报价页）</label>
          <textarea class="textarea" id="fNotes">${esc(quote.notes || '')}</textarea></div>
      </div>
    </div>
  </div>`;
}

function statusCard() {
  const flow = [
    ['submit', '提交审批', 'secondary'], ['approve', '审批通过', 'secondary'],
    ['finalize', '定稿', 'secondary'], ['issue', '签发给客户', 'primary'],
    ['win', '标记成交', 'primary'], ['lose', '标记未成交', 'secondary'],
    ['pause', '暂停跟进', 'secondary'],
  ];
  return `<div class="panel">
    <div class="panel-head"><div><h2>状态流转</h2><p class="panel-note">当前：${(STATUS_MAP[quote.status] || [quote.status])[0]}</p></div></div>
    <div class="panel-body">
      <div class="row wrap gap8">
        ${flow.map(([a, t, cls]) => `<button class="btn btn-${cls} btn-sm" data-flow="${a}">${t}</button>`).join('')}
      </div>
      <div class="t-xs muted mt12">已结案（成交 / 未成交）后不可再编辑，如需修改请先走变更单。</div>
    </div>
  </div>`;
}

function drawTable(el, filter = '') {
  const box = el.querySelector('#edTable');
  const groups = groupsOf();
  const kw = filter.toLowerCase();
  let html = '';
  for (const [g, list] of Object.entries(groups)) {
    const shown = list.filter((i) => !kw || (i.name || '').toLowerCase().includes(kw) || (i.craft || '').toLowerCase().includes(kw));
    if (kw && !shown.length) continue;
    const sub = list.reduce((s, i) => s + (Number(i.unit_price) || 0) * (Number(i.qty) || 0), 0);
    html += `<table class="editor-table"><tbody>
      <tr class="group-row"><td colspan="7">${esc(g)}
        <span class="g-amount">¥${fmt.money(sub)}</span></td></tr>
      <tr>
        <th style="width:26%">项目名称</th><th style="width:8%">单位</th>
        <th style="width:10%">数量</th><th style="width:12%">单价</th>
        <th style="width:12%">成本</th><th style="width:14%">小计</th><th style="width:6%"></th>
      </tr>
      ${shown.map((i) => `<tr data-id="${i.id}">
        <td data-label="项目"><input value="${esc(i.name)}" data-f="name" title="${esc(i.craft || '')}"></td>
        <td data-label="单位"><input value="${esc(i.unit)}" data-f="unit" style="text-align:center"></td>
        <td data-label="数量"><input class="r" type="number" step="0.01" value="${i.qty}" data-f="qty"></td>
        <td data-label="单价"><input class="r" type="number" step="0.01" value="${i.unit_price}" data-f="unit_price"></td>
        <td data-label="成本"><input class="r" type="number" step="0.01" value="${i.cost_price}" data-f="cost_price"></td>
        <td data-label="小计" style="text-align:right;padding-right:12px;font-family:var(--font-num);color:var(--text-2)">¥${fmt.money(i.unit_price * i.qty)}</td>
        <td data-label="操作" style="text-align:center"><button class="btn btn-ghost btn-sm" data-del="${i.id}">${icon('trash', 14)}</button></td>
      </tr>`).join('')}
    </tbody></table>`;
  }
  box.innerHTML = html || emptyState('file', '没有明细', '从工艺库添加项目，或让 AI 自动生成');

  box.querySelectorAll('input[data-f]').forEach((inp) => {
    inp.oninput = () => {
      const tr = inp.closest('tr');
      const it = items.find((x) => x.id === tr.dataset.id);
      if (!it) return;
      const f = inp.dataset.f;
      it[f] = ['qty', 'unit_price', 'cost_price'].includes(f) ? Number(inp.value) || 0 : inp.value;
      dirty = true;
      // 更新小计
      const cells = tr.children;
      cells[5].textContent = '¥' + fmt.money(it.unit_price * it.qty);
      updateSummary(el);
    };
  });

  box.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.del;
      items = items.filter((x) => x.id !== id);
      dirty = true;
      drawTable(el, el.querySelector('#edFilter').value.trim());
    };
  });
}

function updateSummary(el) {
  const c = calc();
  el.querySelector('#sumCount').textContent = items.length;
  el.querySelector('#sumSub').textContent = fmt.money(c.subtotal);
  el.querySelector('#sumCost').textContent = fmt.money(c.cost);
  el.querySelector('#sumGrand').textContent = fmt.money(c.grand);
}

async function saveAll(el, silent = false) {
  const patch = {
    title: el.querySelector('#fTitle').value.trim(),
    customer_name: el.querySelector('#fCustomer').value.trim(),
    customer_phone: el.querySelector('#fPhone').value.trim(),
    community: el.querySelector('#fCommunity').value.trim(),
    city: el.querySelector('#fCity').value.trim(),
    building_area: Number(el.querySelector('#fArea').value) || 0,
    layout: el.querySelector('#fLayout').value.trim(),
    tier: el.querySelector('#fTier').value,
    manage_fee: Number(el.querySelector('#fManage').value) || 0,
    tax_rate: Number(el.querySelector('#fTax').value) || 0,
    house_type: el.querySelector('#fHouseType').value,
    notes: el.querySelector('#fNotes').value,
  };

  try {
    const q = await api.put(`/quotes/${quote.id}`, patch);
    await api.post(`/quotes/${quote.id}/items/batch`, { items, replace: true });
    const fresh = await api.get(`/quotes/${quote.id}`);
    quote = fresh;
    items = (fresh.items || []).map((i) => ({ ...i }));
    dirty = false;
    if (!silent) toast('已保存', 'success');
    return true;
  } catch (e) {
    toast(e.message, 'error');
    return false;
  }
}

function bindEditor(el, ctx) {
  ctx.bind('#edBack', 'onclick', () => { location.hash = '#/app/quotes'; });
  ctx.bind('#edSave', 'onclick', async () => {
    if (await saveAll(el)) { draw(el, ctx); }
  });
  el.querySelector('#edSave2').onclick = async () => { if (await saveAll(el)) { draw(el, ctx); } };

  el.querySelector('#edFilter').oninput = (e) => drawTable(el, e.target.value.trim());

  el.querySelector('#edCsv').onclick = () => {
    exportCSV(`${quote.quote_number}_明细.csv`,
      ['分类', '项目', '单位', '数量', '单价', '成本', '小计', '工艺说明'],
      items.map((i) => [i.group_name, i.name, i.unit, i.qty, i.unit_price, i.cost_price,
        (i.unit_price * i.qty).toFixed(2), i.craft || '']));
    toast('已导出明细 CSV', 'success');
  };

  ctx.bind('#edPrint', 'onclick', async () => {
    const org = await api.get('/org/profile').catch(() => ({}));
    printQuote(quote, items, org);
  });

  ctx.bind('#edShare', 'onclick', async () => {
    const org = await api.get('/org/profile').catch(() => ({}));
    clientLinkModal(quote, items, org);
  });

  ctx.bind('#edExcel', 'onclick', async () => {
    const org = await api.get('/org/profile').catch(() => ({}));
    await exportExcel(quote, items, org);
  });

  el.querySelector('#edAddRow').onclick = () => {
    items.push({
      id: 'tmp_' + Math.random().toString(36).slice(2),
      group_name: '未分类', name: '新项目', unit: '项', qty: 1, unit_price: 0, cost_price: 0, craft: '', remark: '',
    });
    dirty = true;
    drawTable(el, el.querySelector('#edFilter').value.trim());
  };

  el.querySelector('#edAddLib').onclick = () => addFromLibrary(el);
  el.querySelector('#edAiAdd').onclick = () => aiAddItems(el);

  el.querySelectorAll('[data-flow]').forEach((b) => {
    b.onclick = async () => {
      const act = b.dataset.flow;
      if (['issue', 'win'].includes(act)) {
        const ok = await confirmBox('确认操作', `确定要「${b.textContent}」吗？`);
        if (!ok) return;
      }
      await saveAll(el, true);
      try {
        const r = await api.post(`/quotes/${quote.id}/${act}`, {});
        quote = r;
        toast(`已更新为「${(STATUS_MAP[r.status] || [r.status])[0]}」`, 'success');
        draw(el, ctx);
      } catch (e) { toast(e.message, 'error'); }
    };
  });
}

function safeName(s) {
  return String(s || '').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
}

/**
 * 生成客户链接：
 * 把整份报价做成一份自包含的报价网页，上传到云端换取公网链接 —— 客户手机或电脑
 * 打开就是一个完整报价页，不需要登录、不需要安装任何东西。上传失败时自动退化为长图。
 * 链接是报价内容的快照，改动后点「重新生成」即可同步。
 */
function clientLinkModal(q, list, org) {
  const cacheKey = `hq_client_link_${q.id}`;
  const readCache = () => {
    try { return JSON.parse(localStorage.getItem(cacheKey) || 'null'); } catch (e) { return null; }
  };
  const writeCache = (v) => {
    try { localStorage.setItem(cacheKey, JSON.stringify(v)); } catch (e) { /* 忽略 */ }
  };

  modal({
    title: '生成客户链接',
    width: 600,
    body: `<div id="clBody">
      <div style="text-align:center;padding:40px 0">
        <div class="spinner dark" style="width:22px;height:22px;margin:0 auto"></div>
        <div class="t-sm muted mt12">正在生成客户报价页…</div>
      </div>
    </div>`,
    footer: `<button class="btn btn-secondary" data-close>关闭</button>`,
    onMount(m, close) {
      const box = m.querySelector('#clBody');

      const okHtml = (res, at) => {
        const url = res.url || '';
        const isImg = res.kind === 'image';
        const isLocal = res.kind === 'local';
        const isWeb = res.kind === 'html';
        const badge = (bg, fg, txt) => `<span style="display:inline-block;background:${bg};color:${fg};border-radius:6px;padding:3px 9px;font-size:11.5px;font-weight:600">${txt}</span>`;
        const headTag = isLocal
          ? badge('#fef3c7', '#b45309', '暂未拿到链接') + '<span class="t-xs muted">可直接保存长图发给客户</span>'
          : isWeb
            ? badge('#dcfce7', '#15803d', '客户报价页已生成') + '<span class="t-xs muted">网页版，客户手机打开即看，无需登录</span>'
            : badge('#dcfce7', '#15803d', '客户链接已生成') + '<span class="t-xs muted">图片版，客户手机打开即可查看</span>';
        return `
        <div style="display:flex;align-items:center;gap:9px;margin-bottom:12px;flex-wrap:wrap">${headTag}</div>
        ${isLocal ? `<div style="padding:11px 13px;background:#fffbeb;border:1px solid #fde68a;border-radius:9px;color:#92400e;font-size:12.5px;line-height:1.7;margin-bottom:12px">${esc(res.reason || '')}</div>` : ''}
        ${url ? `<input class="input" id="clUrl" readonly value="${esc(url)}"
          style="width:100%;font-size:12.5px;font-family:Consolas,Menlo,monospace">` : ''}
        <div style="display:flex;gap:8px;margin-top:11px;flex-wrap:wrap">
          ${url ? `<button class="btn btn-primary btn-sm" id="clCopy">${icon('copy', 14)} 复制链接</button>
          <button class="btn btn-secondary btn-sm" id="clOpen">${icon('share', 14)} 打开预览</button>` : ''}
          ${res.image ? `<button class="btn ${url ? 'btn-secondary' : 'btn-primary'} btn-sm" id="clSave">${icon('download', 14)} 保存长图</button>` : ''}
          <button class="btn btn-secondary btn-sm" id="clRegen">${icon('refresh', 14)} 重新生成</button>
          <button class="btn btn-secondary btn-sm" id="clText">${icon('copy', 14)} 复制报价文本</button>
        </div>
        <div class="t-xs muted" style="margin-top:12px;line-height:1.7">
          ${isWeb
            ? `内容是一份<b>完整报价网页</b>（含 ${list.length} 项明细），手机浏览器、微信、电脑都能直接打开——可缩放可下拉，页面内自带「打印 / 保存 PDF」，客户想留档一键就能存。`
            : isLocal
              ? `内容是一份<b>报价长图</b>（含 ${list.length} 项明细），可直接保存后发图片给客户。`
              : `内容是一份<b>报价长图快照</b>（含 ${list.length} 项明细）${isImg ? '，客户在手机上长按图片即可保存或转发' : ''}。`}
          报价内容改动后，请点「重新生成」同步成最新版本。
          ${url ? '<br>发送前建议先点「打开预览」，确认客户打开能看到内容。' : ''}
          ${at ? `<br>本次生成：${esc(new Date(at).toLocaleString('zh-CN'))}` : ''}
        </div>`;
      };

      const errHtml = (msg) => `
        <div style="padding:14px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;color:#b91c1c;font-size:12.5px;line-height:1.7">
          <b>生成失败</b><br>${esc(msg)}
        </div>
        <div style="margin-top:12px"><button class="btn btn-primary btn-sm" id="clRetry">重试</button></div>`;

      const bindOk = (res) => {
        const url = res.url || '';
        const urlEl = box.querySelector('#clUrl');
        if (urlEl) urlEl.onclick = () => urlEl.select();

        const copyBtn = box.querySelector('#clCopy');
        if (copyBtn) {
          copyBtn.onclick = async () => {
            if (urlEl) urlEl.select();
            try {
              if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(url);
              } else {
                document.execCommand('copy');
              }
              toast('链接已复制，发给客户即可', 'success');
            } catch (e) {
              try { document.execCommand('copy'); toast('链接已复制，发给客户即可', 'success'); }
              catch (e2) { toast('复制失败，请手动选中复制', 'error'); }
            }
          };
        }

        const openBtn = box.querySelector('#clOpen');
        if (openBtn) openBtn.onclick = () => window.open(url, '_blank');

        box.querySelector('#clText').onclick = async () => {
          const txt = buildClientQuoteText(q, list, org);
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(txt);
            else throw new Error('no clipboard');
            toast('报价文本已复制，粘贴到微信即可', 'success');
          } catch (e) {
            const w = window.open('', '_blank');
            if (!w) { toast('复制失败，请允许弹出窗口', 'error'); return; }
            w.document.write(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>报价文本</title></head>
              <body style="margin:0"><div style="padding:12px;font-family:sans-serif;color:#334;font-size:13px">全选下方内容复制。</div>
              <pre style="margin:0;padding:12px 16px;font:13px/1.7 "Microsoft YaHei",sans-serif;white-space:pre-wrap;background:#f8fafc">${esc(txt)}</pre></body></html>`);
            w.document.close();
          }
        };

        const saveBtn = box.querySelector('#clSave');
        if (saveBtn) {
          saveBtn.onclick = () => downloadQuoteImage(q.quote_number || '报价单', res.image);
        }

        box.querySelector('#clRegen').onclick = () => generate(true);
      };

      const generate = async (force) => {
        if (!force) {
          const c = readCache();
          // 只认网页版缓存；旧的图片版缓存直接作废，重新生成升级为网页
          if (c && c.url && c.format === 'html') {
            const cached = { url: c.url, kind: c.kind || 'html', format: c.format || '' };
            box.innerHTML = okHtml(cached, c.at);
            bindOk(cached);
            return;
          }
        }
        box.innerHTML = `<div style="text-align:center;padding:40px 0">
          <div class="spinner dark" style="width:22px;height:22px;margin:0 auto"></div>
          <div class="t-sm muted mt12">正在生成客户报价页…</div>
        </div>`;
        try {
          const r = await createClientLink(q, list, org);
          if (r.url) writeCache({ url: r.url, kind: r.kind, format: r.format, at: Date.now() });
          box.innerHTML = okHtml(r, Date.now());
          bindOk(r);
        } catch (e) {
          box.innerHTML = errHtml(e.message || '未知错误');
          const rb = box.querySelector('#clRetry');
          if (rb) rb.onclick = () => generate(true);
        }
      };

      generate(false);
    },
  });
}

function addFromLibrary(el) {
  let kw = '';
  let group = 'all';
  modal({
    title: '从工艺库添加项目',
    width: 720,
    body: `
      <div class="row gap8" style="margin-bottom:12px">
        <input class="input" id="libKw" placeholder="搜索工艺名称，如：防水 / 乳胶漆 / 布线" style="flex:1">
        <select class="select" id="libGroup" style="width:150px"><option value="all">全部分类</option></select>
      </div>
      <div style="max-height:380px;overflow:auto;border:1px solid var(--border);border-radius:10px" id="libList"></div>
      <div class="t-xs muted mt8">勾选后点「添加到报价」，单价按工艺库基准价自动填入。</div>
    `,
    footer: `<button class="btn btn-secondary" data-close>取消</button>
      <button class="btn btn-primary" id="libOk">添加到报价</button>`,
    onMount: async (m, close) => {
      const selected = new Set();
      const listBox = m.querySelector('#libList');
      const gsel = m.querySelector('#libGroup');

      // 分类选项
      const gset = [...new Set(libCache.map((x) => x.group_name))];
      gsel.innerHTML += gset.map((g) => `<option value="${esc(g)}">${esc(g)}</option>`).join('');

      const drawList = () => {
        const list = libCache.filter((x) => {
          const okKw = !kw || x.name.toLowerCase().includes(kw.toLowerCase()) || (x.tags || []).some((t) => t.includes(kw));
          const okG = group === 'all' || x.group_name === group;
          return okKw && okG;
        }).slice(0, 100);
        listBox.innerHTML = list.length ? `<table class="tbl"><thead><tr>
          <th style="width:36px"></th><th>工艺名称</th><th class="c">单位</th><th class="r">基准价</th><th class="c">分类</th>
          </tr></thead><tbody>${list.map((x) => `<tr>
            <td class="c"><input type="checkbox" data-id="${x.id}" ${selected.has(x.id) ? 'checked' : ''}></td>
            <td><b>${esc(x.name)}</b><div class="t-xs muted">${esc((x.craft || '').slice(0, 40))}</div></td>
            <td class="c">${esc(x.unit)}</td><td class="r num">${fmt.money(x.price)}</td>
            <td class="c"><span class="badge">${esc(x.group_name)}</span></td>
          </tr>`).join('')}</tbody></table>` : emptyState('search', '没有匹配的工艺', '换个关键词试试');

        listBox.querySelectorAll('input[type=checkbox]').forEach((cb) => {
          cb.onchange = () => {
            if (cb.checked) selected.add(cb.dataset.id); else selected.delete(cb.dataset.id);
          };
        });
      };
      drawList();
      m.querySelector('#libKw').oninput = (e) => { kw = e.target.value.trim(); drawList(); };
      gsel.onchange = (e) => { group = e.target.value; drawList(); };

      m.querySelector('#libOk').onclick = () => {
        if (!selected.size) return toast('请先勾选要添加的项目', 'error');
        selected.forEach((id) => {
          const lib = libCache.find((x) => x.id === id);
          if (!lib) return;
          items.push({
            id: 'tmp_' + Math.random().toString(36).slice(2),
            group_name: lib.group_name, name: lib.name, unit: lib.unit,
            qty: 1, unit_price: lib.price, cost_price: lib.cost || 0,
            craft: lib.craft || '', remark: '',
          });
        });
        dirty = true;
        drawTable(el, el.querySelector('#edFilter').value.trim());
        close();
        toast(`已添加 ${selected.size} 个项目`, 'success');
      };
    },
  });
}

function aiAddItems(el) {
  modal({
    title: 'AI 识别加项',
    width: 560,
    body: `
      <div class="field">
        <label class="field-label">用一句话描述要加的项目</label>
        <textarea class="textarea" id="aiText" placeholder="例如：客厅墙面刷乳胶漆 35 平米，加踢脚线和成品门；厨卫做防水和贴砖"> </textarea>
        <div class="field-hint">AI 会从工艺库中匹配条目并估算工程量，消耗 5 积分（成功才扣）。</div>
      </div>
      <div class="field mt12"><label class="field-label">城市（用于价格校准）</label>
        <input class="input" id="aiCity" value="${esc(quote.city || '')}"></div>
      <div id="aiResult"></div>`,
    footer: `<button class="btn btn-secondary" data-close>取消</button>
      <button class="btn btn-primary" id="aiRun">${icon('sparkles', 15)} 开始识别（5 积分）</button>`,
    onMount(m, close) {
      m.querySelector('#aiRun').onclick = async () => {
        const text = m.querySelector('#aiText').value.trim();
        if (!text) return toast('请先描述要加的项目', 'error');
        const btn = m.querySelector('#aiRun');
        btn.disabled = true; btn.innerHTML = `<span class="spinner"></span>识别中`;
        try {
          const r = await api.post('/ai/nl-to-items', { text, city: m.querySelector('#aiCity').value.trim() });
          const list = r.items || [];
          if (!list.length) {
            m.querySelector('#aiResult').innerHTML = `<div class="t-sm muted mt12">未匹配到工艺条目，请换个说法或手动添加。</div>`;
            return;
          }
          m.querySelector('#aiResult').innerHTML = `
            <div class="mt16"><div class="b t-sm" style="margin-bottom:8px">识别到 ${list.length} 条（可取消勾选）</div>
            <div style="max-height:240px;overflow:auto;border:1px solid var(--border);border-radius:10px">
              <table class="tbl"><thead><tr><th style="width:36px"></th><th>项目</th><th class="c">数量</th><th class="r">单价</th></tr></thead>
              <tbody>${list.map((x, i) => `<tr>
                <td class="c"><input type="checkbox" data-i="${i}" checked></td>
                <td><b>${esc(x.name)}</b><div class="t-xs muted">${esc(x.group_name)}</div></td>
                <td class="c num">${fmt.num(x.qty)} ${esc(x.unit)}</td>
                <td class="r num">${fmt.money(x.unit_price)}</td>
              </tr>`).join('')}</tbody></table>
            </div>
            <button class="btn btn-primary btn-block mt12" id="aiAdd">确认添加到报价</button></div>`;
          m.querySelector('#aiAdd').onclick = () => {
            m.querySelectorAll('#aiResult input[type=checkbox]').forEach((cb) => {
              if (!cb.checked) return;
              const x = list[Number(cb.dataset.i)];
              items.push({
                id: 'tmp_' + Math.random().toString(36).slice(2),
                group_name: x.group_name, name: x.name, unit: x.unit,
                qty: x.qty, unit_price: x.unit_price, cost_price: x.cost_price || 0,
                craft: x.craft || '', remark: '',
              });
            });
            dirty = true;
            drawTable(el, el.querySelector('#edFilter').value.trim());
            close();
            toast('已添加到报价', 'success');
          };
        } catch (e) {
          toast(e.message, 'error');
          btn.disabled = false; btn.innerHTML = `${icon('sparkles', 15)} 开始识别（5 积分）`;
        }
      };
    },
  });
}
