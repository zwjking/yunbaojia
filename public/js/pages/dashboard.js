/**
 * 仪表盘
 */
import { api, icon, esc, fmt, toast, emptyState, loadingRow } from '../core.js';

export async function render(el, ctx) {
  ctx.setTitle('仪表盘', '报价业务全景概览');
  el.innerHTML = loadingRow('正在加载数据…');

  let quotes, stats;
  try {
    const r = await api.get('/quotes?range=all');
    quotes = r.items || [];
    stats = r.stats || {};
  } catch (e) {
    el.innerHTML = emptyState('alert', '加载失败', e.message);
    return;
  }

  ctx.setActions(`
    <div class="seg" id="rangeSeg">
      <button data-r="month">本月</button>
      <button data-r="quarter">本季</button>
      <button data-r="year">本年</button>
      <button data-r="all" class="active">全部</button>
    </div>
    <a class="btn btn-primary" href="#/app/estimate">${icon('sparkles', 15)} 新建智能报价</a>
  `);

  const draw = (s, list) => {
    const recent = list.slice(0, 8);
    el.innerHTML = `
      <div class="grid c4" style="margin-bottom:16px">
        ${statCard('报价总数', s.total || 0, 'file', '', `草稿 ${s.draft || 0} 张`)}
        ${statCard('已签发', s.issued || 0, 'share', 'violet', `待审批 ${s.pending || 0} 张`)}
        ${statCard('已成交', s.won || 0, 'award', 'green', `赢单率 ${s.win_rate || 0}%`)}
        ${statCard('报价总额', '¥' + fmt.wan(s.amount || 0), 'trending', 'amber', `成交 ¥${fmt.wan(s.won_amount || 0)}`)}
      </div>

      <div class="grid c23">
        <div class="panel">
          <div class="panel-head">
            <div><h2>分类金额占比</h2><p class="panel-note">按报价明细的工程分类统计</p></div>
          </div>
          <div class="panel-body" id="distBox">${distHtml(aggregateGroups(list))}</div>
        </div>

        <div class="panel">
          <div class="panel-head"><div><h2>报价漏斗</h2><p class="panel-note">从草稿到成交的转化情况</p></div></div>
          <div class="panel-body">${funnelHtml(s, list)}</div>
        </div>
      </div>

      <div class="panel" style="margin-top:16px">
        <div class="panel-head">
          <div><h2>最近报价</h2><p class="panel-note">共 ${list.length} 张报价</p></div>
          <div class="panel-actions">
            <a class="btn btn-secondary btn-sm" href="#/app/quotes">查看全部 ${icon('arrowRight', 14)}</a>
          </div>
        </div>
        <div class="table-wrap">${recentTable(recent)}</div>
      </div>
    `;

    // 时间范围切换（#rangeSeg 位于顶栏动作区，需从 ctx.actions 取）
    const seg = ctx.actions ? ctx.actions.querySelectorAll('#rangeSeg button') : el.querySelectorAll('#rangeSeg button');
    seg.forEach((b) => {
      b.onclick = async () => {
        seg.forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        try {
          const r2 = await api.get(`/quotes?range=${b.dataset.r}`);
          draw(r2.stats || {}, r2.items || []);
        } catch (e) { toast(e.message, 'error'); }
      };
    });
  };

  draw(stats, quotes);
}

function statCard(label, value, ic, tone, hint) {
  return `<div class="stat-card">
    <div class="stat-card-top">
      <span class="stat-label">${label}</span>
      <span class="stat-icon ${tone}">${icon(ic, 16)}</span>
    </div>
    <div class="stat-value">${value}</div>
    <div class="stat-hint">${hint}</div>
  </div>`;
}

function aggregateGroups(list) {
  const m = {};
  list.forEach((q) => {
    const v = Number(q.grand_total || q.total_amount) || 0;
    m[q.tier || '未分类'] = (m[q.tier || '未分类'] || 0) + v;
  });
  const total = Object.values(m).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(m)
    .map(([name, amount]) => ({ name, amount, ratio: Math.round(amount / total * 1000) / 10 }))
    .sort((a, b) => b.amount - a.amount);
}

function distHtml(rows) {
  if (!rows.length) return emptyState('pie', '暂无数据', '创建报价后这里会显示金额分布');
  const barTone = ['', 'green', 'amber', 'violet', ''];
  return rows.map((r, i) => `<div class="dist-row">
    <div class="dist-top"><span>${esc(r.name)}</span><b>¥${fmt.money(r.amount, 0)} · ${r.ratio}%</b></div>
    <div class="bar ${barTone[i % barTone.length]}"><i style="width:${Math.max(3, r.ratio)}%"></i></div>
  </div>`).join('');
}

function funnelHtml(s, list) {
  const steps = [
    { label: '全部报价', v: s.total || 0, tone: '' },
    { label: '已脱离草稿', v: (s.total || 0) - (s.draft || 0), tone: 'violet' },
    { label: '已签发', v: s.issued || 0, tone: 'amber' },
    { label: '已成交', v: s.won || 0, tone: 'green' },
  ];
  const max = Math.max(1, steps[0].v);
  return `<div>
    ${steps.map((st) => `<div class="dist-row">
      <div class="dist-top"><span>${st.label}</span><b>${st.v}</b></div>
      <div class="bar ${st.tone}"><i style="width:${Math.max(2, st.v / max * 100)}%"></i></div>
    </div>`).join('')}
    <div class="grid c2" style="margin-top:18px;gap:10px">
      <div class="stat-card" style="padding:14px">
        <div class="stat-label">赢单率</div>
        <div class="stat-value" style="font-size:22px">${s.win_rate || 0}<small>%</small></div>
        <div class="stat-hint">已成交 / 已结案</div>
      </div>
      <div class="stat-card" style="padding:14px">
        <div class="stat-label">平均单值</div>
        <div class="stat-value" style="font-size:22px">¥${fmt.wan(s.avg_amount || 0)}</div>
        <div class="stat-hint">毛利 ${s.margin_rate || 0}%</div>
      </div>
    </div>
  </div>`;
}

const STATUS_MAP = {
  draft: ['草稿', ''], pending_approval: ['待审批', 'badge-warn'], approved: ['已通过', 'badge-info'],
  rejected: ['已驳回', 'badge-danger'], final: ['终稿', 'badge-info'], issued: ['已签发', 'badge-brand'],
  won: ['已成交', 'badge-success'], lost: ['未成交', 'badge-danger'], paused: ['已暂停', 'badge-warn'],
  abandoned: ['已放弃', 'badge-danger'], archived: ['已归档', ''],
};

function recentTable(list) {
  if (!list.length) {
    return emptyState('file', '还没有报价', '用智能造价 10 秒生成第一张报价草稿',
      `<a class="btn btn-primary" href="#/app/estimate">${icon('sparkles', 15)} 去新建</a>`);
  }
  return `<table class="tbl">
    <thead><tr>
      <th>单号</th><th>项目</th><th>客户</th><th>面积</th>
      <th class="r">金额</th><th class="c">状态</th><th class="c">更新时间</th><th></th>
    </tr></thead>
    <tbody>
      ${list.map((q) => {
    const st = STATUS_MAP[q.status] || [q.status, ''];
    return `<tr>
        <td class="num t-sm muted">${esc(q.quote_number)}</td>
        <td><a href="#/app/editor/${q.id}" class="strong">${esc(q.title || '未命名')}</a>
          <div class="t-xs muted">${esc(q.community || '')} ${esc(q.city || '')}</div></td>
        <td>${esc(q.customer_name || '—')}</td>
        <td class="num">${q.building_area || '—'}<span class="muted t-xs"> m²</span></td>
        <td class="r num strong">¥${fmt.money(q.grand_total || q.total_amount || 0, 0)}</td>
        <td class="c"><span class="badge ${st[1]}">${st[0]}</span></td>
        <td class="c t-sm muted">${fmt.ago(q.updated_at || q.created_at)}</td>
        <td class="c"><a class="btn btn-ghost btn-sm" href="#/app/editor/${q.id}">${icon('chevronRight', 14)}</a></td>
      </tr>`;
  }).join('')}
    </tbody>
  </table>`;
}

export { STATUS_MAP };
