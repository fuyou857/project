#!/bin/bash
# 停止本地合同转换相关进程（PID 文件 + 端口/命令行兜底）
set -euo pipefail

PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

echo "正在停止本地合同转换服务..."

stop_pid_file() {
  local file=$1
  local label=$2
  if [ -f "$file" ]; then
    local pid
    pid=$(cat "$file")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      echo "已停止 $label (PID: $pid)"
    else
      echo "$label (PID: $pid) 未运行"
    fi
    rm -f "$file"
  fi
}

stop_pid_file "$PROJECT_ROOT/.convert-service.pid" "contract-convert (PID 文件)"
stop_pid_file "$PROJECT_ROOT/.node-service.pid" "Node.js 中间服务 (PID 文件)"

# 兜底：未写入 PID 文件或进程已脱离时的 Node 中间层（固定脚本名 + 端口 8789）
if command -v fuser >/dev/null 2>&1; then
  if fuser 8789/tcp >/dev/null 2>&1; then
    fuser -k 8789/tcp 2>/dev/null && echo "已释放端口 8789（fuser）" || true
  fi
fi
pkill -f "node.*contract-document-convert-local\.js" 2>/dev/null && echo "已结束 contract-document-convert-local.js" || true

# 兜底：本脚本启动的 uvicorn（勿对 8788 无差别 fuser，以免误伤 Docker 映射到 8788 的 docker-proxy）
pkill -f "uvicorn app\.main:app.*--port 8788" 2>/dev/null && echo "已结束 uvicorn app.main:app (8788)" || true

sleep 1

if command -v ss >/dev/null 2>&1; then
  if ss -ltn 2>/dev/null | grep -qE ':8789\s'; then
    echo "警告: 端口 8789 仍被占用，请检查: ss -ltnp | grep 8789" >&2
  fi
  if ss -ltn 2>/dev/null | grep -qE ':8788\s'; then
    echo "提示: 端口 8788 仍被占用。若为 Docker 的 contract-convert，属正常；请勿再启动脚本内的 Python 服务，或先 docker compose stop。" >&2
  fi
fi

echo "停止流程已完成。"
