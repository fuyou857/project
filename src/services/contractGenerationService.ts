import { supabase } from '../supabase/client';
import { invokeConvert } from './contractDocumentConvertService';
import type { DocxVariableToken } from '../utils/docxVariables';
import {
  CONTRACT_FILES_STORAGE_BUCKET,
  loadContractDocxBufferFromStorage,
  preferSignedStorageUrlWithHint,
  type SignedStorageUrlResult,
} from '../utils/contractDocxStorageFetch';

/** 生成的合同 */
export type GeneratedContract = {
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
  /** 非空表示在回收站（软删） */
  deleted_at?: string | null;
  deleted_by?: string | null;
  delete_reason?: string | null;
};

/** 合同生成版本 */
export type GeneratedRevision = {
  id: string;
  generated_id: string;
  revision: number;
  rich_text_html: string | null;
  merged_pdf_storage_path: string | null;
  created_by: string | null;
  created_at: string;
};

/** 填充合同模板参数 */
export type FillGeneratedContractParams = {
  generatedId: string;
  variables: Record<string, string>;
  userId: string | null;
  /** 可选：是否生成新修订版（默认 false，仅更新变量值） */
  createRevision?: boolean;
  /** 可选：修订版备注 */
  revisionNote?: string;
};

/** 生成合同回收站排序键 */
export type GeneratedTrashSortKey = 'contract_no' | 'created_at' | 'deleted_at' | 'delete_reason';

/** 获取所有生成的合同 */
export async function listGeneratedContracts(limit = 200): Promise<GeneratedContractListRow[]> {
  const { data, error } = await supabase
    .from('generated_contracts')
    .select(LIST_GENERATED_WITH_RELATIONS)
    .is('deleted_at', null)
    .limit(limit)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as GeneratedContractListRow[];
}

/** 按模板获取生成的合同 */
export async function listGeneratedContractsByTemplate(templateId: string): Promise<GeneratedContractListRow[]> {
  const { data, error } = await supabase
    .from('generated_contracts')
    .select(LIST_GENERATED_WITH_RELATIONS)
    .eq('template_id', templateId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as GeneratedContractListRow[];
}

/** 获取生成合同回收站页面 */
export async function listGeneratedContractsTrashPage(input: {
  page: number;
  pageSize: number;
  sortKey: GeneratedTrashSortKey;
  sortAsc: boolean;
  search?: string;
}): Promise<{ rows: GeneratedContractListRow[]; total: number }> {
  const { page, pageSize, sortKey, sortAsc, search } = input;
  const offset = page * pageSize;

  let query = supabase
    .from('generated_contracts')
    .select(LIST_GENERATED_WITH_RELATIONS, { count: 'exact' })
    .not('deleted_at', 'is', null);

  // 搜索功能
  if (search?.trim()) {
    const safe = search.trim().replace(/,/g, ' ').replace(/\//g, '\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
    query = query.or(`contract_no.ilike.%${safe}%,contract_templates.title.ilike.%${safe}%`);
  }

  // 排序
  query = query.order(sortKey, { ascending: sortAsc });

  // 分页
  query = query.range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    rows: (data ?? []) as GeneratedContractListRow[],
    total: count ?? 0,
  };
}

/** 软删除生成的合同 */
export async function softDeleteGeneratedContract(input: {
  id: string;
  userId: string | null;
  deleteReason?: string;
}): Promise<void> {
  const { error } = await supabase
    .from('generated_contracts')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: input.userId,
      delete_reason: input.deleteReason?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id)
    .is('deleted_at', null);

  if (error) throw error;
}

/** 从回收站恢复生成的合同 */
export async function restoreGeneratedContractFromTrash(id: string, userId: string | null): Promise<void> {
  const { error } = await supabase
    .from('generated_contracts')
    .update({
      deleted_at: null,
      deleted_by: null,
      delete_reason: null,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq('id', id);

  if (error) throw error;
}

/** 永久删除生成的合同 */
export async function permanentlyDeleteGeneratedContract(id: string): Promise<void> {
  // 获取合同信息，用于后续删除存储文件
  const { data: contract, error: cErr } = await supabase
    .from('generated_contracts')
    .select('merged_pdf_storage_path, generated_docx_storage_path, sealed_pdf_storage_path')
    .eq('id', id)
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
    .eq('generated_id', id);

  // 删除合同本身
  const { error } = await supabase
    .from('generated_contracts')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/** 生成的合同列表行（包含关联数据） */
export type GeneratedContractListRow = GeneratedContract & {
  contract_templates?: { id: string; title: string } | null;
  projects?: { id: string; name: string } | null;
  party_a?: { id: string; name?: string | null } | null;
  /** 主库迁移为 unit_name；个别库仅有 name 时嵌套可能为空，由页面兜底显示 */
  party_b?: { id: string; unit_name?: string | null; name?: string | null } | null;
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

/** 填充生成的合同 Word 文档 */
async function fillGeneratedContractDocx(input: {
  templateStoragePath: string;
  outputPath: string;
  variables: Record<string, string>;
  imageSignedUrls?: Record<string, string>;
  imageBase64?: Record<string, string>;
}): Promise<void> {
  await invokeConvert({
    action: 'fill_docx',
    template_path: input.templateStoragePath,
    output_path: input.outputPath,
    variables: input.variables,
    image_signed_urls: input.imageSignedUrls,
    image_base64: input.imageBase64,
  });
}

/** 同步 HTML 到 Word 文档 */
export async function syncHtmlToWord(generatedId: string, html: string, userId: string | null): Promise<void> {
  await invokeConvert({
    action: 'sync_html_to_word',
    generated_id: generatedId,
    html_content: html,
  });
  await updateGeneratedContractWithRetry(generatedId, { rich_text_draft: html }, userId);
}

/** 将 Storage 上的 .docx 转为 HTML（Edge / contract-convert `docx_to_html`） */
export async function convertDocxToHtml(
  templateStoragePath: string,
): Promise<{ html: string; variables: DocxVariableToken[] }> {
  const raw = await invokeConvert({
    action: 'docx_to_html',
    source_path: templateStoragePath,
  });
  if (!raw || typeof raw !== 'object') {
    throw new Error('docx_to_html 无返回');
  }
  const o = raw as { ok?: boolean; html?: string; variables?: unknown; message?: string; error?: string };
  if (typeof o.html !== 'string' || !o.html) {
    throw new Error(o.message || o.error || 'docx_to_html 未返回 html');
  }
  const variables = Array.isArray(o.variables) ? (o.variables as DocxVariableToken[]) : [];
  return { html: o.html, variables };
}

/** 将 HTML 转换为 PDF */
export async function convertHtmlToPdf(generatedId: string, html: string, userId: string | null): Promise<void> {
  const outputPath = `contract-generated/${generatedId}/merged-${Date.now()}.pdf`;
  await invokeConvert({
    action: 'html_to_pdf',
    html_content: html,
    output_path: outputPath,
  });
  await updateGeneratedContractWithRetry(generatedId, { merged_pdf_storage_path: outputPath }, userId);
}

/** 分配合同编号 */
export async function allocateContractNumber(): Promise<string> {
  const { data, error } = await supabase.rpc('next_contract_library_number');
  if (error) throw error;
  return data as string;
}

/** 创建生成的合同 */
export async function createGeneratedContract(input: {
  templateId: string;
  templateFileVersionId: string;
  projectId: string | null;
  partyAId: string | null;
  partyBId: string | null;
  paymentMethodText: string | null;
  variablesValues: Record<string, string>;
  userId: string | null;
}): Promise<GeneratedContract> {
  const contractNumber = await allocateContractNumber();
  
  const { data, error } = await supabase
    .from('generated_contracts')
    .insert({
      contract_no: contractNumber,
      template_id: input.templateId,
      template_file_version_id: input.templateFileVersionId,
      project_id: input.projectId,
      party_a_id: input.partyAId,
      party_b_id: input.partyBId,
      payment_method_text: input.paymentMethodText,
      variables_values: input.variablesValues,
      status: 'draft',
      created_by: input.userId,
      updated_by: input.userId,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data as GeneratedContract;
}

/**
 * 将模板 .docx 复制到合同草稿独立路径（不修改模板 Storage）。
 * 返回写入的 Storage 路径。
 */
export async function copyTemplateDocxToGeneratedDraft(
  generatedId: string,
  templateStoragePath: string,
  userId: string | null,
): Promise<string> {
  const outPath = `contract-generated/${generatedId}/draft.docx`;
  const { error: copyErr } = await supabase.storage
    .from(CONTRACT_FILES_STORAGE_BUCKET)
    .copy(templateStoragePath, outPath);

  if (copyErr) {
    const { buffer, errorMessage } = await loadContractDocxBufferFromStorage(templateStoragePath);
    if (!buffer) {
      throw new Error(errorMessage || copyErr.message || '无法复制模板 Word 文件');
    }
    const { error: upErr } = await supabase.storage.from(CONTRACT_FILES_STORAGE_BUCKET).upload(outPath, buffer, {
      upsert: true,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    if (upErr) throw upErr;
  }

  await updateGeneratedContractWithRetry(
    generatedId,
    { generated_docx_storage_path: outPath },
    userId,
  );
  return outPath;
}

/**
 * 「用当前模板新建合同」：创建草稿记录 + 复制模板 docx 为合同副本（原模板不变）。
 */
export async function createDraftContractFromTemplate(input: {
  templateId: string;
  templateFileVersionId: string;
  templateStoragePath: string;
  userId: string | null;
}): Promise<GeneratedContract> {
  const row = await createGeneratedContract({
    templateId: input.templateId,
    templateFileVersionId: input.templateFileVersionId,
    projectId: null,
    partyAId: null,
    partyBId: null,
    paymentMethodText: null,
    variablesValues: {},
    userId: input.userId,
  });
  const outPath = await copyTemplateDocxToGeneratedDraft(row.id, input.templateStoragePath, input.userId);
  return { ...row, generated_docx_storage_path: outPath };
}

/** 创建草稿并生成 ONLYOFFICE 可打开的签名 URL（供编辑页直开，少一次往返） */
export async function createDraftContractFromTemplateWithDocAccess(input: {
  templateId: string;
  templateFileVersionId: string;
  templateStoragePath: string;
  userId: string | null;
}): Promise<{ contract: GeneratedContract; docAccess: SignedStorageUrlResult }> {
  const contract = await createDraftContractFromTemplate(input);
  const path = contract.generated_docx_storage_path;
  if (!path) {
    throw new Error('合同副本路径未写入');
  }
  const docAccess = await preferSignedStorageUrlWithHint(path);
  return { contract, docAccess };
}

/** 运行合同文档填充 */
export async function runDocxFillAfterGeneratedContract(
  input: FillGeneratedContractParams,
): Promise<void> {
  // 获取生成的合同信息
  const { data: generated, error: gErr } = await supabase
    .from('generated_contracts')
    .select('template_file_version_id, variables_values')
    .eq('id', input.generatedId)
    .single();
  
  if (gErr) throw gErr;
  if (!generated) throw new Error('生成的合同不存在');
  
  // 获取模板文件版本信息
  const { data: ver, error: vErr } = await supabase
    .from('contract_template_file_versions')
    .select('template_id, storage_path, variables_json')
    .eq('id', generated.template_file_version_id)
    .single();
  
  if (vErr) throw vErr;
  if (!ver) throw new Error('模板文件版本不存在');
  
  // 合并变量
  const finalVariables = { ...generated.variables_values, ...input.variables };
  const tokens = ver.variables_json as DocxVariableToken[];
  
  // 处理图片变量
  const imageBase64: Record<string, string> = {};
  const imageSignedUrls: Record<string, string> = {};
  
  for (const t of tokens) {
    const raw = finalVariables[t.label];
    if (!raw) continue;
    
    if (t.kind === 'image' && raw.startsWith('data:image/')) {
      imageBase64[t.label] = raw;
      continue;
    }
    
    if (t.kind === 'image' && (raw.startsWith('http://') || raw.startsWith('https://'))) {
      imageSignedUrls[t.label] = raw;
      continue;
    }
  }
  
  const outPath = `contract-generated/${input.generatedId}/filled.docx`;
  await fillGeneratedContractDocx({
    templateStoragePath: ver.storage_path,
    outputPath: outPath,
    variables: finalVariables,
    imageSignedUrls: Object.keys(imageSignedUrls).length > 0 ? imageSignedUrls : undefined,
    imageBase64: Object.keys(imageBase64).length > 0 ? imageBase64 : undefined,
  });
  
  // 更新生成的合同
  await updateGeneratedContractWithRetry(
    input.generatedId,
    { 
      generated_docx_storage_path: outPath,
      variables_values: finalVariables 
    },
    input.userId,
  );
  
  // 如果需要，创建新的修订版
  if (input.createRevision) {
    await addGeneratedRevision({
      generatedId: input.generatedId,
      note: input.revisionNote || '更新合同内容',
      userId: input.userId,
    });
  }
}

/** 添加生成的合同修订版 */
export async function addGeneratedRevision(input: {
  generatedId: string;
  note: string;
  userId: string | null;
}): Promise<GeneratedRevision> {
  // 获取当前最新修订版
  const { data: latestRevision, error: lrErr } = await supabase
    .from('generated_contract_revisions')
    .select('revision')
    .eq('generated_id', input.generatedId)
    .order('revision', { ascending: false })
    .maybeSingle();
  
  if (lrErr) throw lrErr;
  
  const nextRevision = (latestRevision?.revision || 0) + 1;
  
  // 获取当前生成的合同信息
  const { data: generated, error: gErr } = await supabase
    .from('generated_contracts')
    .select('rich_text_draft, merged_pdf_storage_path')
    .eq('id', input.generatedId)
    .single();
  
  if (gErr) throw gErr;
  if (!generated) throw new Error('生成的合同不存在');
  
  // 创建新的修订版
  const { data, error } = await supabase
    .from('generated_contract_revisions')
    .insert({
      generated_id: input.generatedId,
      revision: nextRevision,
      rich_text_html: generated.rich_text_draft,
      merged_pdf_storage_path: generated.merged_pdf_storage_path,
      change_summary: input.note,
      created_by: input.userId,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data as GeneratedRevision;
}

/** 将 HTML 写入草稿并新增一条修订记录 */
export async function saveGeneratedRichTextRevision(input: {
  generatedId: string;
  html: string;
  userId: string | null;
  revisionNote?: string;
}): Promise<void> {
  await updateGeneratedContractWithRetry(input.generatedId, { rich_text_draft: input.html }, input.userId);
  await addGeneratedRevision({
    generatedId: input.generatedId,
    note: input.revisionNote?.trim() || '保存正文修订',
    userId: input.userId,
  });
}

/** 列出生成的合同修订版 */
export async function listRevisions(generatedId: string): Promise<GeneratedRevision[]> {
  const { data, error } = await supabase
    .from('generated_contract_revisions')
    .select('*')
    .eq('generated_id', generatedId)
    .order('revision', { ascending: false });
  
  if (error) throw error;
  return (data ?? []) as GeneratedRevision[];
}

/** 更新生成的合同 */
export async function updateGeneratedContract(
  id: string,
  patch: Record<string, unknown>,
  userId: string | null,
): Promise<void> {
  await updateGeneratedContractWithRetry(id, patch, userId);
}

/** 获取生成的合同 */
export async function getGeneratedContract(id: string): Promise<GeneratedContract | null> {
  const { data, error } = await supabase
    .from('generated_contracts')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  
  if (error) throw error;
  if (!data) return null;
  
  return data as GeneratedContract;
}
