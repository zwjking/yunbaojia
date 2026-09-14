/**
 * 构建「静态演示版」：把 server/ 下的真实业务代码打包成浏览器可执行的单文件。
 *
 *   node tools/build-demo.mjs
 *
 * 产物：
 *   public/js/demo/bundle.js   迷你 CJS 运行时 + 垫片 + 全部业务模块
 *   public/js/demo/boot.js     引导层（含内容哈希，用于缓存失效）
 *
 * 设计要点：不转译、不改写业务源码，只做「原样包裹」，因此浏览器端行为
 * 与服务端逐行一致，不会产生两套逻辑漂移。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT_DIR = path.join(ROOT, 'public', 'js', 'demo');

/** 需要打进包里的业务模块（路径相对项目根） */
const MODULES = [
  'server/lib/http.js',
  'server/lib/auth.js',
  'server/lib/seed.js',
  'server/lib/ai.js',
  'server/routes/auth.js',
  'server/routes/quotes.js',
  'server/routes/library.js',
  'server/routes/customers.js',
  'server/routes/ai.js',
  'server/routes/billing.js',
  'server/routes/admin.js',
  'seed/library.js',
  'demo/entry.js',
];

/** 以浏览器实现替换服务端模块 */
const OVERRIDES = {
  'server/lib/db.js': 'demo/db.browser.js',
};

/** 运行时与垫片，按顺序拼在模块之前 */
const PRELUDE = ['demo/runtime.js', 'demo/shims.js'];

function read(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) throw new Error(`源文件缺失：${rel}`);
  return fs.readFileSync(abs, 'utf8');
}

function wrapFactory(id, source) {
  return `__define(${JSON.stringify(id)}, function (module, exports, require, __dirname, __filename) {\n${source}\n});\n`;
}

function build() {
  const parts = [];
  const manifest = [];

  parts.push('/* eslint-disable */');
  parts.push('/**');
  parts.push(' * 云报价 · 静态演示版运行时（自动生成，请勿手改）');
  parts.push(' * 重新生成：node tools/build-demo.mjs');
  parts.push(' *');
  parts.push(' * 本文件包含：迷你 CommonJS 运行时 + Node 内置模块垫片 + 服务端业务模块。');
  parts.push(' * 业务代码原样搬运，未做任何转译。');
  parts.push(' */');
  parts.push('');

  for (const rel of PRELUDE) {
    parts.push(`/* ================= ${rel} ================= */`);
    parts.push(read(rel).trimEnd());
    parts.push('');
    manifest.push(`${rel} (运行时/垫片)`);
  }

  for (const [target, source] of Object.entries(OVERRIDES)) {
    parts.push(`/* ================= ${source} → 替换 ${target} ================= */`);
    parts.push(wrapFactory(target, read(source).trimEnd()));
    manifest.push(`${source} → ${target}`);
  }

  for (const rel of MODULES) {
    parts.push(`/* ================= ${rel} ================= */`);
    parts.push(wrapFactory(rel, read(rel).trimEnd()));
    manifest.push(rel);
  }

  parts.push('');
  parts.push('/* ================= 挂载到全局 ================= */');
  parts.push('window.__HQ_DEMO__ = __require("demo/entry.js");');
  parts.push('');

  const code = parts.join('\n');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'bundle.js'), code, 'utf8');

  const hash = crypto.createHash('sha1').update(code).digest('hex').slice(0, 10);

  const bootSrc = read('demo/boot.tmpl.js').replace('__VERSION__', hash);
  fs.writeFileSync(path.join(OUT_DIR, 'boot.js'), bootSrc, 'utf8');

  const kb = (code.length / 1024).toFixed(1);
  console.log('');
  console.log('  演示版构建完成');
  console.log('  ├─ public/js/demo/bundle.js   ' + kb + ' KB   版本 ' + hash);
  console.log('  ├─ public/js/demo/boot.js     ' + (bootSrc.length / 1024).toFixed(1) + ' KB');
  console.log('  ├─ 模块数 ' + manifest.length);
  console.log('  └─ 入口   window.__HQ_DEMO__');
  console.log('');
  manifest.forEach((m) => console.log('     · ' + m));
  console.log('');
}

build();
