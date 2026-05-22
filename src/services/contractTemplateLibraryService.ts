import { supabase } from '../supabase/client';
import type { DocxVariableToken } from '../utils/docxVariables';
import { CONTRACT_FILES_STORAGE_BUCKET, preferSignedStorageUrl } from '../utils/contractDocxStorageFetch';

/** 合同模板库存储桶名 */
const BUCKET = CONTRACT_FILES_STORAGE_BUCKET;

export type TemplateCategory = {
  id: string;
  level: number;
  parent_id: string | null;
  code: string;
  name: string;
  sort_order: number;
  tier1_fixed: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ContractTemplate = {
  id: string;
  category_leaf_id: string;
  title: string;
  description: string | null;
  status: 'draft' | 'published' | 'archived';
  latest_version: number;
  created_by: string | null;
  created_at?: string;
  updated_at?: string;
  updated_by?: string | null;
  /** 非空表示在回收站（软删） */
  deleted_at?: string | null;
};

export type TemplateLibrarySortField = 'title' | 'updated_at' | 'status' | 'latest_version' | 'created_at';

export type TemplateFileVersion = {
  id: string;
  template_id: string;
  version: number;
  storage_path: string;
  original_filename: string;
  file_size: number | null;
  variables_json: DocxVariableToken[];
  change_summary: string | null;
  created_by: string | null;
  created_at: string;
};

let categoriesCache: TemplateCategory[] | null = null;
let categoriesFetchPromise: Promise<TemplateCategory[]> | null = null;

export async function fetchAllCategories(): Promise<TemplateCategory[]> {
  if (categoriesCache) return categoriesCache;
  if (categoriesFetchPromise) return categoriesFetchPromise;

  categoriesFetchPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from('contract_template_categories')
        .select('*')
        .order('level')
        .order('sort_order');
      if (error) throw error;
      categoriesCache = (data ?? []) as TemplateCategory[];
      return categoriesCache;
    } finally {
      categoriesFetchPromise = null;
    }
  })();

  return categoriesFetchPromise;
}

export function clearCategoriesCache() {
  categoriesCache = null;
}

export async function insertCategory(input: {
  parent_id: string;
  name: string;
  code?: string;
}): Promise<TemplateCategory> {
  const parent = (await fetchAllCategories()).find(c => c.id === input.parent_id);
  if (!parent) throw new Error('父分类不存在');
  const level = parent.level + 1;
  if (level > 3) throw new Error('最多三级分类');
  const code =
    input.code?.trim() ||
    `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { data, error } = await supabase
    .from('contract_template_categories')
    .insert({
      parent_id: input.parent_id,
      level,
      code,
      name: input.name.trim(),
      sort_order: 999,
      tier1_fixed: false,
    })
    .select()
    .single();
  if (error) throw error;
  clearCategoriesCache();
  return data as TemplateCategory;
}

export async function updateCategory(id: string, patch: { name?: string; sort_order?: number }): Promise<void> {
  const { error } = await supabase
    .from('contract_template_categories')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
  clearCategoriesCache();
}

export async function deleteCategory(id: string): Promise<void> {
  const all = await fetchAllCategories();
  const row = all.find(c => c.id === id);
  if (!row) return;
  if (row.level === 1 && row.tier1_fixed) throw new Error('一级分类不可删除');
  const { count, error: cErr } = await supabase
    .from('contract_templates')
    .select('id', { count: 'exact', head: true })
    .eq('category_leaf_id', id)
    .is('deleted_at', null);
  if (cErr) throw cErr;
  if (count && count > 0) throw new Error('该分类下仍有模板，无法删除');
  const hasChild = all.some(c => c.parent_id === id);
  if (hasChild) throw new Error('请先删除子分类');
  const { error } = await supabase.from('contract_template_categories').delete().eq('id', id);
  if (error) throw error;
  clearCategoriesCache();
}

export async function listTemplatesByLeaf(leafId: string): Promise<ContractTemplate[]> {
  const { data, error } = await supabase
    .from('contract_templates')
    .select('*')
    .eq('category_leaf_id', leafId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ContractTemplate[];
}

/** 按一级/二级/三级分类筛选时收集三级（叶）分类 id；全不选时返回 null 表示不过滤 */
export function collectLeafCategoryIdsForFilters(
  cats: TemplateCategory[],
  filterL1Id: string | null,
  filterL2Id: string | null,
  filterL3Id: string | null,
): string[] | null {
  if (!filterL1Id && !filterL2Id && !filterL3Id) return null;
  const byParent = new Map<string | null, TemplateCategory[]>();
  for (const c of cats) {
    const k = c.parent_id;
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(c);
  }
  if (filterL3Id) return [filterL3Id];
  if (filterL2Id) {
    return (byParent.get(filterL2Id) ?? []).filter(c => c.level === 3).map(c => c.id);
  }
  if (filterL1Id) {
    const out: string[] = [];
    for (const l2 of byParent.get(filterL1Id) ?? []) {
      for (const l3 of byParent.get(l2.id) ?? []) {
        if (l3.level === 3) out.push(l3.id);
      }
    }
    return out;
  }
  return null;
}

export async function listTemplateVersions(templateId: string): Promise<TemplateFileVersion[]> {
  const { data, error } = await supabase
    .from('contract_template_file_versions')
    .select('*')
    .eq('template_id', templateId)
    .order('version', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(r => ({
    ...r,
    variables_json: (r as { variables_json: DocxVariableToken[] }).variables_json ?? [],
  })) as TemplateFileVersion[];
}

/** 仅取最新一条版本（比 listTemplateVersions 少传输、少解析） */
export async function getLatestTemplateFileVersion(
  templateId: string,
): Promise<TemplateFileVersion | null> {
  const { data, error } = await supabase
    .from('contract_template_file_versions')
    .select('*')
    .eq('template_id', templateId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    variables_json: (data as { variables_json: DocxVariableToken[] }).variables_json ?? [],
  } as TemplateFileVersion;
}

export async function getTemplateById(
  id: string,
  opts?: { includeDeleted?: boolean },
): Promise<(ContractTemplate & { versions?: TemplateFileVersion[] }) | null> {
  let q = supabase.from('contract_templates').select('*').eq('id', id);
  if (!opts?.includeDeleted) {
    q = q.is('deleted_at', null);
  }
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  if (!data) return null;
  
  // 获取模板的所有版本
  const versions = await listTemplateVersions(id);
  
  return {
    ...(data as ContractTemplate),
    versions
  };
}

/**
 * 获取模板文件版本的签名URL（优先签名，失败回退公开）
 */
export async function getTemplateFileVersionUrl(templateFileVersionId: string): Promise<string> {
  const version = await getTemplateFileVersionById(templateFileVersionId);
  if (!version || !version.storage_path) {
    throw new Error('模板文件版本不存在或没有存储路径');
  }

  return await preferSignedStorageUrl(version.storage_path);
}

export async function getTemplateFileVersionById(id: string): Promise<TemplateFileVersion | null> {
  const { data, error } = await supabase
    .from('contract_template_file_versions')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...(data as TemplateFileVersion),
    variables_json: (data as { variables_json: DocxVariableToken[] }).variables_json ?? [],
  };
}

type HubPageRow = ContractTemplate & { total_count: number };

/** 旧库上 PL/pgSQL + EXECUTE 绑定 uuid[] 时 Postgres 0A000，见 migration 20260515120000（应改为 LANGUAGE sql）。 */
function isAnonymousCompositeHubRpcError(err: unknown): boolean {
  const msg =
    typeof err === 'object' && err !== null && 'message' in err
      ? String((err as { message: unknown }).message)
      : String(err);
  const code =
    typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : '';
  return (
    msg.includes('anonymous composite') ||
    msg.includes('0A000') ||
    code === '0A000'
  );
}

/**
 * 当 hub_page RPC 未升级时：单表查询 + 标题/说明 ILIKE（不含变量 JSON 检索与 FTS，与 RPC 行为略弱一致）。
 */
async function listTemplatesLibraryPageFallback(input: {
  leafCategoryIds: string[] | null;
  search: string;
  sortField: TemplateLibrarySortField;
  sortAsc: boolean;
  page: number;
  pageSize: number;
  includeDeleted?: boolean;
}): Promise<{ rows: ContractTemplate[]; total: number }> {
  const page = Math.max(0, input.page);
  const pageSize = Math.min(100, Math.max(1, input.pageSize));
  const offset = page * pageSize;
  const term = input.search.trim();

  if (input.leafCategoryIds !== null && input.leafCategoryIds.length === 0) {
    return { rows: [], total: 0 };
  }

  let q = supabase.from('contract_templates').select('*', { count: 'exact' });

  if (input.includeDeleted) {
    q = q.not('deleted_at', 'is', null);
  } else {
    q = q.is('deleted_at', null);
  }

  const leaf = input.leafCategoryIds;
  if (leaf !== null && leaf.length > 0) {
    q = q.in('category_leaf_id', leaf);
  }

  if (term) {
    const safe = term.replace(/,/g, ' ').replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
    q = q.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`);
  }

  q = q
    .order(input.sortField, { ascending: input.sortAsc, nullsFirst: false })
    .order('id', { ascending: true });

  const { data, error, count } = await q.range(offset, offset + pageSize - 1);
  if (error) throw error;
  return { rows: (data ?? []) as ContractTemplate[], total: count ?? 0 };
}

/**
 * 分页列出模板（分类 + 关键字 + 排序；依赖 RPC contract_templates_hub_page，与总数同查）。
 */
export async function listTemplatesLibraryPage(input: {
  leafCategoryIds: string[] | null;
  search: string;
  sortField: TemplateLibrarySortField;
  sortAsc: boolean;
  page: number;
  pageSize: number;
  /** true：仅列出回收站内模板（需与筛选配合） */
  includeDeleted?: boolean;
}): Promise<{ rows: ContractTemplate[]; total: number }> {
  const page = Math.max(0, input.page);
  const pageSize = Math.min(100, Math.max(1, input.pageSize));
  const offset = page * pageSize;
  const term = input.search.trim();

  if (input.leafCategoryIds !== null && input.leafCategoryIds.length === 0) {
    return { rows: [], total: 0 };
  }

  const leafIdsForRpc =
    input.leafCategoryIds !== null && input.leafCategoryIds.length > 0 ? input.leafCategoryIds : null;

  const { data, error } = await supabase.rpc('contract_templates_hub_page', {
    p_term: term,
    p_leaf_ids: leafIdsForRpc,
    p_sort_field: input.sortField,
    p_sort_asc: input.sortAsc,
    p_offset: offset,
    p_limit: pageSize,
    p_include_deleted: Boolean(input.includeDeleted),
  });

  if (error) {
    if (isAnonymousCompositeHubRpcError(error) || (error as { code?: string }).code === 'PGRST116') {
      return listTemplatesLibraryPageFallback(input);
    }
    throw error;
  }

  const raw = (data ?? []) as HubPageRow[];
  if (raw.length === 0) {
    const { data: countOnly, error: cErr } = await supabase.rpc('contract_templates_hub_count', {
      p_term: term,
      p_leaf_ids: leafIdsForRpc,
      p_include_deleted: Boolean(input.includeDeleted),
    });
    if (cErr) {
      if (isAnonymousCompositeHubRpcError(cErr) || (cErr as { code?: string }).code === 'PGRST116') {
        return listTemplatesLibraryPageFallback(input);
      }
      throw cErr;
    }
    return { rows: [], total: Number(countOnly) || 0 };
  }
  const total = Number(raw[0].total_count) || 0;
  const rows = raw.map(({ total_count: _tc, ...t }) => t) as ContractTemplate[];
  return { rows, total };
}



export async function uploadBytesToStorage(path: string, body: Blob | ArrayBuffer, contentType: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    upsert: true,
    contentType,
  });
  if (error) throw error;
}

/**
 * 上传文件到存储
 */
export async function uploadFileToStorage(path: string, file: File): Promise<void> {
  await uploadBytesToStorage(path, file, file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}

/**
 * 添加模板文件版本
 */
export async function addTemplateFileVersion(input: {
  templateId: string;
  storagePath: string;
  originalFilename: string;
  variablesJson: DocxVariableToken[];
  userId: string | null;
}): Promise<TemplateFileVersion> {
  // 获取当前最新版本号
  const { data: latestVersion, error: vErr } = await supabase
    .from('contract_template_file_versions')
    .select('version')
    .eq('template_id', input.templateId)
    .order('version', { ascending: false })
    .maybeSingle();

  if (vErr) throw vErr;
  const nextVersion = (latestVersion?.version || 0) + 1;

  // 创建新版本
  const { data, error } = await supabase
    .from('contract_template_file_versions')
    .insert({
      template_id: input.templateId,
      version: nextVersion,
      storage_path: input.storagePath,
      original_filename: input.originalFilename,
      variables_json: input.variablesJson,
      created_by: input.userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data as TemplateFileVersion;
}

/**
 * 创建合同模板
 */
export async function createTemplate(input: {
  title: string;
  categoryId: string;
  description?: string;
  userId: string | null;
}): Promise<ContractTemplate> {
  const { data, error } = await supabase
    .from('contract_templates')
    .insert({
      title: input.title,
      category_leaf_id: input.categoryId,
      description: input.description || null,
      created_by: input.userId,
      updated_by: input.userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ContractTemplate;
}

/**
 * 获取项目列表用于选择
 */
export async function fetchProjectsForSelect(companyId?: string): Promise<{ id: string; name: string }[]> {
  let query = supabase.from('projects').select('id, name').eq('status', 'active');
  if (companyId) {
    query = query.eq('company_id', companyId);
  }
  const { data, error } = await query.order('name');
  if (error) throw error;
  return (data ?? []) as { id: string; name: string }[];
}

/**
 * 从回收站恢复合同模板
 */
export async function restoreContractTemplateFromTrash(id: string, userId: string | null): Promise<void> {
  const { error } = await supabase
    .from('contract_templates')
    .update({
      deleted_at: null,
      deleted_by: null,
      updated_by: userId,
    })
    .eq('id', id);

  if (error) throw error;
}

/**
 * 恢复模板版本
 */
export async function restoreTemplateVersionFrom(versionId: string, userId: string | null): Promise<void> {
  // 获取要恢复的版本信息
  const { data: version, error: vErr } = await supabase
    .from('contract_template_file_versions')
    .select('template_id, storage_path, original_filename, variables_json')
    .eq('id', versionId)
    .single();

  if (vErr) throw vErr;
  if (!version) throw new Error('版本不存在');

  // 添加新的版本
  await addTemplateFileVersion({
    templateId: version.template_id,
    storagePath: version.storage_path,
    originalFilename: version.original_filename,
    variablesJson: version.variables_json,
    userId,
  });
}

/**
 * 重新解析模板文件版本变量
 */
export async function reparseTemplateFileVersionVariables(id: string, variablesJson: DocxVariableToken[]): Promise<void> {
  const { error } = await supabase
    .from('contract_template_file_versions')
    .update({ variables_json: variablesJson })
    .eq('id', id);

  if (error) throw error;
}

/**
 * 删除模板版本
 */
export async function deleteTemplateFileVersion(id: string): Promise<void> {
  const { error } = await supabase
    .from('contract_template_file_versions')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/**
 * 软删除合同模板
 */
export async function softDeleteContractTemplate(id: string, userId: string | null): Promise<void> {
  const { error } = await supabase
    .from('contract_templates')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: userId,
    })
    .eq('id', id);

  if (error) throw error;
}

/**
 * 更新模板元数据
 */
export async function updateTemplateMeta(
  id: string,
  patch: Partial<Omit<ContractTemplate, 'id' | 'created_at' | 'updated_at'>>,
  userId: string | null,
): Promise<void> {
  const updateData: Record<string, unknown> = { ...patch, updated_by: userId, updated_at: new Date().toISOString() };
  const { error } = await supabase
    .from('contract_templates')
    .update(updateData)
    .eq('id', id);

  if (error) throw error;
}







/**
 * 生成记录写入后尝试调用 fill_docx：按 variables_json 将表单值（键为 placeholder）映射为 docxtpl 上下文（键为 label，与 Word 中 `{{…}}` 内变量名一致）；图片支持 data URL、HTTPS URL（含签名 URL）或 Storage 路径（填充前自动签名）。
 */
