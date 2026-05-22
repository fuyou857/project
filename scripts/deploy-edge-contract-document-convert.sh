#!/usr/bin/env bash
# 将 Edge Function contract-document-convert 部署到 supabase/config.toml 中的 project。
# 详见 scripts/deploy-edge-functions.sh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec bash "$SCRIPT_DIR/deploy-edge-functions.sh" contract-document-convert
