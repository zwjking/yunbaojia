/**
 * 工艺价格库
 */
import { api, icon, esc, fmt, toast, emptyState, loadingRow, modal, confirmBox, exportCSV } from '../core.js';

let items = [];
let groups = [];
let kw = '';
let group = 'all';

export async function render(el, ctx) {
  ctx.setTitle('工艺价格库', '维护你自己的工艺条目、单价与成本，AI 估算会以此为基准');
  ctx.setActions(`
    <button class="btn btn-secondary" id="lbAudit">${icon('shield', 15)} AI 体检（5）</button>
    <button class="btn btn-secondary" id="lbCalib">${icon('target', 15)} 城市校准（5）</button>
    <button class="btn btn-secondary" id="lbPreset">${icon('layers', 15)} 价格预设</button>
    <button class="btn btn-primary" id="lbAdd">${icon('plus', 15)} 新增工艺</button>
  `);
  el.innerHTML = loadingRow('正在读取工艺库…');

  await load(el);

  ctx.bind('#lbAdd', 'onclick', () => editModal(null, () => load(el)));
  ctx.bind('#lbPreset', 'onclick', () => presetModal(() => load(el)));
  ctx.bind('#lbCalib', 'onclick', () => calibModal());
  ctx.bind('#lbAudit', 'onclick', () => auditModal());
}

async function load(el) {
  try {
    const qs = new URLSearchParams({ keyword: kw, group }).toString();
    const r = await api.get('/price-library?' + qs);
    items = r.items || [];
    groups = r.groups || [];
    draw(el);
  } catch (e) {
    el.innerHTML = emptyState('alert', '加载失败', e.message);
  }
}

function draw(el) {
  el.innerHTML = `
    <div class="panel">
      <div class="toolbar">
        <input class="input search" id="lbKw" placeholder="搜索工艺名称 / 关键词" value="${esc(kw)}">
        <select class="select" id="lbGroup" style="min-width:150px">
          <option value="all">全部分类（${items.length}）</option>
          ${groups.map((g) => `<option value="${g.key}" ${group === g.key ? 'selected' : ''}>${g.icon} ${g.name}（${g.count}）</option>`).join('')}
        </select>
        <div class="toolbar-right">
          <button class="btn btn-secondary btn-sm" id="lbExport">${icon('download', 14)} 导出</button>
          <button class="btn btn-secondary btn-sm" id="lbImport">${icon('inbox', 14)} 导入</button>
          <button class="btn btn-ghost btn-sm" id="lbReset">${icon('refresh', 14)} 重置为默认</button>
        </div>
      </div>
      <div class="table-wrap" style="max-height:640px;overflow:auto">
        ${tableHtml()}
      </div>
    </div>
  `;

  const kwInp = el.querySelector('#lbKw');
  let t;
  kwInp.oninput = () => {
    clearTimeout(t);
    t = setTimeout(() => { kw = kwInp.value.trim(); load(el); }, 320);
  };
  el.querySelector('#lbGroup').onchange = (e) => { group = e.target.value; load(el); };

  el.querySelector('#lbExport').onclick = () => {
    exportCSV(`工艺价格库_${new Date().toISOString().slice(0, 10)}.csv`,
      ['分类', '工艺名称', '单位', '参考售价', '成本价', '工艺说明'],
      items.map((i) => [i.group_name, i.name, i.unit, i.price, i.cost, i.craft || '']));
    toast('已导出，可用 Excel 编辑后再导入', 'success');
  };
  el.querySelector('#lbImport').onclick = () => importModal(() => load(el));
  el.querySelector('#lbReset').onclick = async () => {
    const ok = await confirmBox('重置工艺库', '将把所有工艺恢复为系统默认，你的修改会丢失。确定继续吗？', true);
    if (!ok) return;
    try {
      const r = await api.post('/price-library/reset', {});
      toast(`已重置，共 ${r.count} 条`, 'success');
      load(el);
    } catch (e) { toast(e.message, 'error'); }
  };

  el.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => {
    const it = items.find((x) => x.id === b.dataset.edit);
    editModal(it, () => load(el));
  });
  el.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    const ok = await confirmBox('删除工艺', '确定删除这条工艺吗？', true);
    if (!ok) return;
    try { await api.del(`/price-library/${b.dataset.del}`); toast('已删除', 'success'); load(el); }
    catch (e) { toast(e.message, 'error'); }
  });
}

function tableHtml() {
  if (!items.length) return emptyState('search', '没有匹配的工艺', '换个关键词或切换分类');
  return `<table class="tbl">
    <thead><tr>
      <th style="width:120px">分类</th><th>工艺名称</th><th class="c" style="width:70px">单位</th>
      <th class="r" style="width:100px">参考售价</th><th class="r" style="width:100px">成本价</th>
      <th class="r" style="width:80px">毛利</th><th>工艺说明</th><th class="c" style="width:90px">操作</th>
    </tr></thead>
    <tbody>${items.map((i) => {
    const mg = i.price ? (i.price - (i.cost || 0)) / i.price * 100 : 0;
    return `<tr>
        <td><span class="badge">${esc(i.group_name)}</span></td>
        <td><b>${esc(i.name)}</b></td>
        <td class="c">${esc(i.unit)}</td>
        <td class="r num strong">¥${fmt.money(i.price)}</td>
        <td class="r num">¥${fmt.money(i.cost || 0)}</td>
        <td class="r num ${mg < 15 ? 'muted' : ''}">${mg.toFixed(0)}%</td>
        <td class="t-sm muted trunc" style="max-width:280px" title="${esc(i.craft || '')}">${esc(i.craft || '—')}</td>
        <td class="c"><div class="row gap8" style="justify-content:center">
          <button class="btn btn-ghost btn-sm" data-edit="${i.id}">${icon('edit', 14)}</button>
          <button class="btn btn-ghost btn-sm" data-del="${i.id}">${icon('trash', 14)}</button>
        </div></td>
      </tr>`;
  }).join('')}</tbody>
  </table>`;
}

function editModal(item, reload) {
  const i = item || { name: '', unit: '项', price: 0, cost: 0, craft: '', group_key: 'misc', group_name: '未分类' };
  modal({
    title: item ? '编辑工艺' : '新增工艺',
    width: 520,
    body: `
      <div class="form-grid">
        <div class="field"><label class="field-label">工艺名称</label>
          <input class="input" id="iName" value="${esc(i.name)}" placeholder="如：厨卫墙地面防水（三遍）"></div>
        <div class="form-grid c3">
          <div class="field"><label class="field-label">分类</label>
            <select class="select" id="iGroup">
              ${['拆除与保护', '水电工程', '泥瓦工程', '木作吊顶', '油漆涂装', '安装五金', '定制主材', '措施与其他']
    .map((g) => `<option ${g === i.group_name ? 'selected' : ''}>${g}</option>`).join('')}
            </select></div>
          <div class="field"><label class="field-label">单位</label>
            <input class="input" id="iUnit" value="${esc(i.unit)}"></div>
          <div class="field"><label class="field-label">售价</label>
            <input class="input" id="iPrice" type="number" step="0.01" value="${i.price}"></div>
        </div>
        <div class="field"><label class="field-label">成本价</label>
          <input class="input" id="iCost" type="number" step="0.01" value="${i.cost || 0}">
          <span class="field-hint">填写后报价体检才能计算毛利</span></div>
        <div class="field"><label class="field-label">工艺说明</label>
          <textarea class="textarea" id="iCraft" placeholder="施工做法与验收标准，会显示在客户报价页">${esc(i.craft || '')}</textarea></div>
      </div>`,
    footer: `<button class="btn btn-secondary" data-close>取消</button>
      <button class="btn btn-primary" id="iSave">保存</button>`,
    onMount(m, close) {
      m.querySelector('#iSave').onclick = async () => {
        const body = {
          name: m.querySelector('#iName').value.trim(),
          group_name: m.querySelector('#iGroup').value,
          unit: m.querySelector('#iUnit').value.trim() || '项',
          price: Number(m.querySelector('#iPrice').value) || 0,
          cost: Number(m.querySelector('#iCost').value) || 0,
          craft: m.querySelector('#iCraft').value,
        };
        if (!body.name) return toast('请填写工艺名称', 'error');
        try {
          if (item) await api.put(`/price-library/${item.id}`, body);
          else await api.post('/price-library', body);
          close(); toast('已保存', 'success'); reload();
        } catch (e) { toast(e.message, 'error'); }
      };
    },
  });
}

function presetModal(reload) {
  api.get('/price-library/presets').then((presets) => {
    modal({
      title: '套用价格预设', width: 520,
      body: `<p class="t-sm dim" style="margin-bottom:14px">按整体系数批量调整工艺库价格，适合快速切换报价口径。</p>
        ${presets.map((p) => `<div class="pkg-card" data-preset="${p.code}" style="margin-bottom:10px">
          <b>${esc(p.name)}</b><p>${esc(p.desc)}</p></div>`).join('')}`,
      footer: `<button class="btn btn-secondary" data-close>取消</button>`,
      onMount(m, close) {
        m.querySelectorAll('[data-preset]').forEach((c) => {
          c.onclick = async () => {
            try {
              const r = await api.post('/price-library/apply-preset', { code: c.dataset.preset });
              close(); toast(r.message, 'success'); reload();
            } catch (e) { toast(e.message, 'error'); }
          };
        });
      },
    });
  });
}

function calibModal() {
  modal({
    title: '城市价格校准', width: 520,
    body: `<div class="field"><label class="field-label">目标城市</label>
      <input class="input" id="cCity" placeholder="如：上海 / 合肥 / 兰州"></div>
      <div class="t-xs muted mt12">消耗 5 积分。AI 会根据城市等级给出整体调整系数与示例明细，只影响你自己的报价，不修改系统基础库。</div>
      <div id="cResult"></div>`,
    footer: `<button class="btn btn-secondary" data-close>关闭</button>
      <button class="btn btn-primary" id="cRun">${icon('target', 15)} 开始校准（5 积分）</button>`,
    onMount(m) {
      m.querySelector('#cRun').onclick = async () => {
        const city = m.querySelector('#cCity').value.trim();
        if (!city) return toast('请输入城市', 'error');
        const btn = m.querySelector('#cRun');
        btn.disabled = true; btn.innerHTML = `<span class="spinner"></span>校准中`;
        try {
          const r = await api.post('/ai/library/calibrate-by-city', { target_city: city });
          m.querySelector('#cResult').innerHTML = `
            <div class="ai-result mt16">
              <div class="kpi-grid">
                <div class="ai-result__kpi"><div class="ai-result__kpi-label">城市等级</div>
                  <div class="ai-result__kpi-value" style="font-size:15px">${esc(r.tier)}</div></div>
                <div class="ai-result__kpi"><div class="ai-result__kpi-label">价格系数</div>
                  <div class="ai-result__kpi-value">${r.factor}</div></div>
                <div class="ai-result__kpi"><div class="ai-result__kpi-label">影响条目</div>
                  <div class="ai-result__kpi-value">${r.affected_count}</div></div>
              </div>
              <div class="ai-result__section mt16"><h4 class="ai-result__section-title">结论</h4>
                <div class="t-sm" style="line-height:1.8;color:var(--text-2)">${esc(r.summary)}</div>
                <div class="t-xs muted mt8">${esc(r.note)}</div></div>
            </div>`;
          toast('校准完成', 'success');
        } catch (e) { toast(e.message, 'error'); }
        finally { btn.disabled = false; btn.innerHTML = `${icon('target', 15)} 开始校准（5 积分）`; }
      };
    },
  });
}

function auditModal() {
  modal({
    title: '工艺库 AI 体检', width: 640,
    body: `<p class="t-sm dim">消耗 5 积分。检查离群价格、逻辑矛盾与缺失说明。</p>
      <div id="aBody" class="mt12"></div>`,
    footer: `<button class="btn btn-secondary" data-close>关闭</button>
      <button class="btn btn-primary" id="aRun">${icon('shield', 15)} 开始体检（5 积分）</button>`,
    onMount(m) {
      m.querySelector('#aRun').onclick = async () => {
        const btn = m.querySelector('#aRun');
        btn.disabled = true; btn.innerHTML = `<span class="spinner"></span>体检中`;
        try {
          const r = await api.post('/ai/library/audit', {});
          m.querySelector('#aBody').innerHTML = `
            <div class="kpi-grid">
              <div class="ai-result__kpi"><div class="ai-result__kpi-label">检查条目</div>
                <div class="ai-result__kpi-value">${r.total}</div></div>
              <div class="ai-result__kpi"><div class="ai-result__kpi-label">待复核项</div>
                <div class="ai-result__kpi-value">${r.issue_count}</div></div>
              <div class="ai-result__kpi"><div class="ai-result__kpi-label">健康度</div>
                <div class="ai-result__kpi-value">${r.health_score}</div></div>
            </div>
            <div class="t-sm b mt16 mb8">${esc(r.summary)}</div>
            <div style="max-height:260px;overflow:auto">
              ${(r.issues || []).map((i) => `<div class="issue-item ${i.type === '逻辑矛盾' ? 'high' : 'warn'}">
                ${icon('alert', 16)}<div><b>${esc(i.name)}</b><span>${esc(i.advice)}</span></div></div>`).join('')
    || '<div class="t-sm muted">未发现明显异常。</div>'}
            </div>`;
          toast('体检完成', 'success');
        } catch (e) { toast(e.message, 'error'); }
        finally { btn.disabled = false; btn.innerHTML = `${icon('shield', 15)} 开始体检（5 积分）`; }
      };
    },
  });
}

function importModal(reload) {
  modal({
    title: '导入工艺', width: 560,
    body: `<p class="t-sm dim">粘贴 CSV 内容（分类,工艺名称,单位,售价,成本,工艺说明），第一行为表头会自动跳过。</p>
      <div class="field mt12"><textarea class="textarea" id="impText" style="min-height:180px" placeholder="水电工程,给水管改造 PPR,m,68,46,热熔连接含试压"></textarea></div>
      <div class="t-xs muted mt8">也可以先导出当前工艺库，用 Excel 编辑后整表粘回来。</div>`,
    footer: `<button class="btn btn-secondary" data-close>取消</button>
      <button class="btn btn-primary" id="impOk">开始导入</button>`,
    onMount(m, close) {
      m.querySelector('#impOk').onclick = async () => {
        const text = m.querySelector('#impText').value.trim();
        if (!text) return toast('请粘贴 CSV 内容', 'error');
        const lines = text.split(/\r?\n/).filter(Boolean);
        const rows = lines.map((l) => l.split(/[,\t]/).map((x) => x.trim()))
          .filter((r) => r.length >= 3 && r[1])
          .map((r) => ({ group_name: r[0], name: r[1], unit: r[2] || '项', price: Number(r[3]) || 0, cost: Number(r[4]) || 0, craft: r[5] || '' }));
        if (!rows.length) return toast('没有解析到有效数据', 'error');
        try {
          const r = await api.post('/price-library/import', { items: rows });
          close(); toast(r.message, 'success'); reload();
        } catch (e) { toast(e.message, 'error'); }
      };
    },
  });
}
