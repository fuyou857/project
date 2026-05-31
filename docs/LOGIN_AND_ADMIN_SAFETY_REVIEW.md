# 登录 / 企微 / 管理员 — 安全影响审查（不改现有权限）

## 结论摘要

| 模块 | 是否改 role_ids / 权限 | 是否影响已有业务数据 | 说明 |
|------|------------------------|----------------------|------|
| 用户名/手机号 + 密码登录 (`login` Edge) | **否** | **否** | 只读 `users` 查账号，只更新 `last_login_at` |
| 企微扫码登录 (`wechat-work-auth`) | **否** | **否** | 按手机号/姓名匹配；仅写 `wechat_work_*`、`last_login_at` |
| 企微固定 IP 代理 (`wechat-work-proxy`) | **否** | **否** | 仅改变访问企微 API 的出口 IP |
| API 密钥中心 `wechat_work` | **否** | **否** | 仅配置项，不动用户表 |
| `reset-super-admin.mjs`（新版） | **默认否** | **默认否** | **仅改密码**；勿设 `RESET_FULL_OVERWRITE=1` |
| `init-admin.js` | **会**（仅新建时） | 慎用 | 会 `delete` 同邮箱用户行后 `insert`，**勿对生产随意执行** |
| 用户管理 UI（邮箱可选） | **否** | **否** | 仅影响「新建用户」表单，不改已有用户 |
| 审批 / 合同 / 其它模块 | **否** | **否** | 本次未改 |

---

## 请勿执行（易影响权限或数据）

1. **`RESET_FULL_OVERWRITE=1` + reset-super-admin** — 会覆盖 `username` / `email` / `role_ids`
2. **`init-admin.js`** — 按邮箱删除 `users` 行再插入，可能冲掉原有超管资料
3. **旧版 reset 脚本**（若曾覆盖 `role_ids: [roleId]`）— 已改为安全模式

---

## 安全重置密码（推荐）

```bash
cd /www/wwwroot/ciond
SUPABASE_SERVICE_ROLE_KEY='你的service_role' \
RESET_TARGET_USERNAME='你的超管用户名' \
INIT_ADMIN_PASSWORD='你的新密码' \
bash scripts/reset-super-admin.sh
```

- **保留**：`role_ids`、`project_ids`、`company_id`、`real_name`、`phone`、权限矩阵
- **仅改**：Supabase Auth 密码 + `users.password` 占位哈希

自动生成密码：

```bash
SUPABASE_SERVICE_ROLE_KEY='…' RESET_GENERATE=1 RESET_TARGET_USERNAME='admin' bash scripts/reset-super-admin.sh
```

---

## 登录逻辑说明（与旧版差异）

- **以前**：登录框可拼 `@ciond.com` 当邮箱登录。
- **现在**：必须用 **用户名** 或 **11 位手机号** + 密码；内部仍用 `users.email` 调 Supabase Auth，**界面上不要求填邮箱**。
- **超管权限判定**：仍读 `users.role_ids` → `roles.code === 'super_admin'`，逻辑未改。

---

## 企微登录说明

- **匹配**：企微 `mobile` → `users.phone`；否则 `name` → `users.real_name`。
- **不匹配邮箱**。
- **不写** `role_ids`。
- **会写** `wechat_work_userid` / `wechat_work_name`（便于下次识别，不影响 RBAC）。

---

## 部署检查（功能正常所需）

```bash
# 登录
USE_GLOBAL_SUPABASE_CLI=1 bash scripts/deploy-edge-functions.sh login

# 企微（含代理）
USE_GLOBAL_SUPABASE_CLI=1 bash scripts/deploy-edge-functions.sh wechat-work-auth wechat-work-ops

# 本站代理（已 apply 则不必重复）
bash scripts/apply-wechat-work-proxy.sh

# 前端
npm run deploy:site
```

企微白名单 IP：**8.148.26.47**（本站出口，非 Supabase `54.x`）。

---

## 自检 SQL（只读，不改数据）

```sql
-- 查看所有用户与是否超管
SELECT u.username, u.real_name, u.phone, u.email, u.status, u.role_ids,
       (SELECT array_agg(r.code) FROM roles r WHERE r.id = ANY(u.role_ids)) AS role_codes
FROM public.users u
ORDER BY u.username;
```
