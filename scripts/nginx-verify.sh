#!/bin/bash
set -euo pipefail

echo "=== 验证 Nginx 配置 ==="
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx 配置正确"
    echo "=== 重载 Nginx ==="
    nginx -s reload
    echo "✅ Nginx 已重载"
    echo "=== 验证企业微信校验文件访问 ==="
    echo "请手动测试: curl -I https://www.ciond.com/WW_verify_*.txt"
else
    echo "❌ Nginx 配置错误，请检查配置文件"
    exit 1
fi