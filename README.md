# 云报价 · 家装报价系统

> 仿「屋算奇」深度复刻 + 全面升级。零依赖 Node.js + 原生 ESM 前端，单进程即跑，数据存本地 JSON。
> 项目路径：`D:\Projects\HomeQuoteCloud`

## 一句话

一个**能注册、能登录、能出报价单**的完整家装报价 SaaS：营销站 → 后台工作台 → 15 项 AI 造价能力 → 四档计费（免费/按次/包月/企业）→ 平台管理后台。

**在线演示（纯静态，无需服务器）**：https://zwjking.github.io/yunbaojia/
演示账号 `13800000000` / 密码 `123456`。该模式下数据保存在**你自己的浏览器**里，不会上传到任何服务器。

---

## 两种运行形态

同一个代码库，支持两种形态，业务逻辑只有一份（前端共用 `public/`，后端共用 `server/`）：

| 形态 | 怎么跑 | 数据存哪 | 适合 |
|---|---|---|---|
| **完整版** | `cd server && node server.js 5173` | 服务器 `server/data/*.json` | 真实经营使用 |
| **静态演示版** | 直接托管 `public/`（如 GitHub Pages） | 访客浏览器 localStorage | 对外演示、给别人试用 |

静态演示版的原理：构建脚本把 `server/` 下**真实的**路由与 AI 引擎原样打包进浏览器，
再配一层 Node 内置模块垫片（`fs`/`path`/`crypto`/`url`）和 localStorage 数据层，
最后由引导层接管 `/api/v1/*` 请求。因此**接口行为与服务端逐字段一致**，
不存在「演示版和正式版两套逻辑」的漂移。

---

## 目录结构

```
HomeQuoteCloud/
├── README.md                  本文件
├── .github/workflows/
│   └── deploy-pages.yml       GitHub Pages 自动发布（含构建 + 自测 + 启用 Pages）
├── docs/
│   ├── 竞品深度分析-屋算奇.md   抓包分析报告（路由/定价/AI 功能/后台模块）
│   ├── screens/               验收截图（本地完整版，已 gitignore，可重新生成）
│   └── pages-screens/         验收截图（静态演示版，已 gitignore）
├── public/                    前端源码（无需构建，直接静态服务）
│   ├── index.html             入口 + SPA 容器（资源引用全部用相对路径）
│   ├── assets/favicon.svg
│   ├── css/base.css           设计系统（配色/卡片/按钮/表单/表格/响应式）
│   ├── css/landing.css        营销站样式
│   ├── css/app.css            工作台样式
│   └── js/
│       ├── demo/bundle.js     【构建产物】浏览器端运行时 + 垫片 + 后端业务代码
│       ├── demo/boot.js       【构建产物】演示模式引导层（接管 /api/v1）
│       ├── core.js            API 客户端 / UI 组件 / 图标 / 格式化 / 简易路由
│       ├── main.js            营销站路由 + 工作台外壳加载
│       ├── landing.js         首页/产品/场景/样例/定价/资料/法务
│       ├── auth.js            登录 / 注册 / 找回密码
│       ├── app.js             工作台外壳（侧边栏 + 顶栏 + 权限）
│       └── pages/             各后台页面（仪表盘/报价/编辑器/智能造价/体检/
│                            模板/工艺库/客户/AI 实验室/会员/设置/平台管理/分享）
├── server/                    后端（零依赖，只用 Node 内置模块）
│   ├── server.js              HTTP 主服务（路由注册 / 静态文件 / 404）
│   ├── lib/db.js              JSON 文档存储（内存缓存 + 防抖落盘）
│   ├── lib/auth.js            密码哈希(scrypt) + JWT(HS256 手写) + 中间件
│   ├── lib/http.js            路由表 / JSON 响应 / 静态文件服务
│   ├── lib/ai.js              本地 AI 规则引擎（15 项功能 + 大模型 provider 预留）
│   ├── lib/seed.js            工艺库种子数据 / 报价单号 / 演示数据（客户+报价+模板）
│   ├── routes/                业务路由：auth / quotes / library / customers /
│   │                        ai / billing / admin
│   ├── selftest.js            逻辑层自测（32 项）
│   └── apitest.js             接口层自测（71 项，进程内启动服务）
├── demo/                      静态演示版的源材料（不进 public，由构建脚本消费）
│   ├── runtime.js             迷你 CommonJS 运行时 + Buffer/process 垫片
│   ├── shims.js               fs / path / url / crypto 垫片（纯 JS SHA-256 + HMAC + PBKDF2）
│   ├── db.browser.js          localStorage 版数据层（API 与 lib/db.js 完全一致）
│   ├── entry.js               路由挂载 + 首次访问播种（对照 server.js）
│   └── boot.tmpl.js           引导层模板（构建时注入版本哈希）
├── seed/library.js            180 条真实家装工艺价格库（八大分类）
└── tools/
    ├── build-demo.mjs         构建静态演示版 → public/js/demo/
    ├── test-demo.mjs          静态演示版接口自测（43 项，Node 内跑浏览器包）
    ├── preview-pages.mjs      本地复刻 GitHub Pages 子路径环境
    ├── screenshot-pages.mjs   静态托管验收（截图 + 404/报错扫描，本地与线上通用）
    ├── check-syntax.mjs       前端 ESM 语法体检
    └── screenshot.mjs         本地完整版批量截图（需先启动 server.js）
```

---

## 启动（本地完整版）

```bash
cd server
node server.js 5173
```

访问：`http://localhost:5173`

**演示账号**：手机号 `13800000000` / 密码 `123456`（Plus 版，含 1000 积分）

也可以用登录页「验证码登录」——本地模式验证码会直接显示在响应里，任意 11 位手机号 + 验证码即可注册。

---

## 构建与预览（静态演示版）

```bash
node tools/build-demo.mjs                            # 生成 public/js/demo/bundle.js
node tools/test-demo.mjs                             # 接口自测（43 项）
node tools/preview-pages.mjs 4180                    # 本地复刻 Pages 子路径
# 浏览器打开 http://127.0.0.1:4180/yunbaojia/?demo=1
```

**演示模式开关**（只有静态托管才需要）：

| 参数 | 作用 |
|---|---|
| 不加 | localhost 走真实后端，其它域名自动启用演示模式 |
| `?demo=1` | 强制启用（本地验证静态版时用） |
| `?demo=0` | 强制关闭，请求真实 `/api/v1`（需自备后端） |
| `?demo-reset=1` | 清空浏览器内的演示数据并重新播种 |

---

## 自测结果

| 层级 | 脚本 | 结果 |
|---|---|---|
| 逻辑层 | `server/selftest.js` | **32 项通过，0 失败** |
| 接口层（完整版） | `server/apitest.js` | **71 项通过，0 失败** |
| 接口层（静态演示版） | `tools/test-demo.mjs` | **43 项通过，0 失败** |
| 前端语法 | `tools/check-syntax.mjs` | 全部 ESM 文件通过 |
| 视觉验收 | `tools/screenshot-pages.mjs` | 18 页截图，0 个 404、0 个控制台报错、0 个未捕获异常 |

接口自测覆盖：认证 / 注册 / 报价 CRUD + 12 态状态机 / 明细编辑 / 体检 / 分享链接 /
工艺库增删改 / 模板 / 客户 / 15 项 AI 功能（含积分真实扣减）/ 计费订单与支付 /
组织设置 / 平台管理后台 / 权限拦截（401/403/404）。

---

## 功能清单（与原站对齐）

**营销站**：首页、产品、装修场景、案例样例、定价（4 档套餐 + 对比表 + FAQ）、资料、
登录/注册、隐私政策 / 服务条款 / AI 使用声明。

**后台工作台 9 大模块**：仪表盘、智能造价向导、报价管理（含 12 态状态机）、
报价编辑器（明细编辑 / 实时汇总 / 状态流转 / 导出分享）、报价体检、
模板管理、工艺价格库（180 条）、客户管理、AI 实验室（15 项）、
会员与计费、系统设置、平台管理后台。

**AI 能力（15 项）**：完整估算 / 户型拆解 / 档次匹配 / 预算反推 / 增项风险预测 /
自然语言加项 / 单点价格建议 / 相似项推荐 / 整单复核 / 漏项检查 / 话术润色 /
用量看板 / 配额状态 / 审计预警 / 价格库体检 + 城市校准。
默认本地规则引擎（确定、可复核、不消耗外部额度），预留大模型 provider 接口。

**计费**：免费版（送 30 积分）/ 普通版 ¥9.9 次 / Plus ¥38 月（年付 ¥32/月，1000 积分）
/ 企业版定制。积分 + 出单次数双轨，成功才扣。

---

## 部署

### 方案 A：GitHub Pages（纯静态演示）

仓库已内置 `.github/workflows/deploy-pages.yml`。推送到 `main` 之后：

1. Actions 先执行 `node tools/build-demo.mjs` 生成浏览器端数据层
2. 再执行 `node tools/test-demo.mjs` 接口自测，不通过则不发版
3. `configure-pages`（`enablement: true`）自动开启 Pages
4. 上传 `public/` 并发布

站点地址：`https://<用户名>.github.io/<仓库名>/`

> 免费账号的 Pages 仅支持**公开仓库**。若流程卡在「启用 Pages」这一步，
> 到仓库 Settings → Pages → Source 选 **GitHub Actions** 手动开一次即可。

### 方案 B：自有服务器（完整版）

单 Node 进程 + 静态文件，无需构建、无需数据库：

1. 把整个目录拷贝到服务器
2. 确保 Node 18+
3. `cd server && node server.js 5173`（或用 `nohup` / systemd / pm2 常驻）
4. 前面接 Nginx 反向代理（`proxy_pass http://127.0.0.1:5173;`）并开启 HTTPS
5. 如需域名，配置 DNS A 记录指向服务器 IP

**数据**：存放在 `server/data/*.json`，服务重启自动加载。生产环境建议：
- 定期备份 `server/data/` 目录
- 把 `HQ_SECRET` 环境变量改成随机强密钥（默认值仅用于本地演示）
- 如需接真 AI，设置 `HQ_AI_API_KEY` / `HQ_AI_BASE_URL` 即可从本地规则引擎切换到大模型

---

## 常见问题

**Q：改了后端代码，静态演示版怎么同步？**
A：跑一次 `node tools/build-demo.mjs`。因为演示版是「原样打包」后端源码，
所以不需要改两份逻辑；推送到 `main` 后 CI 也会自动重建。

**Q：怎么重置演示数据？**
A：完整版删掉 `server/data/` 重启；静态版访问 `?demo-reset=1`。

**Q：怎么换 AI 引擎？**
A：设置环境变量 `HQ_AI_API_KEY` 和 `HQ_AI_BASE_URL` 后重启服务。
接口 `/api/v1/ai/provider-status` 会显示当前引擎状态。

**Q：支持微信小程序 / App 吗？**
A：前后端都是标准 HTTP JSON API（`/api/v1`），任何客户端都能对接。小程序端需另配合法域名。
