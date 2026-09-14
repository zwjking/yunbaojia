/**
 * 无头 Edge + CDP 截图验收脚本
 * 用法：node docs/_shot.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9333;
const BASE = 'http://127.0.0.1:5173';
const OUT = 'D:\\Projects\\HomeQuoteCloud\\docs\\screens';
const PROFILE = path.join(os.tmpdir(), 'hq-shot-profile');

fs.mkdirSync(OUT, { recursive: true });
try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) { /* ignore */ }

const edge = spawn(EDGE, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`,
  '--window-size=1440,960',
  'about:blank',
], { detached: false, stdio: 'ignore' });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWs() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch (e) { /* retry */ }
    await wait(500);
  }
  throw new Error('无法连接 Edge 调试端口');
}

const wsUrl = await getWs();
const ws = new WebSocket(wsUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });

let id = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
});
function send(method, params = {}) {
  id += 1;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
});

async function shoot(hash, file, ms = 2600) {
  await send('Page.navigate', { url: BASE + '/' + hash });
  await wait(ms);
  const r = await send('Page.captureScreenshot', { format: 'png' });
  if (!r.result || !r.result.data) throw new Error('截图失败 ' + hash);
  const p = path.join(OUT, file);
  fs.writeFileSync(p, Buffer.from(r.result.data, 'base64'));
  console.log('[shot] ' + file + '  ' + Math.round(fs.statSync(p).size / 1024) + 'KB');
}

// 1. 先落地到源站，注入演示账号 token（后台页面需要登录态）
await send('Page.navigate', { url: BASE + '/' });
await wait(1800);
const login = await fetch(BASE + '/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ account: '13800000000', password: '123456' }),
}).then((r) => r.json());
if (!login.access_token) { console.error('登录失败', login); process.exit(1); }
await send('Runtime.evaluate', {
  expression: `localStorage.setItem('hq_token', ${JSON.stringify(login.access_token)}); localStorage.setItem('hq_user', ${JSON.stringify(JSON.stringify(login.user))}); 'ok'`,
});
console.log('[auth] 已注入演示账号登录态');

// 取一张真实报价单，用于编辑器与客户分享页截图
const authHeaders = { Authorization: 'Bearer ' + login.access_token };
const qlist = await fetch(BASE + '/api/v1/quotes?range=all', { headers: authHeaders }).then((r) => r.json());
const qid = qlist.items && qlist.items[0] ? qlist.items[0].id : '';
const sres = await fetch(BASE + `/api/v1/quotes/${qid}/share`, {
  method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: '{}',
}).then((r) => r.json());
const shareToken = sres.token || '';

const shots = [
  ['#/', '01-home.png'],
  ['#/product', '02-product.png'],
  ['#/pricing', '03-pricing.png'],
  ['#/samples', '04-samples.png'],
  ['#/login', '05-login.png'],
  ['#/app/dashboard', '06-dashboard.png'],
  ['#/app/quotes', '07-quotes.png'],
  ['#/app/estimate', '08-estimate.png'],
  ['#/app/library', '09-library.png'],
  ['#/app/ailab', '10-ailab.png'],
  ['#/app/billing', '11-billing.png'],
  ['#/app/admin', '12-admin.png'],
  ['#/app/templates', '15-templates.png'],
  ['#/app/customers', '16-customers.png'],
  ['#/app/checkup', '17-checkup.png'],
  ['#/app/settings', '18-settings.png'],
];
if (qid) shots.push([`#/app/editor/${qid}`, '13-editor.png']);
if (shareToken) shots.push([`#/q/${shareToken}`, '14-share.png']);

for (const [hash, file] of shots) {
  try { await shoot(hash, file, hash.startsWith('#/app') ? 3400 : 2600); }
  catch (e) { console.error('[fail] ' + file + ' ' + e.message); }
}

ws.close();
edge.kill();
console.log('[done] 截图输出目录：' + OUT);
process.exit(0);
