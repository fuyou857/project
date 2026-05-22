#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
PY="${ROOT}/.venv/bin/python"
if [[ ! -x "$PY" ]]; then
  echo "请先创建虚拟环境: python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt" >&2
  exit 1
fi
HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8810}"
LOG_LEVEL="${LOG_LEVEL:-debug}"
echo "当前目录: $(pwd)"
echo "Python路径: ${PY}"
echo "Python版本: $(${PY} --version)"
echo "UVicorn路径: ${ROOT}/.venv/bin/uvicorn"
echo "启动服务（开发，带 --reload）: uvicorn app.main:app --host ${HOST} --port ${PORT}"
exec "${ROOT}/.venv/bin/uvicorn" app.main:app --host "${HOST}" --port "${PORT}" --log-level "${LOG_LEVEL}" --reload
