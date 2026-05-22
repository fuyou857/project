/** 合同子业务页：必填项未填时弹窗（返回 true 表示已拦截提交） */
export function alertMissingRequiredFields(missing: string[]): boolean {
  if (missing.length === 0) return false;
  alert(`请填写完整信息，以下必填项未填写：\n${missing.map((f) => `• ${f}`).join('\n')}`);
  return true;
}

/** 列表关键字筛选：在指定字段上匹配（忽略大小写） */
export function filterRowsBySearch<T extends Record<string, unknown>>(
  rows: T[],
  search: string,
  fields: (keyof T)[],
): T[] {
  const q = search.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((item) =>
    fields.some((field) => {
      const v = item[field];
      return typeof v === 'string' && v.toLowerCase().includes(q);
    }),
  );
}

type ContractRow = { id: string; contract_name?: string | null; contract_amount?: number | null };

/** 合同列表 → 合同名称（子业务页表格展示） */
export function contractNameById(contracts: ContractRow[], id: string): string {
  return contracts.find((c) => c.id === id)?.contract_name || '-';
}

/** 合同列表 → 合同金额 */
export function contractAmountById(contracts: ContractRow[], id: string): number {
  return contracts.find((c) => c.id === id)?.contract_amount || 0;
}

/** 支出合同金额（库字段 contract_amount；兼容历史误写的 amount） */
export function expenseContractAmountValue(
  row: { contract_amount?: number | null; amount?: number | null } | null | undefined,
): number {
  if (!row) return 0;
  const v = row.contract_amount ?? row.amount;
  return v != null && !Number.isNaN(Number(v)) ? Number(v) : 0;
}

/** 日期 + 序号后缀编号（如 EX-STL-20260517-0001） */
export function generateDatedSequentialCode(prefix: string, sequence: number): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}${date}-${String(sequence).padStart(4, '0')}`;
}

/** 日期 + 随机四位后缀编号（如 VAR-20260517-1234） */
export function generateDatedRandomCode(prefix: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}${date}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
}
