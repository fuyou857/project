import { supabase } from '../supabase/client';
import { CONTRACT_FILES_STORAGE_BUCKET, signedUrlForContractStoragePath } from '../utils/contractDocxStorageFetch';

/** 生成的合同列表行（包含关联数据） */
export type GeneratedContractListRow = {
  id: string;
  contract_no: string;
  template_id: string;
  template_file_version_id: string;
  project_id: string | null;
  party_a_id: string | null;
  party_b_id: string | null;
  payment_method_text: string | null;
  variables_values: Record<string, string>;
  merged_pdf_storage_path: string | null;
  generated_docx_storage_path: string | null;
  rich_text_draft: string | null;
  status: string;
  approval_id: string | null;
  seal_annotation: string | null;
  sealed_pdf_storage_path: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  delete_reason?: string | null;
  contract_templates?: { id: string; title: string } | null;
  projects?: { id: string; name: string } | null;
  party_a?: { id: string; name?: string | null } | null;
  party_b?: { id: string; unit_name?: string | null; name?: string | null } | null;
};

/** 个人合同列表查询参数 */
export type UserContractListParams = {
  search?: string;
  status?: string;
  sortField?: 'contract_no' | 'created_at' | 'updated_at' | 'status';
  sortAsc?: boolean;
  page?: number;
  pageSize?: number;
  includeDeleted?: boolean;
};

/** 与 migrations/20260425_070555 等一致：party_b 列为 unit_name，勿选不存在的 name 以免整条 embed 失败 */
const LIST_GENERATED_WITH_RELATIONS =
  '*, contract_templates(id, title), projects(id, name), party_a(id, name), party_b(id, unit_name)';

/** 重试更新生成的合同 */
async function updateGeneratedContractWithRetry(
  id: string,
  patch: Record<string, unknown>,
  userId: string | null,
): Promise<void> {
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      const updateData = { ...patch, updated_by: userId, updated_at: new Date().toISOString() };
      const { error } = await supabase.from('generated_contracts').update(updateData).eq('id', id);
      if (error) throw error;
      return;
    } catch (error) {
      retryCount++;
      if (retryCount === maxRetries) {
        throw error;
      }
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, 500 * retryCount));
    }
  }
}

/** 获取用户的合同列表 */
export async function getUserContractList(
  userId: string,
  params: UserContractListParams
): Promise<{ rows: GeneratedContractListRow[]; total: number }> {
  const page = Math.max(0, params.page || 0);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 10));
  const offset = page * pageSize;
  const term = params.search?.trim() || '';
  
  let query = supabase
    .from('generated_contracts')
    .select(LIST_GENERATED_WITH_RELATIONS, { count: 'exact' })
    .eq('created_by', userId);
  
  // 处理删除状态
  if (params.includeDeleted) {
    query = query.not('deleted_at', 'is', null);
  } else {
    query = query.is('deleted_at', null);
  }
  
  // 处理状态过滤
  if (params.status) {
    query = query.eq('status', params.status);
  }
  
  // 处理搜索
  if (term) {
    const safe = term.replace(/,/g, ' ').replace(/\//g, '\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
    query = query.or(`contract_no.ilike.%${safe}%,contract_templates.title.ilike.%${safe}%`);
  }
  
  // 处理排序
  const sortField = params.sortField || 'created_at';
  const sortAsc = params.sortAsc ?? false;
  query = query.order(sortField, { ascending: sortAsc });
  
  // 分页
  query = query.range(offset, offset + pageSize - 1);
  
  const { data, error, count } = await query;
  if (error) throw error;
  
  return { 
    rows: (data ?? []) as GeneratedContractListRow[], 
    total: count ?? 0 
  };
}

/** 获取用户的合同详情 */
export async function getUserContractDetail(
  userId: string,
  contractId: string
): Promise<GeneratedContractListRow | null> {
  const { data, error } = await supabase
    .from('generated_contracts')
    .select(LIST_GENERATED_WITH_RELATIONS)
    .eq('id', contractId)
    .eq('created_by', userId)
    .maybeSingle();
  
  if (error) throw error;
  if (!data) return null;
  
  return data as GeneratedContractListRow;
}

/** 软删除用户的合同（移入回收站） */
export async function softDeleteUserContract(
  userId: string,
  contractId: string,
  reason?: string
): Promise<void> {
  const { error } = await supabase
    .from('generated_contracts')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: userId,
      delete_reason: reason || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contractId)
    .eq('created_by', userId)
    .is('deleted_at', null);
  
  if (error) throw error;
}

/** 从回收站恢复用户的合同 */
export async function restoreUserContractFromTrash(
  userId: string,
  contractId: string
): Promise<void> {
  const { error } = await supabase
    .from('generated_contracts')
    .update({
      deleted_at: null,
      deleted_by: null,
      delete_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contractId)
    .eq('created_by', userId);
  
  if (error) throw error;
}

/** 永久删除用户的合同 */
export async function permanentlyDeleteUserContract(
  userId: string,
  contractId: string
): Promise<void> {
  // 先获取合同信息，用于后续删除存储文件
  const { data: contract, error: cErr } = await supabase
    .from('generated_contracts')
    .select('merged_pdf_storage_path, generated_docx_storage_path, sealed_pdf_storage_path')
    .eq('id', contractId)
    .eq('created_by', userId)
    .single();
  
  if (cErr) throw cErr;
  if (!contract) throw new Error('合同不存在');
  
  // 删除关联的存储文件
  const storagePaths = [
    contract.merged_pdf_storage_path,
    contract.generated_docx_storage_path,
    contract.sealed_pdf_storage_path
  ].filter((path): path is string => path !== null && path !== undefined);
  
  for (const path of storagePaths) {
    await supabase.storage.from(CONTRACT_FILES_STORAGE_BUCKET).remove([path]);
  }
  
  // 删除合同修订版
  await supabase
    .from('generated_contract_revisions')
    .delete()
    .eq('generated_id', contractId);
  
  // 删除合同本身
  const { error } = await supabase
    .from('generated_contracts')
    .delete()
    .eq('id', contractId)
    .eq('created_by', userId);
  
  if (error) throw error;
}

/** 更新用户合同的状态 */
export async function updateUserContractStatus(
  userId: string,
  contractId: string,
  status: string
): Promise<void> {
  await updateGeneratedContractWithRetry(
    contractId,
    { status },
    userId
  );
}

/** 获取用户合同的文件 URL */
export async function getUserContractFileUrls(
  userId: string,
  contractId: string
): Promise<{ 
  docxUrl?: string;
  pdfUrl?: string;
  sealedPdfUrl?: string;
}> {
  const { data: contract, error } = await supabase
    .from('generated_contracts')
    .select('generated_docx_storage_path, merged_pdf_storage_path, sealed_pdf_storage_path')
    .eq('id', contractId)
    .eq('created_by', userId)
    .single();
  
  if (error) throw error;
  if (!contract) throw new Error('合同不存在');
  
  const urls: { docxUrl?: string; pdfUrl?: string; sealedPdfUrl?: string } = {};
  
  if (contract.generated_docx_storage_path) {
    urls.docxUrl = await signedUrlForContractStoragePath(contract.generated_docx_storage_path);
  }
  
  if (contract.merged_pdf_storage_path) {
    urls.pdfUrl = await signedUrlForContractStoragePath(contract.merged_pdf_storage_path);
  }
  
  if (contract.sealed_pdf_storage_path) {
    urls.sealedPdfUrl = await signedUrlForContractStoragePath(contract.sealed_pdf_storage_path);
  }
  
  return urls;
}

/** 获取用户合同的统计信息 */
export async function getUserContractStatistics(
  userId: string
): Promise<{
  total: number;
  draft: number;
  pending: number;
  approved: number;
  rejected: number;
  archived: number;
  inTrash: number;
}> {
  // 获取总数（不包括已删除）
  const { count: totalCount, error: totalError } = await supabase
    .from('generated_contracts')
    .select('id', { count: 'exact' })
    .eq('created_by', userId)
    .is('deleted_at', null);
  
  if (totalError) throw totalError;
  
  // 获取草稿数
  const { count: draftCount, error: draftError } = await supabase
    .from('generated_contracts')
    .select('id', { count: 'exact' })
    .eq('created_by', userId)
    .eq('status', 'draft')
    .is('deleted_at', null);
  
  if (draftError) throw draftError;
  
  // 获取待审核数
  const { count: pendingCount, error: pendingError } = await supabase
    .from('generated_contracts')
    .select('id', { count: 'exact' })
    .eq('created_by', userId)
    .eq('status', 'pending')
    .is('deleted_at', null);
  
  if (pendingError) throw pendingError;
  
  // 获取已批准数
  const { count: approvedCount, error: approvedError } = await supabase
    .from('generated_contracts')
    .select('id', { count: 'exact' })
    .eq('created_by', userId)
    .eq('status', 'approved')
    .is('deleted_at', null);
  
  if (approvedError) throw approvedError;
  
  // 获取已拒绝数
  const { count: rejectedCount, error: rejectedError } = await supabase
    .from('generated_contracts')
    .select('id', { count: 'exact' })
    .eq('created_by', userId)
    .eq('status', 'rejected')
    .is('deleted_at', null);
  
  if (rejectedError) throw rejectedError;
  
  // 获取已归档数
  const { count: archivedCount, error: archivedError } = await supabase
    .from('generated_contracts')
    .select('id', { count: 'exact' })
    .eq('created_by', userId)
    .eq('status', 'archived')
    .is('deleted_at', null);
  
  if (archivedError) throw archivedError;
  
  // 获取回收站数量
  const { count: trashCount, error: trashError } = await supabase
    .from('generated_contracts')
    .select('id', { count: 'exact' })
    .eq('created_by', userId)
    .not('deleted_at', 'is', null);
  
  if (trashError) throw trashError;
  
  return {
    total: totalCount || 0,
    draft: draftCount || 0,
    pending: pendingCount || 0,
    approved: approvedCount || 0,
    rejected: rejectedCount || 0,
    archived: archivedCount || 0,
    inTrash: trashCount || 0,
  };
}
