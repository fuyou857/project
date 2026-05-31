#!/usr/bin/env bash
# 输出可粘贴到 API 密钥中心 wechat_work JSON 的 proxy 字段（与 Edge Secrets 二选一）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.wechat-proxy"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "缺少 $ENV_FILE，请先: bash scripts/apply-wechat-work-proxy.sh" >&2
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
cat <<EOF
在 wechat_work JSON 中增加（注意逗号）：

  "proxy_url": "$PROXY_URL",
  "proxy_secret": "$PROXY_SECRET"

企微「企业可信 IP」只需：8.148.26.47
EOF
