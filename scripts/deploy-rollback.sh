#!/usr/bin/env bash
# deploy-rollback.sh — 快速回滚到上一个稳定版本
#
# 用法:
#   bash scripts/deploy-rollback.sh            # 回滚到上一个版本
#   bash scripts/deploy-rollback.sh 3          # 回滚到指定版本号
#   bash scripts/deploy-rollback.sh --list     # 列出所有版本
#
# 等效于: bash scripts/deploy-site.sh --rollback [version]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

case "${1:-}" in
  --list|-l)
    exec bash "$ROOT/scripts/deploy-site.sh" --list
    ;;
  --help|-h)
    echo "用法: bash scripts/deploy-rollback.sh [version]"
    echo "  (无参数)  回滚到上一个版本"
    echo "  version   回滚到指定版本号"
    echo "  --list    列出所有版本"
    exit 0
    ;;
  *)
    exec bash "$ROOT/scripts/deploy-site.sh" --rollback "${1:-}"
    ;;
esac