/** 人民币金额展示（与多数页面内联 formatMoney 逻辑一致，便于单测与逐步收敛引用） */
export function formatMoneyCny(amount: number | null | undefined): string {
  return `¥${(Number(amount) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
}

/** ISO / 数据库时间字符串 → 中文本地化日期时间 */
export function formatDateTimeZh(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
