#!/usr/bin/env bash
# 快速检查自建发票 OCR 是否可用（本机 + 公网）
set -euo pipefail
PORT="${PORT:-8810}"
LOCAL="http://127.0.0.1:${PORT}"
PUBLIC="${PUBLIC_OCR_URL:-https://ocr.ciond.com}"

echo "=== 本机 ${LOCAL}/health ==="
if curl -sf -m 5 "${LOCAL}/health" >/dev/null; then
  curl -sS "${LOCAL}/health"
  echo
else
  echo "失败：本机 OCR 未监听 ${PORT}。请执行: sudo systemctl start invoice-ocr"
  echo "  或: cd invoice-ocr-service && ./run-prod.sh"
fi

echo ""
echo "=== 公网 ${PUBLIC}/health ==="
if curl -sf -m 10 "${PUBLIC}/health" >/dev/null 2>&1; then
  curl -sS "${PUBLIC}/health"
  echo
else
  echo "失败：公网不可达或 502。请检查 Nginx 反代端口是否为 ${PORT}，以及 proxy_read_timeout≥300s"
fi
