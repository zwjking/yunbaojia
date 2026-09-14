/**
 * 系统设置
 */
import { api, icon, esc, fmt, toast, emptyState, loadingRow, modal, confirmBox } from '../core.js';

let tab = 'org';
let org = null;
let settings = null;
let members = [];

export async function render(el, ctx) {
  ctx.setTitle('系统设置', '组织信息、团队成员、工资标准与报价默认条款');
  el.innerHTML = loadingRow('正在读取设置…');

  try {
    const [o, s, m] = await Promise.all([
      api.get('/org/profile'),
      api.get('/org/settings'),
      api.get('/users').catch(() => []),
    ]);
    org = o; settings = s; members = m;
  } catch (e) {
    el.innerHTML = emptyState('alert', '加载失败', e.message);
    return;
  }

  await draw(el, ctx);
}

async function draw(el, ctx) {
  el.innerHTML = `
    <div class="settings-layout">
      <div class="settings-nav">
        <button data-t="org" class="${tab === 'org' ? 'active' : ''}">组织信息</button>
        <button data-t="wage" class="${tab === 'wage' ? 'active' : ''}">人工工资标准</button>
        <button data-t="quote" class="${tab === 'quote' ? 'active' : ''}">报价默认设置</button>
        <button data-t="member" class="${tab === 'member' ? 'active' : ''}">成员与权限</button>
        <button data-t="account" class="${tab === 'account' ? 'active' : ''}">账号安全</button>
        <button data-t="about" class="${tab === 'about' ? 'active' : ''}">关于系统</button>
      </div>
      <div id="setBody"></div>
    </div>
  `;

  el.querySelectorAll('.settings-nav button').forEach((b) => {
    b.onclick = async () => { tab = b.dataset.t; await draw(el, ctx); };
  });

  const box = el.querySelector('#setBody');

  if (tab === 'org') {
    box.innerHTML = `<div class="panel">
      <div class="panel-head"><div><h2>组织信息</h2><p class="panel-note">会显示在客户报价页上</p></div></div>
      <div class="panel-body">
        <div class="form-grid c2">
          <div class="field"><label class="field-label">公司 / 团队名称</label>
            <input class="input" id="oName" value="${esc(org.name || '')}"></div>
          <div class="field"><label class="field-label">联系电话</label>
            <input class="input" id="oPhone" value="${esc(org.phone || '')}"></div>
          <div class="field"><label class="field-label">地址</label>
            <input class="input" id="oAddr" value="${esc(org.address || '')}"></div>
          <div class="field"><label class="field-label">品牌色</label>
            <input class="input" id="oColor" type="color" value="${esc(org.brand_color || '#4f46e5')}" style="height:38px;padding:3px"></div>
        </div>
        <div class="field mt12"><label class="field-label">公司简介</label>
          <textarea class="textarea" id="oIntro">${esc(org.intro || '')}</textarea></div>
        <div style="text-align:right;margin-top:18px">
          <button class="btn btn-primary" id="oSave">${icon('save', 15)} 保存</button>
        </div>
      </div>
    </div>`;

    box.querySelector('#oSave').onclick = async () => {
      try {
        await api.put('/org/profile', {
          name: box.querySelector('#oName').value.trim(),
          phone: box.querySelector('#oPhone').value.trim(),
          address: box.querySelector('#oAddr').value.trim(),
          brand_color: box.querySelector('#oColor').value,
          intro: box.querySelector('#oIntro').value,
        });
        toast('已保存', 'success');
        render(el, ctx);
      } catch (e) { toast(e.message, 'error'); }
    };
  }

  if (tab === 'wage') {
    const wages = settings.labor_wage_standards || [];
    box.innerHTML = `<div class="panel">
      <div class="panel-head"><div><h2>人工工资标准</h2>
        <p class="panel-note">用于报价体检时计算建议人工成本与人工分摊</p></div></div>
      <div class="panel-body">
        <div class="wage-row" style="font-size:12px;color:var(--text-3);margin-bottom:6px">
          <span>工种</span><span>日工资（元 / 人 / 天）</span><span></span>
        </div>
        <div id="wageList">
          ${wages.map((w, i) => `<div class="wage-row">
            <input class="input" value="${esc(w.trade)}" data-i="${i}" data-k="trade">
            <input class="input" type="number" value="${w.daily_wage}" data-i="${i}" data-k="daily_wage">
            <button class="btn btn-ghost btn-sm" data-wrm="${i}">${icon('trash', 14)}</button>
          </div>`).join('')}
        </div>
        <button class="btn btn-secondary btn-sm mt12" id="wAdd">${icon('plus', 14)} 添加工种</button>
        <div style="text-align:right;margin-top:18px">
          <button class="btn btn-primary" id="wSave">${icon('save', 15)} 保存</button>
        </div>
      </div>
    </div>`;

    let list = wages.map((w) => ({ ...w }));
    const drawW = () => {
      box.querySelector('#wageList').innerHTML = list.map((w, i) => `<div class="wage-row">
        <input class="input" value="${esc(w.trade)}" data-i="${i}" data-k="trade">
        <input class="input" type="number" value="${w.daily_wage}" data-i="${i}" data-k="daily_wage">
        <button class="btn btn-ghost btn-sm" data-wrm="${i}">${icon('trash', 14)}</button>
      </div>`).join('');
      box.querySelectorAll('#wageList input').forEach((inp) => {
        inp.oninput = () => { list[Number(inp.dataset.i)][inp.dataset.k] = inp.dataset.k === 'daily_wage' ? Number(inp.value) || 0 : inp.value; };
      });
      box.querySelectorAll('[data-wrm]').forEach((b) => {
        b.onclick = () => { list.splice(Number(b.dataset.wrm), 1); drawW(); };
      });
    };
    drawW();
    box.querySelector('#wAdd').onclick = () => { list.push({ trade: '新工种', daily_wage: 300 }); drawW(); };
    box.querySelector('#wSave').onclick = async () => {
      try {
        await api.put('/org/settings', { settings: { ...settings, labor_wage_standards: list } });
        toast('已保存，报价体检会使用新的日工资', 'success');
        render(el, ctx);
      } catch (e) { toast(e.message, 'error'); }
    };
  }

  if (tab === 'quote') {
    box.innerHTML = `<div class="panel">
      <div class="panel-head"><div><h2>报价默认设置</h2>
        <p class="panel-note">新建报价时的默认值与客户报价页展示规则</p></div></div>
      <div class="panel-body">
        <div class="form-grid c2">
          <div class="field"><label class="field-label">报价单号前缀</label>
            <input class="input" id="qPrefix" value="${esc(settings.quote_prefix || 'BJ')}"></div>
          <div class="field"><label class="field-label">默认税率（%）</label>
            <input class="input" id="qTax" type="number" value="${settings.default_tax_rate || 0}"></div>
        </div>
        <div class="field mt12"><label class="field-label">报价条款（显示在客户报价页底部）</label>
          <textarea class="textarea" id="qTerms" style="min-height:100px">${esc(settings.quote_terms || '')}</textarea></div>
        <div class="row gap8 mt12">
          <input type="checkbox" id="qShowCost" ${settings.show_cost_to_client ? 'checked' : ''}>
          <label for="qShowCost" class="t-sm">在客户报价页显示成本价（一般不推荐）</label>
        </div>
        <div style="text-align:right;margin-top:18px">
          <button class="btn btn-primary" id="qSave">${icon('save', 15)} 保存</button>
        </div>
      </div>
    </div>`;

    box.querySelector('#qSave').onclick = async () => {
      try {
        await api.put('/org/settings', {
          settings: {
            ...settings,
            quote_prefix: box.querySelector('#qPrefix').value.trim() || 'BJ',
            default_tax_rate: Number(box.querySelector('#qTax').value) || 0,
            quote_terms: box.querySelector('#qTerms').value,
            show_cost_to_client: box.querySelector('#qShowCost').checked,
          },
        });
        toast('已保存', 'success');
        render(el, ctx);
      } catch (e) { toast(e.message, 'error'); }
    };
  }

  if (tab === 'member') {
    const roleName = { owner: '拥有者', admin: '管理员', member: '成员' };
    box.innerHTML = `<div class="panel">
      <div class="panel-head"><div><h2>成员与权限</h2><p class="panel-note">共 ${members.length} 位成员</p></div>
        <div class="panel-actions"><button class="btn btn-primary btn-sm" id="mInvite">${icon('plus', 14)} 邀请成员</button></div></div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>成员</th><th>手机号</th><th class="c">角色</th><th class="c">状态</th>
        <th class="c">报价数</th><th class="c">加入时间</th><th class="c">操作</th></tr></thead>
        <tbody>${members.map((m) => `<tr>
          <td><b>${esc(m.name || '—')}</b></td>
          <td class="num">${esc(m.phone)}</td>
          <td class="c"><span class="badge ${m.role === 'owner' ? 'badge-violet' : m.role === 'admin' ? 'badge-brand' : ''}">${roleName[m.role] || m.role}</span></td>
          <td class="c"><span class="badge ${m.status === 'active' ? 'badge-success' : 'badge-danger'}">${m.status === 'active' ? '正常' : '已停用'}</span></td>
          <td class="c num">${m.quote_count || 0}</td>
          <td class="c t-sm muted">${fmt.date(m.created_at)}</td>
          <td class="c">${m.role === 'owner' ? '<span class="t-xs muted">—</span>' :
    `<select class="select" data-role="${m.id}" style="height:30px;width:96px;font-size:12px">
              ${['owner', 'admin', 'member'].map((r) => `<option value="${r}" ${r === m.role ? 'selected' : ''}>${roleName[r]}</option>`).join('')}
            </select>`}</td>
        </tr>`).join('')}</tbody></table></div>
    </div>`;

    const inv = box.querySelector('#mInvite');
    if (inv) inv.onclick = () => {
      modal({
        title: '邀请成员', width: 440,
        body: `<div class="field"><label class="field-label">手机号</label>
          <input class="input" id="ivPhone" placeholder="11 位手机号"></div>
          <div class="field mt12"><label class="field-label">角色</label>
            <select class="select" id="ivRole">
              <option value="member">成员</option><option value="admin">管理员</option>
            </select></div>
          <div class="t-xs muted mt12">对方注册后即可加入你的团队并共享数据。</div>`,
        footer: `<button class="btn btn-secondary" data-close>取消</button>
          <button class="btn btn-primary" id="ivOk">发送邀请</button>`,
        onMount(m, close) {
          m.querySelector('#ivOk').onclick = async () => {
            try {
              await api.post('/users/invitations', {
                phone: m.querySelector('#ivPhone').value.trim(),
                role: m.querySelector('#ivRole').value,
              });
              close(); toast('邀请已创建', 'success');
            } catch (e) { toast(e.message, 'error'); }
          };
        },
      });
    };

    box.querySelectorAll('[data-role]').forEach((s) => {
      s.onchange = async () => {
        try {
          await api.put(`/users/${s.dataset.role}/role`, { role: s.value });
          toast('角色已更新', 'success');
          render(el, ctx);
        } catch (e) { toast(e.message, 'error'); }
      };
    });
  }

  if (tab === 'account') {
    box.innerHTML = `<div class="panel">
      <div class="panel-head"><div><h2>账号安全</h2><p class="panel-note">修改登录密码</p></div></div>
      <div class="panel-body">
        <div class="form-grid c2">
          <div class="field"><label class="field-label">当前密码</label>
            <input class="input" id="pOld" type="password"></div>
          <div class="field"><label class="field-label">新密码（至少 6 位）</label>
            <input class="input" id="pNew" type="password"></div>
        </div>
        <div style="text-align:right;margin-top:18px">
          <button class="btn btn-primary" id="pSave">修改密码</button>
        </div>
      </div>
    </div>`;
    box.querySelector('#pSave').onclick = async () => {
      try {
        await api.put('/users/me/password', {
          old_password: box.querySelector('#pOld').value,
          new_password: box.querySelector('#pNew').value,
        });
        toast('密码已更新，下次登录请使用新密码', 'success');
        box.querySelector('#pOld').value = '';
        box.querySelector('#pNew').value = '';
      } catch (e) { toast(e.message, 'error'); }
    };
  }

  if (tab === 'about') {
    let cfg = {};
    try { cfg = await api.get('/public-config'); } catch (e) { /* ignore */ }
    box.innerHTML = `<div class="panel">
      <div class="panel-head"><div><h2>关于系统</h2></div></div>
      <div class="panel-body">
        <div class="row gap12" style="align-items:flex-start">
          <div class="brand-mark" style="width:48px;height:48px;border-radius:14px">${icon('home', 24)}</div>
          <div>
            <div style="font-size:17px;font-weight:650">${esc(cfg.app_name || '云报价 · 家装报价系统')}</div>
            <div class="t-sm muted mt4">版本 ${esc(cfg.version || '1.0.0')} · AI 引擎：${cfg.ai_provider === 'llm' ? '大模型' : '本地规则引擎'}</div>
          </div>
        </div>
        <div class="ai-result__section mt16">
          <h4 class="ai-result__section-title">能力清单</h4>
          <div class="t-sm" style="line-height:1.9;color:var(--text-2)">
            · 内置 ${fmt.int(180)}+ 条家装工艺（八大分类）<br>
            · 15 项 AI 造价能力，按积分计费，成功才扣<br>
            · 12 种报价状态，从草稿跟踪到成交<br>
            · 支持 Excel / CSV 导入导出、PDF 打印、客户分享链接<br>
            · 本地部署，数据保存在你自己的服务器
          </div>
        </div>
        <div class="row gap8 mt16">
          <a class="btn btn-secondary btn-sm" href="#/privacy">隐私政策</a>
          <a class="btn btn-secondary btn-sm" href="#/terms">服务条款</a>
          <a class="btn btn-secondary btn-sm" href="#/ai-disclaimer">AI 使用声明</a>
        </div>
      </div>
    </div>`;
  }
}
