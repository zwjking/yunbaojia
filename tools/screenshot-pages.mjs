/**
 * 静态托管验收脚本（本地 Pages 预演 + 线上 GitHub Pages 通用）
 *
 *   node tools/screenshot-pages.mjs                                   # 验本地预演
 *   node tools/screenshot-pages.mjs https://zwjking.github.io/yunbaojia ""   # 验线上
 *
 * 参数：[baseUrl] [outDir] [query]
 *
 * 做三件事：
 *   1) 在页面内通过被接管的 fetch 登录，拿到登录态与真实单号
 *   2) 逐页截图，供人眼验收
 *   3) 收集控制台报错、未捕获异常、HTTP >= 400 的请求 —— 这是「网址能不能正常打开」的硬证据
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const DEBUG_PORT = 9334;
const BASE = (process.argv[2] || 'http://127.0.0.1:4180/yunbaojia').replace(/\/$/, '');
const OUT = process.argv[3] !== undefined && process.argv[3] !== '' ? process.argv[3] : path.join(ROOT, 'docs', 'screens');
const QUERY = process.argv[4] !== undefined ? process.argv[4] : '?demo=1';
const PROFILE = path.join(os.tmpdir(), 'hq-pages-shot-profile');

fs.mkdirSync(OUT, { recursive: true });
try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) { /* ignore */ }

console.log(`\n[验收目标] ${BASE}${QUERY}\n`);

const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${PROFILE}`,
  '--window-size=1440,960', 'about:blank',
], { detached: false, stdio: 'ignore' });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWs() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch (e) { /* retry */ }
    await wait(500);
  }
  throw new Error('无法连接 Edge 调试端口');
}

const ws = new WebSocket(await getWs());
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });

let id = 0;
const pending = new Map();
const consoleErrors = [];
const exceptions = [];
const badResponses = [];
const failedRequests = [];

ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }

  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    consoleErrors.push((msg.params.args || []).map((a) => a.value || a.description || '').join(' ').slice(0, 200));
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails || {};
    exceptions.push((d.exception && (d.exception.description || d.exception.value)) || d.text || '未知异常');
  }
  if (msg.method === 'Network.responseReceived') {
    const r = msg.params.response;
    if (r.status >= 400) badResponses.push(`${r.status} ${r.url.replace(BASE, '')}`);
  }
  if (msg.method === 'Network.loadingFailed') {
    failedRequests.push(`${msg.params.errorText} ${(msg.params.type || '')}`);
  }
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
await send('Network.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

/* ---------- 第一步：页面内登录（走被接管的 fetch，顺带验证拦截层） ---------- */
await send('Page.navigate', { url: `${BASE}/${QUERY}` });
await wait(4000);

const loginRes = await send('Runtime.evaluate', {
  awaitPromise: true,
  returnByValue: true,
  expression: `(async () => {
    if (!window.__HQ_DEMO_MODE__) return { error: '演示模式未启用' };
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: '13800000000', password: '123456' }),
    });
    const d = await res.json();
    if (!d.access_token) return { error: '登录失败', status: res.status, d };
    localStorage.setItem('hq_token', d.access_token);
    localStorage.setItem('hq_user', JSON.stringify(d.user));
    const H = { authorization: 'Bearer ' + d.access_token };
    const ql = await (await fetch('/api/v1/quotes?range=all', { headers: H })).json();
    const qid = (ql.items || [])[0] ? ql.items[0].id : '';
    let shareToken = '';
    if (qid) {
      const sr = await (await fetch('/api/v1/quotes/' + qid + '/share', {
        method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: '{}',
      })).json();
      shareToken = sr.token || sr.share_token || '';
    }
    return { ok: true, name: d.user.name, plan: d.user.plan, quotes: (ql.items || []).length, qid, shareToken };
  })()`,
});

const info = loginRes.result && loginRes.result.result ? loginRes.result.result.value : null;
if (!info || info.error) {
  console.error('❌ 页面内登录失败：', JSON.stringify(info));
  ws.close(); edge.kill(); process.exit(1);
}
console.log(`[登录] ${info.name} · ${info.plan} · 报价 ${info.quotes} 张 · 单号 ${info.qid}`);
if (info.shareToken) console.log(`[分享] token=${info.shareToken}`);

/* ---------- 第二步：逐页截图 ---------- */
async function shoot(hash, file, ms) {
  await send('Page.navigate', { url: `${BASE}/${QUERY}${hash}` });
  await wait(ms);
  const r = await send('Page.captureScreenshot', { format: 'png' });
  if (!r.result || !r.result.data) throw new Error('截图失败');
  const p = path.join(OUT, file);
  fs.writeFileSync(p, Buffer.from(r.result.data, 'base64'));
  console.log(`  [shot] ${file}  ${Math.round(fs.statSync(p).size / 1024)}KB`);
}

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
if (info.qid) shots.push([`#/app/editor/${info.qid}`, '13-editor.png']);
if (info.shareToken) shots.push([`#/q/${info.shareToken}`, '14-share.png']);

for (const [hash, file] of shots) {
  try { await shoot(hash, file, hash.startsWith('#/app') ? 3200 : 2400); }
  catch (e) { console.error(`  [fail] ${file} ${e.message}`); }
}

/* ---------- 第三步：健康报告 ---------- */
const uniq = (a) => [...new Set(a)];
const bad = uniq(badResponses);
const errs = uniq(consoleErrors);
const excs = uniq(exceptions);

console.log('\n=== 健康检查 ===');
console.log(`  HTTP >= 400 的请求： ${bad.length}`);
bad.slice(0, 12).forEach((x) => console.log('    · ' + x));
console.log(`  控制台 error： ${errs.length}`);
errs.slice(0, 12).forEach((x) => console.log('    · ' + x));
console.log(`  未捕获异常： ${excs.length}`);
excs.slice(0, 12).forEach((x) => console.log('    · ' + String(x).split('\n')[0].slice(0, 180)));
const netFails = uniq(failedRequests).filter((x) => !/favicon/i.test(x));
console.log(`  请求失败： ${netFails.length}`);
netFails.slice(0, 8).forEach((x) => console.log('    · ' + x));

console.log(`\n  截图输出： ${OUT}`);
console.log(`  结论： ${bad.length === 0 && errs.length === 0 && excs.length === 0 ? '页面可用，无资源缺失与脚本报错 ✅' : '存在待处理问题 ⚠️'}\n`);

ws.close();
edge.kill();
process.exit(bad.length || errs.length || excs.length ? 1 : 0);
