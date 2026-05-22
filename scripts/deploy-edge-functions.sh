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
# USE_GLOBAL_SUPABASE_CLI=1 时使用 PATH 中的全局 `supabase`。
# 默认使用 node_modules/supabase/bin/supabase；若遇「Text file busy」，会复制到 /tmp 再执行。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  case "$SUPABASE_ACCESS_TOKEN" in
    sbp_*) ;;
    *)
      echo "[deploy-edge] 环境变量 SUPABASE_ACCESS_TOKEN 格式无效：须为 Dashboard → Account → Access Tokens 生成的「Personal Access Token」，以 sbp_ 开头。" >&2
      echo "[deploy-edge] 请勿使用项目的 anon key、service_role JWT 或其它字符串。" >&2
      echo "[deploy-edge] 修正方式其一：unset SUPABASE_ACCESS_TOKEN 后在本机执行 supabase login" >&2
      echo "[deploy-edge] 修正方式其二：export SUPABASE_ACCESS_TOKEN='sbp_你的新令牌'" >&2
      exit 1
      ;;
  esac
fi

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

run_supabase() {
  if [[ "${USE_GLOBAL_SUPABASE_CLI:-0}" == "1" ]] && command -v supabase >/dev/null 2>&1; then
    echo "[deploy-edge] 使用全局: supabase $*"
    supabase "$@"
    return
  fi
  LOCAL_BIN="$ROOT/node_modules/supabase/bin/supabase"
  if [[ -f "$LOCAL_BIN" ]] && [[ -r "$LOCAL_BIN" ]]; then
    TMPBIN="/tmp/ciond-supabase-cli-$$"
    /bin/cp -f "$LOCAL_BIN" "$TMPBIN"
    chmod +x "$TMPBIN"
    echo "[deploy-edge] 使用本地 CLI（/tmp 副本）: $*"
    set +e
    "$TMPBIN" "$@"
    R=$?
    set -e
    rm -f "$TMPBIN"
    return "$R"
  fi
  echo "[deploy-edge] 未找到 node_modules/supabase/bin/supabase，请先执行: npm install" >&2
  echo "[deploy-edge] 或安装全局 CLI 后: USE_GLOBAL_SUPABASE_CLI=1 bash $0" >&2
  exit 1
}

for name in "${FUNCS[@]}"; do
  echo "[deploy-edge] --- deploy $name ---"
  run_supabase functions deploy "$name" --project-ref "$PROJECT_REF"
done

echo "[deploy-edge] 全部完成: ${FUNCS[*]}"
