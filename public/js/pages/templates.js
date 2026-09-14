/**
 * 户型模板管理
 */
import { api, icon, esc, fmt, toast, emptyState, loadingRow, modal, confirmBox } from '../core.js';

export async function render(el, ctx) {
  ctx.setTitle('模板管理', '把常用户型存成模板，下次接单直接套用');
  ctx.setActions(`
    <button class="btn btn-secondary" id="tpAi">${icon('sparkles', 15)} AI 生成模板（10 积分）</button>
    <button class="btn btn-primary" id="tpNew">${icon('plus', 15)} 新建模板</button>
  `);
  el.innerHTML = loadingRow('正在读取模板…');

  const load = async () => {
    try {
      const list = await api.get('/room-templates');
      draw(el, ctx, list, load);
    } catch (e) {
      el.innerHTML = emptyState('alert', '加载失败', e.message);
    }
  };

  ctx.bind('#tpNew', 'onclick', () => editModal(null, load));
  ctx.bind('#tpAi', 'onclick', () => aiModal(load));
  await load();
}

function draw(el, ctx, list, reload) {
  if (!list.length) {
    el.innerHTML = `<div class="panel"><div class="panel-body">${emptyState('layers', '还没有模板',
      '把常用的户型空间配置存成模板，下次接单直接套用；也可以让 AI 生成一个',
      `<div class="row gap8" style="justify-content:center">
        <button class="btn btn-primary" id="e1">${icon('plus', 15)} 手工新建</button>
        <button class="btn btn-secondary" id="e2">${icon('sparkles', 15)} AI 生成</button>
      </div>`)}</div></div>`;
    el.querySelector('#e1').onclick = () => editModal(null, reload);
    el.querySelector('#e2').onclick = () => aiModal(reload);
    return;
  }

  el.innerHTML = `<div class="grid c3">
    ${list.map((t) => `<div class="panel">
      <div class="panel-head">
        <div><h2 style="font-size:15px">${esc(t.name)}</h2>
          <p class="panel-note">${esc(t.layout || '未填户型')} · ${t.building_area || '—'} m² · ${esc(t.house_type || '')} · ${esc(t.tier || '')}</p></div>
      </div>
      <div class="panel-body">
        <div class="row wrap gap8" style="margin-bottom:14px">
          ${(t.spaces || []).map((s) => `<span class="badge badge-brand">${esc(s.name)} ${s.area || 0}m²</span>`).join('')
    || '<span class="t-sm muted">未配置空间</span>'}
        </div>
        <div class="t-xs muted">${(t.spaces || []).length} 个空间 · 合计 ${(t.spaces || []).reduce((s, x) => s + (Number(x.area) || 0), 0).toFixed(1)} m²</div>
        ${t.note ? `<div class="t-xs muted mt8">${esc(t.note)}</div>` : ''}
      </div>
      <div class="panel-body" style="border-top:1px solid var(--border);display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm" data-edit="${t.id}">${icon('edit', 14)} 编辑</button>
        <button class="btn btn-ghost btn-sm" data-del="${t.id}">${icon('trash', 14)} 删除</button>
      </div>
    </div>`).join('')}
  </div>`;

  el.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => {
    const t = list.find((x) => x.id === b.dataset.edit);
    editModal(t, reload);
  });
  el.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    const ok = await confirmBox('删除模板', '确定删除这个模板吗？', true);
    if (!ok) return;
    try { await api.del(`/room-templates/${b.dataset.del}`); toast('已删除', 'success'); reload(); }
    catch (e) { toast(e.message, 'error'); }
  });
}

function editModal(tpl, reload) {
  const t = tpl || { name: '', layout: '三室两厅两卫', building_area: 100, building_type: '高层', house_type: '新房', city: '', tier: '中档', spaces: [], note: '' };
  const spaces = (t.spaces || []).map((s) => ({ ...s }));

  modal({
    title: tpl ? '编辑模板' : '新建模板',
    width: 640,
    body: `
      <div class="form-grid c2">
        <div class="field"><label class="field-label">模板名称</label>
          <input class="input" id="tName" value="${esc(t.name)}" placeholder="如：三居室标准平层"></div>
        <div class="field"><label class="field-label">户型</label>
          <select class="select" id="tLayout">
            ${['一室一厅一卫', '两室一厅一卫', '两室两厅一卫', '三室两厅一卫', '三室两厅两卫', '四室两厅两卫']
    .map((x) => `<option ${x === t.layout ? 'selected' : ''}>${x}</option>`).join('')}
          </select></div>
        <div class="field"><label class="field-label">建筑面积 m²</label>
          <input class="input" id="tArea" type="number" value="${t.building_area || 100}"></div>
        <div class="field"><label class="field-label">建筑类型</label>
          <select class="select" id="tBType">
            ${['高层', '多层', '低层', '别墅'].map((x) => `<option ${x === t.building_type ? 'selected' : ''}>${x}</option>`).join('')}
          </select></div>
        <div class="field"><label class="field-label">房屋类型</label>
          <select class="select" id="tHType">
            ${['新房', '老房'].map((x) => `<option ${x === t.house_type ? 'selected' : ''}>${x}</option>`).join('')}
          </select></div>
        <div class="field"><label class="field-label">档次</label>
          <select class="select" id="tTier">
            ${['简装', '中档', '高档', '定制'].map((x) => `<option ${x === t.tier ? 'selected' : ''}>${x}</option>`).join('')}
          </select></div>
      </div>
      <div class="mt16">
        <label class="field-label">空间配置</label>
        <div class="space-chips mt8">
          ${['客厅', '餐厅', '主卧', '次卧', '书房', '厨房', '主卫', '客卫', '阳台', '玄关过道']
    .map((s) => `<button class="chip" data-add="${s}">+ ${s}</button>`).join('')}
        </div>
        <div class="space-list" id="tSpaces"></div>
        <button class="btn btn-secondary btn-sm mt8" id="tAiBreak">${icon('sparkles', 14)} AI 自动拆解（3 积分）</button>
      </div>
      <div class="field mt16"><label class="field-label">备注</label>
        <textarea class="textarea" id="tNote">${esc(t.note || '')}</textarea></div>`,
    footer: `<button class="btn btn-secondary" data-close>取消</button>
      <button class="btn btn-primary" id="tSave">保存模板</button>`,
    onMount(m, close) {
      const box = m.querySelector('#tSpaces');
      const drawSpaces = () => {
        box.innerHTML = spaces.length
          ? spaces.map((s, i) => `<div class="space-row">
              <input class="n" value="${esc(s.name)}" data-i="${i}" data-k="name">
              <input class="a" type="number" step="0.1" value="${s.area || 0}" data-i="${i}" data-k="area">
              <span class="t-sm muted">m²</span>
              <button class="btn btn-ghost btn-sm" data-rm="${i}">${icon('trash', 14)}</button>
            </div>`).join('')
          : `<div class="empty" style="padding:20px"><div class="empty-desc">还没有空间，点上方标签添加</div></div>`;
        box.querySelectorAll('input').forEach((inp) => {
          inp.oninput = () => { spaces[Number(inp.dataset.i)][inp.dataset.k] = inp.dataset.k === 'area' ? Number(inp.value) || 0 : inp.value; };
        });
        box.querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => { spaces.splice(Number(b.dataset.rm), 1); drawSpaces(); });
      };
      drawSpaces();
      m.querySelectorAll('[data-add]').forEach((b) => b.onclick = () => {
        const n = b.dataset.add;
        if (spaces.some((s) => s.name === n)) return;
        spaces.push({ name: n, area: 0 }); drawSpaces();
      });

      m.querySelector('#tAiBreak').onclick = async () => {
        try {
          const r = await api.post('/ai/room-breakdown', {
            building_area: Number(m.querySelector('#tArea').value) || 100,
            layout: m.querySelector('#tLayout').value,
            building_type: m.querySelector('#tBType').value,
          });
          spaces.length = 0;
          r.spaces.forEach((s) => spaces.push({ name: s.name, area: s.area }));
          drawSpaces();
          toast('已自动拆解', 'success');
        } catch (e) { toast(e.message, 'error'); }
      };

      m.querySelector('#tSave').onclick = async () => {
        const body = {
          name: m.querySelector('#tName').value.trim() || '未命名模板',
          layout: m.querySelector('#tLayout').value,
          building_area: Number(m.querySelector('#tArea').value) || 0,
          building_type: m.querySelector('#tBType').value,
          house_type: m.querySelector('#tHType').value,
          tier: m.querySelector('#tTier').value,
          spaces, note: m.querySelector('#tNote').value,
        };
        try {
          if (tpl) await api.put(`/room-templates/${tpl.id}`, body);
          else await api.post('/room-templates', body);
          close(); toast('已保存', 'success'); reload();
        } catch (e) { toast(e.message, 'error'); }
      };
    },
  });
}

function aiModal(reload) {
  modal({
    title: 'AI 生成户型模板',
    width: 520,
    body: `
      <div class="form-grid c2">
        <div class="field"><label class="field-label">模板名称</label>
          <input class="input" id="aName" placeholder="留空则自动生成"></div>
        <div class="field"><label class="field-label">户型</label>
          <select class="select" id="aLayout">
            ${['一室一厅一卫', '两室一厅一卫', '两室两厅一卫', '三室两厅一卫', '三室两厅两卫', '四室两厅两卫']
    .map((x) => `<option ${x === '三室两厅两卫' ? 'selected' : ''}>${x}</option>`).join('')}
          </select></div>
        <div class="field"><label class="field-label">建筑面积 m²</label>
          <input class="input" id="aArea" type="number" value="100"></div>
        <div class="field"><label class="field-label">建筑类型</label>
          <select class="select" id="aBType">
            ${['高层', '多层', '低层', '别墅'].map((x) => `<option>${x}</option>`).join('')}
          </select></div>
      </div>
      <div class="t-xs muted mt12">消耗 10 积分，成功才扣。AI 会按户型与面积自动拆解出各空间面积。</div>`,
    footer: `<button class="btn btn-secondary" data-close>取消</button>
      <button class="btn btn-primary" id="aRun">${icon('sparkles', 15)} 生成（10 积分）</button>`,
    onMount(m, close) {
      m.querySelector('#aRun').onclick = async () => {
        const btn = m.querySelector('#aRun');
        btn.disabled = true; btn.innerHTML = `<span class="spinner"></span>生成中`;
        try {
          const r = await api.post('/ai/templates/ai-generate', {
            name: m.querySelector('#aName').value.trim(),
            layout: m.querySelector('#aLayout').value,
            building_area: Number(m.querySelector('#aArea').value) || 100,
            building_type: m.querySelector('#aBType').value,
          });
          await api.post('/room-templates', { ...r, source: 'ai' });
          close(); toast('模板已生成', 'success'); reload();
        } catch (e) {
          toast(e.message, 'error');
          btn.disabled = false; btn.innerHTML = `${icon('sparkles', 15)} 生成（10 积分）`;
        }
      };
    },
  });
}
