#!/bin/bash
#
# API 错误监控与告警脚本
# 文件名：api-error-monitor.sh
# 用途：监控 Nginx 错误日志中的 API 错误，发送告警通知
#

set -euo pipefail

# ==================== 配置区域 ====================

# 日志文件路径
ERROR_LOG="/www/wwwlogs/www.ciond.com.error.log"
ACCESS_LOG="/www/wwwlogs/www.ciond.com.log"
MONITOR_LOG="/www/wwwroot/ciond/logs/api-monitor.log"

# 告警阈值
IMMEDIATE_ALERT_THRESHOLD=5      # 每分钟超过此数量立即告警
WARNING_ALERT_THRESHOLD=20        # 每小时超过此数量警告

# 告警配置
ENABLE_EMAIL_ALERT=true
ENABLE_SLACK_ALERT=true
ENABLE_PAGERDUTY_ALERT=false

# 邮件配置
EMAIL_TO="dev-team@ciond.com"
EMAIL_FROM="monitoring@ciond.com"

# Slack 配置
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"

# PagerDuty 配置
PAGERDUTY_ROUTING_KEY="${PAGERDUTY_ROUTING_KEY:-}"
PAGERDUTY_API_KEY="${PAGERDUTY_API_KEY:-}"

# 数据保留天数
LOG_RETENTION_DAYS=30

# ==================== 辅助函数 ====================

log_message() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$MONITOR_LOG"
}

send_email() {
    local subject="$1"
    local body="$2"
    
    if [ "$ENABLE_EMAIL_ALERT" = true ]; then
        echo "$body" | mail -s "$subject" -r "$EMAIL_FROM" "$EMAIL_TO" 2>/dev/null || {
            log_message "WARN" "邮件发送失败"
        }
    fi
}

send_slack() {
    local message="$1"
    local color="${2:-warning}"
    
    if [ "$ENABLE_SLACK_ALERT" = true ] && [ -n "$SLACK_WEBHOOK_URL" ]; then
        local payload=$(cat <<EOF
{
    "attachments": [
        {
            "color": "$color",
            "title": "API 错误告警",
            "text": "$message",
            "footer": "API Monitor",
            "ts": $(date +%s)
        }
    ]
}
EOF
)
        curl -s -X POST \
            -H 'Content-type: application/json' \
            --data "$payload" \
            "$SLACK_WEBHOOK_URL" > /dev/null 2>&1 || {
            log_message "WARN" "Slack 通知发送失败"
        }
    fi
}

send_pagerduty() {
    local event_type="$1"
    local message="$2"
    local severity="${3:-warning}"
    
    if [ "$ENABLE_PAGERDUTY_ALERT" = true ] && [ -n "$PAGERDUTY_ROUTING_KEY" ]; then
        local payload=$(cat <<EOF
{
    "routing_key": "$PAGERDUTY_ROUTING_KEY",
    "event_action": "$event_type",
    "payload": {
        "summary": "$message",
        "severity": "$severity",
        "source": "nginx-api-monitor",
        "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    }
}
EOF
)
        curl -s -X POST \
            -H 'Content-type: application/json' \
            -d "$payload" \
            'https://events.pagerduty.com/v2/enqueue' > /dev/null 2>&1 || {
            log_message "WARN" "PagerDuty 告警发送失败"
        }
    fi
}

# ==================== 监控函数 ====================

get_error_count_per_minute() {
    local since="${1:-1}"
    local count=$(grep -c "$(date -d "$since minutes ago" '+%Y/%m/%d %H:%M')" "$ERROR_LOG" 2>/dev/null || echo 0)
    echo $count
}

get_error_count_per_hour() {
    local since="${1:-1}"
    local count=$(grep -c "$(date -d "$since hours ago" '+%Y/%m/%d %H:')" "$ERROR_LOG" 2>/dev/null || echo 0)
    echo $count
}

analyze_405_errors() {
    log_message "INFO" "开始分析 405 错误..."
    
    # 检查日志文件是否存在
    if [ ! -f "$ERROR_LOG" ]; then
        log_message "ERROR" "错误日志文件不存在: $ERROR_LOG"
        return 1
    fi
    
    # 统计 405 错误
    local total_405=$(grep -c '"status": 405' "$ERROR_LOG" 2>/dev/null || echo 0)
    local recent_405=$(grep -c "$(date '+%Y/%m/%d %H:%M')" "$ERROR_LOG" 2>/dev/null | grep 405 | wc -l || echo 0)
    
    log_message "INFO" "405 错误总数: $total_405"
    log_message "INFO" "最近 1 分钟 405 错误: $recent_405"
    
    # 获取 Top 5 受影响的端点
    log_message "INFO" "Top 5 受影响的端点:"
    grep '"status": 405' "$ERROR_LOG" 2>/dev/null | \
        awk -F'"url": "' '{print $2}' | \
        awk -F'"' '{print $1}' | \
        sort | uniq -c | sort -rn | head -5 | \
        while read count endpoint; do
            log_message "INFO" "  - $endpoint: $count 次"
        done
    
    # 返回错误数量
    echo $total_405
}

analyze_api_errors() {
    log_message "INFO" "开始分析 API 错误..."
    
    # 按 HTTP 方法分组统计
    log_message "INFO" "按 HTTP 方法分组统计:"
    grep -oP '"method": "\K[A-Z]+' "$ERROR_LOG" 2>/dev/null | \
        sort | uniq -c | sort -rn | \
        while read count method; do
            log_message "INFO" "  - $method: $count 次"
        done
    
    # 按状态码分组统计
    log_message "INFO" "按状态码分组统计:"
    grep -oP '"status": \K[0-9]+' "$ERROR_LOG" 2>/dev/null | \
        sort | uniq -c | sort -rn | \
        while read count status; do
            log_message "INFO" "  - $status: $count 次"
        done
}

generate_daily_report() {
    local report_file="/www/wwwroot/ciond/logs/api-daily-report-$(date '+%Y%m%d').json"
    
    log_message "INFO" "生成每日报告: $report_file"
    
    # 生成 JSON 格式报告
    cat > "$report_file" <<EOF
{
    "report_date": "$(date '+%Y-%m-%d')",
    "generated_at": "$(date '+%Y-%m-%dT%H:%M:%SZ')",
    "total_errors": $(grep -c "" "$ERROR_LOG" 2>/dev/null || echo 0),
    "405_errors": $(grep -c '"status": 405' "$ERROR_LOG" 2>/dev/null || echo 0),
    "top_endpoints": [],
    "error_distribution_by_method": {},
    "comparison_with_last_7_days": {
        "trend": "stable",
        "change_percentage": 0
    },
    "recommendations": []
}
EOF
    
    log_message "INFO" "每日报告已生成: $report_file"
}

check_and_alert() {
    local current_minute=$(date '+%Y/%m/%d %H:%M')
    local error_count=$(grep -c "$current_minute" "$ERROR_LOG" 2>/dev/null || echo 0)
    
    log_message "INFO" "当前分钟错误数: $error_count"
    
    # 立即告警：每分钟超过阈值
    if [ "$error_count" -ge "$IMMEDIATE_ALERT_THRESHOLD" ]; then
        log_message "CRITICAL" "检测到大量 API 错误！当前数量: $error_count"
        
        send_slack "🚨 严重告警：检测到 $error_count 个 API 错误（超过阈值 $IMMEDIATE_ALERT_THRESHOLD）" "danger"
        send_pagerduty "trigger" "API 错误超过阈值：$error_count 次/分钟" "critical"
        send_email "🚨 [严重] API 错误告警" "检测到 $error_count 个 API 错误，请立即检查系统状态。"
    fi
    
    # 警告告警：每小时超过阈值
    local error_per_hour=$(grep -c "$(date '+%Y/%m/%d %H:')" "$ERROR_LOG" 2>/dev/null || echo 0)
    if [ "$error_per_hour" -ge "$WARNING_ALERT_THRESHOLD" ]; then
        log_message "WARN" "检测到 API 错误趋势上升，当前小时: $error_per_hour"
        
        send_slack "⚠️ 警告：每小时 API 错误数量达到 $error_per_hour（阈值: $WARNING_ALERT_THRESHOLD）" "warning"
    fi
}

cleanup_old_logs() {
    log_message "INFO" "清理过期的监控日志..."
    
    # 保留最近 N 天的日志
    find /www/wwwroot/ciond/logs -name "api-*.log" -mtime +$LOG_RETENTION_DAYS -delete 2>/dev/null
    find /www/wwwroot/ciond/logs -name "api-daily-report-*.json" -mtime +$LOG_RETENTION_DAYS -delete 2>/dev/null
    
    log_message "INFO" "日志清理完成"
}

# ==================== 主逻辑 ====================

main() {
    local command="${1:-monitor}"
    
    log_message "INFO" "==================== API 错误监控启动 ===================="
    log_message "INFO" "命令: $command"
    
    # 创建日志目录
    mkdir -p "$(dirname "$MONITOR_LOG")"
    mkdir -p /www/wwwroot/ciond/logs
    
    case "$command" in
        monitor)
            log_message "INFO" "开始监控模式..."
            analyze_405_errors
            analyze_api_errors
            check_and_alert
            ;;
        hourly)
            log_message "INFO" "执行每小时检查..."
            analyze_405_errors
            analyze_api_errors
            check_and_alert
            ;;
        daily)
            log_message "INFO" "执行每日报告..."
            generate_daily_report
            analyze_405_errors
            analyze_api_errors
            cleanup_old_logs
            ;;
        analyze)
            log_message "INFO" "执行详细分析..."
            analyze_405_errors
            analyze_api_errors
            ;;
        *)
            echo "用法: $0 {monitor|hourly|daily|analyze}"
            echo ""
            echo "  monitor  - 执行一次监控检查并告警（默认）"
            echo "  hourly   - 执行每小时检查"
            echo "  daily    - 生成每日报告"
            echo "  analyze  - 执行详细分析（不告警）"
            exit 1
            ;;
    esac
    
    log_message "INFO" "==================== API 错误监控完成 ===================="
}

# 运行主函数
main "$@"
