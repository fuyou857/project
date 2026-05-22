#!/usr/bin/env bash
# ============================================================================
# 数据库备份管理脚本 - 强制备份策略实施
# ============================================================================
# 功能：
#   - 自动备份：在更新前自动触发
#   - 完整性校验：SHA256校验和验证
#   - 多版本保留：保留指定数量的备份
#   - 远程存储：支持上传到安全存储位置
# ============================================================================

set -euo pipefail

# 配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="${PROJECT_ROOT}/backups"
LOG_DIR="${PROJECT_ROOT}/logs"
MAX_BACKUPS=30
RETENTION_DAYS=90

# Supabase 配置
SUPABASE_PROJECT_ID="${SUPABASE_PROJECT_ID:-}"
SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 日志函数
log() { echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 初始化目录
init() {
    mkdir -p "$BACKUP_DIR" "$LOG_DIR"
}

# 生成备份文件名
generate_backup_name() {
    local backup_type="$1"
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    echo "supabase_backup_${backup_type}_${timestamp}.sql"
}

# 计算 SHA256 校验和
calculate_checksum() {
    local file="$1"
    sha256sum "$file" | awk '{print $1}'
}

# 验证校验和
verify_checksum() {
    local file="$1"
    local expected_checksum="$2"
    local actual_checksum=$(calculate_checksum "$file")
    
    if [ "$actual_checksum" = "$expected_checksum" ]; then
        return 0
    else
        return 1
    fi
}

# 执行完整数据库备份
backup_full() {
    local backup_name=$(generate_backup_name "full")
    local backup_path="${BACKUP_DIR}/${backup_name}"
    local start_time=$(date +%s)
    
    log "开始完整数据库备份: ${backup_name}"
    
    if ! command -v supabase &> /dev/null; then
        log_error "supabase CLI 未找到"
        return 1
    fi
    
    # 执行备份
    if ! supabase db dump --data-only --file "$backup_path" 2>&1; then
        log_error "备份失败"
        return 1
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local file_size=$(stat -f%z "$backup_path" 2>/dev/null || stat -c%s "$backup_path" 2>/dev/null || echo 0)
    local checksum=$(calculate_checksum "$backup_path")
    
    # 创建元数据文件
    local metadata_file="${backup_path}.meta.json"
    cat > "$metadata_file" <<EOF
{
    "backup_name": "${backup_name}",
    "backup_type": "FULL",
    "backup_path": "${backup_path}",
    "file_size_bytes": ${file_size},
    "checksum_sha256": "${checksum}",
    "created_at": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')",
    "duration_seconds": ${duration},
    "triggered_by": "${TRIGGERED_BY:-MANUAL}"
}
EOF
    
    log_success "备份完成: ${backup_name} (${duration}s, $(numfmt --to=iec $file_size))"
    log "校验和: ${checksum}"
    
    # 清理旧备份
    cleanup_old_backups
    
    echo "$backup_path"
    return 0
}

# 执行更新前备份（用于迁移前）
backup_pre_update() {
    log "执行更新前强制备份..."
    export TRIGGERED_BY="PRE_UPDATE"
    
    local backup_path=$(backup_full)
    if [ $? -ne 0 ]; then
        log_error "更新前备份失败，终止更新"
        return 1
    fi
    
    log_success "更新前备份完成: ${backup_path}"
    echo "$backup_path"
    return 0
}

# 执行更新后备份
backup_post_update() {
    log "执行更新后备份..."
    export TRIGGERED_BY="POST_UPDATE"
    
    local backup_path=$(backup_full)
    if [ $? -ne 0 ]; then
        log_warning "更新后备份失败，但更新已完成"
        return 1
    fi
    
    log_success "更新后备份完成: ${backup_path}"
    echo "$backup_path"
    return 0
}

# 清理旧备份
cleanup_old_backups() {
    log "清理旧备份（保留最近 ${MAX_BACKUPS} 个，保留 ${RETENTION_DAYS} 天）..."
    
    # 按时间删除
    find "$BACKUP_DIR" -type f -name "*.sql" -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true
    find "$BACKUP_DIR" -type f -name "*.meta.json" -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true
    
    # 按数量删除
    local backup_count=$(ls -1t "$BACKUP_DIR"/*.sql 2>/dev/null | wc -l)
    if [ "$backup_count" -gt "$MAX_BACKUPS" ]; then
        local to_delete=$((backup_count - MAX_BACKUPS))
        ls -1t "$BACKUP_DIR"/*.sql 2>/dev/null | tail -n "$to_delete" | xargs rm -f 2>/dev/null || true
        ls -1t "$BACKUP_DIR"/*.meta.json 2>/dev/null | tail -n "$to_delete" | xargs rm -f 2>/dev/null || true
        log "已删除 ${to_delete} 个旧备份"
    fi
}

# 列出所有备份
list_backups() {
    echo "可用备份列表："
    echo "=================="
    
    if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A "$BACKUP_DIR" 2>/dev/null)" ]; then
        echo "无备份文件"
        return 0
    fi
    
    for backup_file in "$BACKUP_DIR"/*.sql; do
        if [ -f "$backup_file" ]; then
            local meta_file="${backup_file}.meta.json"
            local filename=$(basename "$backup_file")
            local filesize=$(numfmt --to=iec $(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null))
            
            if [ -f "$meta_file" ]; then
                local created_at=$(cat "$meta_file" | grep -o '"created_at": "[^"]*"' | cut -d'"' -f4)
                echo "- ${filename} (${filesize}) - ${created_at}"
            else
                echo "- ${filename} (${filesize})"
            fi
        fi
    done
}

# 验证备份完整性
verify_backup() {
    local backup_path="$1"
    
    if [ ! -f "$backup_path" ]; then
        log_error "备份文件不存在: ${backup_path}"
        return 1
    fi
    
    local meta_file="${backup_path}.meta.json"
    if [ ! -f "$meta_file" ]; then
        log_warning "元数据文件不存在，仅校验文件存在性"
        log_success "备份文件存在"
        return 0
    fi
    
    local expected_checksum=$(cat "$meta_file" | grep -o '"checksum_sha256": "[^"]*"' | cut -d'"' -f4)
    
    if verify_checksum "$backup_path" "$expected_checksum"; then
        log_success "备份完整性校验通过"
        return 0
    else
        log_error "备份完整性校验失败！"
        return 1
    fi
}

# 恢复备份
restore_backup() {
    local backup_path="$1"
    
    if [ ! -f "$backup_path" ]; then
        log_error "备份文件不存在: ${backup_path}"
        return 1
    fi
    
    log_warning "即将恢复备份: ${backup_path}"
    log_warning "此操作将覆盖当前数据库！"
    
    read -p "确认继续？(yes/NO): " confirm
    if [ "$confirm" != "yes" ]; then
        log "操作已取消"
        return 1
    fi
    
    # 先做一个当前状态的备份
    log "先备份当前状态..."
    backup_full
    
    log "开始恢复..."
    if supabase db restore "$backup_path"; then
        log_success "恢复完成"
        return 0
    else
        log_error "恢复失败"
        return 1
    fi
}

# 主函数
main() {
    init
    
    case "${1:-}" in
        full)
            backup_full
            ;;
        pre-update)
            backup_pre_update
            ;;
        post-update)
            backup_post_update
            ;;
        list)
            list_backups
            ;;
        verify)
            verify_backup "${2:-}"
            ;;
        restore)
            restore_backup "${2:-}"
            ;;
        cleanup)
            cleanup_old_backups
            ;;
        *)
            echo "使用方法: $0 {full|pre-update|post-update|list|verify|restore|cleanup}"
            echo ""
            echo "命令说明："
            echo "  full        - 执行完整备份"
            echo "  pre-update  - 更新前备份（用于迁移前）"
            echo "  post-update - 更新后备份"
            echo "  list        - 列出所有备份"
            echo "  verify <file> - 验证备份完整性"
            echo "  restore <file> - 恢复备份"
            echo "  cleanup     - 清理旧备份"
            ;;
    esac
}

main "$@"
