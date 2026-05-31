# 企业微信扫码登录与用户管理

## 登录方式说明

| 方式 | 入口 | 匹配规则 |
|------|------|----------|
| 账号密码 | `/login` | **用户名** 或 **手机号** + 密码（**不使用邮箱登录**） |
| 企业微信扫码 | `/login` → 使用企业微信登录 | **手机号** 优先，其次 **姓名**（`real_name`），**不与邮箱匹配** |

> Supabase Auth 内部仍使用 `users.email` 字段作为技术凭证（可填内部邮箱如 `13800138000@internal.ciond.local`），用户无需记住该邮箱。

## 企业微信扫码匹配逻辑

1. 扫码授权后，Edge `wechat-work-auth` 拉取成员 `mobile`、`name`
2. **优先**：`mobile` 与 `users.phone` 规范化后一致（支持去空格、去 `+86`、后 11 位比对）
3. **其次**：`name` 与 `users.real_name` 去首尾空格后忽略大小写完全一致
4. 匹配到 0 个 → 提示未找到；匹配到多个 → 提示联系管理员
5. 匹配成功后自动写入 `wechat_work_userid` / `wechat_work_name`，并建立会话

## 用户资料要求

- **手机号**：建议填写，用于密码登录与企微扫码（须与企微成员手机号一致）
- **姓名**：建议与企微显示名一致，作为手机号未命中时的备选匹配
- **内部邮箱**：可选；新建用户未填时系统自动生成 `{手机号}@internal.ciond.local` 或 `{用户名}@internal.ciond.local`

## 固定 IP 代理（解决 errcode 60020）

Supabase Edge 出口 IP 不固定，企微会报 `not allow to access from your ip`。  
在本站部署代理后，**只需把服务器公网 IP** 加入企微「企业可信 IP」。

```bash
cd /www/wwwroot/ciond && bash scripts/apply-wechat-work-proxy.sh
```

脚本会：启动 `127.0.0.1:8790` 代理、安装 Nginx `/api/wechat-work-proxy/`、生成 `.env.wechat-proxy` 中的 `WECHAT_WORK_PROXY_SECRET`。

在 **API 密钥中心 `wechat_work` JSON** 中增加（与 `.env.wechat-proxy` 一致）：

```json
{
  "corp_id": "wwea223b1a3cc25eeb",
  "agent_id": "1000026",
  "redirect_uri": "https://www.ciond.com/login",
  "corp_secret": "应用Secret",
  "proxy_url": "https://www.ciond.com/api/wechat-work-proxy",
  "proxy_secret": "apply 脚本输出的 WECHAT_WORK_PROXY_SECRET"
}
```

或在 **Supabase Edge Secrets** 设置 `WECHAT_WORK_PROXY_URL`、`WECHAT_WORK_PROXY_SECRET`。

部署 Edge：`bash scripts/deploy-edge-functions.sh wechat-work-auth wechat-work-ops`

## 配置与部署

见下文「密钥配置」「部署」章节（与此前相同）。

### 密钥配置（API 密钥中心 `wechat_work`）

```json
{
  "corp_id": "真实CorpID",
  "agent_id": "真实AgentId",
  "redirect_uri": "https://www.ciond.com/login",
  "corp_secret": "应用Secret"
}
```

**勿使用占位符**（如 `你的CorpID`）。

### 部署 Edge

```bash
cd /www/wwwroot/ciond && USE_GLOBAL_SUPABASE_CLI=1 bash scripts/deploy-edge-functions.sh login wechat-work-auth api-key-ops
```

### 前端

```bash
npm run deploy:site
```

## 企微后台

- 可信域名：`www.ciond.com`
- 授权回调：`https://www.ciond.com/login`
- 成员须在企业微信中维护**手机号**（否则只能按姓名匹配）

## 常见错误

| 提示 | 处理 |
|------|------|
| 未找到匹配的系统账号 | 核对用户管理中手机号、姓名与企微成员一致 |
| 对应多个系统账号 | 去重手机号或姓名 |
| invalid corpid | 修正 API 密钥中心 `wechat_work` 的 `corp_id` |
| 用户名或手机号不存在 | 检查用户名/手机号与密码 |
