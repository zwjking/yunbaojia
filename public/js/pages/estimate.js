/**
 * 智能造价向导
 */
import { api, icon, esc, fmt, toast, emptyState, loadingRow, modal } from '../core.js';

const STEPS = [
  { k: 0, t: '选择套餐' },
  { k: 1, t: '项目信息' },
  { k: 2, t: '空间清单' },
  { k: 3, t: '现场备注' },
  { k: 4, t: '生成草稿' },
];

let S = {
  step: 0,
  pkg: null,
  packages: [],
  form: {
    province: '', city: '合肥', building_area: 108, layout: '三室两厅两卫',
    tier: '中档', house_type: '新房', house_age: 0, floor: 8,
    building_type: '高层', has_elevator: true, budget: '',
  },
  rooms: [],
  notes: '',
  result: null,
  generating: false,
};

export async function render(el, ctx) {
  ctx.setTitle('智能造价', '选套餐 → 填项目 → 维护空间 → 写备注 → AI 生成报价草稿');
  ctx.setActions(`
    <button class="btn btn-secondary" id="estReset">${icon('refresh', 15)} 重新开始</button>
    <a class="btn btn-ghost" href="#/app/quotes">报价管理 ${icon('arrowRight', 15)}</a>
  `);

  try {
    S.packages = await api.get('/ai/quote-packages');
    if (!S.pkg && S.packages.length) S.pkg = S.packages[0];
  } catch (e) { /* 忽略 */ }

  ctx.bind('#estReset', 'onclick', () => {
    S = { ...S, step: 0, rooms: [], notes: '', result: null };
    draw(el, ctx);
  });

  draw(el, ctx);
}

function draw(el, ctx) {
  el.innerHTML = `
    <div class="wizard-steps">
      ${STEPS.map((s, i) => `${i ? '<i class="wline"></i>' : ''}
        <div class="wstep ${S.step === i ? 'active' : ''} ${S.step > i ? 'done' : ''}" data-step="${i}">
          <i>${S.step > i ? '✓' : i + 1}</i>${s.t}
        </div>`).join('')}
    </div>
    <div id="stepBody"></div>
  `;

  el.querySelectorAll('.wstep').forEach((w) => {
    w.onclick = () => {
      const n = Number(w.dataset.step);
      if (n <= S.step) { S.step = n; draw(el, ctx); }
    };
  });

  const body = el.querySelector('#stepBody');
  if (S.step === 0) step0(body, el, ctx);
  if (S.step === 1) step1(body, el, ctx);
  if (S.step === 2) step2(body, el, ctx);
  if (S.step === 3) step3(body, el, ctx);
  if (S.step === 4) step4(body, el, ctx);
}

/* ---------- 步骤 1：套餐 ---------- */
function step0(body, el, ctx) {
  body.innerHTML = `<div class="panel">
    <div class="panel-head">
      <div><h2>选择智能套餐</h2><p class="panel-note">先选套餐，系统再结合面积、户型和本地价格生成初稿</p></div>
    </div>
    <div class="panel-body">
      <div class="package-grid">
        ${S.packages.map((p) => `<div class="pkg-card ${S.pkg && S.pkg.code === p.code ? 'active' : ''}" data-pkg="${p.code}">
          <b>${esc(p.name)}</b><p>${esc(p.desc)}</p>
          <div class="pkg-inc">✓ 含：${p.includes.slice(0, 4).join('、')}</div>
          <div class="pkg-exc">不含：${p.excludes.join('、')}</div>
        </div>`).join('')}
      </div>
      <div class="mt24" style="text-align:right">
        <button class="btn btn-primary" id="next1">下一步：填项目信息 ${icon('arrowRight', 15)}</button>
      </div>
    </div>
  </div>`;

  body.querySelectorAll('[data-pkg]').forEach((c) => {
    c.onclick = () => {
      S.pkg = S.packages.find((p) => p.code === c.dataset.pkg);
      body.querySelectorAll('.pkg-card').forEach((x) => x.classList.remove('active'));
      c.classList.add('active');
    };
  });
  body.querySelector('#next1').onclick = () => { S.step = 1; draw(el, ctx); };
}

/* ---------- 步骤 2：项目信息 ---------- */
function step1(body, el, ctx) {
  const f = S.form;
  body.innerHTML = `<div class="panel">
    <div class="panel-head"><div><h2>项目信息</h2>
      <p class="panel-note">这些信息决定了工程量与价格系数，越准确估算越准</p></div></div>
    <div class="panel-body">
      <div class="form-grid c2">
        <div class="field"><label class="field-label">城市</label>
          <input class="input" id="eCity" value="${esc(f.city)}" placeholder="如：合肥 / 上海 / 兰州">
          <span class="field-hint">系统按一线 / 新一线 / 二线 / 三线自动套用价格系数</span></div>
        <div class="field"><label class="field-label">省份</label>
          <input class="input" id="eProvince" value="${esc(f.province)}" placeholder="选填"></div>
        <div class="field"><label class="field-label">建筑面积（m²）</label>
          <input class="input" id="eArea" type="number" value="${f.building_area}"></div>
        <div class="field"><label class="field-label">户型</label>
          <select class="select" id="eLayout">
            ${['一室一厅一卫', '两室一厅一卫', '两室两厅一卫', '三室两厅一卫', '三室两厅两卫', '四室两厅两卫']
    .map((x) => `<option ${x === f.layout ? 'selected' : ''}>${x}</option>`).join('')}
          </select></div>
        <div class="field"><label class="field-label">装修档次</label>
          <select class="select" id="eTier">
            ${[['简装', '简装（满足基本居住）'], ['中档', '中档（品质平衡）'], ['高档', '高档（升级品牌）'], ['定制', '定制 / 豪装']]
    .map(([v, t]) => `<option value="${v}" ${v === f.tier ? 'selected' : ''}>${t}</option>`).join('')}
          </select></div>
        <div class="field"><label class="field-label">房屋类型</label>
          <select class="select" id="eHouseType">
            ${['新房', '老房', '二手房翻新'].map((x) => `<option ${x === f.house_type ? 'selected' : ''}>${x}</option>`).join('')}
          </select></div>
        <div class="field"><label class="field-label">房龄（年）</label>
          <input class="input" id="eAge" type="number" value="${f.house_age}" placeholder="新房填 0">
          <span class="field-hint">≥10 年自动计入拆除、基层与水电重排</span></div>
        <div class="field"><label class="field-label">所在楼层</label>
          <input class="input" id="eFloor" type="number" value="${f.floor}"></div>
        <div class="field"><label class="field-label">建筑类型</label>
          <select class="select" id="eBType">
            ${['高层', '多层', '低层', '别墅'].map((x) => `<option ${x === f.building_type ? 'selected' : ''}>${x}</option>`).join('')}
          </select></div>
        <div class="field"><label class="field-label">电梯</label>
          <select class="select" id="eElevator">
            <option value="1" ${f.has_elevator ? 'selected' : ''}>有电梯</option>
            <option value="0" ${!f.has_elevator ? 'selected' : ''}>无电梯</option>
          </select></div>
        <div class="field"><label class="field-label">业主预算（元，选填）</label>
          <input class="input" id="eBudget" type="number" value="${f.budget}" placeholder="填了会做可行性评估"></div>
      </div>
      <div class="row between mt24">
        <button class="btn btn-secondary" id="prev0">${icon('arrowLeft', 15)} 上一步</button>
        <button class="btn btn-primary" id="next2">下一步：空间清单 ${icon('arrowRight', 15)}</button>
      </div>
    </div>
  </div>`;

  body.querySelector('#prev0').onclick = () => { S.step = 0; draw(el, ctx); };
  body.querySelector('#next2').onclick = () => {
    S.form = {
      ...S.form,
      province: body.querySelector('#eProvince').value.trim(),
      city: body.querySelector('#eCity').value.trim() || '合肥',
      building_area: Number(body.querySelector('#eArea').value) || 0,
      layout: body.querySelector('#eLayout').value,
      tier: body.querySelector('#eTier').value,
      house_type: body.querySelector('#eHouseType').value,
      house_age: Number(body.querySelector('#eAge').value) || 0,
      floor: Number(body.querySelector('#eFloor').value) || 0,
      building_type: body.querySelector('#eBType').value,
      has_elevator: body.querySelector('#eElevator').value === '1',
      budget: body.querySelector('#eBudget').value,
    };
    if (!S.form.building_area) return toast('请填写建筑面积', 'error');
    S.step = 2; draw(el, ctx);
  };
}

/* ---------- 步骤 3：空间清单 ---------- */
const PRESET_SPACES = ['客厅', '餐厅', '主卧', '次卧', '书房', '厨房', '主卫', '客卫', '阳台', '玄关过道', '衣帽间', '影音室'];

function step2(body, el, ctx) {
  body.innerHTML = `<div class="panel">
    <div class="panel-head">
      <div><h2>维护空间清单</h2>
        <p class="panel-note">点下方标签快速添加，也可以让 AI 按户型自动拆解</p></div>
      <div class="panel-actions">
        <button class="btn btn-secondary btn-sm" id="aiBreak">${icon('sparkles', 14)} AI 拆解户型（3 积分）</button>
        <button class="btn btn-secondary btn-sm" id="btnTpl">${icon('layers', 14)} 匹配我的模板</button>
      </div>
    </div>
    <div class="panel-body">
      <div class="space-chips">
        ${PRESET_SPACES.map((s) => `<button class="chip" data-space="${s}">+ ${s}</button>`).join('')}
        <button class="chip" id="customSpace">+ 自定义</button>
      </div>
      <div class="space-list" id="spaceList"></div>
      <div class="row between mt16">
        <span class="t-sm muted" id="areaSum"></span>
      </div>
      <div class="row between mt24">
        <button class="btn btn-secondary" id="prev1">${icon('arrowLeft', 15)} 上一步</button>
        <button class="btn btn-primary" id="next3">下一步：现场备注 ${icon('arrowRight', 15)}</button>
      </div>
    </div>
  </div>`;

  const listBox = body.querySelector('#spaceList');
  const drawList = () => {
    if (!S.rooms.length) {
      listBox.innerHTML = `<div class="empty" style="padding:28px">
        <div class="empty-desc">还没有空间。点上方任意标签开始添加，或用 AI 自动拆解。</div></div>`;
    } else {
      listBox.innerHTML = S.rooms.map((r, i) => `<div class="space-row">
        <input class="n" value="${esc(r.name)}" data-i="${i}" data-k="name">
        <input class="a" type="number" step="0.1" value="${r.area}" data-i="${i}" data-k="area">
        <span class="t-sm muted">m²</span>
        <button class="btn btn-ghost btn-sm" data-rm="${i}">${icon('trash', 14)}</button>
      </div>`).join('');
      listBox.querySelectorAll('input').forEach((inp) => {
        inp.oninput = () => {
          const i = Number(inp.dataset.i);
          S.rooms[i][inp.dataset.k] = inp.dataset.k === 'area' ? Number(inp.value) || 0 : inp.value;
          updateSum();
        };
      });
      listBox.querySelectorAll('[data-rm]').forEach((b) => {
        b.onclick = () => { S.rooms.splice(Number(b.dataset.rm), 1); drawList(); };
      });
    }
    updateSum();
  };
  const updateSum = () => {
    const sum = S.rooms.reduce((s, r) => s + (Number(r.area) || 0), 0);
    const usable = Math.round((S.form.building_area || 0) * 0.78);
    body.querySelector('#areaSum').innerHTML = S.rooms.length
      ? `已添加 <b>${S.rooms.length}</b> 个空间，合计 <b>${sum.toFixed(1)} m²</b>（参考套内面积约 ${usable} m²）`
      : '';
  };
  drawList();

  body.querySelectorAll('[data-space]').forEach((b) => {
    b.onclick = () => {
      const name = b.dataset.space;
      if (S.rooms.some((r) => r.name === name)) return toast('该空间已添加', 'error');
      S.rooms.push({ name, area: 0 });
      drawList();
    };
  });
  body.querySelector('#customSpace').onclick = () => {
    modal({
      title: '自定义空间', width: 400,
      body: `<div class="field"><label class="field-label">空间名称</label>
        <input class="input" id="csName" placeholder="如：影音室、衣帽间、保姆房"></div>
        <div class="field mt12"><label class="field-label">面积（m²）</label>
        <input class="input" id="csArea" type="number" value="10"></div>`,
      footer: `<button class="btn btn-secondary" data-close>取消</button>
        <button class="btn btn-primary" id="csOk">添加</button>`,
      onMount(m, close) {
        m.querySelector('#csOk').onclick = () => {
          const n = m.querySelector('#csName').value.trim();
          if (!n) return toast('请填写名称', 'error');
          S.rooms.push({ name: n, area: Number(m.querySelector('#csArea').value) || 0 });
          drawList(); close();
        };
      },
    });
  };

  body.querySelector('#aiBreak').onclick = async () => {
    try {
      const r = await api.post('/ai/room-breakdown', {
        building_area: S.form.building_area, layout: S.form.layout, building_type: S.form.building_type,
      });
      S.rooms = r.spaces.map((s) => ({ name: s.name, area: s.area }));
      drawList();
      toast('AI 已按户型拆解空间', 'success');
    } catch (e) { toast(e.message, 'error'); }
  };

  body.querySelector('#btnTpl').onclick = async () => {
    try {
      const r = await api.post('/ai/templates/match-rank', {
        building_area: S.form.building_area, layout: S.form.layout, house_type: S.form.house_type,
      });
      if (!r.matches || !r.matches.length) {
        return modal({
          title: '模板匹配', width: 480,
          body: `<p class="t-sm dim">你还没有任何模板。可以先让 AI 生成一个，或在模板管理里手工创建。</p>`,
          footer: `<button class="btn btn-primary" data-close>知道了</button>`,
        });
      }
      modal({
        title: '选择一个模板导入', width: 620,
        body: `<div style="max-height:340px;overflow:auto">${r.matches.map((t) => `
          <div class="pkg-card" data-tpl="${t.id}" style="margin-bottom:10px">
            <div class="row between"><b>${esc(t.name)}</b>
              <span class="badge ${t.score >= 70 ? 'badge-success' : t.score >= 50 ? 'badge-warn' : ''}">匹配 ${t.score} 分</span></div>
            <p>${esc(t.layout || '')} · ${t.building_area || ''} m² · ${esc(t.house_type || '')} · ${esc(t.tier || '')}</p>
            <div class="pkg-exc">${(t.reasons || []).join(' / ') || '按户型与面积匹配'}</div>
          </div>`).join('')}</div>`,
        footer: `<button class="btn btn-secondary" data-close>取消</button>`,
        onMount(m, close) {
          m.querySelectorAll('[data-tpl]').forEach((c) => {
            c.onclick = () => {
              const t = r.matches.find((x) => x.id === c.dataset.tpl);
              S.rooms = (t.spaces || []).map((s) => ({ name: s.name, area: s.area }));
              drawList(); close();
              toast('已导入模板空间配置', 'success');
            };
          });
        },
      });
    } catch (e) { toast(e.message, 'error'); }
  };

  body.querySelector('#prev1').onclick = () => { S.step = 1; draw(el, ctx); };
  body.querySelector('#next3').onclick = () => { S.step = 3; draw(el, ctx); };
}

/* ---------- 步骤 4：现场备注 ---------- */
function step3(body, el, ctx) {
  body.innerHTML = `<div class="panel">
    <div class="panel-head"><div><h2>现场备注</h2>
      <p class="panel-note">老房年数、墙体状态、物业限制、特殊需求 —— 写得越细，AI 估算越准</p></div></div>
    <div class="panel-body">
      <div class="field">
        <textarea class="textarea" id="eNotes" style="min-height:130px" placeholder="例如：老房 25 年、墙面有空鼓、物业不让动承重墙、想做智能家居预留、厨房要改成开放式">${esc(S.notes)}</textarea>
        <div class="field-hint">这些信息会被 AI 用于判断拆除量、加固需求与增项风险</div>
      </div>
      <div class="space-chips mt16">
        ${['老房 20 年以上', '墙面有空鼓', '物业不让动承重墙', '需智能家居预留', '厨房改开放式', '卫生间需重做防水', '有电梯搬运限制', '业主要求环保材料']
    .map((t) => `<button class="chip" data-tip="${t}">+ ${t}</button>`).join('')}
      </div>
      <div class="row between mt24">
        <button class="btn btn-secondary" id="prev2">${icon('arrowLeft', 15)} 上一步</button>
        <button class="btn btn-primary" id="next4">${icon('sparkles', 15)} 生成报价草稿（10 积分）</button>
      </div>
    </div>
  </div>`;

  const ta = body.querySelector('#eNotes');
  body.querySelectorAll('[data-tip]').forEach((b) => {
    b.onclick = () => {
      const t = b.dataset.tip;
      if (ta.value.includes(t)) return;
      ta.value = ta.value ? `${ta.value}；${t}` : t;
    };
  });

  body.querySelector('#prev2').onclick = () => { S.step = 2; draw(el, ctx); };
  body.querySelector('#next4').onclick = async () => {
    S.notes = ta.value.trim();
    S.step = 4;
    draw(el, ctx);
    await generate(el, ctx);
  };
}

/* ---------- 步骤 5：结果与生成 ---------- */
function step4(body, el, ctx) {
  if (!S.result) {
    body.innerHTML = `<div class="panel"><div class="panel-body">
      <div class="empty">
        <div class="spinner dark" style="width:26px;height:26px"></div>
        <div class="empty-title">AI 正在生成报价草稿</div>
        <div class="empty-desc">正在综合城市、户型、空间清单、备注和工艺库… 约 10-15 秒</div>
      </div>
    </div></div>`;
    return;
  }
  const r = S.result;
  body.innerHTML = `
    <div class="panel" style="margin-bottom:16px">
      <div class="panel-head"><div><h2>估算结果</h2>
        <p class="panel-note">${esc(r.summary || '')}</p></div>
        <div class="panel-actions">
          <button class="btn btn-secondary btn-sm" id="reGen">${icon('refresh', 14)} 重新生成</button>
        </div></div>
      <div class="panel-body">
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

        <div class="ai-result__section mt16">
          <h4 class="ai-result__section-title">分类构成</h4>
          ${(r.breakdown || []).map((b) => `<div class="dist-row">
            <div class="dist-top"><span>${esc(b.name)}</span><b>¥${fmt.money(b.amount, 0)} · ${b.ratio}%</b></div>
            <div class="bar"><i style="width:${Math.max(3, b.ratio)}%"></i></div>
          </div>`).join('')}
        </div>

        <div class="ai-result__section mt16">
          <h4 class="ai-result__section-title">估算假设（请人工复核）</h4>
          ${(r.assumptions || []).map((a) => `<div class="assumption-item">${esc(a)}</div>`).join('')}
        </div>

        ${r.adjusted ? `<div class="issue-item warn mt16">
          <div><b>已按经验区间校正</b>
          <span>原始计算 ¥${fmt.money(r.raw_total, 0)}，单方造价偏离${S.form.tier}档经验区间，已校正到 ¥${fmt.money(r.total, 0)}（参考区间 ${fmt.int(r.expect_range[0])}–${fmt.int(r.expect_range[1])} 元/m²）</span></div>
        </div>` : ''}

        <div class="row between mt24 wrap gap12">
          <button class="btn btn-secondary" id="back3">${icon('arrowLeft', 15)} 返回修改条件</button>
          <div class="row gap8">
            <button class="btn btn-secondary" id="viewItems">查看明细（${(r.items || []).length} 条）</button>
            <button class="btn btn-primary" id="toQuote">${icon('file', 15)} 转为正式报价</button>
          </div>
        </div>
      </div>
    </div>
  `;

  body.querySelector('#back3').onclick = () => { S.step = 3; draw(el, ctx); };
  body.querySelector('#reGen').onclick = async () => { S.result = null; draw(el, ctx); await generate(el, ctx); };

  body.querySelector('#viewItems').onclick = () => {
    modal({
      title: `报价明细（${(r.items || []).length} 条）`, width: 800,
      body: `<div style="max-height:460px;overflow:auto"><table class="tbl">
        <thead><tr><th>分类</th><th>项目</th><th class="c">单位</th><th class="r">数量</th><th class="r">单价</th><th class="r">小计</th></tr></thead>
        <tbody>${(r.items || []).map((i) => `<tr>
          <td><span class="badge">${esc(i.group_name)}</span></td>
          <td><b>${esc(i.name)}</b><div class="t-xs muted">${esc((i.craft || '').slice(0, 34))}</div></td>
          <td class="c">${esc(i.unit)}</td><td class="r num">${fmt.num(i.qty)}</td>
          <td class="r num">${fmt.money(i.unit_price)}</td>
          <td class="r num">¥${fmt.money(i.amount || i.unit_price * i.qty)}</td>
        </tr>`).join('')}</tbody></table></div>`,
      footer: `<button class="btn btn-primary" data-close>关闭</button>`,
    });
  };

  body.querySelector('#toQuote').onclick = async () => {
    try {
      const res = await api.post('/ai/estimate-to-quote', {
        params: { ...S.form, package_code: S.pkg ? S.pkg.code : '', notes: S.notes },
        client_name: '待填写客户',
      });
      toast(`已生成报价草稿：${res.quote.quote_number}`, 'success');
      location.hash = `#/app/editor/${res.quote.id}`;
    } catch (e) { toast(e.message, 'error'); }
  };
}

async function generate(el, ctx) {
  try {
    const r = await api.post('/ai/smart-estimate', {
      ...S.form,
      package_code: S.pkg ? S.pkg.code : '',
      rooms: S.rooms,
      notes: S.notes,
    });
    S.result = r;
  } catch (e) {
    S.result = null;
    toast(e.message, 'error');
    S.step = 3;
  }
  draw(el, ctx);
}
