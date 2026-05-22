#!/bin/bash
"""
在后台启动Invoice OCR服务，并将输出重定向到日志文件
"""

set -e

# 进入脚本所在目录
cd "$(dirname "$0")"

# 确保虚拟环境存在
if [ ! -d ".venv" ]; then
    echo "错误：虚拟环境不存在，请先创建虚拟环境并安装依赖"
    exit 1
fi

# 创建日志目录
mkdir -p logs

# 激活虚拟环境并启动服务
nohup bash -c 'source .venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8810 --log-level info' > logs/service.log 2>&1 &

# 保存进程ID
echo $! > logs/service.pid

echo "Invoice OCR服务已在后台启动！"
echo "服务进程ID: $(cat logs/service.pid)"
echo "日志文件: logs/service.log"
echo "使用以下命令停止服务: kill $(cat logs/service.pid)"
