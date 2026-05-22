#!/usr/bin/env bash
# 确保 invoice-ocr 在 8810 端口运行（供计划任务或部署后调用）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-8810}"
LOCAL="http://127.0.0.1:${PORT}/health"

if curl -sf -m 3 "${LOCAL}" >/dev/null 2>&1; then
  echo "[ensure-invoice-ocr] 已在运行: ${LOCAL}"
  exit 0
fi

if command -v systemctl >/dev/null 2>&1 && systemctl is-system-running >/dev/null 2>&1; then
  if systemctl list-unit-files invoice-ocr.service &>/dev/null; then
    sudo systemctl start invoice-ocr
    sleep 3
    if curl -sf -m 5 "${LOCAL}" >/dev/null; then
      echo "[ensure-invoice-ocr] systemd 启动成功"
      exit 0
    fi
  fi
fi

echo "[ensure-invoice-ocr] 使用 run-prod 后台启动…"
cd "${ROOT}/invoice-ocr-service"
nohup ./run-prod.sh >> logs/ocr.log 2>&1 &
sleep 5
if curl -sf -m 8 "${LOCAL}" >/dev/null; then
  echo "[ensure-invoice-ocr] 启动成功"
  exit 0
fi

echo "[ensure-invoice-ocr] 启动失败，请查看 invoice-ocr-service/logs/ocr.log" >&2
exit 1
