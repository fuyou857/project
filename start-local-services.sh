#!/bin/bash
# 本地合同转换服务启动脚本
set -euo pipefail

echo "开始启动本地合同转换服务..."

# 项目根目录
PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

echo "项目根目录: $PROJECT_ROOT"

# 先清理上次遗留进程，避免 EADDRINUSE
if [ -x "$PROJECT_ROOT/stop-local-services.sh" ]; then
  echo "先执行 stop-local-services.sh 释放 8788/8789…"
  bash "$PROJECT_ROOT/stop-local-services.sh" || true
  sleep 1
fi

port_listening() {
  local p=$1
  if command -v ss >/dev/null 2>&1; then
    ss -ltn 2>/dev/null | grep -qE ":${p}\\s" && return 0
    return 1
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1 && return 0
    return 1
  fi
  return 1
}

if port_listening 8789; then
  echo "错误: 端口 8789 仍被占用（Node 中间层）。请执行: bash $PROJECT_ROOT/stop-local-services.sh" >&2
  ss -ltnp 2>/dev/null | grep -E ':8789\s' || true
  exit 1
fi

# 1. 启动 contract-convert 服务
echo "正在启动 contract-convert 服务..."
cd "$PROJECT_ROOT/contract-convert-service"
if [ ! -d "venv" ]; then
    echo "创建 Python 虚拟环境..."
    python3 -m venv venv
fi
source venv/bin/activate
echo "安装 Python 依赖..."
pip install -r requirements.txt

if port_listening 8788; then
  echo "错误: 端口 8788 已被占用。常见原因：" >&2
  echo "  ① 已运行 docker compose 的 contract-convert（与脚本内 Python 二选一）" >&2
  echo "  ② 上次 uvicorn 未退出，请: bash $PROJECT_ROOT/stop-local-services.sh" >&2
  ss -ltnp 2>/dev/null | grep -E ':8788\s' || true
  exit 1
fi

echo "启动 contract-convert 服务 (端口 8788)..."
# 使用虚拟环境中的 uvicorn
venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8788 &
CONVERT_PID=$!

# 2. 启动 Node.js 中间服务
echo "正在启动 Node.js 中间服务..."
cd "$PROJECT_ROOT"
if [ ! -d "local-services" ]; then
    mkdir -p local-services
    cp package-local-services.json local-services/package.json
    cp contract-document-convert-local.js local-services/
    cd local-services
    echo "安装 Node.js 依赖..."
    npm install
else
    cd local-services
fi

echo "启动 contract-document-convert 本地服务 (端口 8789)..."
node contract-document-convert-local.js &
NODE_PID=$!

trap "echo '正在停止服务...'; kill $CONVERT_PID $NODE_PID 2>/dev/null || true; bash \"$PROJECT_ROOT/stop-local-services.sh\" || true; exit" INT TERM

# 保存 PID
echo $CONVERT_PID > "$PROJECT_ROOT/.convert-service.pid"
echo $NODE_PID > "$PROJECT_ROOT/.node-service.pid"

echo "服务已启动！"
echo "contract-convert 服务 PID: $CONVERT_PID"
echo "Node.js 中间服务 PID: $NODE_PID"
echo ""
echo "按 Ctrl+C 停止所有服务，或者手动运行 stop-local-services.sh"

wait
