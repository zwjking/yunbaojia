/**
 * 前端语法体检：把 public/js 下的 ESM 逐个交给 node --check 验证
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const ROOT = 'D:/Projects/HomeQuoteCloud/public/js';
const TMP = path.join(os.tmpdir(), 'hq-syntax-check');
fs.mkdirSync(TMP, { recursive: true });

function walk(d, acc = []) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p, acc);
    else if (f.endsWith('.js')) acc.push(p);
  }
  return acc;
}

let bad = 0;
for (const file of walk(ROOT)) {
  const tmp = path.join(TMP, path.basename(file).replace(/\.js$/, '.mjs'));
  fs.copyFileSync(file, tmp);
  try {
    execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
    console.log('[OK]   ' + file.replace(ROOT, 'js'));
  } catch (e) {
    bad += 1;
    console.log('[FAIL] ' + file.replace(ROOT, 'js'));
    console.log(String(e.stderr || e.message).split('\n').slice(0, 8).join('\n'));
  }
}
console.log(bad ? `\n共 ${bad} 个文件有语法错误` : '\n全部文件语法通过');
process.exit(bad ? 1 : 0);
