# 企业微信 API 60020 固定 IP 代理方案

## 架构

```text
Supabase Edge (wechat-work-auth / wechat-work-ops)
    → https://www.ciond.com/api/wechat-work-proxy/cgi-bin/...
    → Nginx → 127.0.0.1:8790 (wechat-work-proxy-server.mjs)
    → https://qyapi.weixin.qq.com（出口 IP = 8.148.26.47）
```

企微「企业可信 IP」**只加**：`8.148.26.47`（不要用 `54.x.x.x` Supabase 段）。

## 一、服务器（已完成可跳过）

```bash
cd /www/wwwroot/ciond && bash scripts/apply-wechat-work-proxy.sh
```

验证（应看到 `from ip: 8.148.26.47`，而非 60020）：

```bash
source .env.wechat-proxy
curl -sS -H "X-Wechat-Proxy-Secret: $WECHAT_WORK_PROXY_SECRET" \
  "https://www.ciond.com/api/wechat-work-proxy/cgi-bin/gettoken?corpid=你的CorpID&corpsecret=你的Secret"
```

## 二、让 Edge 走代理（必做，否则仍报 60020）

任选其一：

### A. Supabase Edge Secrets（推荐）

```bash
# 1) 检查令牌（勿用全局 supabase；勿设 USE_GLOBAL_SUPABASE_CLI=1）
export SUPABASE_ACCESS_TOKEN='sbp_完整令牌'
bash scripts/check-supabase-token.sh

# 2) 写入 Secrets 并部署
bash scripts/set-wechat-proxy-edge-secrets.sh
bash scripts/deploy-edge-functions.sh wechat-work-auth wechat-work-ops api-key-ops
```

或 Dashboard → Edge Functions → Secrets：

| 名称 | 值 |
|------|-----|
| `WECHAT_WORK_PROXY_URL` | `https://www.ciond.com/api/wechat-work-proxy` |
| `WECHAT_WORK_PROXY_SECRET` | 与 `.env.wechat-proxy` 中相同 |

### B. API 密钥中心 `wechat_work` JSON

在现有 JSON 中增加（可复制脚本输出）：

```bash
bash scripts/print-wechat-proxy-json-fields.sh
```

```json
"proxy_url": "https://www.ciond.com/api/wechat-work-proxy",
"proxy_secret": "与 .env.wechat-proxy 中 WECHAT_WORK_PROXY_SECRET 相同"
```

> 若「连通性测试」报 `from ip: 54.x`，说明 Edge 未走代理；配置 proxy 后须重新部署 `api-key-ops`、`wechat-work-auth`。

## 三、重新部署 Edge

```bash
USE_GLOBAL_SUPABASE_CLI=1 bash scripts/deploy-edge-functions.sh wechat-work-auth wechat-work-ops
```

## 四、验证

```bash
curl -sS -X POST 'https://wlkrdylgojkhgfzvcagc.supabase.co/functions/v1/wechat-work-auth' \
  -H 'Content-Type: application/json' \
  -H "apikey: $(grep '^SUPABASE_ANON_KEY=' .env | cut -d= -f2-)" \
  -d '{"action":"getPublicConfig"}'
```

应含 `"proxy_configured":true`。

## 五、Nginx 要点（已实现）

- 对外路径：`/api/wechat-work-proxy/`
- Node 访问企微时 `Host: qyapi.weixin.qq.com`，不转发 `X-Forwarded-For` 至企微
- 鉴权头：`X-Wechat-Proxy-Secret`

## 后续高可用（可选）

- 多台同配置代理 + DNS 轮询
- 或 OpenResty 做健康检查
