#!/usr/bin/env bash
# 检查 SUPABASE_ACCESS_TOKEN 是否已设置且格式正确（不打印完整令牌）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/supabase-cli.sh
source "$ROOT/scripts/lib/supabase-cli.sh"
load_supabase_access_token_from_file "${SUPABASE_TOKEN_FILE:-/tmp/sbp.token}"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "未设置 SUPABASE_ACCESS_TOKEN"
  echo ""
  echo "任选一种方式："
  echo ""
  echo "方式 1（推荐）— 把完整 sbp_ 令牌写入文件后重试："
  echo "  nano /tmp/sbp.token    # 只粘贴一行 sbp_ 令牌，保存退出"
  echo "  bash scripts/check-supabase-token.sh"
  echo ""
  echo "方式 2 — 当前终端 export："
  echo "  export SUPABASE_ACCESS_TOKEN='sbp_你的完整令牌'"
  echo "  bash scripts/check-supabase-token.sh"
  exit 1
fi

if validate_supabase_access_token check-token; then
  echo "OK: 令牌前缀 ${SUPABASE_ACCESS_TOKEN:0:8}… 长度 ${#SUPABASE_ACCESS_TOKEN}"
  echo "可执行:"
  echo "  bash scripts/set-wechat-proxy-edge-secrets.sh"
  echo "  bash scripts/deploy-edge-functions.sh wechat-work-auth wechat-work-ops api-key-ops"
  exit 0
fi
exit 1
