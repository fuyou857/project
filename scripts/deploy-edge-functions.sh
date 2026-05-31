#!/usr/bin/env bash
# 将仓库内全部 Edge Functions 部署到 supabase/config.toml 中的 project_id 对应项目。
#
# 认证（与官方 CLI 一致）：
#   - 推荐：export SUPABASE_ACCESS_TOKEN='sbp_…'（ https://supabase.com/dashboard/account/tokens ）
#   - 或：unset SUPABASE_ACCESS_TOKEN 后执行 `supabase login`
#
# 用法（项目根）：
#   bash scripts/deploy-edge-functions.sh                    # 部署下列全部
#   bash scripts/deploy-edge-functions.sh login admin-user-ops   # 仅部署指定名称
#
# 依赖：supabase/functions 须指向仓库根目录的 functions/（见 supabase/functions → ../functions）。
#
# 默认使用 node_modules/supabase/bin/supabase（勿设 USE_GLOBAL_SUPABASE_CLI=1，/root/go/bin 旧版会误报 token 格式错误）。
# 先检查令牌: bash scripts/check-supabase-token.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=lib/supabase-cli.sh
source "$ROOT/scripts/lib/supabase-cli.sh"

load_supabase_access_token_from_file "${SUPABASE_TOKEN_FILE:-/tmp/sbp.token}"
if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "[deploy-edge] 未设置 SUPABASE_ACCESS_TOKEN。请先:" >&2
  echo "  export SUPABASE_ACCESS_TOKEN='sbp_…'  或  nano /tmp/sbp.token" >&2
  echo "  bash scripts/check-supabase-token.sh" >&2
  exit 1
fi
validate_supabase_access_token deploy-edge || exit 1

if [[ ! -f supabase/config.toml ]]; then
  echo "[deploy-edge] 缺少 supabase/config.toml" >&2
  exit 1
fi

PROJECT_REF="$(grep -E '^[[:space:]]*project_id[[:space:]]*=' supabase/config.toml | head -1 | sed -E 's/^[[:space:]]*project_id[[:space:]]*=[[:space:]]*"([^"]+)".*/\1/')"
if [[ -z "$PROJECT_REF" ]]; then
  echo "[deploy-edge] 无法从 supabase/config.toml 解析 project_id" >&2
  exit 1
fi

DEFAULT_FUNCS=(
  contract-document-convert
  onlyoffice-callback
  admin-user-ops
  api-key-ops
  wechat-work-ops
  wechat-work-auth
  warning-generator
  project-delete-check
  login
  invoice-ocr
)

if [[ $# -gt 0 ]]; then
  FUNCS=("$@")
else
  FUNCS=("${DEFAULT_FUNCS[@]}")
fi

for name in "${FUNCS[@]}"; do
  if [[ ! -e "supabase/functions/$name/index.ts" ]]; then
    echo "[deploy-edge] 缺少 supabase/functions/$name/index.ts（确认 supabase/functions 已链接到 ../functions）" >&2
    exit 1
  fi
done

for name in "${FUNCS[@]}"; do
  echo "[deploy-edge] --- deploy $name ---"
  extra=()
  case "$name" in
    login|wechat-work-auth|onlyoffice-callback|admin-user-ops|api-key-ops)
      extra+=(--no-verify-jwt)
      ;;
  esac
  run_supabase_cli functions deploy "$name" --project-ref "$PROJECT_REF" "${extra[@]}"
done

echo "[deploy-edge] 全部完成: ${FUNCS[*]}"
