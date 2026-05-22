#!/usr/bin/env bash
# 极低内存构建脚本
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[build-minimal] 释放页缓存..."
sync
# 注意：在某些沙盒中可能无法执行 drop_caches，这里忽略错误
echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true

export NODE_OPTIONS="--max-old-space-size=1536"
export CIOND_LOW_MEM_BUILD=1

echo "[build-minimal] NODE_OPTIONS=$NODE_OPTIONS"
node scripts/assert-prod-auth.mjs
# 不带 --progress，减少输出
npx webpack --mode production

echo "[build-minimal] 完成"
