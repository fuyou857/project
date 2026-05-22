#!/usr/bin/env bash
# 生产环境启动（无 --reload，避免双进程与请求中断）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
if [[ ! -x "${ROOT}/.venv/bin/uvicorn" ]]; then
  echo "请先安装虚拟环境，见 README.md" >&2
  exit 1
fi
# shellcheck disable=SC1091
[[ -f "${ROOT}/.env" ]] && set -a && source "${ROOT}/.env" && set +a
HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8810}"
LOG_LEVEL="${LOG_LEVEL:-info}"
KEEP_ALIVE="${UVICORN_TIMEOUT_KEEP_ALIVE:-300}"
exec "${ROOT}/.venv/bin/uvicorn" app.main:app \
  --host "${HOST}" \
  --port "${PORT}" \
  --log-level "${LOG_LEVEL}" \
  --timeout-keep-alive "${KEEP_ALIVE}"
