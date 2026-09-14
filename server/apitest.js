/**
 * 接口层自测：进程内启动服务，逐一验证 API
 * 运行：node server/apitest.js
 */
process.chdir(__dirname);
process.argv[2] = '5199';

const server = require('./server.js');
const PORT = 5199;
const B = `http://127.0.0.1:${PORT}/api/v1`;

let token = '';
let pass = 0, fail = 0;

async function call(method, path, body, useToken = true) {
  const m = method === 'DEL' ? 'DELETE' : method;
  const res = await fetch(B + path, {
    method: m,
    headers: {
      'Content-Type': 'application/json',
      ...(useToken && token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try { data = await res.json(); } catch (e) { data = { error: '非 JSON 响应' }; }
  return { status: res.status, data };
}

function check(name, cond, extra = '') {
  if (cond) { pass += 1; console.log(`  [OK]   ${name} ${extra}`); }
  else { fail += 1; console.log(`  [FAIL] ${name} ${extra}`); }
}

function ok(r) { return r.status >= 200 && r.status < 300; }
function brief(r) { return r.data && r.data.error ? `ERR: ${r.data.error}` : JSON.stringify(r.data).slice(0, 160); }

(async () => {
  await new Promise((r) => setTimeout(r, 900));

  console.log('\n===== A. 基础与认证 =====');
  let r = await call('GET', '/health', null, false);
  check('健康检查', ok(r) && r.data.status === 'ok', `v${r.data.version} · AI=${r.data.ai_engine} · 用户${r.data.counts.users}`);

  r = await call('GET', '/public-config', null, false);
  check('公开配置', ok(r), r.data.app_name);

  r = await call('POST', '/auth/login', { account: '13800000000', password: '123456' }, false);
  check('演示账号登录', ok(r) && !!r.data.access_token, r.data.user ? `${r.data.user.name} / ${r.data.plan_info.plan_name}` : brief(r));
  if (r.data.access_token) token = r.data.access_token;

  r = await call('POST', '/auth/login', { account: '13800000000', password: 'wrong' }, false);
  check('错误密码被拒绝', r.status === 401);

  r = await call('GET', '/users/me');
  check('获取当前用户', ok(r) && r.data.phone === '13800000000', `积分 ${r.data.credits}`);

  console.log('\n===== B. 注册新账号 =====');
  const newPhone = '139' + String(Math.floor(Math.random() * 90000000) + 10000000);
  r = await call('POST', '/auth/sms-code/send', { phone: newPhone }, false);
  check('发送验证码', ok(r) && !!r.data.dev_code, `验证码 ${r.data.dev_code}`);
  const code = r.data.dev_code;

  r = await call('POST', '/auth/register', { phone: newPhone, password: '123456', name: '测试账号', code }, false);
  check('注册成功', ok(r) && !!r.data.access_token, `${r.data.user.name} · 赠 ${r.data.user.credits} 积分`);
  const newToken = r.data.access_token;
  const newUser = r.data.user;

  // 切回演示账号
  token = (await call('POST', '/auth/login', { account: '13800000000', password: '123456' }, false)).data.access_token;
  const demoToken = token;

  console.log('\n===== C. 报价模块 =====');
  r = await call('GET', '/quotes');
  check('报价列表', ok(r) && r.data.total >= 3, `${r.data.total} 张 · 统计：赢单率 ${r.data.stats.win_rate}%`);

  r = await call('GET', '/quotes/stats?range=all');
  check('报价统计', ok(r) && r.data.total >= 3, `总额 ¥${r.data.amount}`);

  r = await call('POST', '/quotes', { title: '接口测试报价', city: '合肥', building_area: 100, layout: '三室两厅一卫', tier: '中档' });
  check('新建报价', ok(r) && !!r.data.id, `${r.data.quote_number}`);
  const qid = r.data.id;

  r = await call('GET', `/quotes/${qid}`);
  check('报价详情', ok(r) && r.data.id === qid);

  r = await call('POST', `/quotes/${qid}/items`, { group_name: '水电工程', name: '强电布线 2.5mm²（暗线含开槽）', unit: 'm', qty: 320, unit_price: 45, cost_price: 30 });
  check('添加明细', ok(r), `小计 ¥${r.data.amount}`);

  r = await call('POST', `/quotes/${qid}/items/batch`, {
    items: [
      { group_name: '油漆涂装', name: '墙面刷乳胶漆（底漆一遍+面漆两遍）', unit: 'm²', qty: 200, unit_price: 28, cost_price: 18 },
      { group_name: '泥瓦工程', name: '厨卫墙地面防水（聚合物水泥基三遍）', unit: 'm²', qty: 45, unit_price: 58, cost_price: 38 },
    ], replace: true,
  });
  check('批量保存明细', ok(r) && r.data.length >= 2, `${r.data.length} 条`);

  r = await call('GET', `/quotes/${qid}`);
  check('金额自动汇总', r.data.total_amount > 0 && r.data.margin_rate > 0, `合计 ¥${r.data.total_amount} · 毛利 ${r.data.margin_rate}%`);

  r = await call('GET', `/quotes/${qid}/pricing-audit`);
  check('报价体检', ok(r) && r.data.item_count >= 2, `问题 ${(r.data.issues || []).length} 处`);

  r = await call('GET', `/quotes/${qid}/material-takeoff`);
  check('材料用量', ok(r), `${(r.data.materials || []).length} 种材料`);

  r = await call('POST', `/quotes/${qid}/duplicate`, {});
  check('复制报价', ok(r) && r.data.title.includes('副本'));

  r = await call('POST', `/quotes/${qid}/submit`, {});
  check('状态流转：提交审批', ok(r) && r.data.status === 'pending_approval', r.data.status);
  r = await call('POST', `/quotes/${qid}/approve`, {});
  check('状态流转：审批通过', ok(r) && r.data.status === 'approved');
  r = await call('POST', `/quotes/${qid}/finalize`, {});
  check('状态流转：定稿', ok(r) && r.data.status === 'final');
  r = await call('POST', `/quotes/${qid}/issue`, {});
  check('状态流转：签发', ok(r) && r.data.status === 'issued', r.data.status);
  r = await call('POST', `/quotes/${qid}/win`, {});
  check('状态流转：成交', ok(r) && r.data.status === 'won');

  r = await call('POST', `/quotes/${qid}/share`, {});
  check('生成分享链接', ok(r) && !!r.data.token, `#/q/${(r.data.token || '').slice(0, 10)}…`);
  const shareToken = r.data.token;
  r = await call('GET', `/quotes/share/${shareToken}`, null, false);
  check('免登录读取分享', ok(r) && r.data.quote && r.data.quote.quote_number, `客户可见 ${(r.data.items || []).length} 条明细`);

  r = await call('POST', `/quotes/${qid}/unlock-export`, {});
  check('解锁导出', ok(r), r.data.message || '');

  r = await call('GET', `/quotes/${qid}/history`);
  check('操作历史', ok(r), `${r.data.length} 条记录`);

  r = await call('DEL', `/quotes/${qid}`, null) ;
  // 已成交报价不可删，验证保护
  check('已成交报价禁止删除', r.status === 400 || r.status === 403 || !ok(r), `status ${r.status}`);

  console.log('\n===== D. 工艺价格库 =====');
  r = await call('GET', '/price-library');
  check('工艺库列表', ok(r) && r.data.total >= 180, `${r.data.total} 条 · ${r.data.groups.length} 分类`);

  r = await call('POST', '/price-library', { name: '测试工艺项', group_name: '水电工程', unit: 'm', price: 66, cost: 40, craft: '测试' });
  check('新增工艺', ok(r));
  const libId = r.data.id;
  r = await call('PUT', `/price-library/${libId}`, { price: 88 });
  check('修改工艺', ok(r) && r.data.price === 88);
  r = await call('DEL', `/price-library/${libId}`);
  check('删除工艺', ok(r));

  r = await call('GET', '/price-library/presets');
  check('价格预设列表', ok(r) && r.data.length === 4);

  console.log('\n===== E. 模板 / 客户 =====');
  r = await call('POST', '/room-templates', { name: '测试模板', layout: '三室两厅两卫', building_area: 110, spaces: [{ name: '客厅', area: 20 }] });
  check('新建模板', ok(r));
  const tplId = r.data.id;
  r = await call('GET', '/room-templates');
  check('模板列表', ok(r) && r.data.length >= 1);
  r = await call('POST', '/ai/templates/match-rank', { building_area: 108, layout: '三室两厅两卫', house_type: '新房' });
  check('本地模板匹配（免费）', ok(r) && r.data.matches.length >= 1, `最高 ${r.data.best ? r.data.best.score : 0} 分`);
  r = await call('DEL', `/room-templates/${tplId}`);
  check('删除模板', ok(r));

  r = await call('POST', '/customers', { name: '测试客户', phone: '13800009999', community: '测试小区', building_area: 100 });
  check('新建客户', ok(r));
  const cid = r.data.id;
  r = await call('GET', '/customers');
  check('客户列表', ok(r) && r.data.total >= 1, `${r.data.total} 位`);
  r = await call('DEL', `/customers/${cid}`);
  check('删除客户', ok(r));

  console.log('\n===== F. AI 功能（积分计费） =====');
  r = await call('GET', '/ai/feature-costs');
  check('积分消耗表', ok(r) && r.data.length >= 15, `${r.data.length} 项`);
  r = await call('GET', '/ai/provider-status');
  check('引擎状态', ok(r), r.data.note ? r.data.note.slice(0, 30) + '…' : '');
  r = await call('GET', '/ai/quote-packages');
  check('智能套餐', ok(r) && r.data.length === 5);

  r = await call('POST', '/ai/room-breakdown', { building_area: 108, layout: '三室两厅两卫', building_type: '高层' });
  check('AI 户型拆解', ok(r) && r.data.spaces.length >= 8, `${r.data.spaces.length} 个空间`);

  // 用普通账号（非平台管理员、非无限额度）验证积分真实扣减
  token = newToken;
  const before = (await call('GET', '/users/me')).data.credits;
  r = await call('POST', '/ai/room-breakdown', { building_area: 108, layout: '三室两厅两卫', building_type: '高层' });
  check('普通账号 AI 调用', ok(r) && r.data.cost === 3, `扣 ${r.data.cost} 积分`);
  const after = (await call('GET', '/users/me')).data.credits;
  check('积分正确扣减', after === before - 3, `${before} → ${after}`);
  token = demoToken;

  r = await call('POST', '/ai/smart-estimate', {
    city: '合肥', building_area: 108, layout: '三室两厅两卫', tier: '中档',
    house_type: '新房', building_type: '高层', floor: 8, has_elevator: true,
  });
  check('AI 智能造价', ok(r) && r.data.items.length > 40, `${r.data.items.length} 条 · ¥${r.data.total} · ${r.data.per_sqm} 元/m²`);

  r = await call('POST', '/ai/estimate-to-quote', {
    params: { city: '合肥', building_area: 89, layout: '两室两厅一卫', tier: '简装', house_type: '老房', house_age: 15 },
    client_name: '接口测试客户',
  });
  check('估算转正式报价', ok(r) && !!(r.data.quote && r.data.quote.id), ok(r) ? `${r.data.quote.quote_number} · ${r.data.items_count} 条 · ¥${r.data.total}` : brief(r));
  const aiQuoteId = r.data.quote && r.data.quote.id;
  if (!aiQuoteId) {
    console.log(`\n===== 结果：通过 ${pass} 项，失败 ${fail} 项（估算转报价失败，后续用例中止） =====\n`);
    server.close();
    process.exit(1);
  }

  r = await call('POST', '/ai/quote-review', {
    items: (await call('GET', `/quotes/${aiQuoteId}`)).data.items.map((i) => ({
      group_name: i.group_name, name: i.name, unit: i.unit, qty: i.qty, unit_price: i.unit_price, cost_price: i.cost_price,
    })),
  });
  check('AI 整单复核', ok(r) && r.data.score > 0, `评分 ${r.data.score} · 漏项 ${(r.data.missing || []).length}`);

  r = await call('POST', '/ai/customer-copy', { items_text: '墙面刷乳胶漆\n厨卫防水', city: '合肥' });
  check('AI 话术润色', ok(r) && r.data.lines.length === 2, r.data.lines[0].slice(0, 20) + '…');

  r = await call('GET', '/ai/usage-summary');
  check('AI 用量看板', ok(r) && r.data.total_calls >= 3, `${r.data.total_calls} 次调用 · ${r.data.total_credits} 积分`);

  console.log('\n===== G. 计费 =====');
  r = await call('GET', '/plans');
  check('套餐列表', ok(r) && r.data.length === 4, r.data.map((p) => p.name).join('/'));
  r = await call('GET', '/ai-credits/packs');
  check('积分充值包', ok(r) && r.data.length >= 5);
  r = await call('POST', '/ai-credits/purchases', { pack_code: 'c500' });
  check('创建积分订单', ok(r), `${r.data.order_no} · ¥${r.data.amount}`);
  r = await call('POST', `/ai-credits/purchases/${r.data.id}/pay`, { method: '模拟支付' });
  check('模拟支付并到账', ok(r), r.data.message);
  r = await call('GET', '/ai-credits/balance');
  check('积分余额已增加', r.data.credits > 0, `${r.data.credits} 积分`);

  r = await call('POST', '/report-credits/purchases', { pack_code: 'e5' });
  check('购买出单次数', ok(r));
  r = await call('POST', `/report-credits/purchases/${r.data.id}/pay`, { method: '模拟支付' });
  check('出单次数到账', ok(r), r.data.message);
  r = await call('GET', '/report-credits/balance');
  check('出单次数余额', r.data.remaining >= 5, `剩余 ${r.data.remaining} 次`);

  console.log('\n===== H. 组织与设置 =====');
  r = await call('GET', '/org/profile');
  check('组织信息', ok(r), r.data.name);
  r = await call('PUT', '/org/profile', { name: '云报价演示工作室' });
  check('更新组织', ok(r) && r.data.name === '云报价演示工作室');
  r = await call('GET', '/org/settings');
  check('组织设置', ok(r) && Array.isArray(r.data.labor_wage_standards), `${(r.data.labor_wage_standards || []).length} 个工种标准`);
  r = await call('GET', '/users');
  check('成员列表', ok(r) && r.data.length >= 1, `${r.data.length} 位`);
  r = await call('PUT', '/users/me', { name: '演示账号' });
  check('更新个人资料', ok(r));

  console.log('\n===== I. 平台管理 =====');
  r = await call('GET', '/admin/overview');
  check('平台总览', ok(r) && r.data.users.total >= 2, `用户 ${r.data.users.total} · 报价 ${r.data.quotes.total} · AI ${r.data.ai.calls} 次`);
  r = await call('GET', '/admin/users');
  check('平台用户列表', ok(r) && r.data.length >= 2, `${r.data.length} 位`);
  r = await call('POST', '/admin/credit-grants', { phone: newPhone, amount: 500, reason: '接口测试发放' });
  check('发放积分', ok(r), `给 ${newPhone} 发 500 积分`);

  console.log('\n===== J. 权限与异常 =====');
  const savedToken = token;
  token = '';
  r = await call('GET', '/quotes');
  check('未登录访问被拦截', r.status === 401, `status ${r.status}`);
  r = await call('GET', '/admin/overview');
  check('未登录管理接口被拦截', r.status === 401);
  token = 'invalid.token.xxx';
  r = await call('GET', '/users/me');
  check('无效令牌被拒绝', r.status === 401);
  token = savedToken;

  // 新注册用户（非平台管理员）访问管理接口
  r = await fetch(B + '/admin/overview', { headers: { Authorization: `Bearer ${newToken}` } });
  check('普通用户无权管理后台', r.status === 403, `status ${r.status}`);

  r = await call('GET', '/not-exist-api');
  check('未知接口 404', r.status === 404);

  console.log(`\n===== 结果：通过 ${pass} 项，失败 ${fail} 项 =====\n`);
  server.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('测试异常：', e);
  process.exit(1);
});
