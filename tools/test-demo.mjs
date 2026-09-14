/**
 * 静态演示版接口自测：在 Node 中以浏览器环境运行 bundle.js，逐个打真实接口。
 *
 *   node tools/test-demo.mjs
 *
 * 等价于对「GitHub Pages 上那份前端」做接口冒烟，但不需要浏览器。
 */
globalThis.window = globalThis; // bundle 会挂到 window 上；localStorage 缺失时自动退化为内存模式

const here = new URL('.', import.meta.url);
await import(new URL('../public/js/demo/bundle.js', here).href);

const D = globalThis.__HQ_DEMO__;
if (!D) {
  console.error('❌ bundle 未挂载 window.__HQ_DEMO__');
  process.exit(1);
}

let pass = 0;
const fails = [];

function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}${detail ? '  ' + detail : ''}`); }
  else { fails.push(name); console.log(`  ✗ ${name}  ${detail}`); }
}

let token = '';

async function call(method, path, body, useToken = true) {
  const headers = {};
  if (useToken && token) headers.authorization = `Bearer ${token}`;
  const r = await D.handle(method, path, body || {}, headers);
  return r;
}

function ok(r) { return r.status >= 200 && r.status < 300; }

console.log('\n=== 演示版接口自测 ===\n');
console.log('【1】公开接口');

let r = await call('GET', '/health', null, false);
check('健康检查', ok(r) && r.data.status === 'ok', `${r.data.mode} · ${r.data.ai_engine} · 工艺库 ${r.data.counts.library} 条`);

r = await call('GET', '/public-config', null, false);
check('站点配置', ok(r), Object.keys(r.data || {}).slice(0, 5).join(','));

r = await call('GET', '/plans', null, false);
const plansRaw = r.data;
const plans = Array.isArray(plansRaw) ? plansRaw : ((plansRaw && plansRaw.plans) || []);
check('套餐列表', ok(r) && plans.length >= 4, plans.map((p) => p.name).join('/'));

console.log('\n【2】认证');

r = await call('POST', '/auth/login', { account: '13800000000', password: '123456' }, false);
check('演示账号登录', ok(r) && !!r.data.access_token, `${r.data.user && r.data.user.name} · ${r.data.user && r.data.user.plan}`);
token = r.data.access_token;

r = await call('POST', '/auth/login', { account: '13800000000', password: 'wrong-pwd' }, false);
check('错误密码被拒', r.status === 401 || r.status === 400, `HTTP ${r.status}`);

await call('POST', '/auth/sms-code/send', { phone: '13900001111' }, false);
const sms = await call('POST', '/auth/sms-code/send', { phone: '13900001111' }, false);
const devCode = sms.data && sms.data.dev_code;
check('发送短信验证码', !!devCode, `本地测试码 ${devCode}`);

r = await call('POST', '/auth/register', {
  phone: '13900001111', password: 'abc123456', name: '演示新用户', code: devCode,
}, false);
const newUserToken = r.data && r.data.access_token;
check('新用户注册', ok(r) && !!newUserToken, r.data && r.data.user ? r.data.user.name : JSON.stringify(r.data).slice(0, 80));

if (newUserToken) {
  const keep = token;
  token = newUserToken;
  r = await call('GET', '/admin/overview');
  check('安全：新用户无平台管理员权限', r.status === 403, `HTTP ${r.status}`);
  r = await call('GET', '/users/me');
  check('安全：新用户 is_platform_admin 为假', ok(r) && !r.data.is_platform_admin, `plan=${r.data.plan}`);
  token = keep;
}

r = await call('GET', '/users/me');
check('读取当前用户', ok(r) && r.data.phone === '13800000000', `积分 ${r.data.credits}`);

console.log('\n【3】工艺价格库');

r = await call('GET', '/price-library');
const libCount = Array.isArray(r.data) ? r.data.length : (r.data.items || []).length;
check('工艺库列表', ok(r) && libCount >= 180, `${libCount} 条`);

r = await call('GET', '/price-library?keyword=防水');
const kw = Array.isArray(r.data) ? r.data : (r.data.items || []);
check('工艺库关键词检索', ok(r) && kw.length > 0, `命中 ${kw.length} 条`);

r = await call('GET', '/price-library/presets');
check('工艺库预设', ok(r));

r = await call('GET', '/room-templates');
const tplList = Array.isArray(r.data) ? r.data : (r.data.items || []);
check('空间模板列表（含演示模板）', ok(r) && tplList.length >= 3, `${tplList.length} 套 · ${tplList.map((t) => t.name).join('、')}`);

console.log('\n【4】报价全流程');

r = await call('GET', '/quotes');
const quotes = Array.isArray(r.data) ? r.data : (r.data.items || []);
check('报价列表（含示例数据）', ok(r) && quotes.length > 0, `${quotes.length} 张`);

r = await call('POST', '/customers', { name: '自测客户', phone: '13600002222', address: '合肥市蜀山区' });
const custId = r.data && r.data.id;
check('新增客户', ok(r) && !!custId, r.data && r.data.name);

r = await call('POST', '/quotes', {
  customer_id: custId, title: '自测报价单', building_area: 100, style: 'modern', tier: 'mid',
});
const qid = r.data && r.data.id;
check('新建报价', ok(r) && !!qid, r.data && r.data.quote_number);

r = await call('POST', `/quotes/${qid}/items`, { name: '墙顶面乳胶漆', unit: '㎡', qty: 260, unit_price: 38 });
const itemId = r.data && r.data.id;
check('添加明细', ok(r) && r.data.amount !== undefined, `小计 ¥${r.data.amount}`);

r = await call('GET', `/quotes/${qid}`);
const qd = r.data || {};
check('读取报价详情', ok(r) && !!qd.quote_number,
  `${qd.quote_number} · 合计 ¥${qd.total_amount} · ${(qd.items || []).length} 条明细`);

r = await call('POST', `/quotes/${qid}/submit`);
check('报价提交（状态机）', ok(r), r.data && r.data.status);

r = await call('POST', `/quotes/${qid}/share`);
check('生成客户分享链接', ok(r), r.data && r.data.share_token);

if (r.data && r.data.share_token) {
  const st = r.data.share_token;
  const keep = token; token = '';
  const sr = await call('GET', `/quotes/share/${st}`, null, false);
  check('免登录打开分享页', ok(sr) && !!sr.data.quote, `HTTP ${sr.status}`);
  token = keep;
}

r = await call('DEL', `/quotes/${qid}`);
check('删除报价', ok(r), `HTTP ${r.status}`);

console.log('\n【5】AI 智能造价（本地规则引擎）');

r = await call('POST', '/ai/smart-estimate', { building_area: 108, layout: '三室两厅两卫', tier: 'mid', city: '合肥' });
const estTotal = r.data && r.data.total;
check('智能估算', ok(r) && estTotal > 0, `¥${estTotal} · 明细 ${(r.data.items || []).length} 条 · 扣 ${r.data.cost} 积分`);

r = await call('POST', '/ai/room-breakdown', { building_area: 108, layout: '三室两厅两卫' });
check('户型拆解', ok(r) && (r.data.spaces || []).length >= 8, `${(r.data.spaces || []).length} 个空间`);

r = await call('POST', '/ai/nl-to-items', { text: '客厅地面铺800*800瓷砖，含水泥砂浆找平' });
check('自然语言加项', ok(r) && (r.data.items || []).length > 0, `${(r.data.items || []).length} 条`);

r = await call('POST', '/ai/quote-review', { quote_id: quotes[0] && quotes[0].id });
check('整单复核', ok(r), (r.data.findings || []).length + ' 条发现');

r = await call('POST', '/ai/library/audit');
check('价格库体检', ok(r) && r.data.total >= 180, `${r.data.total} 条 · 健康度 ${r.data.health_score}`);

r = await call('POST', '/ai/library/calibrate-by-city', { target_city: '合肥' });
check('城市价格校准', ok(r), typeof r.data === 'object' ? Object.keys(r.data).slice(0, 3).join(',') : '');

r = await call('POST', '/ai/templates/match-rank', { building_area: 100, tier: 'mid' });
check('模板智能匹配', ok(r));

r = await call('GET', '/ai/quota-status');
check('积分配额状态', ok(r), JSON.stringify(r.data).slice(0, 90));

r = await call('GET', '/ai/feature-costs');
check('AI 功能价目表', ok(r), JSON.stringify(r.data).slice(0, 90));

r = await call('GET', '/ai/usage-summary');
check('AI 用量汇总', ok(r), JSON.stringify(r.data).slice(0, 90));

console.log('\n【6】计费与会员');

r = await call('GET', '/ai-credits/balance');
check('积分余额', ok(r), JSON.stringify(r.data).slice(0, 80));
r = await call('GET', '/ai-credits/packs');
check('积分套餐', ok(r));
r = await call('GET', '/subscriptions/orders');
check('订阅订单', ok(r));
r = await call('GET', '/org/profile');
check('企业资料', ok(r), r.data && r.data.name);
r = await call('GET', '/org/settings');
check('企业设置', ok(r));

console.log('\n【7】平台管理');

r = await call('GET', '/admin/overview');
check('平台总览', ok(r), JSON.stringify(r.data).slice(0, 90));
r = await call('GET', '/admin/users');
check('用户列表', ok(r), `${Array.isArray(r.data) ? r.data.length : (r.data.items || []).length} 人`);
r = await call('GET', '/admin/organizations');
check('组织列表', ok(r));
r = await call('GET', '/admin/ai-usage');
check('AI 用量看板', ok(r));

console.log('\n【8】鉴权边界');

const keep = token; token = '';
r = await call('GET', '/quotes', null, false);
check('未登录访问受保护接口 → 401', r.status === 401, `HTTP ${r.status}`);
r = await call('GET', '/no-such-endpoint', null, false);
check('不存在的接口 → 404', r.status === 404, `HTTP ${r.status}`);
token = keep;

console.log('\n=== 结果 ===');
console.log(`  通过 ${pass} 项，失败 ${fails.length} 项`);
if (fails.length) { console.log('  失败用例：' + fails.join('、')); process.exit(1); }
console.log('  静态演示版接口层全部通过 ✅\n');
