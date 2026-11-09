/**
 * 演示版引导层模板（构建时由 tools/build-demo.mjs 注入版本号后输出到
 * public/js/demo/boot.js，请勿手改生成物）
 *
 * 职责：
 *   1) 在静态托管（GitHub Pages 等）上把 /api/v1/* 请求接管到浏览器端数据层
 *   2) 提供 ?demo=1 / ?demo=0 手动开关，以及 ?demo-reset=1 重置数据
 */
import './bundle.js?v=ea50fde178';

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

}
