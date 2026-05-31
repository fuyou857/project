# 供其它 bash 脚本 source：统一使用 node_modules 内 Supabase CLI（避免 /root/go/bin 旧版误报 token 格式错误）
# 用法：source "$(dirname "$0")/lib/supabase-cli.sh"  或 source "$ROOT/scripts/lib/supabase-cli.sh"

_supabase_cli_root() {
  if [[ -n "${ROOT:-}" ]]; then
    echo "$ROOT"
    return
  fi
  echo "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
}

load_supabase_access_token_from_file() {
  local f="${1:-/tmp/sbp.token}"
  if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]] && [[ -f "$f" ]]; then
    SUPABASE_ACCESS_TOKEN="$(tr -d '\n\r ' < "$f")"
    export SUPABASE_ACCESS_TOKEN
    echo "[supabase-cli] 已从 $f 加载 SUPABASE_ACCESS_TOKEN（前缀 ${SUPABASE_ACCESS_TOKEN:0:8}…）" >&2
  fi
}

validate_supabase_access_token() {
  local label="${1:-supabase}"
  load_supabase_access_token_from_file "${SUPABASE_TOKEN_FILE:-/tmp/sbp.token}"
  if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
    return 0
  fi
  # 去掉常见复制错误：换行、首尾空格与引号
  local t="${SUPABASE_ACCESS_TOKEN//$'\r'/}"
  t="${t//$'\n'/}"
  while [[ "$t" == [[:space:]]* || "$t" == \"* || "$t" == \'* ]]; do t="${t:1}"; done
  while [[ "$t" == *[[:space:]] || "$t" == *\" || "$t" == *\' ]]; do t="${t:0:-1}"; done
  SUPABASE_ACCESS_TOKEN="$t"
  export SUPABASE_ACCESS_TOKEN
  if [[ "$SUPABASE_ACCESS_TOKEN" =~ ^sbp_(oauth_)?[a-f0-9]{40}$ ]]; then
    return 0
  fi
  case "$SUPABASE_ACCESS_TOKEN" in
    eyJ* | sb_publishable_*)
      echo "[$label] SUPABASE_ACCESS_TOKEN 是项目 JWT/anon key，不能用于 CLI。请到 https://supabase.com/dashboard/account/tokens 生成 sbp_ 令牌。" >&2
      ;;
    sbp_*)
      echo "[$label] sbp_ 令牌格式不对：须为 sbp_ + 40 位小写十六进制（总长 44）。当前长度: ${#SUPABASE_ACCESS_TOKEN}" >&2
      echo "[$label] 请到 Dashboard 重新生成并完整复制，勿用打码预览 sbp_0a9c…6791。" >&2
      ;;
    *)
      echo "[$label] SUPABASE_ACCESS_TOKEN 无效。当前前缀: ${SUPABASE_ACCESS_TOKEN:0:12}… 长度: ${#SUPABASE_ACCESS_TOKEN}" >&2
      ;;
  esac
  echo "[$label] 勿使用错误信息里的示例 sbp_0102...1920。" >&2
  return 1
}

run_supabase_cli() {
  local root
  root="$(_supabase_cli_root)"
  local extra=()
  if [[ "${DEBUG:-0}" == "1" ]]; then
    extra+=(--debug)
  fi
  if [[ "${USE_GLOBAL_SUPABASE_CLI:-0}" == "1" ]] && command -v supabase >/dev/null 2>&1; then
    echo "[supabase-cli] 警告: 使用 PATH 全局 supabase；若报 Invalid access token，请 unset USE_GLOBAL_SUPABASE_CLI" >&2
    supabase "$@" "${extra[@]}"
    return $?
  fi
  local local_bin="$root/node_modules/supabase/bin/supabase"
  if [[ ! -f "$local_bin" ]]; then
    echo "[supabase-cli] 未找到 $local_bin，请执行: cd $root && npm install" >&2
    return 1
  fi
  local tmpbin="/tmp/ciond-supabase-cli-$$"
  /bin/cp -f "$local_bin" "$tmpbin"
  chmod +x "$tmpbin"
  echo "[supabase-cli] 本地 CLI v$("$tmpbin" --version 2>/dev/null | head -1 || echo '?'): $*"
  # 显式传入，避免子进程未继承 export
  set +e
  env SUPABASE_ACCESS_TOKEN="$SUPABASE_ACCESS_TOKEN" "$tmpbin" "$@" "${extra[@]}"
  local r=$?
  set -e
  rm -f "$tmpbin"
  return "$r"
}
