#!/usr/bin/env bash
# 安装并启动企业微信 API 固定 IP 代理 + Nginx 片段
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="$ROOT/.env.wechat-proxy"
NGINX_SNIPPET="$ROOT/scripts/nginx-wechat-work-proxy.conf"
BT_EXT="/www/server/panel/vhost/nginx/extension/www.ciond.com"

echo "[wechat-proxy] 1/5 生成代理密钥（若不存在）"
if [[ ! -f "$ENV_FILE" ]]; then
  SECRET="$(openssl rand -hex 24)"
  cat > "$ENV_FILE" <<EOF
WECHAT_WORK_PROXY_SECRET=${SECRET}
WECHAT_WORK_PROXY_PORT=8790
EOF
  chmod 600 "$ENV_FILE"
  echo "[wechat-proxy] 已写入 $ENV_FILE"
else
  echo "[wechat-proxy] 使用已有 $ENV_FILE"
fi
# shellcheck disable=SC1090
source "$ENV_FILE"

echo "[wechat-proxy] 2/5 安装 systemd 服务"
if command -v systemctl >/dev/null 2>&1; then
  sudo cp "$ROOT/scripts/wechat-work-proxy.service" /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable wechat-work-proxy.service
  sudo systemctl restart wechat-work-proxy.service
  sudo systemctl --no-pager status wechat-work-proxy.service | head -8
else
  echo "[wechat-proxy] 无 systemctl，请手动: node scripts/wechat-work-proxy-server.mjs"
fi

echo "[wechat-proxy] 3/5 安装 Nginx 片段"
if [[ -d "$BT_EXT" ]]; then
  sudo cp "$NGINX_SNIPPET" "$BT_EXT/wechat-work-proxy.conf"
  echo "[wechat-proxy] 已复制到 $BT_EXT/wechat-work-proxy.conf"
else
  echo "[wechat-proxy] 未找到宝塔 extension 目录，请手动 include: $NGINX_SNIPPET"
fi
if command -v nginx >/dev/null 2>&1; then
  sudo nginx -t && sudo nginx -s reload
fi

echo "[wechat-proxy] 4/5 本机健康检查"
sleep 1
CODE="$(curl -sS -o /tmp/wechat-proxy-health.json -w '%{http_code}' \
  -H "X-Wechat-Proxy-Secret: ${WECHAT_WORK_PROXY_SECRET}" \
  "http://127.0.0.1:${WECHAT_WORK_PROXY_PORT:-8790}/cgi-bin/gettoken?corpid=test&corpsecret=test" || echo 000)"
echo "[wechat-proxy] 本地代理 HTTP $CODE（403/400 正常，502 表示上游或进程异常）"

echo "[wechat-proxy] 5/5 请在企微后台「企业可信 IP」添加本站公网 IP："
PUB_IP="$(curl -sS --max-time 5 https://ifconfig.me 2>/dev/null || curl -sS --max-time 5 https://api.ipify.org 2>/dev/null || echo '（请手动查询服务器公网 IP）')"
echo "  $PUB_IP"
echo ""
echo "请在 Supabase Edge Secrets 与密钥中心 wechat_work JSON 增加："
echo "  WECHAT_WORK_PROXY_URL=https://www.ciond.com/api/wechat-work-proxy"
echo "  WECHAT_WORK_PROXY_SECRET=${WECHAT_WORK_PROXY_SECRET}"
echo ""
echo "wechat_work secret_key JSON 示例字段："
echo '  "proxy_url": "https://www.ciond.com/api/wechat-work-proxy",'
echo "  \"proxy_secret\": \"${WECHAT_WORK_PROXY_SECRET}\""
