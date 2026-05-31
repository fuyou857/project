#!/bin/bash
# 简单的部署脚本，跳过 typecheck
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# 颜色和日志
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[deploy]${NC} $*"; }
ok()    { echo -e "${GREEN}[deploy]${NC} $*"; }
warn()  { echo -e "${YELLOW}[deploy]${NC} $*"; }
err()   { echo -e "${RED}[deploy]${NC} $*"; }

mkdir -p logs releases

# 获取下一个版本号
if [[ -f releases/.current-version ]]; then
  VER=$(cat releases/.current-version)
  VER=$((VER + 1))
else
  VER=1
fi

info "开始部署 v${VER} …"

# 2. 构建（假设已经构建好了）
export NODE_OPTIONS="--max-old-space-size=3072"

if [[ ! -d dist ]] || [[ ! -f dist/index.html ]]; then
  err "构建产物不存在，正在重新构建..."
  npm run build
fi

if [[ ! -d dist ]] || [[ ! -f dist/index.html ]]; then
  err "构建产物不完整（缺少 dist/index.html）"
  exit 1
fi
ok "构建完成"

# 3. 创建版本化快照
SNAPSHOT_DIR="releases/v-${VER}"
rm -rf "$SNAPSHOT_DIR"
cp -a dist "$SNAPSHOT_DIR"
echo "$(date '+%Y-%m-%d %H:%M:%S')" > "$SNAPSHOT_DIR/.timestamp"
echo "$VER" > releases/.current-version
ok "已创建快照: v${VER}"

# 4. 清理旧快照（保留最近 10 个）
KEEP=10
total=$(ls -1 releases/v-* 2>/dev/null | wc -l)
if [[ "$total" -gt "$KEEP" ]]; then
  for old in $(ls -1 releases/v-* 2>/dev/null | sort -t- -k2 -n | head -n $((total - KEEP))); do
    rm -rf "$old"
    warn "清理旧快照: ${old##*/}"
  done
fi

# 5. 同步到项目根目录
info "同步 dist → 项目根 …"
(
  cd dist
  shopt -s nullglob
  for f in index.html manifest.json sw.js *.js *.css; do
    if [[ -f "$f" ]]; then
      cp -f "$f" ../
    fi
  done
)
node scripts/prune-stale-root-bundles.mjs
ok "已同步至项目根"

ok "部署完成: v${VER}"
echo "-------------------------"
echo "Version: v${VER}"
echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo "Dist: $(pwd)/dist"
echo "Snapshot: $(pwd)/releases/v-${VER}"
