/**
 * GitHub Pages 本地预演服务器。
 *
 *   node tools/preview-pages.mjs [port]
 *
 * 精确复刻 GitHub Pages 的路径行为：站点挂在 /仓库名/ 子路径下，
 * 即 http://127.0.0.1:4180/yunbaojia/  ⇄  public/ 目录。
 * 这样能在推送之前就发现「根绝对路径」「子路径下资源 404」一类问题。
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

const PORT = Number(process.argv[2] || 4180);
const REPO = process.env.HQ_PAGES_REPO || 'yunbaojia'; // 改成实际仓库名即可

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);

  if (pathname === '/' || pathname === '') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<meta charset="utf-8"><p style="font:15px/1.8 system-ui;padding:24px">
      本地 Pages 预演已启动：<a href="/${REPO}/">http://127.0.0.1:${PORT}/${REPO}/</a>
      <br><span style="color:#666">（强制演示模式：加 ?demo=1；重置数据：加 ?demo-reset=1）</span></p>`);
    return;
  }

  const prefix = `/${REPO}`;
  if (pathname === prefix) {
    res.writeHead(301, { Location: `${prefix}/` });
    res.end();
    return;
  }
  if (!pathname.startsWith(`${prefix}/`) && pathname !== '/index.html') {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404');
    return;
  }

  let rel = pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length) : pathname;
  if (rel === '/' || rel === '') rel = '/index.html';

  let file = path.join(PUBLIC_DIR, rel);
  if (!file.startsWith(path.resolve(PUBLIC_DIR))) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    // 与 Pages 不同，这台预演服务器不把未知路径回退到 index.html，
    // 以便把「资源路径写错」直接暴露成 404
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found: ' + rel);
    return;
  }

  const ext = path.extname(file).toLowerCase();
  const stat = fs.statSync(file);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': 'no-cache',
  });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log('');
  console.log(`  本地 Pages 预演： http://127.0.0.1:${PORT}/${REPO}/`);
  console.log(`  强制演示模式：   http://127.0.0.1:${PORT}/${REPO}/?demo=1`);
  console.log(`  重置演示数据：   http://127.0.0.1:${PORT}/${REPO}/?demo-reset=1`);
  console.log('');
});
