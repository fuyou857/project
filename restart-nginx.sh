#!/bin/bash
# 重启 nginx 使配置生效

echo "=== 停止所有 nginx 进程 ==="
pkill -9 -f nginx 2>/dev/null
sleep 2

echo "=== 检查 nginx 主进程 ==="
ps aux | grep nginx | grep -v grep

echo "=== 启动 nginx ==="
/www/server/nginx/sbin/nginx 2>&1

echo "=== 检查端口监听 ==="
ss -tlnp | grep -E ":80 |:443 "

echo "=== 测试访问 ==="
sleep 1
curl -k -I https://localhost/ 2>/dev/null | head -3
