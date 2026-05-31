#!/usr/bin/env bash
# init-deploy-agent.sh — 初始化部署 Webhook 监听服务
#
# 用法: sudo bash scripts/init-deploy-agent.sh
#
# 该脚本会:
#   1. 生成随机安全密钥
#   2. 写入 .deploy-agent.secret（chmod 600）
#   3. 安装 systemd 服务
#   4. 启动服务并设置开机自启
#   5. 输出触发部署的 curl 命令
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ $EUID -ne 0 ]]; then
  echo "请使用 sudo 运行: sudo bash $0" >&2
  exit 1
fi

echo "==> 初始化部署 Webhook 服务 …"

# 1. 生成密钥
SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo -n "$SECRET" > "$ROOT/.deploy-agent.secret"
chmod 600 "$ROOT/.deploy-agent.secret"
echo "   密钥已写入: $ROOT/.deploy-agent.secret"

# 2. 创建环境文件（兼容 EnvironmentFile 加载）
echo "DEPLOY_AGENT_SECRET=$SECRET" > "$ROOT/.deploy-agent.env"
chmod 600 "$ROOT/.deploy-agent.env"
echo "   环境文件已写入: $ROOT/.deploy-agent.env"

# 3. 安装 systemd 服务
SERVICE_FILE="$ROOT/scripts/ciond-deploy-agent.service"
if [[ -f "$SERVICE_FILE" ]]; then
  cp "$SERVICE_FILE" /etc/systemd/system/ciond-deploy-agent.service
  systemctl daemon-reload
  echo "   systemd 服务已安装"
else
  echo "   错误: 找不到 $SERVICE_FILE" >&2
  exit 1
fi

# 4. 启用并启动
systemctl enable ciond-deploy-agent
systemctl restart ciond-deploy-agent
echo "   服务已启动 (systemctl status ciond-deploy-agent)"

# 5. 等待服务就绪
sleep 2
if systemctl is-active --quiet ciond-deploy-agent; then
  echo ""
  echo "  ✅ 部署代理服务已就绪!"
  echo ""
  echo "  📡  监听地址: http://127.0.0.1:18900"
  echo "  🔑  密钥: ${SECRET:0:8}…${SECRET: -4}"
  echo ""
  echo "  触发部署 (curl):"
  echo "    curl -X POST http://localhost:18900/deploy \\"
  echo "      -H \"Authorization: Bearer $SECRET\" \\"
  echo "      -H \"Content-Type: application/json\" \\"
  echo "      -d '{}'"
  echo ""
  echo "  健康检查:"
  echo "    curl http://localhost:18900/health"
  echo ""
  echo "  查看日志:"
  echo "    journalctl -u ciond-deploy-agent -f"
else
  echo "   错误: 服务启动失败，请检查: journalctl -u ciond-deploy-agent -n 50" >&2
  systemctl status ciond-deploy-agent --no-pager || true
  exit 1
fi