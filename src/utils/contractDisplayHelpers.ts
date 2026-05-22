/** 合同审批状态展示文案（收入合同列表） */
export function contractApprovalStatusLabel(status: string): string {
  if (status === 'draft') return '草稿';
  if (status === 'approved') return '已审批';
  if (status === 'rejected') return '已驳回';
  return '已完成';
}

/** 合同审批状态展示文案（支出合同列表，末态为「已执行」） */
export function expenseContractApprovalStatusLabel(status: string): string {
  if (status === 'draft') return '草稿';
  if (status === 'approved') return '已审批';
  if (status === 'rejected') return '已驳回';
  return '已执行';
}

/** 合同审批状态 Badge 样式类 */
export function contractApprovalStatusClass(status: string): string {
  if (status === 'draft') return 'bg-yellow-500/20 text-yellow-400';
  if (status === 'approved') return 'bg-blue-500/20 text-blue-400';
  if (status === 'rejected') return 'bg-red-500/20 text-red-400';
  return 'bg-green-500/20 text-green-400';
}

/** 收入合同导出 Excel 状态列 */
export function incomeContractExportStatusLabel(status: string): string {
  if (status === 'draft') return '草稿';
  if (status === 'signed') return '已签订';
  return '已完成';
}

/** 支出合同导出 Excel 状态列 */
export function expenseContractExportStatusLabel(status: string): string {
  if (status === 'draft') return '草稿';
  if (status === 'signed') return '已签订';
  return '已执行';
}

/** 合同提醒类型 Badge 样式类 */
export function contractReminderTypeClass(reminderType: string): string {
  if (reminderType === 'contract_expiry') return 'bg-yellow-500/20 text-yellow-600';
  if (reminderType === 'payment_due') return 'bg-blue-500/20 text-blue-600';
  return 'bg-green-500/20 text-green-600';
}

/** 合同提醒类型文案 */
export function contractReminderTypeLabel(reminderType: string): string {
  if (reminderType === 'contract_expiry') return '合同到期';
  if (reminderType === 'payment_due') return '付款提醒';
  return '里程碑';
}

/** 合同提醒处理状态 Badge 样式类 */
export function contractReminderStatusClass(status: string): string {
  if (status === 'pending') return 'bg-red-500/20 text-red-600';
  if (status === 'processed') return 'bg-yellow-500/20 text-yellow-600';
  return 'bg-green-500/20 text-green-600';
}

/** 合同提醒处理状态文案 */
export function contractReminderStatusLabel(status: string): string {
  if (status === 'pending') return '未处理';
  if (status === 'processed') return '处理中';
  return '已处理';
}
