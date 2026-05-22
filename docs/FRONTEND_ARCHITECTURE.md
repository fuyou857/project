# 前端架构：数据访问、登录与环境变量

## 1. Supabase 直连 vs 自建 API（并存关系）

| 能力 | 实现方式 | 说明 |
|------|-----------|------|
| **业务 CRUD、认证会话、RLS** | **Supabase 直连**（`src/supabase/client.ts`，`@supabase/supabase-js`） | 浏览器使用 **anon key**；鉴权由 Supabase Auth + JWT；数据权限依赖 **数据库 RLS**（见 `docs/DATABASE_RLS.md`）。 |
| **企业微信扫码登录回调落地** | **自建后端 API**（约定路径 **`POST /api/auth/wechat-work/login`**） | `loginWithWechatWork`（`src/services/wechatWorkService.ts`）在企业微信返回 `code` 后调用该接口；服务端应校验 code、建立/绑定用户并签发可与 Supabase 对齐的会话方案（见下方 staging）。 |
| **企业微信 OAuth / token** | 前端直连 **微信开放平台域名**（`qyapi.weixin.qq.com` 等） | 用于换取用户信息；**CorpSecret 必须只在服务端**，不得写入前端。 |

结论：**两套并存**——日常业务数据走 Supabase；企微登录最后一步走自建 `/api`；不要在同一流程里混用未文档化的其它 REST 基地址。

---

## 2. 环境变量（浏览器可见）

Webpack 仅向 bundle 注入以下键（`webpack.config.js` 中 `CLIENT_SAFE_ENV_KEYS`），请在部署环境的 `.env` 中配置：

| 变量 | 用途 |
|------|------|
| `SUPABASE_URL` | Supabase 项目 URL |
| `SUPABASE_ANON_KEY` | 匿名密钥（配合 RLS） |
| `WECHAT_WORK_CORP_ID` | 企业微信企业 ID |
| `WECHAT_WORK_AGENT_ID` | 自建应用 AgentId |
| `WECHAT_WORK_REDIRECT_URI` | OAuth 回调 URL（需与企微后台、自建 `/api` 路由一致） |

**勿**把 `SUPABASE_SERVICE_ROLE_KEY` 或企微 **Secret** 放进前端 env。

---

## 3. 登录入口分支（代码入口）

| 入口 | 文件 | 行为 |
|------|------|------|
| 账号密码 | `Login.tsx` → `useAuth().signIn` | Supabase `signInWithPassword`，会话写入 Supabase Auth；`localStorage.user` 存业务用户扩展信息。 |
| 企业微信 | `Login.tsx` 内嵌 `WechatWorkLogin.tsx` | 配置合法时展示；扫码回调带 `code` → `loginWithWechatWork` → **`POST /api/auth/wechat-work/login`**；成功后可 `navigate('/dashboard')`（需在服务端与 Supabase 会话策略对齐）。 |

若未配置企微 env，`validateWechatWorkConfig()` 为 false，页面提示「企业微信登录功能暂未配置」。

---

## 4. Staging 验收清单：扫码 → 会话 → RLS 身份

在 **staging** 环境逐项打通：

1. **扫码**：企微工作台打开应用，能回到前端并带上 `?code=`。
2. **自建登录接口**：`POST /api/auth/wechat-work/login` 返回成功，且用户 identity 与 Supabase `users`（或 auth.users）一致。
3. **会话**：浏览器中 `supabase.auth.getSession()`（或通过现有 `AuthProvider`）与业务用户一致；**勿**仅在 `localStorage` 手写 user 而无 Supabase session（除非后端明确采用自定义 token 方案并已接入客户端）。
4. **RLS**：用 **非超管** 测试账号仅能读写本公司/本项目数据；直接请求 REST API（curl + anon key）不可越权。

---

## 5. 前端路由权限 vs RLS

侧栏与 `routePermissions.ts` 仅控制 **「看不见入口」**；**跨公司/跨项目越权**必须在 PostgreSQL **RLS** 与策略中拦截（参见 `docs/DATABASE_RLS.md`）。

---

## 6. 生产构建：禁止关闭路由守卫

`DISABLE_FRONTEND_AUTH`（`src/config/accessControl.ts`）必须为 **`false`**。生产构建前运行 **`npm run build`** 会先执行 `scripts/assert-prod-auth.mjs`；若为 `true` 构建失败。
