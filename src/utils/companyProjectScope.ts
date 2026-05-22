import { supabase } from '../supabase/client';

const PROJECT_ID_PAGE_SIZE = 10_000;

/** 指定公司范围内的项目 id（子表禁止直接 .in('company_id') 时用） */
export async function projectIdsForCompanies(companyIds: string[]): Promise<string[]> {
  if (companyIds.length === 0) return [];
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('id')
      .in('company_id', companyIds)
      .order('id', { ascending: false })
      .limit(PROJECT_ID_PAGE_SIZE);
    if (error) {
      console.error('[companyProjectScope] projectIdsForCompanies', error);
      return [];
    }
    return (data ?? []).map((r: { id: string }) => r.id);
  } catch (e) {
    console.error('[companyProjectScope] projectIdsForCompanies', e);
    return [];
  }
}

/**
 * 收入发票列表：在 scopeCompanyIds 范围内解析 project_id 列表。
 * - 无范围且无 companyFilter：返回 null（不过滤 project）
 * - 有 companyFilter：仅该公司下项目（且在 scope 内，若 scope 非空）
 */
export async function projectIdsForInvoiceScope(
  scopeCompanyIds: string[],
  companyFilter: string,
): Promise<string[] | null> {
  try {
    if (scopeCompanyIds.length === 0 && !companyFilter) {
      return null;
    }
    if (companyFilter) {
      if (scopeCompanyIds.length > 0 && !scopeCompanyIds.includes(companyFilter)) {
        return [];
      }
      return await projectIdsForCompanies([companyFilter]);
    }
    return await projectIdsForCompanies(scopeCompanyIds);
  } catch (e) {
    console.error('[companyProjectScope] projectIdsForInvoiceScope', e);
    return [];
  }
}
