#!/usr/bin/env bash
# 发票 OCR 全栈上线：启动 Python 服务 + 健康检查 + 提示 Nginx / 前端部署
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OCR_DIR="${ROOT}/invoice-ocr-service"
PORT="${PORT:-8810}"
PUBLIC="${PUBLIC_OCR_URL:-https://ocr.ciond.com}"

echo "[ocr-stack] 1/4 安装/更新 systemd 单元"
sudo cp "${OCR_DIR}/invoice-ocr.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable invoice-ocr

echo "[ocr-stack] 2/4 重启 OCR 服务 (端口 ${PORT})"
sudo systemctl restart invoice-ocr
sleep 3
if ! systemctl is-active --quiet invoice-ocr; then
  echo "[ocr-stack] 启动失败，最近日志：" >&2
  sudo journalctl -u invoice-ocr -n 40 --no-pager >&2 || true
  exit 1
fi

echo "[ocr-stack] 3/4 本机健康检查"
if curl -sf -m 10 "http://127.0.0.1:${PORT}/health" >/dev/null; then
  curl -sS "http://127.0.0.1:${PORT}/health"
  echo
else
  echo "[ocr-stack] 本机 http://127.0.0.1:${PORT}/health 失败" >&2
  exit 1
fi

echo "[ocr-stack] 4/4 公网健康检查（需 Nginx 已指向 ${PORT}）"
if curl -sf -m 15 "${PUBLIC}/health" >/dev/null 2>&1; then
  curl -sS "${PUBLIC}/health"
  echo
  echo "[ocr-stack] 公网 OCR 正常。"
else
  echo "[ocr-stack] 警告: ${PUBLIC}/health 未通过。请按 scripts/nginx-ocr-ciond.conf.example 配置 Nginx 后执行: nginx -t && nginx -s reload"
fi

echo ""
echo "[ocr-stack] 下一步（前端）："
echo "  cd ${ROOT} && npm run deploy:site"
echo "  确认 .env 中 INVOICE_OCR_SERVICE_URL=https://ocr.ciond.com（勿用 localhost）"
