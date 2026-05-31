#!/usr/bin/env bash
# deploy-site.sh — 生产构建与部署脚本（支持版本化快照与回滚）
#
# 用法:
#   bash scripts/deploy-site.sh                    # 构建并部署最新版本
#   bash scripts/deploy-site.sh --rollback         # 回滚到上一个版本
#   bash scripts/deploy-site.sh --rollback 2       # 回滚到指定版本号
#   bash scripts/deploy-site.sh --list             # 列出所有版本快照
#   bash scripts/deploy-site.sh --dry-run          # 模拟运行（不实际部署）
#   bash scripts/deploy-site.sh --dist-only        # 仅保留 dist/，不同步到项目根
#
# 环境变量:
#   CIOND_DEPLOY_DIST_ONLY=1  等同于 --dist-only
#   NODE_OPTIONS              构建内存上限（默认 --max-old-space-size=3072）
#
# 版本化管理:
#   每次成功构建后，dist/ 会快照到 releases/<version>/，
#   支持通过 --rollback 快速回滚到任意历史版本。
#
# ── 宝塔「计划任务」配置示例 ─────────────────────────────────────────────
#   cd /www/wwwroot/ciond && /usr/bin/npm run deploy:site \
#     >> /www/wwwroot/ciond/logs/deploy-site.log 2>&1
#   首次请 mkdir -p /www/wwwroot/ciond/logs
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ── 颜色与日志 ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[deploy]${NC} $*"; }
ok()    { echo -e "${GREEN}[deploy]${NC} $*"; }
warn()  { echo -e "${YELLOW}[deploy]${NC} $*"; }
err()   { echo -e "${RED}[deploy]${NC} $*"; }

mkdir -p "$ROOT/logs" "$ROOT/releases"

# ── 版本文件 ──────────────────────────────────────────────────────────────
VERSION_FILE="$ROOT/releases/.current-version"
next_version() {
  if [[ -f "$VERSION_FILE" ]]; then
    echo $(($(cat "$VERSION_FILE") + 1))
  else
    echo 1
  fi
}

# ── 解析参数 ──────────────────────────────────────────────────────────────
ROLLBACK=""
LIST_ONLY=false
DRY_RUN=false
DIST_ONLY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rollback)
      ROLLBACK="${2:-prev}"
      shift 2 2>/dev/null || shift
      ;;
    --list) LIST_ONLY=true; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    --dist-only) DIST_ONLY=true; shift ;;
    *) warn "未知参数: $1"; shift ;;
  esac
done

# 环境变量覆盖
if [[ "${CIOND_DEPLOY_DIST_ONLY:-}" == "1" ]]; then
  DIST_ONLY=true
fi

# ── list 模式 ─────────────────────────────────────────────────────────────
if $LIST_ONLY; then
  echo -e "${CYAN}已部署版本快照:${NC}"
  if [[ ! -d "$ROOT/releases" ]]; then
    echo "  （无）"
    exit 0
  fi
  for ver_dir in "$ROOT/releases"/v-*; do
    [[ -d "$ver_dir" ]] || continue
    ver="${ver_dir##*/v-}"
    ts_file="$ver_dir/.timestamp"
    ts="$(cat "$ts_file" 2>/dev/null || echo 'unknown')"
    current=""
    [[ -f "$VERSION_FILE" && "$(cat "$VERSION_FILE")" == "$ver" ]] && current=" ← 当前"
    echo "  v${ver}  (${ts})${current}"
  done
  exit 0
fi

# ── rollback 模式 ─────────────────────────────────────────────────────────
if [[ -n "$ROLLBACK" ]]; then
  if [[ "$ROLLBACK" == "prev" ]]; then
    # 找到小于当前版本的最大版本
    current_ver=$(cat "$VERSION_FILE" 2>/dev/null || echo "0")
    target_ver=0
    for ver_dir in "$ROOT/releases"/v-*; do
      [[ -d "$ver_dir" ]] || continue
      v="${ver_dir##*/v-}"
      if [[ "$v" -lt "$current_ver" && "$v" -gt "$target_ver" ]]; then
        target_ver="$v"
      fi
    done
    if [[ "$target_ver" == "0" ]]; then
      err "没有找到可回滚的历史版本"
      exit 1
    fi
  else
    target_ver="$ROLLBACK"
  fi

  ROLLBACK_DIR="$ROOT/releases/v-${target_ver}"
  if [[ ! -d "$ROLLBACK_DIR" ]]; then
    err "版本 v${target_ver} 不存在 (${ROLLBACK_DIR})"
    exit 1
  fi

  info "回滚到 v${target_ver} …"
  if $DRY_RUN; then
    ok "[DRY RUN] 将回滚到: ${ROLLBACK_DIR}"
    exit 0
  fi

  # 备份当前 dist
  if [[ -d "$ROOT/dist" ]]; then
    rm -rf "$ROOT/dist.bak"
    mv "$ROOT/dist" "$ROOT/dist.bak"
  fi
  cp -a "$ROLLBACK_DIR" "$ROOT/dist"
  echo "$target_ver" > "$VERSION_FILE"

  # 同步到项目根（如果需要）
  if ! $DIST_ONLY; then
    info "同步 dist → 项目根 …"
    (
      cd "$ROOT/dist"
      shopt -s nullglob
      for f in index.html manifest.json sw.js *.js *.css; do
        [[ -f "$f" ]] && /bin/cp -f "$f" "$ROOT/"
      done
    )
    node "$ROOT/scripts/prune-stale-root-bundles.mjs"
  fi

  ok "已回滚到 v${target_ver}"

  # 重载 Nginx
  if command -v nginx >/dev/null 2>&1; then
    if nginx -t 2>/dev/null; then
      nginx -s reload && ok "已 nginx -s reload" || warn "nginx reload 跳过"
    fi
  fi
  exit 0
fi

# ── 正常部署模式 ──────────────────────────────────────────────────────────
VER="$(next_version)"
info "开始部署 v${VER} …"

# 1. 预检查
info "预检查: typecheck …"
if ! npm run typecheck 2>/dev/null; then
  err "TypeScript 类型检查失败，中止部署。请先修复类型错误。"
  err "  npm run typecheck"
  exit 1
fi
ok "TypeScript 类型检查通过"

# 2. 构建
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=3072}"
info "构建中 …"

set +e
npm run build
build_ec=$?
set -e

if [[ "$build_ec" -ne 0 ]]; then
  if [[ "$build_ec" -eq 137 ]]; then
    warn "构建退出码 137（OOM），回退到 scripts/build-low-mem.sh …"
    bash "$ROOT/scripts/build-low-mem.sh"
  else
    err "构建失败，退出码: $build_ec"
    exit "$build_ec"
  fi
fi

if [[ ! -d "$ROOT/dist" ]] || [[ ! -f "$ROOT/dist/index.html" ]]; then
  err "构建产物不完整（缺少 dist/index.html）"
  exit 1
fi
ok "构建完成"

# 3. 创建版本化快照
SNAPSHOT_DIR="$ROOT/releases/v-${VER}"
rm -rf "$SNAPSHOT_DIR"
cp -a "$ROOT/dist" "$SNAPSHOT_DIR"
echo "$(date '+%Y-%m-%d %H:%M:%S')" > "$SNAPSHOT_DIR/.timestamp"
echo "$VER" > "$VERSION_FILE"
ok "已创建快照: v${VER}"

# 4. 清理旧快照（保留最近 10 个）
KEEP=10
total=$(ls -1d "$ROOT/releases"/v-* 2>/dev/null | wc -l)
if [[ "$total" -gt "$KEEP" ]]; then
  for old in $(ls -1d "$ROOT/releases"/v-* 2>/dev/null | sort -t- -k2 -n | head -n $((total - KEEP))); do
    rm -rf "$old"
    warn "清理旧快照: ${old##*/}"
  done
fi

# 5. 同步到项目根（如果需要）
if $DIST_ONLY; then
  info "dist 模式：Nginx root 应指向 ${ROOT}/dist"
else
  info "同步 dist → 项目根 …"
  (
    cd "$ROOT/dist"
    shopt -s nullglob
    for f in index.html manifest.json sw.js *.js *.css; do
      if [[ -f "$f" ]]; then
        /bin/cp -f "$f" "$ROOT/"
      fi
    done
  )
  node "$ROOT/scripts/prune-stale-root-bundles.mjs"
  ok "已同步至项目根"
fi

# 6. 重载 Nginx
if command -v nginx >/dev/null 2>&1; then
  if nginx -t 2>/dev/null; then
    nginx -s reload && ok "已 nginx -s reload" || warn "nginx reload 跳过（可手动重载）"
  fi
fi

ok "部署完成: v${VER}"
echo "----------------------------------------"
echo "  版本:       v${VER}"
echo "  时间:       $(date '+%Y-%m-%d %H:%M:%S')"
echo "  dist:       ${ROOT}/dist"
echo "  快照:       ${ROOT}/releases/v-${VER}"
echo "  回滚命令:   bash $0 --rollback"
echo "----------------------------------------"