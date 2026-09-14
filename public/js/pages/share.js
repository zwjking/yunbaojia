/**
 * 客户报价页（分享链接，无需登录）
 */
import { icon, esc, fmt, loadingRow, emptyState } from '../core.js';
import { printQuote } from '../core.js';

export async function render(el, token) {
  el.innerHTML = `<div class="share-page"><div class="share-card">
    <div style="padding:60px;text-align:center">
      <div class="spinner dark" style="width:24px;height:24px;margin:0 auto"></div>
      <div class="t-sm muted mt12">正在加载报价…</div>
    </div>
  </div></div>`;

  let data;
  try {
    const res = await fetch(`/api/v1/quotes/share/${token}`);
    data = await res.json();
    if (!res.ok) throw new Error(data.error || '加载失败');
  } catch (e) {
    el.innerHTML = `<div class="share-page"><div class="share-card" style="padding:60px;text-align:center">
      <h2 style="margin-bottom:10px">无法打开报价</h2>
      <p class="t-sm muted">${esc(e.message)}</p>
      <a class="btn btn-primary mt16" href="#/">返回首页</a>
    </div></div>`;
    return;
  }

  const q = data.quote;
  const org = data.org || {};
  const items = data.items || [];

  const groups = {};
  items.forEach((i) => { (groups[i.group_name || '未分类'] = groups[i.group_name || '未分类'] || []).push(i); });

  el.innerHTML = `<div class="share-page">
    <div class="share-card">
      <div class="share-head">
        <div class="row between wrap gap12">
          <div>
            <h1>${esc(q.title || '装修报价单')}</h1>
            <div class="share-org">${esc(org.name || '')}${org.phone ? ` · ${esc(org.phone)}` : ''}</div>
          </div>
          <div style="text-align:right">
            <div class="t-xs muted">报价单号</div>
            <div class="num t-sm">${esc(q.quote_number)}</div>
            <div class="t-xs muted mt4">${fmt.date(q.created_at)}</div>
          </div>
        </div>
      </div>

      <div class="share-body">
        <div class="sample-meta" style="grid-template-columns:repeat(4,1fr)">
          <div><span>客户</span><b>${esc(q.customer_name || '—')}</b></div>
          <div><span>小区</span><b>${esc(q.community || '—')}</b></div>
          <div><span>建筑面积</span><b>${q.building_area || '—'} m²</b></div>
          <div><span>户型</span><b>${esc(q.layout || '—')}</b></div>
        </div>
        <div class="sample-meta" style="grid-template-columns:repeat(3,1fr)">
          <div><span>城市</span><b>${esc(q.city || '—')}</b></div>
          <div><span>装修档次</span><b>${esc(q.tier || '—')}</b></div>
          <div><span>房屋类型</span><b>${esc(q.house_type || '—')}</b></div>
        </div>

        ${Object.entries(groups).map(([g, list]) => {
    const sub = list.reduce((s, i) => s + i.unit_price * i.qty, 0);
    return `<div style="margin-top:18px">
            <div class="row between" style="padding:8px 0;border-bottom:2px solid var(--brand)">
              <b>${esc(g)}</b><b class="num">¥${fmt.money(sub, 0)}</b>
            </div>
            <table class="tbl" style="font-size:12.5px">
              <thead><tr><th>项目</th><th class="c" style="width:60px">单位</th>
                <th class="r" style="width:80px">数量</th><th class="r" style="width:90px">单价</th>
                <th class="r" style="width:100px">金额</th></tr></thead>
              <tbody>${list.map((i) => `<tr>
                <td><b>${esc(i.name)}</b>${i.craft ? `<div class="t-xs muted">${esc(i.craft)}</div>` : ''}</td>
                <td class="c">${esc(i.unit)}</td>
                <td class="r num">${fmt.num(i.qty)}</td>
                <td class="r num">${fmt.money(i.unit_price)}</td>
                <td class="r num strong">${fmt.money(i.amount)}</td>
              </tr>`).join('')}</tbody>
            </table>
          </div>`;
  }).join('')}

        <div class="share-total">
          <span>合计金额</span>
          <b>¥ ${fmt.money(q.grand_total || q.total_amount || 0)}</b>
        </div>

        ${q.notes ? `<div class="ai-result__section">
          <h4 class="ai-result__section-title">备注</h4>
          <div class="t-sm" style="line-height:1.8;color:var(--text-2)">${esc(q.notes)}</div>
        </div>` : ''}

        <div class="row gap8 mt16">
          <button class="btn btn-primary" id="shPrint">${icon('download', 15)} 打印 / 保存 PDF</button>
          <a class="btn btn-secondary" href="#/">了解云报价</a>
        </div>
      </div>

      <div class="share-foot">
        本报价由云报价系统生成，价格以双方确认的正式文件为准。如对明细有疑问，请联系报价方确认。
      </div>
    </div>
  </div>`;

  el.querySelector('#shPrint').onclick = () => {
    printQuote({ ...q, manage_fee: 0, tax_rate: 0 }, items, org);
  };
}
