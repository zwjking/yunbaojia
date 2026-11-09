/**
 * 演示版引导层模板（构建时由 tools/build-demo.mjs 注入版本号后输出到
 * public/js/demo/boot.js，请勿手改生成物）
 *
 * 职责：
 *   1) 在静态托管（GitHub Pages 等）上把 /api/v1/* 请求接管到浏览器端数据层
 *   2) 提供 ?demo=1 / ?demo=0 手动开关，以及 ?demo-reset=1 重置数据
 *   3) 展示演示模式提示条
 */
import './bundle.js?v=__VERSION__';

const D = window.__HQ_DEMO__;
const params = new URLSearchParams(location.search);
// 同域自带真实后端的托管（本机 Node 服务 / CloudBase / PocketBay 等）走真实接口
const REAL_HOSTS = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$|\.(tcloudbaseapp\.com|pocketbay\.app)$/i;
const flag = params.get('demo');
// 默认策略：同域有真实后端时走真实接口，其它纯静态托管（如 GitHub Pages）才启用演示模式
const ENABLED = flag === '1' ? true : flag === '0' ? false : !REAL_HOSTS.test(location.hostname);

if (params.get('demo-reset') === '1') {
  D.resetAll();
  params.delete('demo-reset');
  const qs = params.toString();
  location.replace(location.pathname + (qs ? '?' + qs : '') + location.hash);
} else if (ENABLED) {
  install();
}

function install() {
  window.__HQ_DEMO_MODE__ = true;

  const nativeFetch = window.fetch.bind(window);

  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const at = url.indexOf('/api/v1');
    if (at < 0) return nativeFetch(input, init);

    const apiPath = url.slice(at + '/api/v1'.length) || '/';
    const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    let body = {};
    const rawBody = init && init.body;
    if (typeof rawBody === 'string' && rawBody) {
      try { body = JSON.parse(rawBody); } catch (e) { body = {}; }
    }
    const headers = (init && init.headers) || {};

    try {
      const r = await D.handle(method, apiPath, body, headers);
      return new Response(JSON.stringify(r.data), {
        status: r.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    } catch (e) {
      console.error('[demo] 接口处理失败', method, apiPath, e);
      return new Response(JSON.stringify({ error: '演示模式内部错误：' + (e && e.message) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }
  };

  const ready = () => {
    const tip = document.createElement('div');
    tip.id = 'hq-demo-tip';
    tip.style.cssText = [
      'position:fixed', 'left:14px', 'bottom:14px', 'z-index:2147483000',
      'display:flex', 'align-items:center', 'gap:10px',
      'padding:8px 10px 8px 12px', 'border-radius:10px',
      'background:#ffffff', 'border:1px solid #e2e6ef',
      'box-shadow:0 6px 24px rgba(23,31,53,.12)',
      'font:12px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif',
      'color:#4b5568', 'max-width:min(78vw,340px)',
    ].join(';');
    tip.innerHTML = `
      <span style="width:7px;height:7px;border-radius:50%;background:#22c55e;flex:none"></span>
      <span style="flex:1">演示模式 · 数据仅存本机浏览器</span>
      <button type="button" id="hq-demo-reset"
        style="border:1px solid #dfe3ec;background:#f7f8fb;color:#3f4a5f;border-radius:6px;padding:2px 7px;font-size:12px;cursor:pointer;flex:none">重置</button>
      <button type="button" id="hq-demo-close" aria-label="关闭"
        style="border:0;background:transparent;color:#9aa3b5;font-size:15px;line-height:1;cursor:pointer;padding:0 2px;flex:none">×</button>`;
    document.body.appendChild(tip);

    tip.querySelector('#hq-demo-close').onclick = () => tip.remove();
    tip.querySelector('#hq-demo-reset').onclick = () => {
      tip.remove();
      D.resetAll();
      location.reload();
    };
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
}
