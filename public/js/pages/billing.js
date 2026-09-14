/**
 * 会员与计费
 */
import { api, icon, esc, fmt, toast, emptyState, loadingRow, modal, confirmBox } from '../core.js';

let me = null;
let tab = 'plan';

export async function render(el, ctx) {
  ctx.setTitle('会员与计费', '套餐、积分、出单次数与订单发票');
  el.innerHTML = loadingRow('正在读取账户信息…');

  try {
    const r = await api.get('/users/me');
    me = r;
  } catch (e) {
    el.innerHTML = emptyState('alert', '加载失败', e.message);
    return;
  }

  draw(el, ctx);
}

async function draw(el, ctx) {
  const [plans, credits, balance, exportBal] = await Promise.all([
    api.get('/plans'),
    api.get('/ai-credits/packs'),
    api.get('/ai-credits/balance'),
    api.get('/report-credits/balance'),
  ]);

  const planName = { free: '免费版', personal: '普通版（按次）', plus: 'Plus 版', enterprise: '企业版' }[me.plan] || '免费版';
  const monthly = { free: 30, personal: 0, plus: 1000, enterprise: 5000 }[me.plan] || 0;

  el.innerHTML = `
    <div class="plan-current" style="margin-bottom:16px">
      <div class="info">
        <h3>当前套餐：${planName}</h3>
        <p>账号：${esc(me.name || me.phone)} · ${esc(me.phone)}${me.plan_expires_at ? ` · 有效期至 ${fmt.date(me.plan_expires_at)}` : ''}</p>
      </div>
      <div class="plan-usage">
        <div><b>${fmt.int(balance.credits)}</b><span>积分余额${monthly ? `（每月赠 ${monthly}）` : ''}</span></div>
        <div><b>${exportBal.unlimited ? '不限' : exportBal.remaining}</b><span>出单次数（已用 ${exportBal.used}）</span></div>
      </div>
    </div>

    <div class="seg mb16" id="billTabs">
      <button data-t="plan" class="${tab === 'plan' ? 'active' : ''}">套餐方案</button>
      <button data-t="credits" class="${tab === 'credits' ? 'active' : ''}">积分充值</button>
      <button data-t="export" class="${tab === 'export' ? 'active' : ''}">出单次数</button>
      <button data-t="orders" class="${tab === 'orders' ? 'active' : ''}">订单记录</button>
      <button data-t="usage" class="${tab === 'usage' ? 'active' : ''}">AI 用量看板</button>
    </div>
    <div id="billBody"></div>
  `;

  el.querySelectorAll('#billTabs button').forEach((b) => {
    b.onclick = () => { tab = b.dataset.t; draw(el, ctx); };
  });

  const box = el.querySelector('#billBody');

  if (tab === 'plan') {
    box.innerHTML = `<div class="pricing-cards">
      ${plans.map((p) => `<div class="price-card ${p.highlight ? 'highlight' : ''}" style="${p.highlight ? '' : `border-color:${p.borderColor}`}">
        ${p.highlight ? `<span class="pc-tag">${esc(p.tag)}</span>` : `<span class="badge" style="align-self:flex-start;margin-bottom:10px">${esc(p.tag)}</span>`}
        <div class="pc-name">${esc(p.name)}</div>
        <div class="pc-note">${esc(p.note)}</div>
        <div class="pc-price"><b>${esc(p.price)}</b><span>${esc(p.cycle)}</span></div>
        <div class="pc-yearly">${p.yearlyMonthly ? `年付 ¥${p.yearlyMonthly}/月 · 年总 ${p.yearlyTotal}` : '&nbsp;'}</div>
        <div class="pc-ai"><b>${esc(p.aiQuota.label)}</b><span>${esc(p.aiQuota.detail)}</span></div>
        <ul class="pc-features">${p.features.map((f) => `<li>${icon('check', 14)}${esc(f)}</li>`).join('')}</ul>
        ${me.plan === p.key
    ? `<button class="btn btn-secondary btn-block" disabled>当前套餐</button>`
    : `<button class="btn ${p.highlight ? 'btn-primary' : 'btn-secondary'} btn-block" data-buy="${p.key}">${esc(p.cta)}</button>`}
      </div>`).join('')}
    </div>
    <p class="t-xs muted mt16">本地部署采用模拟支付：下单后点「模拟支付」即可即时开通，不会产生真实扣款。</p>`;

    box.querySelectorAll('[data-buy]').forEach((b) => {
      b.onclick = async () => {
        const key = b.dataset.buy;
        const plan = plans.find((p) => p.key === key);
        if (key === 'enterprise') {
          return modal({
            title: '企业版', width: 460,
            body: `<p class="t-sm" style="line-height:1.8;color:var(--text-2)">
              企业版包含 5 个账号起、企业统一价格库、审批流与角色权限，价格按团队规模定制。<br><br>
              请联系我们沟通需求与报价。</p>`,
            footer: `<button class="btn btn-primary" data-close>知道了</button>`,
          });
        }
        if (!plan.monthly) {
          return toast('该套餐按出单次数计费，请到「出单次数」标签购买', 'error');
        }
        let cycle = 'monthly';
        if (plan.yearlyTotal) {
          cycle = await new Promise((resolve) => {
            modal({
              title: `开通 ${plan.name}`, width: 460,
              body: `<div class="form-grid">
                <div class="pkg-card active" data-c="monthly" style="cursor:pointer">
                  <b>月付</b><p>¥${plan.monthly} / 月，随时取消</p></div>
                <div class="pkg-card" data-c="yearly" style="cursor:pointer">
                  <b>年付（省 2 个月）</b><p>¥${plan.yearlyMonthly} / 月，年总 ${plan.yearlyTotal} 元</p></div>
              </div>`,
              footer: `<button class="btn btn-secondary" data-close>取消</button>
                <button class="btn btn-primary" id="cyOk">下一步</button>`,
              onMount(m, close) {
                let sel = 'monthly';
                m.querySelectorAll('[data-c]').forEach((c) => {
                  c.onclick = () => {
                    sel = c.dataset.c;
                    m.querySelectorAll('[data-c]').forEach((x) => x.classList.remove('active'));
                    c.classList.add('active');
                  };
                });
                m.querySelector('#cyOk').onclick = () => { close(); resolve(sel); };
              },
            });
          }).catch(() => null);
          if (!cycle) return;
        }
        try {
          const order = await api.post('/subscriptions/purchase', { plan: key, cycle });
          await payModal(order, `开通 ${plan.name}`, () => { render(el, ctx); });
        } catch (e) { toast(e.message, 'error'); }
      };
    });
  }

  if (tab === 'credits') {
    box.innerHTML = `<div class="panel"><div class="panel-head">
      <div><h2>积分充值包</h2><p class="panel-note">AI 功能按积分计费，成功才扣；充值包 180 天内有效</p></div>
      <div class="panel-actions"><span class="ai-quota-badge">${icon('zap', 13)} 当前余额 ${fmt.int(balance.credits)}</span></div>
      </div>
      <div class="panel-body"><div class="credit-packs">
        ${credits.map((c) => `<div class="pack-card">
          <b>${c.credits}${c.bonus ? `<span style="font-size:13px;color:var(--success)"> +${c.bonus}</span>` : ''}</b>
          <span>积分${c.bonus ? '（含赠送）' : ''}</span>
          <div class="price">¥ ${c.price}</div>
          <div class="t-xs muted" style="margin-top:6px">约 ${Math.round((c.credits + (c.bonus || 0)) / 10)} 次智能造价</div>
          <button class="btn btn-primary btn-sm btn-block mt12" data-pack="${c.code}">购买</button>
        </div>`).join('')}
      </div></div></div>`;

    box.querySelectorAll('[data-pack]').forEach((b) => {
      b.onclick = async () => {
        try {
          const order = await api.post('/ai-credits/purchases', { pack_code: b.dataset.pack });
          await payModal(order, '积分充值', () => { render(el, ctx); });
        } catch (e) { toast(e.message, 'error'); }
      };
    });
  }

  if (tab === 'export') {
    const packs = await api.get('/report-credits/packs');
    box.innerHTML = `<div class="panel"><div class="panel-head">
      <div><h2>出单次数</h2><p class="panel-note">1 次 = 对一份报价完成出单（导出 / 分享解锁），同一份解锁后可反复导出</p></div>
      <div class="panel-actions"><span class="badge ${exportBal.unlimited ? 'badge-success' : ''}">
        ${exportBal.unlimited ? '当前套餐不限次' : `剩余 ${exportBal.remaining} 次`}</span></div>
      </div>
      <div class="panel-body"><div class="credit-packs">
        ${packs.map((c) => `<div class="pack-card">
          <b>${c.count}</b><span>次出单</span>
          <div class="price">¥ ${c.price}</div>
          <div class="t-xs muted" style="margin-top:6px">${c.tag || `约 ¥${(c.price / c.count).toFixed(1)} / 次`}</div>
          <button class="btn btn-primary btn-sm btn-block mt12" data-pack="${c.code}">购买</button>
        </div>`).join('')}
      </div></div></div>`;

    box.querySelectorAll('[data-pack]').forEach((b) => {
      b.onclick = async () => {
        try {
          const order = await api.post('/report-credits/purchases', { pack_code: b.dataset.pack });
          await payModal(order, '购买出单次数', () => { render(el, ctx); });
        } catch (e) { toast(e.message, 'error'); }
      };
    });
  }

  if (tab === 'orders') {
    const [subs, crd, exp] = await Promise.all([
      api.get('/subscriptions/orders'), api.get('/ai-credits/purchases'), api.get('/report-credits/purchases'),
    ]);
    const all = [
      ...subs.map((o) => ({ ...o, _t: '套餐订阅' })),
      ...crd.map((o) => ({ ...o, _t: '积分充值' })),
      ...exp.map((o) => ({ ...o, _t: '出单次数' })),
    ].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

    const st = { paid: ['已支付', 'badge-success'], pending: ['待支付', 'badge-warn'], cancelled: ['已取消', ''], refunded: ['已退款', 'badge-danger'] };

    box.innerHTML = `<div class="panel">
      <div class="panel-head"><div><h2>订单记录</h2><p class="panel-note">共 ${all.length} 笔</p></div>
        <div class="panel-actions"><button class="btn btn-secondary btn-sm" id="invBtn">${icon('receipt', 14)} 发票管理</button></div></div>
      <div class="table-wrap">${all.length ? `<table class="tbl">
        <thead><tr><th>订单号</th><th>类型</th><th>内容</th><th class="r">金额</th>
        <th class="c">状态</th><th class="c">时间</th><th class="c">操作</th></tr></thead>
        <tbody>${all.map((o) => `<tr>
          <td class="num t-sm">${esc(o.order_no)}</td>
          <td><span class="badge">${esc(o._t)}</span></td>
          <td>${esc(o.plan_name || o.pack_name || '')}${o.call_count ? ` · ${o.call_count}` : ''}</td>
          <td class="r num strong">¥${fmt.money(o.amount)}</td>
          <td class="c"><span class="badge ${(st[o.status] || ['', ''])[1]}">${(st[o.status] || [o.status])[0]}</span></td>
          <td class="c t-sm muted">${fmt.dateTime(o.created_at)}</td>
          <td class="c">${o.status === 'pending'
    ? `<button class="btn btn-primary btn-sm" data-pay="${o.id}" data-kind="${o.kind}">去支付</button>`
    : o.status === 'paid' ? '<span class="t-xs muted">已完成</span>' : ''}</td>
        </tr>`).join('')}</tbody></table>`
    : emptyState('receipt', '还没有订单', '购买套餐或积分后，订单会出现在这里')}</div>
    </div>`;

    box.querySelectorAll('[data-pay]').forEach((b) => {
      b.onclick = async () => {
        const order = all.find((o) => o.id === b.dataset.pay);
        await payModal(order, '订单支付', () => { render(el, ctx); });
      };
    });
    const invBtn = box.querySelector('#invBtn');
    if (invBtn) invBtn.onclick = () => invoiceModal();
  }

  if (tab === 'usage') {
    let u = null;
    try { u = await api.get('/ai/usage-summary'); }
    catch (e) {
      box.innerHTML = emptyState('alert', '无权查看', e.message);
      return;
    }
    box.innerHTML = `<div class="grid c4" style="margin-bottom:16px">
      <div class="stat-card"><div class="stat-label">总调用</div><div class="stat-value">${u.total_calls}</div></div>
      <div class="stat-card"><div class="stat-label">消耗积分</div><div class="stat-value">${fmt.int(u.total_credits)}</div></div>
      <div class="stat-card"><div class="stat-label">预估成本</div><div class="stat-value">¥${fmt.money(u.estimated_cost_cny)}</div></div>
      <div class="stat-card"><div class="stat-label">引擎</div><div class="stat-value" style="font-size:15px">${esc(u.engine)}</div></div>
    </div>
    <div class="grid c2">
      <div class="panel"><div class="panel-head"><div><h2>按功能</h2></div></div>
        <div class="panel-body">${(u.by_feature || []).map((f) => `<div class="dist-row">
          <div class="dist-top"><span>${esc(f.name)}</span><b>${f.calls} 次 · ${f.credits} 积分</b></div>
          <div class="bar"><i style="width:${Math.min(100, f.calls / Math.max(1, u.total_calls) * 100)}%"></i></div>
        </div>`).join('') || '<div class="t-sm muted">暂无调用记录</div>'}</div></div>
      <div class="panel"><div class="panel-head"><div><h2>按用户</h2></div></div>
        <div class="panel-body">${(u.by_user || []).map((x) => `<div class="dist-row">
          <div class="dist-top"><span>${esc(x.name)}</span><b>${x.calls} 次 · ${x.credits} 积分</b></div>
          <div class="bar"><i style="width:${Math.min(100, x.calls / Math.max(1, u.total_calls) * 100)}%"></i></div>
        </div>`).join('') || '<div class="t-sm muted">暂无调用记录</div>'}</div></div>
    </div>`;
  }
}

function payModal(order, title, reload) {
  return new Promise((resolve) => {
    modal({
      title, width: 460,
      body: `
        <div class="card card-pad" style="background:var(--surface-2)">
          <div class="row between" style="margin-bottom:8px"><span class="dim t-sm">订单号</span><b class="num t-sm">${esc(order.order_no)}</b></div>
          <div class="row between" style="margin-bottom:8px"><span class="dim t-sm">内容</span><b>${esc(order.plan_name || order.pack_name || '')}${order.call_count ? ` · ${order.call_count}` : ''}</b></div>
          <div class="row between"><span class="dim t-sm">应付金额</span><b style="font-size:22px;color:var(--brand);font-family:var(--font-num)">¥${fmt.money(order.amount)}</b></div>
        </div>
        <div class="t-xs muted mt12">本地部署为模拟支付，点击支付后立即到账，不会产生真实扣款。</div>`,
      footer: `<button class="btn btn-secondary" data-close>稍后支付</button>
        <button class="btn btn-primary" id="payOk">${icon('check', 15)} 模拟支付</button>`,
      onMount(m, close) {
        m.querySelector('#payOk').onclick = async () => {
          try {
            const path = order.kind === 'subscription' ? `/subscriptions/orders/${order.id}/pay`
              : order.kind === 'credits' ? `/ai-credits/purchases/${order.id}/pay`
                : `/report-credits/purchases/${order.id}/pay`;
            const r = await api.post(path, { method: '模拟支付' });
            toast(r.message || '支付成功', 'success');
            close(); reload(); resolve(true);
          } catch (e) { toast(e.message, 'error'); }
        };
      },
    });
  });
}

function invoiceModal() {
  api.get('/invoices/invoiceable-orders').then((list) => {
    modal({
      title: '发票管理', width: 620,
      body: list.length ? `
        <div class="field"><label class="field-label">发票抬头</label>
          <input class="input" id="ivTitle" placeholder="公司名 / 个人"></div>
        <div class="field mt12"><label class="field-label">税号（企业必填）</label>
          <input class="input" id="ivTax"></div>
        <div class="t-sm b mt16 mb8">可开票订单（${list.length}）</div>
        <div style="max-height:220px;overflow:auto;border:1px solid var(--border);border-radius:10px">
          <table class="tbl"><thead><tr><th style="width:36px"></th><th>订单号</th><th>内容</th><th class="r">金额</th></tr></thead>
          <tbody>${list.map((o) => `<tr>
            <td class="c"><input type="checkbox" data-id="${o.id}" checked></td>
            <td class="num t-sm">${esc(o.order_no)}</td>
            <td>${esc(o.plan_name || o.pack_name || '')}</td>
            <td class="r num">¥${fmt.money(o.amount)}</td>
          </tr>`).join('')}</tbody></table>
        </div>`
        : '<p class="t-sm dim">暂无可开票的订单。完成支付后会显示在这里。</p>',
      footer: `<button class="btn btn-secondary" data-close>关闭</button>
        ${list.length ? '<button class="btn btn-primary" id="ivOk">提交开票申请</button>' : ''}`,
      onMount(m, close) {
        const btn = m.querySelector('#ivOk');
        if (!btn) return;
        btn.onclick = async () => {
          const ids = [...m.querySelectorAll('input[type=checkbox]:checked')].map((c) => c.dataset.id);
          if (!ids.length) return toast('请选择要开票的订单', 'error');
          try {
            const r = await api.post('/invoices/records', {
              order_ids: ids,
              title: m.querySelector('#ivTitle').value.trim(),
              tax_no: m.querySelector('#ivTax').value.trim(),
            });
            close(); toast(r.message, 'success');
          } catch (e) { toast(e.message, 'error'); }
        };
      },
    });
  });
}
