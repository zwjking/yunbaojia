/**
 * AI 能力路由：统一调用入口 + 点数扣减 + 使用日志
 * 计费原则：调用成功返回结果才扣点数，失败不扣
 */
const { db, uid, now } = require('../lib/db');
const A = require('../lib/auth');
const { ok, fail } = require('../lib/http');
const AI = require('../lib/ai');
const { genQuoteNo } = require('../lib/seed');

/** 功能中文名，用于日志与前端展示 */
const FEATURE_NAMES = {
  'smart-estimate': '智能造价估算',
  'full-estimate': '完整自助估算',
  'estimate-cost': '快速造价估算',
  'room-breakdown': '户型智能拆解',
  'tier-matching': '装修档次匹配',
  'budget-reverse': '预算反推',
  'risk-report': '增项风险预测',
  'nl-to-items': '自然语言加项',
  'price-suggestion': '单点价格建议',
  'item-suggestion': '相似项推荐',
  'quote-review': '整张报价复核',
  'validate-quote': '漏项检查',
  'customer-copy': '客户话术润色',
  'price-library-audit': '价格库体检',
  'city-calibration': '城市价格校准',
  'audit-risk': '审计异常预警',
  'template-generate': '模板 AI 生成',
};

module.exports = function register(api) {

  /* ---------------- 元信息 ---------------- */
  api.get('/ai/feature-costs', async (req, res) => {
    ok(res, Object.entries(AI.FEATURE_COSTS).map(([key, cost]) => ({
      key, cost, name: FEATURE_NAMES[key] || key,
    })));
  });

  api.get('/ai/provider-status', async (req, res) => {
    ok(res, {
      provider: AI.provider.enabled ? 'llm' : 'local-rule-engine',
      model: AI.provider.name,
      llm_enabled: AI.provider.enabled,
      note: AI.provider.enabled
        ? `已接入大模型 ${AI.provider.name}`
        : '当前使用本地规则引擎：结果确定、可复核、不消耗外部额度。配置 HQ_AI_API_KEY 与 HQ_AI_BASE_URL 后可切换到大模型。',
    });
  });

  api.get('/ai/quota-status', async (req, res) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const plan = { free: 30, personal: 0, plus: 1000, enterprise: 5000 }[user.plan] || 30;
    ok(res, {
      plan: user.plan,
      credits: user.credits || 0,
      monthly_credits: plan,
      unlimited: !!user.platform_admin_unlimited,
      usage_this_month: db.ai_logs.find((l) => l.user_id === user.id && l.month === curMonth()).length,
      cost_list: AI.FEATURE_COSTS,
    });
  });

  api.get('/ai/quote-packages', async (req, res) => {
    ok(res, AI.PACKAGES);
  });

  /* ---------------- 统一调用入口（动态路由，静态路径由 Router 优先匹配） ---------------- */
  const runFeature = async (req, res, body, params) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    const feature = params.feature;
    if (!AI.FEATURES[feature]) return fail(res, `未知的 AI 功能：${feature}`, 404);

    const cost = AI.costOf(feature);
    const unlimited = !!user.is_platform_admin;
    if (!unlimited && (user.credits || 0) < cost) {
      return fail(res, `积分不足：${FEATURE_NAMES[feature] || feature} 需要 ${cost} 积分，当前剩余 ${user.credits || 0} 积分。请先充值或升级。`, 402, 'INSUFFICIENT_CREDITS');
    }

    const started = Date.now();
    try {
      const payload = { ...body, org_id: user.org_id, user_id: user.id };
      const result = await AI.run(feature, payload);

      const elapsed = Date.now() - started;
      // 日志记录真实消耗额（便于用量看板统计），管理员免扣余额
      db.ai_logs.insert({
        id: uid(), org_id: user.org_id, user_id: user.id,
        feature, feature_name: FEATURE_NAMES[feature] || feature,
        cost, billed: unlimited ? 0 : cost, status: 'success',
        engine: result._engine, elapsed_ms: elapsed,
        month: curMonth(), created_at: now(),
      });
      if (!unlimited) db.users.update(user.id, { credits: (user.credits || 0) - cost });
      db.ai_logs.flush();

      ok(res, { ...result, cost: unlimited ? 0 : cost, list_cost: cost, unlimited, elapsed_ms: elapsed });
    } catch (e) {
      db.ai_logs.insert({
        id: uid(), org_id: user.org_id, user_id: user.id,
        feature, feature_name: FEATURE_NAMES[feature] || feature,
        cost: 0, status: 'failed', error: e.message,
        month: curMonth(), created_at: now(),
      });
      db.ai_logs.flush();
      fail(res, e.message || 'AI 调用失败，请稍后重试。', 500, 'AI_FAILED');
    }
  };

  api.post('/ai/:feature', runFeature);

  /* ---------------- 兼容原站独立路径 ---------------- */
  const alias = (path, feature) => {
    api.post(path, (req, res, body) => runFeature(req, res, body, { feature }));
  };

  alias('/ai/smart-estimate', 'smart-estimate');
  alias('/ai/full-estimate', 'full-estimate');
  alias('/ai/estimate-cost', 'estimate-cost');
  alias('/ai/room-breakdown', 'room-breakdown');
  alias('/ai/tier-matching', 'tier-matching');
  alias('/ai/budget-reverse', 'budget-reverse');
  alias('/ai/risk-report', 'risk-report');
  alias('/ai/nl-to-items', 'nl-to-items');
  alias('/ai/price-suggestion', 'price-suggestion');
  alias('/ai/item-suggestion', 'item-suggestion');
  alias('/ai/quote-review', 'quote-review');
  alias('/ai/validate-quote', 'validate-quote');
  alias('/ai/customer-copy', 'customer-copy');
  alias('/ai/audit-risk', 'audit-risk');
  alias('/ai/library/audit', 'price-library-audit');
  alias('/ai/library/calibrate-by-city', 'city-calibration');
  alias('/ai/templates/ai-generate', 'template-generate');

  /* ---------------- 估算结果 → 正式报价 ---------------- */
  api.post('/ai/estimate-to-quote', async (req, res, body) => {
    const user = A.requireAuth(req, res);
    if (!user) return;

    const payload = body.params || body;
    const est = AI.estimate({ ...payload, pkg: AI.PACKAGES.find((p) => p.code === payload.package_code) });

    const qid = uid();
    const quote = db.quotes.insert({
      id: qid, org_id: user.org_id, user_id: user.id,
      quote_number: genQuoteNo(user.org_id),
      title: `${payload.city || ''}${payload.building_area || ''}㎡ ${payload.layout || ''} ${payload.tier || ''}报价草稿`,
      city: payload.city || '', province: payload.province || '',
      building_area: Number(payload.building_area) || 0,
      layout: payload.layout || '',
      tier: payload.tier || '中档',
      house_type: payload.house_type || '新房',
      house_age: Number(payload.house_age) || 0,
      floor: Number(payload.floor) || 0,
      building_type: payload.building_type || '高层',
      has_elevator: payload.has_elevator !== false,
      customer_name: body.client_name && body.client_name !== '待填写客户' ? body.client_name : '',
      status: 'draft',
      total_amount: est.total, cost_amount: est.cost_total, grand_total: est.total,
      margin_rate: est.gross_margin, item_count: est.items.length,
      notes: payload.notes || '',
      created_at: now(), updated_at: now(),
    });

    db.quote_items.insertMany(
      est.items.map((it) => ({
        ...it, id: uid(), quote_id: qid, org_id: user.org_id,
        amount: Math.round(it.unit_price * it.qty * 100) / 100,
        created_at: now(),
      }))
    );
    db.quote_items.flush();

    ok(res, { quote, items_count: est.items.length, total: est.total, assumptions: est.assumptions });
  });

  /* ---------------- 用量看板（管理视角） ---------------- */
  api.get('/ai/usage-summary', async (req, res) => {
    const user = A.requireAuth(req, res);
    if (!user) return;
    if (!['owner', 'admin'].includes(user.role) && !user.is_platform_admin) {
      return fail(res, '仅管理员可查看用量看板。', 403);
    }
    const logs = db.ai_logs.find((l) => l.org_id === user.org_id);
    const byFeature = {};
    const byUser = {};
    const byDay = {};
    let tokens = 0;
    logs.forEach((l) => {
      byFeature[l.feature_name] = byFeature[l.feature_name] || { name: l.feature_name, calls: 0, credits: 0 };
      byFeature[l.feature_name].calls += 1;
      byFeature[l.feature_name].credits += l.cost || 0;
      byUser[l.user_id] = byUser[l.user_id] || { user_id: l.user_id, name: (db.users.findOne({ id: l.user_id }) || {}).name || l.user_id, calls: 0, credits: 0 };
      byUser[l.user_id].calls += 1;
      byUser[l.user_id].credits += l.cost || 0;
      const d = (l.created_at || '').slice(0, 10);
      byDay[d] = byDay[d] || { date: d, calls: 0, credits: 0 };
      byDay[d].calls += 1;
      byDay[d].credits += l.cost || 0;
      tokens += 1;
    });
    ok(res, {
      total_calls: logs.length,
      total_credits: logs.reduce((s, l) => s + (l.cost || 0), 0),
      estimated_cost_cny: Math.round(logs.reduce((s, l) => s + (l.cost || 0), 0) * 0.01 * 100) / 100,
      by_feature: Object.values(byFeature).sort((a, b) => b.calls - a.calls),
      by_user: Object.values(byUser).sort((a, b) => b.calls - a.calls),
      by_day: Object.values(byDay).sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(-30),
      engine: AI.provider.enabled ? AI.provider.name : '本地规则引擎',
    });
  });
};

function curMonth() { return new Date().toISOString().slice(0, 7); }

module.exports.FEATURE_NAMES = FEATURE_NAMES;
