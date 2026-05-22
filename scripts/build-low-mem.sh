#!/usr/bin/env bash
# 低配 VPS（约 8GB 内存）生产构建：跳过 gzip/brotli 二次压缩，降低 OOM(137) 概率。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[build-low-mem] 结束本项目中残留的 webpack 进程（若有）…"
pgrep -af "$ROOT/node_modules/.bin/webpack" 2>/dev/null | grep -v build-low-mem | awk '{print $1}' | xargs -r kill 2>/dev/null || true
sleep 1

echo "[build-low-mem] 释放页缓存（可选）…"
sync
echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true

free -h || true

export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
export CIOND_LOW_MEM_BUILD=1

echo "[build-low-mem] NODE_OPTIONS=$NODE_OPTIONS CIOND_LOW_MEM_BUILD=1"
node scripts/assert-prod-auth.mjs
npx webpack --mode production --progress

echo "[build-low-mem] 完成，输出目录: $ROOT/dist"
