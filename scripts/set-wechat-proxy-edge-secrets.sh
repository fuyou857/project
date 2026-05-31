#!/usr/bin/env bash
# 将本站企微代理配置写入 Supabase Edge Secrets（解决 60020）
# 用法：SUPABASE_ACCESS_TOKEN='sbp_…' bash scripts/set-wechat-proxy-edge-secrets.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=lib/supabase-cli.sh
source "$ROOT/scripts/lib/supabase-cli.sh"
ENV_FILE="$ROOT/.env.wechat-proxy"
PROJECT_REF="wlkrdylgojkhgfzvcagc"

load_supabase_access_token_from_file "${SUPABASE_TOKEN_FILE:-/tmp/sbp.token}"
if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "[secrets] 未设置 SUPABASE_ACCESS_TOKEN。请先 export 或 nano /tmp/sbp.token" >&2
  exit 1
fi
validate_supabase_access_token secrets || exit 1

if [[ ! -f "$ENV_FILE" ]]; then
  echo "缺少 $ENV_FILE，请先执行: bash scripts/apply-wechat-work-proxy.sh" >&2
  exit 1
fi
# shellcheck disable=SC1090
source "$ENV_FILE"

PROXY_URL="${WECHAT_WORK_PROXY_URL:-https://www.ciond.com/api/wechat-work-proxy}"
PROXY_SECRET="${WECHAT_WORK_PROXY_SECRET:-}"

if [[ -z "$PROXY_SECRET" ]]; then
  echo "WECHAT_WORK_PROXY_SECRET 为空" >&2
  exit 1
fi

echo "[secrets] 将写入项目 $PROJECT_REF"
echo "  WECHAT_WORK_PROXY_URL=$PROXY_URL"
echo "  WECHAT_WORK_PROXY_SECRET=(已隐藏)"

if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  run_supabase_cli secrets set \
    WECHAT_WORK_PROXY_URL="$PROXY_URL" \
    WECHAT_WORK_PROXY_SECRET="$PROXY_SECRET" \
    --project-ref "$PROJECT_REF"
  echo "[secrets] 完成。请重新部署: bash scripts/deploy-edge-functions.sh wechat-work-auth wechat-work-ops api-key-ops"
  exit 0
fi

echo ""
echo "未检测到 SUPABASE_ACCESS_TOKEN，请手动在 Supabase Dashboard 配置："
echo "  Project → Edge Functions → Secrets"
echo "  WECHAT_WORK_PROXY_URL = $PROXY_URL"
echo "  WECHAT_WORK_PROXY_SECRET = (见 $ENV_FILE)"
echo ""
echo "或在 API 密钥中心 wechat_work JSON 增加："
echo "  \"proxy_url\": \"$PROXY_URL\","
echo "  \"proxy_secret\": \"<与 $ENV_FILE 中 WECHAT_WORK_PROXY_SECRET 相同>\""
echo ""
echo "企微后台「企业可信 IP」只需添加: 8.148.26.47"
