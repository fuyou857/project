#!/bin/bash
# 测试 contract-convert 服务

cd /www/wwwroot/ciond/contract-convert-service

# 激活虚拟环境
source venv/bin/activate

# 测试导入是否正常
echo "测试模块导入..."
python3 -c "
import sys
print('Python 版本:', sys.version)
import fastapi
print('FastAPI 导入成功:', fastapi.__version__)
import httpx
print('httpx 导入成功:', httpx.__version__)
import PyPDF2
print('PyPDF2 导入成功:', PyPDF2.__version__)
import docxtpl
print('docxtpl 导入成功:', docxtpl.__version__)
print('所有依赖导入成功！')
"

# 尝试启动服务（测试模式，立即退出）
echo ""
echo "测试服务启动..."
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8788 --workers 1 --timeout-keep-alive 5 2>&1 &
TEST_PID=$!

# 等待一下
sleep 3

# 检查进程是否还在
if kill -0 $TEST_PID 2>/dev/null; then
    echo "服务启动成功！"
    kill $TEST_PID
    echo "测试完成！"
    exit 0
else
    echo "服务启动失败，请检查日志"
    exit 1
fi
