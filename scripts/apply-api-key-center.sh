#!/usr/bin/env bash
# API 密钥中心：迁移 + 部署 Edge + 构建前端
# 用法（项目根）：
#   export SUPABASE_ACCESS_TOKEN='sbp_…'   # 部署 Edge 必需
#   export DATABASE_URL='postgresql://…'  # 执行 SQL 必需（Dashboard → Database → Connection string）
#   bash scripts/apply-api-key-center.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[1/4] 数据库迁移…"
if [[ -n "${DATABASE_URL:-}" || -n "${SUPABASE_DB_URL:-}" ]]; then
  if ! node -e "require('pg')" 2>/dev/null; then
    npm install pg --no-save
  fi
  node scripts/apply-system-api-keys-migration.mjs
else
  echo "  跳过：未设置 DATABASE_URL。请在 Supabase SQL Editor 粘贴执行："
  echo "  migrations/20260516120000_system_api_keys.sql"
fi

echo "[2/4] 部署 Edge Function api-key-ops…"
if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  bash scripts/deploy-edge-functions.sh api-key-ops
else
  echo "  跳过：未设置 SUPABASE_ACCESS_TOKEN。请执行："
  echo "  export SUPABASE_ACCESS_TOKEN='sbp_…' && bash scripts/deploy-edge-functions.sh api-key-ops"
fi

echo "[3/4] 构建前端…"
npm run build

echo "[4/4] 部署后请在 Supabase → Edge Functions → Secrets 设置："
echo "  SYSTEM_API_KEY_ENCRYPTION_SECRET=<至少32位随机字符串>"
echo ""
echo "完成。超管登录后打开：系统管理 → 高级运维配置 → API 密钥中心 → 从系统同步"
