#!/usr/bin/env bash
# 将 contract-convert 反代片段安装到宝塔站点（仅当主 vhost 尚未包含该 location 时写入 extension，避免 duplicate）。
# 用法（root，项目根）：bash scripts/apply-contract-convert-nginx.sh [域名目录名]
# 默认域名目录：www.ciond.com（与 server_name 对应）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE="${1:-www.ciond.com}"
SRC="$ROOT/scripts/nginx-contract-convert-proxy.conf"
DEST_DIR="/www/server/panel/vhost/nginx/extension/${SITE}"
DEST="${DEST_DIR}/contract-convert-proxy.conf"
MAIN_VHOST="/www/server/panel/vhost/nginx/${SITE}.conf"

if [[ ! -f "$SRC" ]]; then
  echo "[apply-contract-convert-nginx] 缺少: $SRC" >&2
  exit 1
fi

if [[ -f "$MAIN_VHOST" ]] && grep -q 'location /api/contract-convert/' "$MAIN_VHOST" 2>/dev/null; then
  echo "[apply-contract-convert-nginx] 主 vhost 已含 location /api/contract-convert/：$MAIN_VHOST"
  echo "[apply-contract-convert-nginx] 跳过写入 extension，避免 duplicate location。"
  rm -f "$DEST" 2>/dev/null || true
else
  mkdir -p "$DEST_DIR"
  /bin/cp -f "$SRC" "$DEST"
  echo "[apply-contract-convert-nginx] 已写入: $DEST"
fi

if command -v nginx >/dev/null 2>&1; then
  nginx -t
  nginx -s reload && echo "[apply-contract-convert-nginx] nginx -s reload 成功" || true
else
  echo "[apply-contract-convert-nginx] 未找到 nginx 命令，请手动 nginx -t && nginx -s reload" >&2
fi

echo
echo "请在 Supabase 将 DOC_CONVERT_SERVICE_BASE_URL 设为（按实际域名）："
echo "  https://www.ciond.com/api/contract-convert"
echo "（须与 DOC_CONVERT_WEBHOOK_SECRET、docker-compose 中 CONTRACT_CONVERT_SECRET 一致）"
