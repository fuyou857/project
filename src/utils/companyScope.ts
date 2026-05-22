/** 公司树节点（与 Layout useCompany 中 companies 项结构兼容） */
export interface CompanyScopeNode {
  id: string;
  parent_id?: string | null;
}

/**
 * 当前公司及直接子公司的 id 列表（与合同列表等页原 getCompanyIds 逻辑一致）
 */
export function collectCompanyIds(
  currentCompany: CompanyScopeNode | null | undefined,
  companies: CompanyScopeNode[],
): string[] {
  if (!currentCompany) return [];
  const ids = [currentCompany.id];
  const children = companies.filter(
    (c) => c.parent_id === currentCompany.id || c.parent_id === '0',
  );
  children.forEach((c) => ids.push(c.id));
  return ids;
}
