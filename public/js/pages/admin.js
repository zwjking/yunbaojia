/**
 * 平台管理（仅平台管理员）
 */
import { api, icon, esc, fmt, toast, emptyState, loadingRow, modal, confirmBox } from '../core.js';

let tab = 'overview';
let data = null;

export async function render(el, ctx) {
  ctx.setTitle('平台管理', '全平台数据总览与账号管理');
  el.innerHTML = loadingRow('正在读取平台数据…');

  try {
    data = await api.get('/admin/overview');
  } catch (e) {
    el.innerHTML = emptyState('alert', '无权访问', e.message || '仅平台管理员可访问');
    return;
  }

  draw(el, ctx);
}

function draw(el, ctx) {
  el.innerHTML = `
    <div class="seg mb16" id="adTabs">
      <button data-t="overview" class="${tab === 'overview' ? 'active' : ''}">总览</button>
      <button data-t="users" class="${tab === 'users' ? 'active' : ''}">用户管理</button>
      <button data-t="orgs" class="${tab === 'orgs' ? 'active' : ''}">组织管理</button>
      <button data-t="grant" class="${tab === 'grant' ? 'active' : ''}">积分发放</button>
      <button data-t="ai" class="${tab === 'ai' ? 'active' : ''}">AI 调用日志</button>
    </div>
    <div id="adBody"></div>
  `;
  el.querySelectorAll('#adTabs button').forEach((b) => {
    b.onclick = () => { tab = b.dataset.t; draw(el, ctx); };
  });

  const box = el.querySelector('#adBody');

  if (tab === 'overview') {
    const d = data;
    box.innerHTML = `
      <div class="grid c4" style="margin-bottom:16px">
        ${card('注册用户', d.users.total, 'users', '', `今日新增 ${d.users.today} · 正常 ${d.users.active}`)}
        ${card('组织 / 团队', d.orgs.total, 'building', 'violet', '')}
        ${card('报价总数', d.quotes.total, 'file', 'amber', `累计金额 ¥${fmt.wan(d.quotes.amount)}`)}
        ${card('已支付订单', d.revenue.paid_orders, 'card', 'green', `收入 ¥${fmt.money(d.revenue.amount, 0)}`)}
      </div>
      <div class="grid c2">
        <div class="panel"><div class="panel-head"><div><h2>用户套餐分布</h2></div></div>
          <div class="panel-body">${dist(d.users.by_plan, planLabel)}</div></div>
        <div class="panel"><div class="panel-head"><div><h2>报价状态分布</h2></div></div>
          <div class="panel-body">${dist(d.quotes.by_status, statusLabel)}</div></div>
      </div>
      <div class="grid c3" style="margin-top:16px">
        <div class="panel"><div class="panel-head"><div><h2>AI 调用</h2></div></div>
          <div class="panel-body">
            <div class="row between mb8"><span class="dim t-sm">总调用</span><b class="num">${d.ai.calls}</b></div>
            <div class="row between mb8"><span class="dim t-sm">消耗积分</span><b class="num">${fmt.int(d.ai.credits_used)}</b></div>
            <div class="row between mb8"><span class="dim t-sm">失败数</span><b class="num">${d.ai.failed}</b></div>
            <div class="row between"><span class="dim t-sm">引擎</span><b>${esc(d.ai.engine)}</b></div>
          </div></div>
        <div class="panel"><div class="panel-head"><div><h2>工艺库</h2></div></div>
          <div class="panel-body">
            <div class="row between mb8"><span class="dim t-sm">系统基准库</span><b class="num">${d.library.system}</b></div>
            <div class="row between"><span class="dim t-sm">含组织副本</span><b class="num">${d.library.total}</b></div>
          </div></div>
        <div class="panel"><div class="panel-head"><div><h2>订单</h2></div></div>
          <div class="panel-body">
            <div class="row between mb8"><span class="dim t-sm">已支付</span><b class="num">${d.revenue.paid_orders}</b></div>
            <div class="row between"><span class="dim t-sm">待支付</span><b class="num">${d.revenue.pending}</b></div>
          </div></div>
      </div>`;
  }

  if (tab === 'users') {
    api.get('/admin/users').then((list) => {
      box.innerHTML = `<div class="panel">
        <div class="panel-head"><div><h2>用户管理</h2><p class="panel-note">共 ${list.length} 位用户</p></div></div>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>用户</th><th>手机号</th><th>组织</th><th class="c">套餐</th>
          <th class="r">积分</th><th class="c">报价数</th><th class="c">状态</th>
          <th class="c">平台管理员</th><th class="c">注册时间</th><th class="c">操作</th></tr></thead>
          <tbody>${list.map((u) => `<tr>
            <td><b>${esc(u.name || '—')}</b></td>
            <td class="num">${esc(u.phone)}</td>
            <td class="t-sm">${esc(u.org_name || '')}</td>
            <td class="c"><span class="badge ${u.plan === 'plus' ? 'badge-violet' : ''}">${planLabel(u.plan)}</span></td>
            <td class="r num">${fmt.int(u.credits || 0)}</td>
            <td class="c num">${u.quote_count || 0}</td>
            <td class="c"><span class="badge ${u.status === 'disabled' ? 'badge-danger' : 'badge-success'}">${u.status === 'disabled' ? '已停用' : '正常'}</span></td>
            <td class="c"><input type="checkbox" data-admin="${u.id}" ${u.is_platform_admin ? 'checked' : ''}></td>
            <td class="c t-sm muted">${fmt.date(u.created_at)}</td>
            <td class="c"><button class="btn btn-ghost btn-sm" data-toggle="${u.id}" data-st="${u.status}">
              ${u.status === 'disabled' ? '启用' : '停用'}</button></td>
          </tr>`).join('')}</tbody></table></div>
      </div>`;

      box.querySelectorAll('[data-admin]').forEach((cb) => {
        cb.onchange = async () => {
          try {
            await api.put(`/admin/users/${cb.dataset.admin}/platform-admin`, { enabled: cb.checked });
            toast('已更新', 'success');
          } catch (e) { toast(e.message, 'error'); cb.checked = !cb.checked; }
        };
      });
      box.querySelectorAll('[data-toggle]').forEach((b) => {
        b.onclick = async () => {
          const disable = b.dataset.st !== 'disabled';
          const ok = await confirmBox(disable ? '停用账号' : '启用账号', `确定要${disable ? '停用' : '启用'}这个账号吗？`, disable);
          if (!ok) return;
          try {
            await api.put(`/admin/users/${b.dataset.toggle}/status`, { status: disable ? 'disabled' : 'active' });
            toast('已更新', 'success'); draw(el, ctx);
          } catch (e) { toast(e.message, 'error'); }
        };
      });
    });
  }

  if (tab === 'orgs') {
    api.get('/admin/organizations').then((list) => {
      box.innerHTML = `<div class="panel">
        <div class="panel-head"><div><h2>组织管理</h2><p class="panel-note">共 ${list.length} 个组织</p></div></div>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>组织名称</th><th class="c">套餐</th><th class="c">成员</th>
          <th class="c">报价数</th><th class="c">工艺条目</th><th class="c">创建时间</th><th class="c">操作</th></tr></thead>
          <tbody>${list.map((o) => `<tr>
            <td><b>${esc(o.name)}</b></td>
            <td class="c"><select class="select" data-plan="${o.id}" style="height:30px;width:110px;font-size:12px">
              ${['free', 'personal', 'plus', 'enterprise'].map((p) => `<option value="${p}" ${p === o.plan ? 'selected' : ''}>${planLabel(p)}</option>`).join('')}
            </select></td>
            <td class="c num">${o.user_count || 0}</td>
            <td class="c num">${o.quote_count || 0}</td>
            <td class="c num">${o.library_count || 0}</td>
            <td class="c t-sm muted">${fmt.date(o.created_at)}</td>
            <td class="c"><a class="btn btn-ghost btn-sm" href="#/app/admin">—</a></td>
          </tr>`).join('')}</tbody></table></div>
      </div>`;

      box.querySelectorAll('[data-plan]').forEach((s) => {
        s.onchange = async () => {
          try {
            await api.put(`/admin/organizations/${s.dataset.plan}/plan`, { plan: s.value });
            toast('套餐已更新', 'success');
          } catch (e) { toast(e.message, 'error'); }
        };
      });
    });
  }

  if (tab === 'grant') {
    box.innerHTML = `<div class="panel">
      <div class="panel-head"><div><h2>积分发放</h2><p class="panel-note">给指定用户发放 AI 积分</p></div></div>
      <div class="panel-body">
        <div class="form-grid c3">
          <div class="field"><label class="field-label">用户手机号</label>
            <input class="input" id="gPhone" placeholder="11 位手机号"></div>
          <div class="field"><label class="field-label">发放数量</label>
            <input class="input" id="gAmount" type="number" value="100"></div>
          <div class="field"><label class="field-label">原因</label>
            <input class="input" id="gReason" value="管理员发放"></div>
        </div>
        <div style="text-align:right;margin-top:18px">
          <button class="btn btn-primary" id="gOk">${icon('zap', 15)} 发放</button>
        </div>
      </div>
    </div>`;
    box.querySelector('#gOk').onclick = async () => {
      try {
        await api.post('/admin/credit-grants', {
          phone: box.querySelector('#gPhone').value.trim(),
          amount: Number(box.querySelector('#gAmount').value) || 0,
          reason: box.querySelector('#gReason').value.trim(),
        });
        toast('已发放', 'success');
      } catch (e) { toast(e.message, 'error'); }
    };

    api.get('/admin/credit-grants').then((list) => {
      if (!list.length) return;
      box.insertAdjacentHTML('beforeend', `<div class="panel mt16">
        <div class="panel-head"><div><h2>发放记录</h2></div></div>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>手机号</th><th class="r">数量</th><th>原因</th><th class="c">时间</th></tr></thead>
          <tbody>${list.map((g) => `<tr><td class="num">${esc(g.phone || '')}</td>
            <td class="r num">${fmt.int(g.amount)}</td><td>${esc(g.reason || '')}</td>
            <td class="c t-sm muted">${fmt.dateTime(g.created_at)}</td></tr>`).join('')}</tbody></table></div>
      </div>`);
    });
  }

  if (tab === 'ai') {
    api.get('/admin/ai-usage').then((u) => {
      box.innerHTML = `
        <div class="grid c4" style="margin-bottom:16px">
          ${card('总调用', u.total, 'activity', '', '')}
        </div>
        <div class="panel">
          <div class="panel-head"><div><h2>按功能统计</h2></div></div>
          <div class="panel-body">${(u.by_feature || []).map((f) => `<div class="dist-row">
            <div class="dist-top"><span>${esc(f.name)}</span><b>${f.calls} 次 · ${f.credits} 积分</b></div>
            <div class="bar"><i style="width:${Math.min(100, f.calls / Math.max(1, u.total) * 100)}%"></i></div>
          </div>`).join('') || '<div class="t-sm muted">暂无调用记录</div>'}</div>
        </div>
        <div class="panel mt16">
          <div class="panel-head"><div><h2>最近调用</h2></div></div>
          <div class="table-wrap" style="max-height:400px;overflow:auto"><table class="tbl">
            <thead><tr><th>功能</th><th class="c">状态</th><th class="r">积分</th>
            <th class="c">引擎</th><th class="r">耗时</th><th class="c">时间</th></tr></thead>
            <tbody>${(u.recent || []).map((l) => `<tr>
              <td>${esc(l.feature_name)}</td>
              <td class="c"><span class="badge ${l.status === 'success' ? 'badge-success' : 'badge-danger'}">${l.status === 'success' ? '成功' : '失败'}</span></td>
              <td class="r num">${l.cost || 0}</td>
              <td class="c t-sm muted">${esc(l.engine || '')}</td>
              <td class="r num t-sm">${l.elapsed_ms || 0} ms</td>
              <td class="c t-sm muted">${fmt.dateTime(l.created_at)}</td>
            </tr>`).join('')}</tbody></table></div>
        </div>`;
    });
  }
}

function card(label, value, ic, tone, hint) {
  return `<div class="stat-card">
    <div class="stat-card-top"><span class="stat-label">${label}</span>
      <span class="stat-icon ${tone}">${icon(ic, 16)}</span></div>
    <div class="stat-value">${value}</div>
    ${hint ? `<div class="stat-hint">${hint}</div>` : ''}
  </div>`;
}

function dist(obj, labelFn) {
  const entries = Object.entries(obj || {});
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
  if (!entries.length) return '<div class="t-sm muted">暂无数据</div>';
  return entries.sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="dist-row">
    <div class="dist-top"><span>${esc(labelFn(k))}</span><b>${v}</b></div>
    <div class="bar"><i style="width:${v / total * 100}%"></i></div>
  </div>`).join('');
}

function planLabel(p) {
  return { free: '免费版', personal: '普通版', plus: 'Plus 版', enterprise: '企业版' }[p] || p || '未设置';
}
function statusLabel(s) {
  return {
    draft: '草稿', pending_approval: '待审批', approved: '已通过', rejected: '已驳回',
    final: '终稿', issued: '已签发', won: '已成交', lost: '未成交',
    paused: '已暂停', abandoned: '已放弃', archived: '已归档',
  }[s] || s;
}
