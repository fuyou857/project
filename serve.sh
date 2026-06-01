#!/bin/bash
# 临时服务脚本 - 启动 HTTP 服务器提供静态文件
python3 -m http.server 8082 --bind 0.0.0.0
