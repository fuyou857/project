#!/usr/bin/env bash
# 在服务器项目根执行：生产构建并写入 dist/（Webpack 唯一输出目录）。
#
# 默认行为（与历史脚本一致）：构建后将 dist 内 index.html / *.js / *.css 等复制到项目根，
# 便于宝塔 Nginx root = …/ciond 时根目录 index 与 chunk 哈希一致。
#
# 若已将网站根目录指向 …/ciond/dist，可只保留 dist、不再向根目录复制：
#   CIOND_DEPLOY_DIST_ONLY=1 bash scripts/deploy-site.sh
#
# 每次部署后会运行 prune，删除根目录上与当前 dist 不一致的旧 main.*.js / vendors.*.js 等副本。
#
# ── 宝塔「计划任务」示例（Shell 脚本，周期自定）────────────────────────────
#   cd /www/wwwroot/ciond && /usr/bin/npm run deploy:site >> /www/wwwroot/ciond/logs/deploy-site.log 2>&1
# 首次请 mkdir -p /www/wwwroot/ciond/logs ，并在面板里选「root」或具备该目录写权限的用户。
#
# ── OOM 自动回退 ───────────────────────────────────────────────────────────
# 若 `npm run build` 以退出码 137 结束（多为 Linux OOM Killer / 内存不足），自动执行
#   scripts/build-low-mem.sh
# 再进入后续同步；其它失败码直接退出，不静默吞掉编译错误。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=3072}"

echo "[deploy-site] 构建中… ($ROOT)"
set +e
npm run build
build_ec=$?
set -e
if [[ "$build_ec" -ne 0 ]]; then
  if [[ "$build_ec" -eq 137 ]]; then
    echo "[deploy-site] 构建退出码 137（多为 OOM），回退到 scripts/build-low-mem.sh …"
    bash "$ROOT/scripts/build-low-mem.sh"
  else
    echo "[deploy-site] 构建失败，退出码: $build_ec" >&2
    exit "$build_ec"
  fi
fi

echo "[deploy-site] 构建完成，静态文件已在: $ROOT/dist"

if [[ "${CIOND_DEPLOY_DIST_ONLY:-}" == "1" ]]; then
  echo "[deploy-site] CIOND_DEPLOY_DIST_ONLY=1：不镜像到项目根（请确认 Nginx root 为: $ROOT/dist）"
else
  echo "[deploy-site] 同步 dist → 项目根（*.js / *.css / index.html 等）"
  (
    cd "$ROOT/dist"
    shopt -s nullglob
    for f in index.html manifest.json sw.js *.js *.css; do
      if [[ -f "$f" ]]; then
        /bin/cp -f "$f" "$ROOT/"
      fi
    done
  )
  echo "[deploy-site] 已复制 dist 内入口与 chunk 至: $ROOT"
fi

node "$ROOT/scripts/prune-stale-root-bundles.mjs"

if command -v nginx >/dev/null 2>&1; then
  if nginx -t 2>/dev/null; then
    nginx -s reload && echo "[deploy-site] 已 nginx -s reload" || echo "[deploy-site] nginx reload 跳过（无权限可手动重载）"
  fi
fi
