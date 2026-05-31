#!/usr/bin/env bash
# 仅重置超管密码，不改动 role_ids / 权限矩阵（默认）
# 用法：
#   SUPABASE_SERVICE_ROLE_KEY='eyJ…' INIT_ADMIN_PASSWORD='新密码' bash scripts/reset-super-admin.sh
#   SUPABASE_SERVICE_ROLE_KEY='eyJ…' RESET_GENERATE=1 bash scripts/reset-super-admin.sh
#   SUPABASE_SERVICE_ROLE_KEY='eyJ…' RESET_TARGET_USERNAME='admin' INIT_ADMIN_PASSWORD='新密码' bash scripts/reset-super-admin.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "缺少 SUPABASE_SERVICE_ROLE_KEY（Supabase → Settings → API → service_role）" >&2
  exit 1
fi

export SUPABASE_URL="${SUPABASE_URL:-https://wlkrdylgojkhgfzvcagc.supabase.co}"

echo "[reset-admin] 安全模式：只改密码，不改管理员权限与 role_ids"
node scripts/reset-super-admin.mjs
