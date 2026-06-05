import { useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import {
  FaArrowLeft,
  FaCheck,
  FaDownload,
  FaInfoCircle,
  FaLayerGroup,
  FaPlus,
  FaRecycle,
  FaSave,
  FaSync,
  FaTimes,
  FaTrash,
  FaUndo,
  FaUpload } from
'react-icons/fa';
import { saveAs } from 'file-saver';
import PartyASelector from '../../components/PartyASelector';
import PartyBSelector from '../../components/PartyBSelector';
import { useAuth } from '../../hooks/useAuth';
import { createApproval } from '../../services/approvalService';
import { publicUrlForStoragePath } from '../../utils/contractDocxStorageFetch';
import {
  addTemplateFileVersion,
  collectLeafCategoryIdsForFilters,
  createTemplate,
  deleteTemplateFileVersion,
  fetchAllCategories,
  fetchProjectsForSelect,
  getLatestTemplateFileVersion,
  getTemplateById,
  insertCategory,
  listTemplateVersions,
  listTemplatesLibraryPage,
  restoreContractTemplateFromTrash,
  restoreTemplateVersionFrom,
  reparseTemplateFileVersionVariables,
  softDeleteContractTemplate,
  updateTemplateMeta,
  uploadBytesToStorage,
  uploadFileToStorage,
  type ContractTemplate,
  type TemplateCategory,
  type TemplateFileVersion,
  type TemplateLibrarySortField} from
'../../services/contractTemplateLibraryService';
import {
  createDraftContractFromTemplateWithDocAccess,
  createGeneratedContract,
  getGeneratedContract,
  listGeneratedContracts,
  listGeneratedContractsByTemplate,
  listGeneratedContractsTrashPage,
  listRevisions,
  permanentlyDeleteGeneratedContract,
  restoreGeneratedContractFromTrash,
  runDocxFillAfterGeneratedContract,
  saveGeneratedRichTextRevision,
  softDeleteGeneratedContract,
  updateGeneratedContract,
  type GeneratedContract,
  type GeneratedContractListRow,
  type GeneratedRevision,
  type GeneratedTrashSortKey } from
'../../services/contractGenerationService';
import { fetchConvertCapabilities } from '../../services/contractDocumentConvertService';
import { convertStorageDocxToPdf } from '../../services/contractConvertActions';
import { extractVariablesFromDocx, hydrateDocxVariableTokens } from '../../utils/docxVariables';
import { validateBeforeGenerateContract } from '../../utils/contractGenerateValidation';
import {
  partyBDisplayNameFromListRow,
  rowMatchesMyGeneratedContractSearch } from
'../../utils/generatedContractListSearch';
import ContractPreviewModal from '../../components/ContractPreviewModal';
import DocxStoragePreview from '../../components/contract/DocxStoragePreview';
import GeneratedContractRichWorkspace from '../../components/contract/GeneratedContractRichWorkspace';
import { preloadOnlyOfficeEnvironment } from '../../components/contract/OnlyOfficeEditorLazy';
import type { DraftEditorLocationState } from './draftEditorLocationState';
import { Skeleton } from '../../components/ui';
import TemplateVariableImageField from '../../components/contract/TemplateVariableImageField';
import TrashTable from '../../components/contract/TrashTable';
import MyGeneratedTable from '../../components/contract/MyGeneratedTable';
import GenDetailPanel from '../../components/contract/GenDetailPanel';
import ContractTemplateFilters from '../../components/contract/ContractTemplateFilters';
import { SearchableSelect, SegmentedControl } from '../../components/ui';
import { optionsFromTuples, projectSelectOptions } from '../../components/ui/options';
import { errorMessageFromUnknown as baseErrorMsg } from '../../utils/httpErrorMessage';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

/**
 * 生成安全的对象存储文件名
 * - 移除中文和特殊字符
 * - 只保留字母、数字、下划线、连字符和点
 * - 自动处理文件扩展名
 */
function sanitizeStorageFileName(fileName: string): string {
  // 获取扩展名
  const lastDotIndex = fileName.lastIndexOf('.');
  let baseName = fileName;
  let extension = '';
  
  if (lastDotIndex !== -1) {
    baseName = fileName.substring(0, lastDotIndex);
    extension = fileName.substring(lastDotIndex + 1);
  }
  
  // 清理基本文件名：只保留字母、数字、下划线、连字符
  // 将所有非ASCII字符替换为下划线
  let cleanBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
  
  // 防止连续的下划线
  cleanBaseName = cleanBaseName.replace(/_+/g, '_');
  
  // 移除开头和结尾的下划线
  cleanBaseName = cleanBaseName.replace(/^_+|_+$/g, '');
  
  // 如果清理后为空，使用默认名称
  if (!cleanBaseName) {
    cleanBaseName = 'file';
  }
  
  // 组合文件名
  if (extension) {
    // 清理扩展名
    const cleanExtension = extension.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
    return `${cleanBaseName}.${cleanExtension}`;
  }
  return cleanBaseName;
}

type View =
{name: 'hub';} |
{name: 'tpl_detail';template: ContractTemplate;trail: TemplateCategory[];} |
{name: 'generate';template: ContractTemplate;version: TemplateFileVersion;trail: TemplateCategory[];} |
{name: 'my';} |
{name: 'my_trash';} |
{name: 'gen_detail';row: GeneratedContract;} |
{name: 'generation_management';}; // 合同生成管理视图

type TrashCompositeSort = 'deleted_at_desc' | 'deleted_at_asc' | 'contract_no_asc' | 'contract_no_desc';

function trashCompositeToApi(composite: TrashCompositeSort): {sortKey: GeneratedTrashSortKey;sortAsc: boolean;} {
  switch (composite) {
    case 'deleted_at_desc':
      return { sortKey: 'deleted_at', sortAsc: false };
    case 'deleted_at_asc':
      return { sortKey: 'deleted_at', sortAsc: true };
    case 'contract_no_asc':
      return { sortKey: 'contract_no', sortAsc: true };
    case 'contract_no_desc':
      return { sortKey: 'contract_no', sortAsc: false };
    default:
      return { sortKey: 'deleted_at', sortAsc: false };
  }
}

function useDebounced<T>(value: T, delayMs: number): T {
  return useDebouncedValue(value, delayMs);
}

function categoryTrailForLeaf(cats: TemplateCategory[], leafId: string): TemplateCategory[] {
  const byId = new Map(cats.map((c) => [c.id, c]));
  let cur = byId.get(leafId);
  const stack: TemplateCategory[] = [];
  while (cur) {
    stack.push(cur);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return stack.reverse();
}

function csvEscapeCell(val: string): string {
  if (/[",\n\r]/.test(val)) return `"${val.replace(/"/g, '""')}"`;
  return val;
}

/** 常见 Supabase / 网络错误附简短解决建议 */
function appendErrorHint(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('jwt') || m.includes('session') || message.includes('登录'))
  return `${message}\n\n建议：重新登录后再试；无痕窗口需先完成登录。`;
  if (m.includes('failed to fetch') || m.includes('network') || message.includes('网络'))
  return `${message}\n\n建议：检查本机网络、代理/VPN 及 Supabase 服务是否可达。`;
  if (m.includes('row-level security') || m.includes('rls') || m.includes('42501') || message.includes('权限'))
  return `${message}\n\n建议：联系管理员检查 RLS 策略与当前账号角色。`;
  if (m.includes('anonymous composite'))
  return `${message}\n\n建议：在 SQL Editor 执行迁移「contract_templates_hub_page」LANGUAGE sql 版，并刷新页面。`;
  if (m.includes('pgrst') && m.includes('timeout'))
  return `${message}\n\n建议：缩小筛选范围或稍后再试；若持续超时请联系管理员优化查询。`;
  return message;
}

function errorMessageFromUnknown(e: unknown, fallback: string): string {
  const msg = baseErrorMsg(e, '');
  return appendErrorHint(msg || fallback);
}

type MyGenSortField = 'created_at' | 'updated_at' | 'contract_no' | 'status';

function statusBadgeClass(status: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'draft') return 'badge-neutral';
  if (s === 'contract_final') return 'badge-info';
  if (s === 'published' || s === 'sealed') return 'badge-success';
  if (s === 'archived') return 'badge-neutral opacity-70';
  return 'badge-warning';
}

/** 模板状态：列表/徽章旁展示中文 */
function formatTemplateStatusLabel(status: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'draft') return '草稿';
  if (s === 'published') return '已发布';
  if (s === 'archived') return '已归档';
  return status;
}

/** 模板库生成的合同实例状态 */
function formatGeneratedContractStatusLabel(status: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'draft') return '草稿';
  if (s === 'contract_final') return '已定稿';
  if (s === 'sealed') return '已签章';
  return status;
}

const PAYMENT_PRESETS: {label: string;text: string;}[] = [
{
  label: '进度款（月结 80% + 竣工 15% + 质保 5%）',
  text:
  '按月进度支付至已完工程价款的 80%；竣工验收合格后支付至 95%；余款 5% 作为质量保证金，质保期满后无息付清。'
},
{
  label: '货到付款',
  text: '货到验收合格后 15 个工作日内一次性付清合同价款。'
},
{
  label: '预付款 + 进度款',
  text: '合同签订后 7 日内支付合同总价 30% 作为预付款；按月进度支付至 85%；竣工验收后付至 97%；余 3% 质保金。'
}];


/** Word 占位符与 docxtpl/Jinja2 命名提示（用于模板详情 / 生成表单） */
function ContractVariableNamingHintBox() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-xs text-amber-950 space-y-1.5 leading-relaxed">
      <p className="font-semibold text-amber-900">变量名规范（文字 / 图片 / 文件）</p>
      <ul className="list-disc pl-4 space-y-1">
        <li>
          <strong>与 fill_docx 一致</strong>：服务端按 <code className="bg-white/90 px-1 rounded">variables_json</code> 里的{' '}
          <strong>「标签」</strong>（label）注入 Word。表单按 <strong>占位符</strong>（placeholder）取值；纯文字时通常{' '}
          <code className="bg-white/90 px-1 rounded">{'{{标签}}'}</code> 与标签相同。
        </li>
        <li>
          <strong>关键字自动识别为图片</strong>：占位符内变量名若包含以下任一字串，则表单显示为图片上传（与「图片:」前缀二选一即可）：正面、反面、营业执照、身份证、清单、开户许可、证书、证。匹配为<strong>模糊包含</strong>，不区分英文大小写。
        </li>
        <li>
          <strong>文字变量</strong>：推荐 <code className="bg-white/90 px-1 rounded">party_a</code>、
          <code className="bg-white/90 px-1 rounded">签订日期</code> 等；<strong>不要在 {'{{ }}'} 内使用半角冒号「:」</strong>
          （Jinja2 会当成语法符号）。若版式需要「甲方：」等，请写成「甲方：{'{{甲方名称}}'}」，冒号放在占位符外。含半角冒号且非「图片:」「文件:」前缀的占位符<strong>不会</strong>按关键字归为图片类。
        </li>
        <li>
          <strong>显式图片 / 文件前缀</strong>（可选）：仍支持 <code className="bg-white/90 px-1 rounded">{'{{图片:字段名}}'}</code>、
          <code className="bg-white/90 px-1 rounded">{'{{文件:字段名}}'}</code> 等；前缀后的字段名勿再含半角冒号。
        </li>
      </ul>
    </div>);

}

function buildTree(cats: TemplateCategory[]) {
  const byParent = new Map<string | null, TemplateCategory[]>();
  for (const c of cats) {
    const k = c.parent_id;
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(c);
  }
  for (const arr of byParent.values()) {
    arr.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }
  return byParent;
}

export default function ContractTemplateLibraryPage() {
  const { user, isSuperAdmin } = useAuth();
  const userId = user?.id ?? null;
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { templateId: editRouteTemplateId } = useParams<{templateId?: string;}>();

  const [cats, setCats] = useState<TemplateCategory[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [view, setView] = useState<View>({ name: 'hub' });
  const [err, setErr] = useState<string | null>(null);
  const [convertInfo, setConvertInfo] = useState<string | null>(null);

  const [hubRows, setHubRows] = useState<ContractTemplate[]>([]);
  const [hubTotal, setHubTotal] = useState(0);
  const [hubLoading, setHubLoading] = useState(false);
  const [hubPage, setHubPage] = useState(0);
  const [hubPageSize, setHubPageSize] = useState(10);
  const [hubShowTrash, setHubShowTrash] = useState(false);
  const [hubSortField, setHubSortField] = useState<TemplateLibrarySortField>('updated_at');
  const [hubSortAsc, setHubSortAsc] = useState(false);
  const [hubSearch, setHubSearch] = useState('');
  const debouncedHubSearch = useDebounced(hubSearch, 320);
  const [filterL1, setFilterL1] = useState('');
  const [filterL2, setFilterL2] = useState('');
  const [expandedTplId, setExpandedTplId] = useState<string | null>(null);
  const [expandedGens, setExpandedGens] = useState<Record<string, GeneratedContract[]>>({});
  const [expandedGensLoading, setExpandedGensLoading] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState<{template: ContractTemplate;versions: TemplateFileVersion[];} | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [contractPreviewOpen, setContractPreviewOpen] = useState(false);
  const [previewContractId, setPreviewContractId] = useState<string>('');
  const [newTplModalOpen, setNewTplModalOpen] = useState(false);
  const [newTplLeafId, setNewTplLeafId] = useState('');
  const [modalFilterL1, setModalFilterL1] = useState('');
  const [modalFilterL2, setModalFilterL2] = useState('');

  const [versions, setVersions] = useState<TemplateFileVersion[]>([]);
  const [myList, setMyList] = useState<GeneratedContractListRow[]>([]);
  const [myListLoading, setMyListLoading] = useState(false);
  const [myGenSearch, setMyGenSearch] = useState('');
  const debouncedMyGenSearch = useDebounced(myGenSearch, 320);
  const [myGenStatus, setMyGenStatus] = useState('');
  const [myGenSort, setMyGenSort] = useState('created_at:desc');
  const [genDetailFromTrash, setGenDetailFromTrash] = useState(false);
  const [trashPage, setTrashPage] = useState(0);
  const [trashPageSize] = useState(20);
  const [trashTotal, setTrashTotal] = useState(0);
  const [trashRows, setTrashRows] = useState<GeneratedContractListRow[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [trashSort, setTrashSort] = useState<TrashCompositeSort>('deleted_at_desc');
  const [trashNoSearch, setTrashNoSearch] = useState('');
  const debouncedTrashNoSearch = useDebounced(trashNoSearch, 320);
  const [trashSelected, setTrashSelected] = useState<Set<string>>(() => new Set());
  const [trashActionBusy, setTrashActionBusy] = useState(false);
  const [softDeleteModalRow, setSoftDeleteModalRow] = useState<GeneratedContractListRow | null>(null);
  const [softDeleteReasonDraft, setSoftDeleteReasonDraft] = useState('');
  const [softDeleteBusy, setSoftDeleteBusy] = useState(false);
  const [permaConfirm, setPermaConfirm] = useState<{ids: string[];typed: string;} | null>(null);
  const [permaBusy, setPermaBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [projects, setProjects] = useState<{id: string;name: string;}[]>([]);
  const [revisions, setRevisions] = useState<GeneratedRevision[]>([]);

  const [newTplTitle, setNewTplTitle] = useState('');
  const [newTplDescription, setNewTplDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [reparseBusyId, setReparseBusyId] = useState<string | null>(null);
  const [deleteVersionConfirmId, setDeleteVersionConfirmId] = useState<string | null>(null);
  const [deleteVersionBusy, setDeleteVersionBusy] = useState(false);
  const [genDocxBusy, setGenDocxBusy] = useState(false);
  const [retryFillBusy, setRetryFillBusy] = useState(false);
  const [wordFillFailure, setWordFillFailure] = useState<{id: string;message: string;} | null>(null);
  const [genSubmitBusy, setGenSubmitBusy] = useState(false);
  const [genFlowNotice, setGenFlowNotice] = useState<string | null>(null);
  const [genPdfBusy, setGenPdfBusy] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminParentCatId, setAdminParentCatId] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [genForm, setGenForm] = useState({
    party_a_id: '',
    party_b_id: '',
    project_id: '',
    payment_method_text: '',
    vars: {} as Record<string, string>
  });

  const [metaEditTitle, setMetaEditTitle] = useState('');
  const [metaEditDesc, setMetaEditDesc] = useState('');
  const [metaSaveBusy, setMetaSaveBusy] = useState(false);
  const [templateStatusBusy, setTemplateStatusBusy] = useState(false);
  const [versionUploadSummary, setVersionUploadSummary] = useState('');

  const byParent = useMemo(() => buildTree(cats), [cats]);

  const myGenRows = useMemo(() => {
    let rows = [...myList];
    if (myGenStatus) {
      rows = rows.filter((r) => (r.status || '').toLowerCase() === myGenStatus.toLowerCase());
    }
    const q = debouncedMyGenSearch.trim();
    if (q) {
      rows = rows.filter((r) => rowMatchesMyGeneratedContractSearch(r, q));
    }
    const parts = myGenSort.split(':');
    const sf = (parts[0] || 'created_at') as MyGenSortField;
    const asc = parts[1] === 'asc';
    rows.sort((a, b) => {
      let c = 0;
      if (sf === 'created_at' || sf === 'updated_at') {
        const ta = new Date(a[sf]).getTime();
        const tb = new Date(b[sf]).getTime();
        c = ta - tb;
      } else if (sf === 'contract_no') {
        c = a.contract_no.localeCompare(b.contract_no, 'zh-CN');
      } else if (sf === 'status') {
        c = (a.status || '').localeCompare(b.status || '', 'zh-CN');
      }
      if (c !== 0) return asc ? c : -c;
      return a.id.localeCompare(b.id);
    });
    return rows;
  }, [myList, myGenStatus, debouncedMyGenSearch, myGenSort]);

  const hubLeafFilter = useMemo(
    () => collectLeafCategoryIdsForFilters(cats, filterL1 || null, filterL2 || null, null),
    [cats, filterL1, filterL2]
  );

  const l1Options = useMemo(() => byParent.get(null) ?? [], [byParent]);
  const l2Options = useMemo(() => filterL1 ? byParent.get(filterL1) ?? [] : [], [byParent, filterL1]);
  const modalL2Opts = useMemo(
    () => modalFilterL1 ? byParent.get(modalFilterL1) ?? [] : [],
    [byParent, modalFilterL1]
  );

  const hubFilterL1Options = useMemo(
    () => [{ value: '', label: '全部' }, ...l1Options.map((c) => ({ value: c.id, label: c.name }))],
    [l1Options]
  );
  const hubFilterL2Options = useMemo(() => {
    const emptyLabel = filterL1 ? '全部（该一级下）' : '请先选一级';
    return [{ value: '', label: emptyLabel }, ...l2Options.map((c) => ({ value: c.id, label: c.name }))];
  }, [filterL1, l2Options]);

  const hubSortComboOptions = useMemo(
    () =>
    optionsFromTuples([
    { value: 'updated_at:desc', label: '更新时间 ↓' },
    { value: 'updated_at:asc', label: '更新时间 ↑' },
    { value: 'created_at:desc', label: '创建时间 ↓' },
    { value: 'created_at:asc', label: '创建时间 ↑' },
    { value: 'title:asc', label: '标题 A→Z' },
    { value: 'title:desc', label: '标题 Z→A' },
    { value: 'latest_version:desc', label: '版本号 ↓' },
    { value: 'latest_version:asc', label: '版本号 ↑' },
    { value: 'status:asc', label: '状态 A→Z' },
    { value: 'status:desc', label: '状态 Z→A' }]
    ),
    []
  );

  const hubPageSizeSegmentOptions = useMemo(
    () => [
    { value: '10', label: '10 条/页' },
    { value: '20', label: '20 条/页' },
    { value: '50', label: '50 条/页' }],

    []
  );

  const myGenStatusFilterOptions = useMemo(
    () =>
    optionsFromTuples([
    { value: '', label: '全部状态' },
    { value: 'draft', label: '草稿' },
    { value: 'contract_final', label: '已定稿' },
    { value: 'sealed', label: '已签章' }]
    ),
    []
  );

  const myGenSortOptions = useMemo(
    () =>
    optionsFromTuples([
    { value: 'created_at:desc', label: '创建时间 ↓' },
    { value: 'created_at:asc', label: '创建时间 ↑' },
    { value: 'updated_at:desc', label: '更新时间 ↓' },
    { value: 'updated_at:asc', label: '更新时间 ↑' },
    { value: 'contract_no:asc', label: '编号 A→Z' },
    { value: 'contract_no:desc', label: '编号 Z→A' },
    { value: 'status:asc', label: '状态 A→Z' },
    { value: 'status:desc', label: '状态 Z→A' }]
    ),
    []
  );

  const trashSortOptions = useMemo(
    () =>
    optionsFromTuples([
    { value: 'deleted_at_desc', label: '删除时间 ↓' },
    { value: 'deleted_at_asc', label: '删除时间 ↑' },
    { value: 'contract_no_asc', label: '编号 A→Z' },
    { value: 'contract_no_desc', label: '编号 Z→A' }]
    ),
    []
  );

  const adminParentCatOptions = useMemo(() => {
    const l1 = byParent.get(null) ?? [];
    const opts: {value: string;label: string;}[] = [{ value: '', label: '选择父级…' }];
    for (const a of l1) {
      opts.push({ value: a.id, label: `${a.name}（下挂二级）` });
    }
    return opts;
  }, [byParent]);

  const newTplModalL1Options = useMemo(
    () => [{ value: '', label: '请选择…' }, ...l1Options.map((c) => ({ value: c.id, label: c.name }))],
    [l1Options]
  );
  const newTplModalL2Options = useMemo(() => {
    const emptyLabel = modalFilterL1 ? '请选择…' : '请先选一级';
    return [{ value: '', label: emptyLabel }, ...modalL2Opts.map((c) => ({ value: c.id, label: c.name }))];
  }, [modalFilterL1, modalL2Opts]);

  const genProjectSelectOptions = useMemo(() => projectSelectOptions(projects, '不关联'), [projects]);

  const reloadCats = useCallback(async () => {
    if (loadingCats && cats.length > 0) return; // 避免重复进入
    setLoadingCats(true);
    setErr(null);
    try {
      const data = await fetchAllCategories();
      setCats(data);
    } catch (e: unknown) {
      setErr(errorMessageFromUnknown(e, '加载分类失败'));
    } finally {
      setLoadingCats(false);
    }
  }, [loadingCats, cats.length]);

  useEffect(() => {
    if (cats.length === 0) {
      void reloadCats();
    }
  }, [reloadCats, cats.length]);

  useEffect(() => {
    void fetchProjectsForSelect().
    then(setProjects).
    catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    setHubPage(0);
  }, [debouncedHubSearch, filterL1, filterL2, hubShowTrash]);

  useEffect(() => {
    if (!editRouteTemplateId || loadingCats || cats.length === 0) return;
    void (async () => {
      setErr(null);
      try {
        const t = await getTemplateById(editRouteTemplateId, { includeDeleted: true });
        if (!t) {
          setErr('模板不存在');
          navigate('/contract/templates', { replace: true });
          return;
        }
        const trail = categoryTrailForLeaf(cats, t.category_leaf_id);
        setView({ name: 'tpl_detail', template: t, trail });
      } catch (e: unknown) {
        setErr(errorMessageFromUnknown(e, '加载模板失败'));
      }
    })();
  }, [editRouteTemplateId, loadingCats, cats, navigate]);

  const [quickGenBusyId, setQuickGenBusyId] = useState<string | null>(null);

  useEffect(() => {
    preloadOnlyOfficeEnvironment();
  }, []);

  const createDraftFromTemplateAndEdit = useCallback(
    async (template: ContractTemplate) => {
      if (!userId) {
        setErr('请先登录后再新建合同');
        return;
      }
      setErr(null);
      setQuickGenBusyId(template.id);
      try {
        const ver = await getLatestTemplateFileVersion(template.id);
        if (!ver?.storage_path) {
          setErr('请先在「编辑」中上传 .docx 模板版本');
          return;
        }
        const { contract, docAccess } = await createDraftContractFromTemplateWithDocAccess({
          templateId: template.id,
          templateFileVersionId: ver.id,
          templateStoragePath: ver.storage_path,
          userId,
        });
        const state: DraftEditorLocationState = {
          documentUrl: docAccess.url,
          urlHint: docAccess.hint,
          contract,
        };
        navigate(`/contract/templates/draft/${contract.id}/edit`, { state });
      } catch (e: unknown) {
        setErr((e as Error)?.message || '无法创建合同草稿');
      } finally {
        setQuickGenBusyId(null);
      }
    },
    [navigate, userId],
  );

  const handleGenerateFromTemplate = useCallback(async (template: ContractTemplate) => {
    setErr(null);
    try {
      const vers = await listTemplateVersions(template.id);
      if (!vers[0]) {
        setErr('请先在「编辑」中上传 .docx 模板版本');
        return;
      }
      const trail = categoryTrailForLeaf(cats, template.category_leaf_id);
      setGenForm({
        party_a_id: '',
        party_b_id: '',
        project_id: '',
        payment_method_text: '',
        vars: {}
      });
      setView({ name: 'generate', template: template, version: vers[0], trail });
    } catch (e: unknown) {
      setErr((e as Error)?.message || '无法开始生成');
    }
  }, [cats]);

  const loadHub = useCallback(async () => {
    if (loadingCats || cats.length === 0) return;
    setHubLoading(true);
    setErr(null);
    try {
      const { rows, total } = await listTemplatesLibraryPage({
        leafCategoryIds: hubLeafFilter,
        search: debouncedHubSearch,
        sortField: hubSortField,
        sortAsc: hubSortAsc,
        page: hubPage,
        pageSize: hubPageSize,
        includeDeleted: hubShowTrash
      });
      setHubRows(rows);
      setHubTotal(total);
    } catch (e: unknown) {
      const msg = errorMessageFromUnknown(e, '加载模板列表失败');
      // 如果是并发限制或取消导致的错误，不清除列表，仅记录日志
      if (!msg.includes('insufficient') && !msg.includes('aborted')) {
        setErr(msg);
        setHubRows([]);
        setHubTotal(0);
      }
    } finally {
      setHubLoading(false);
    }
  }, [
    loadingCats,
    cats.length,
    hubLeafFilter,
    debouncedHubSearch,
    hubSortField,
    hubSortAsc,
    hubPage,
    hubPageSize,
    hubShowTrash
  ]);

  useEffect(() => {
    if (cats.length > 0) {
      void loadHub();
    }
  }, [loadHub, cats.length]);

  const loadVersions = async (templateId: string) => {
    setErr(null);
    try {
      setVersions(await listTemplateVersions(templateId));
    } catch (e: unknown) {
      setErr(errorMessageFromUnknown(e, '加载版本失败'));
    }
  };

  const loadMy = async () => {
    setErr(null);
    setMyListLoading(true);
    try {
      setMyList(await listGeneratedContracts());
    } catch (e: unknown) {
      setErr(errorMessageFromUnknown(e, '加载生成合同失败'));
    } finally {
      setMyListLoading(false);
    }
  };

  const loadTrash = useCallback(async () => {
    setErr(null);
    setTrashLoading(true);
    try {
      const { sortKey, sortAsc } = trashCompositeToApi(trashSort);
      const { rows, total } = await listGeneratedContractsTrashPage({
        page: trashPage,
        pageSize: trashPageSize,
        sortKey,
        sortAsc,
        search: debouncedTrashNoSearch.trim() || undefined
      });
      setTrashRows(rows);
      setTrashTotal(total);
    } catch (e: unknown) {
      setErr(errorMessageFromUnknown(e, '加载回收站失败'));
    } finally {
      setTrashLoading(false);
    }
  }, [trashPage, trashPageSize, trashSort, debouncedTrashNoSearch]);

  const loadRevisions = async (gid: string) => {
    setErr(null);
    try {
      setRevisions(await listRevisions(gid));
    } catch (e: unknown) {
      setErr(errorMessageFromUnknown(e, '加载修订失败'));
    }
  };

  const tplDetailId = view.name === 'tpl_detail' ? view.template.id : '';
  useEffect(() => {
    if (view.name === 'tpl_detail' && tplDetailId) void loadVersions(tplDetailId);
  }, [view.name, tplDetailId]);

  useEffect(() => {
    if (view.name === 'my') void loadMy();
  }, [view.name]);

  useEffect(() => {
    if (view.name !== 'my_trash') return;
    void loadTrash();
  }, [view.name, loadTrash]);

  useEffect(() => {
    setTrashPage(0);
  }, [debouncedTrashNoSearch, trashSort]);

  useEffect(() => {
    if (view.name !== 'my_trash') return;
    setTrashSelected(new Set());
  }, [view.name, trashPage, debouncedTrashNoSearch, trashSort]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const p = location.pathname;
    const contractId = searchParams.get('contract')?.trim() || '';
    const openPreview = searchParams.get('preview') === '1';

    if (p === '/contract/templates/my-generated/trash') {
      setView({ name: 'my_trash' });
      return;
    }
    if (p === '/contract/templates/my-generated') {
      if (!contractId) {
        setView({ name: 'my' });
        return;
      }
      let cancelled = false;
      void (async () => {
        try {
          const row = await getGeneratedContract(contractId);
          if (cancelled) return;
          if (row) {
            setGenDetailFromTrash(Boolean(row.deleted_at));
            setView({ name: 'gen_detail', row });
            if (openPreview) {
              setPreviewContractId(row.id);
              setContractPreviewOpen(true);
            }
          } else {
            setView({ name: 'my' });
            setErr('未找到该合同，可能已删除');
          }
        } catch (e: unknown) {
          if (!cancelled) {
            setView({ name: 'my' });
            setErr(errorMessageFromUnknown(e, '加载合同详情失败'));
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }
    if (p === '/contract/templates/generation') {
      setView({ name: 'generation_management' });
    } else if (p === '/contract/templates') {
      /** 从侧栏进入「模板总览」须回到 hub；避免 URL 已是 /contract/templates 却仍停留在 tpl_detail */
      setView({ name: 'hub' });
    }
  }, [location.pathname, searchParams]);

  const genDetailId = view.name === 'gen_detail' ? view.row.id : '';
  useEffect(() => {
    if (view.name === 'gen_detail' && genDetailId) void loadRevisions(genDetailId);
  }, [view.name, genDetailId]);

  const tplDetailSyncKey = view.name === 'tpl_detail' ? view.template.id : '';
  useEffect(() => {
    if (view.name !== 'tpl_detail') return;
    setMetaEditTitle(view.template.title);
    setMetaEditDesc(view.template.description ?? '');
    setVersionUploadSummary('');
  }, [view.name, tplDetailSyncKey]);

  const trailLabels = (trail: TemplateCategory[]) => trail.map((t) => t.name).join(' / ');

  const goGenDetail = (row: GeneratedContract, fromTrash: boolean) => {
    setGenDetailFromTrash(fromTrash);
    setView({ name: 'gen_detail', row });
  };

  const openPreviewModal = async (t: ContractTemplate) => {
    setPreviewOpen({ template: t, versions: [] });
    setPreviewLoading(true);
    try {
      const vers = await listTemplateVersions(t.id);
      setPreviewOpen({ template: t, versions: vers });
    } catch (e: unknown) {
      setErr(errorMessageFromUnknown(e, '加载预览失败'));
      setPreviewOpen(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const toggleExpandGenerated = async (templateId: string) => {
    if (expandedTplId === templateId) {
      setExpandedTplId(null);
      return;
    }
    setExpandedTplId(templateId);
    if (expandedGens[templateId]) return;
    setExpandedGensLoading(templateId);
    setErr(null);
    try {
      const list = await listGeneratedContractsByTemplate(templateId);
      setExpandedGens((prev) => ({ ...prev, [templateId]: list }));
    } catch (e: unknown) {
      setErr(errorMessageFromUnknown(e, '加载已生成合同失败'));
    } finally {
      setExpandedGensLoading(null);
    }
  };

  const handleUploadVersion = async (template: ContractTemplate, file: File | null) => {
    if (!file) return;
    setUploading(true);
    setErr(null);
    try {
      const vars = await extractVariablesFromDocx(file);
      const cleanFileName = sanitizeStorageFileName(file.name);
      const path = `contract-templates/uploads/${template.id}/${crypto.randomUUID()}_${cleanFileName}`;
      await uploadFileToStorage(path, file);
      await addTemplateFileVersion({
        templateId: template.id,
        storagePath: path,
        originalFilename: file.name,
        variablesJson: vars,
        userId
      });
      await loadVersions(template.id);
      void loadHub();
      setVersionUploadSummary('');
    } catch (e: unknown) {
      setErr((e as Error)?.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTplLeafId) {
      setErr('请选择二级分类（用途）');
      return;
    }
    if (!newTplTitle.trim()) {
      setErr('请填写模板名称');
      return;
    }
    setErr(null);
    try {
      const t = await createTemplate({
        categoryId: newTplLeafId,
        title: newTplTitle.trim(),
        description: newTplDescription.trim() || undefined,
        userId
      });
      const trail = categoryTrailForLeaf(cats, newTplLeafId);
      setNewTplTitle('');
      setNewTplDescription('');
      setNewTplLeafId('');
      setModalFilterL1('');
      setModalFilterL2('');
      setNewTplModalOpen(false);
      /** 新建后若列表仍开着分类/关键字筛选，新模板可能不在当前 leaf 集合内 → 清空筛选并拉第一页 */
      setFilterL1('');
      setFilterL2('');
      setHubSearch('');
      setHubPage(0);
      setHubSortField('updated_at');
      setHubSortAsc(false);
      const { rows, total } = await listTemplatesLibraryPage({
        leafCategoryIds: null,
        search: '',
        sortField: 'updated_at',
        sortAsc: false,
        page: 0,
        pageSize: hubPageSize,
        includeDeleted: hubShowTrash
      });
      setHubRows(rows);
      setHubTotal(total);
      setView({ name: 'tpl_detail', template: t, trail });
      navigate(`/contract/templates/edit/${t.id}`, { replace: true });
    } catch (e: unknown) {
      setErr(errorMessageFromUnknown(e, '创建失败'));
    }
  };

  const handleDeleteVersion = async (templateId: string, versionId: string) => {
    if (!isSuperAdmin) {
      setErr('仅超级管理员可删除版本');
      return;
    }
    if (!confirm('确定要删除当前版本吗？此操作不可撤销')) return;

    setDeleteVersionBusy(true);
    setErr(null);
    try {
      await deleteTemplateFileVersion(versionId);
      await loadVersions(templateId);
      void loadHub();
      setToast('版本删除成功');
    } catch (e: unknown) {
      setErr(errorMessageFromUnknown(e, '删除版本失败'));
    } finally {
      setDeleteVersionBusy(false);
      setDeleteVersionConfirmId(null);
    }
  };

  const exportCsv = () => {
    const headers = [
    'contract_no',
    'status',
    'template_title',
    'project_name',
    'party_a_name',
    'party_b_name',
    'has_word',
    'has_pdf',
    'approval_linked',
    'created_at',
    'updated_at',
    'template_id',
    'project_id',
    'party_a_id',
    'party_b_id'];

    const lines = [headers.map(csvEscapeCell).join(',')];
    for (const r of myGenRows) {
      const hasWord = r.generated_docx_storage_path ? 'yes' : 'no';
      const hasPdf = r.merged_pdf_storage_path ? 'yes' : 'no';
      const appr = r.approval_id ? 'yes' : 'no';
      lines.push(
        [
        csvEscapeCell(r.contract_no),
        csvEscapeCell(r.status),
        csvEscapeCell(r.contract_templates?.title ?? ''),
        csvEscapeCell(r.projects?.name ?? ''),
        csvEscapeCell(r.party_a?.name ?? ''),
        csvEscapeCell(partyBDisplayNameFromListRow(r) === '—' ? '' : partyBDisplayNameFromListRow(r)),
        csvEscapeCell(hasWord),
        csvEscapeCell(hasPdf),
        csvEscapeCell(appr),
        csvEscapeCell(r.created_at),
        csvEscapeCell(r.updated_at),
        csvEscapeCell(r.template_id),
        csvEscapeCell(r.project_id ?? ''),
        csvEscapeCell(r.party_a_id ?? ''),
        csvEscapeCell(r.party_b_id ?? '')].
        join(',')
      );
    }
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, `generated-contracts-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const startApproval = async (row: GeneratedContract) => {
    if (!userId) {
      setErr('请先登录');
      return;
    }
    setErr(null);
    try {
      const ap = await createApproval(
        'contract_template_generated',
        row.id,
        `模板合同 ${row.contract_no}`,
        userId
      );
      if (!ap) {
        setErr('未配置审批步骤（approval_steps 中需有 contract_template_generated）');
        return;
      }
      await updateGeneratedContract(row.id, { approval_id: ap.id }, userId);
      const fresh = await getGeneratedContract(row.id);
      if (fresh) setView({ name: 'gen_detail', row: fresh });
    } catch (e: unknown) {
      setErr((e as Error)?.message || '发起审批失败');
    }
  };

  const applySealDemo = async (row: GeneratedContract) => {
    const name = user?.real_name || user?.username || '审批人';
    const stamp = `${name}  ${new Date().toLocaleString('zh-CN')}`;
    setErr(null);
    try {
      await updateGeneratedContract(
        row.id,
        {
          seal_annotation: stamp,
          status: 'sealed',
          sealed_pdf_storage_path: row.merged_pdf_storage_path
        },
        userId
      );
      const fresh = await getGeneratedContract(row.id);
      if (fresh) setView({ name: 'gen_detail', row: fresh });
    } catch (e: unknown) {
      setErr((e as Error)?.message || '更新签章信息失败');
    }
  };

  const handleUploadGeneratedContractDocx = async (row: GeneratedContract, file: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.docx')) {
      setErr('请上传 .docx 格式的 Word 文件');
      return;
    }
    setGenDocxBusy(true);
    setErr(null);
    try {
      const path = `contract-generated/${row.id}/contract-${Date.now()}.docx`;
      await uploadFileToStorage(path, file);
      await updateGeneratedContract(row.id, { generated_docx_storage_path: path }, userId);
      const fresh = await getGeneratedContract(row.id);
      if (fresh) setView({ name: 'gen_detail', row: fresh });
    } catch (e: unknown) {
      setErr((e as Error)?.message || '上传 Word 失败');
    } finally {
      setGenDocxBusy(false);
    }
  };

  const handleConvertGeneratedContractPdf = async (row: GeneratedContract) => {
    const src = row.generated_docx_storage_path;
    if (!src || !src.toLowerCase().endsWith('.docx')) {
      setErr('请先有 Word 合同文件（自动生成或上传）后再导出 PDF');
      return;
    }
    setGenPdfBusy(true);
    setErr(null);
    try {
      const outPath = `contract-generated/${row.id}/contract-${Date.now()}.pdf`;
      await convertStorageDocxToPdf(src, outPath);
      await updateGeneratedContract(row.id, { merged_pdf_storage_path: outPath }, userId);
      const fresh = await getGeneratedContract(row.id);
      if (fresh) setView({ name: 'gen_detail', row: fresh });
    } catch (e: unknown) {
      setErr((e as Error)?.message || '生成 PDF 失败（请确认已部署转换服务）');
    } finally {
      setGenPdfBusy(false);
    }
  };

  const handleSaveGeneratedContractFinal = async (row: GeneratedContract) => {
    if (!row.generated_docx_storage_path) {
      setErr('请先完成 Word 合同文件（自动生成或上传修订版）');
      return;
    }
    setErr(null);
    try {
      await updateGeneratedContract(row.id, { status: 'contract_final' }, userId);
      const fresh = await getGeneratedContract(row.id);
      if (fresh) setView({ name: 'gen_detail', row: fresh });
    } catch (e: unknown) {
      setErr((e as Error)?.message || '保存失败');
    }
  };

  const confirmSoftDeleteRun = async () => {
    if (!softDeleteModalRow) return;
    if (!userId) {
      setErr('请先登录');
      return;
    }
    setSoftDeleteBusy(true);
    setErr(null);
    try {
      await softDeleteGeneratedContract({
        id: softDeleteModalRow.id,
        userId,
        ...(softDeleteReasonDraft.trim() ? { deleteReason: softDeleteReasonDraft.trim() } : {})
      });
      setSoftDeleteModalRow(null);
      setSoftDeleteReasonDraft('');
      setToast('合同已移入回收站');
      await loadMy();
    } catch (e: unknown) {
      setErr(errorMessageFromUnknown(e, '移入回收站失败'));
    } finally {
      setSoftDeleteBusy(false);
    }
  };

  const restoreOneTrash = async (id: string) => {
    setTrashActionBusy(true);
    setErr(null);
    try {
      await restoreGeneratedContractFromTrash(id, userId);
      setToast('已恢复至主列表');
      await loadTrash();
      await loadMy();
    } catch (e: unknown) {
      setErr(errorMessageFromUnknown(e, '恢复失败'));
    } finally {
      setTrashActionBusy(false);
    }
  };

  const batchRestoreTrash = async () => {
    const ids = [...trashSelected];
    if (!ids.length) return;
    if (!userId) {
      setErr('请先登录');
      return;
    }
    setTrashActionBusy(true);
    setErr(null);
    try {
      for (const id of ids) {
        await restoreGeneratedContractFromTrash(id, userId);
      }
      setTrashSelected(new Set());
      setToast(`已批量恢复 ${ids.length} 条`);
      await loadTrash();
      await loadMy();
    } catch (e: unknown) {
      setErr(errorMessageFromUnknown(e, '批量恢复失败'));
    } finally {
      setTrashActionBusy(false);
    }
  };

  const runPermanentDelete = async (ids: string[]) => {
    if (!isSuperAdmin) {
      setErr('仅超级管理员可彻底删除');
      return;
    }
    setPermaBusy(true);
    setErr(null);
    try {
      for (const id of ids) {
        await permanentlyDeleteGeneratedContract(id);
      }
      setPermaConfirm(null);
      setTrashSelected(new Set());
      setToast(`已永久删除 ${ids.length} 条`);
      await loadTrash();
      await loadMy();
      if (view.name === 'gen_detail' && ids.includes(view.row.id)) {
        setGenDetailFromTrash(false);
        navigate('/contract/templates/my-generated/trash');
        setView({ name: 'my_trash' });
      }
    } catch (e: unknown) {
      setErr(errorMessageFromUnknown(e, '彻底删除失败（请确认当前账号为超级管理员且数据库迁移已部署）'));
    } finally {
      setPermaBusy(false);
    }
  };

  const renderHub = () => {
    const pathLabelForTemplate = (tpl: ContractTemplate) =>
    categoryTrailForLeaf(cats, tpl.category_leaf_id).
    map((c) => c.name).
    join(' / ') || '—';
    const totalPages = Math.max(1, Math.ceil(hubTotal / hubPageSize));

    return (
      <div
        className={`transition-opacity duration-150 ease-out ${hubLoading ? 'opacity-70' : 'opacity-100'}`}>
        {/* 模板库只读提示 */}
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50/70 px-4 py-3">
          <h3 className="text-lg font-semibold text-blue-900 mb-1">📋 合同模板库（只读）</h3>
          <p className="text-sm text-blue-800">
            {isSuperAdmin ? 
              "您拥有管理员权限，可以编辑和管理模板。普通用户仅可查看和使用模板。" : 
              "您当前为普通用户权限，模板库为只读状态，不可修改模板内容。"
            }
          </p>
        </div>
        
        <ContractTemplateFilters
          filterL1={filterL1}
          filterL2={filterL2}
          hubSearch={hubSearch}
          hubSortField={hubSortField}
          hubSortAsc={hubSortAsc}
          hubShowTrash={hubShowTrash}
          hubFilterL1Options={hubFilterL1Options}
          hubFilterL2Options={hubFilterL2Options}
          hubSortComboOptions={hubSortComboOptions}
          isSuperAdmin={isSuperAdmin}
          hasActiveFilters={Boolean(filterL1 || filterL2 || hubSearch.trim())}
          onFilterL1Change={(v) => setFilterL1(v)}
          onFilterL2Change={(v) => setFilterL2(v)}
          onSearchChange={(v) => setHubSearch(v)}
          onSortChange={(field, asc) => {
            setHubSortField(field as TemplateLibrarySortField);
            setHubSortAsc(asc);
          }}
          onShowTrashChange={(v) => setHubShowTrash(v)}
          onClearFilters={() => {
            setFilterL1('');
            setFilterL2('');
            setHubSearch('');
            setHubPage(0);
          }}
          onNewTemplate={() => {
            setModalFilterL1('');
            setModalFilterL2('');
            setNewTplLeafId('');
            setNewTplTitle('');
            setNewTplDescription('');
            setNewTplModalOpen(true);
          }}
          onManageCategories={() => {
            setAdminParentCatId('');
            setAdminOpen(true);
          }}
          onRefresh={() => void (async () => { await reloadCats(); await loadHub(); })()}
        />
        <p className="text-sm text-gray-600">共 {hubTotal} 个模板</p>

        {loadingCats ? (
              <Skeleton variant="text" rows={3} className="w-48 mx-auto" />
            ) : hubLoading && hubRows.length === 0 ? (
                <div className="py-16 text-center text-gray-500">加载模板列表…</div>
            ) : hubRows.length === 0 ? (
                  <div className="py-16 text-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-gray-600">
            <p className="font-medium text-gray-800">暂无符合条件的模板</p>
            <p className="text-sm mt-2 max-w-md mx-auto">未应用筛选时展示全部模板；请调整一级/二级筛选或搜索关键字，或新建模板。</p>
          </div>
            ) : (
                  <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm w-full">
            <div className="overflow-x-auto w-full">
              <table className="min-w-full text-sm text-left w-full">
                <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-3 w-10" aria-label="展开" />
                    <th className="px-3 py-3 min-w-[140px]">分类路径</th>
                    <th className="px-3 py-3 min-w-[180px]">模板名称</th>
                    <th className="px-3 py-3">状态</th>
                    <th className="px-3 py-3">版本</th>
                    <th className="px-3 py-3 hidden md:table-cell">更新时间</th>
                    <th className="px-3 py-3 text-right min-w-[220px]">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {hubRows.map((t) => {
                            const expanded = expandedTplId === t.id;
                            const gens = expandedGens[t.id] ?? [];
                            return (
                              <Fragment key={t.id}>
                                <tr key={`${t.id}-main`} className="border-t border-gray-100 hover:bg-gray-50/80">
                          <td className="px-3 py-2 align-middle">
                            <button
                                      type="button"
                                      className="text-gray-500 hover:text-blue-700 p-1"
                                      aria-expanded={expanded}
                                      onClick={() => void toggleExpandGenerated(t.id)}>
                                      
                              {expanded ? '▼' : '▶'}
                            </button>
                          </td>
                          <td className="px-3 py-2 text-gray-600 align-middle text-xs md:text-sm">
                            {pathLabelForTemplate(t)}
                          </td>
                          <td className="px-3 py-2 font-medium text-gray-900 align-middle">
                            {t.title}
                            {t.deleted_at ?
                                    <span className="ml-2 inline-flex px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-900 border border-amber-200">
                                回收站
                              </span> :
                                    null}
                          </td>
                          <td className="px-3 py-2 align-middle">
                            <span
                                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(t.status)}`}>
                                      
                              {formatTemplateStatusLabel(t.status)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-600 align-middle">v{t.latest_version}</td>
                          <td className="px-3 py-2 text-gray-500 align-middle hidden md:table-cell">
                            {t.updated_at ? new Date(t.updated_at).toLocaleString('zh-CN') : t.created_at ? new Date(t.created_at).toLocaleString('zh-CN') : '—'}
                          </td>
                          <td className="px-3 py-2 align-middle text-right">
                            <div className="flex flex-wrap justify-end gap-1.5">
                              <button
                                        type="button"
                                        className="px-2 py-1 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-xs"
                                        onClick={() => void openPreviewModal(t)}>
                                        
                                预览
                              </button>
                              {isSuperAdmin && (
                                <button
                                        type="button"
                                        className="px-2 py-1 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-xs"
                                        onClick={() => {
                                          const trail = categoryTrailForLeaf(cats, t.category_leaf_id);
                                          setView({ name: 'tpl_detail', template: t, trail });
                                          navigate(`/contract/templates/edit/${t.id}`);
                                        }}>
                                        
                                编辑
                              </button>
                              )}
                              <button
                                        type="button"
                                        disabled={Boolean(t.deleted_at) || quickGenBusyId === t.id}
                                        title={t.deleted_at ? '请先在详情页将模板移出回收站后再编辑' : undefined}
                                        className="px-2 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                                        onClick={() => void createDraftFromTemplateAndEdit(t)}>
                                        
                                {quickGenBusyId === t.id ? '创建中…' : '用当前模板新建合同'}
                              </button>
                              <button
                                        type="button"
                                        disabled={Boolean(t.deleted_at)}
                                        title={t.deleted_at ? '请先在详情页将模板移出回收站后再生成合同' : undefined}
                                        className="px-2 py-1 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                                        onClick={() =>
                                        void (async () => {
                                          setErr(null);
                                          try {
                                            const vers = await listTemplateVersions(t.id);
                                            if (!vers[0]) {
                                              setErr('请先在「编辑」中上传 .docx 模板版本');
                                              return;
                                            }
                                            const trail = categoryTrailForLeaf(cats, t.category_leaf_id);
                                            setGenForm({
                                              party_a_id: '',
                                              party_b_id: '',
                                              project_id: '',
                                              payment_method_text: '',
                                              vars: {}
                                            });
                                            setView({ name: 'generate', template: t, version: vers[0], trail });
                                          } catch (e: unknown) {
                                            setErr((e as Error)?.message || '无法开始生成');
                                          }
                                        })()
                                        }>
                                        
                                从模板生成合同
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expanded ? (
                                <tr key={`${t.id}-sub`} className="bg-gray-50/90 border-t border-gray-100">
                            <td colSpan={7} className="px-4 py-3">
                              <p className="text-xs font-medium text-gray-700 mb-2">本模板已生成的合同（延迟加载）</p>
                              {expandedGensLoading === t.id ? (
                                <p className="text-sm text-gray-500">加载中…</p>
                              ) : gens.length === 0 ? (
                                <p className="text-sm text-gray-500">尚无生成记录</p>
                              ) : (
                                <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                                  <table className="min-w-full text-xs sm:text-sm">
                                    <thead className="bg-gray-100 text-gray-600">
                                      <tr>
                                        <th className="px-2 py-2 text-left">编号</th>
                                        <th className="px-2 py-2 text-left">状态</th>
                                        <th className="px-2 py-2 text-left">创建时间</th>
                                        <th className="px-2 py-2 text-right">操作</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {gens.map((g) => (
                                        <tr key={g.id} className="border-t border-gray-100">
                                          <td className="px-2 py-2 text-blue-700">{g.contract_no}</td>
                                          <td className="px-2 py-2">
                                            <span className={`inline-flex px-2 py-0.5 rounded text-xs ${statusBadgeClass(g.status)}`}>
                                              {formatGeneratedContractStatusLabel(g.status)}
                                            </span>
                                          </td>
                                          <td className="px-2 py-2 text-gray-500">
                                            {new Date(g.created_at).toLocaleString('zh-CN')}
                                          </td>
                                          <td className="px-2 py-2 text-right space-x-2">
                                            <button
                                              type="button"
                                              className="text-blue-600 hover:underline"
                                              onClick={() => {setPreviewContractId(g.id);setContractPreviewOpen(true);}}
                                            >
                                              在线预览
                                            </button>
                                            {g.merged_pdf_storage_path ? (
                                              <a
                                                className="text-blue-600 hover:underline"
                                                href={publicUrlForStoragePath(g.merged_pdf_storage_path)}
                                                target="_blank"
                                                rel="noreferrer"
                                              >
                                                PDF 下载
                                              </a>
                                            ) : (
                                              <span className="text-gray-400">无 PDF</span>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    )})}
                </tbody>
              </table>
            </div>
          </div>
            )}

        <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
          <SegmentedControl
            value={String(hubPageSize) as '10' | '20' | '50'}
            onChange={(v) => {
              setHubPageSize(Number(v));
              setHubPage(0);
            }}
            options={hubPageSizeSegmentOptions}
            className="w-auto"
            aria-label="每页条数" />
          
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              disabled={hubPage <= 0}
              onClick={() => setHubPage((p) => Math.max(0, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white disabled:opacity-40">
              
              上一页
            </button>
            <span className="text-gray-600">
              {hubPage + 1} / {totalPages}
            </span>
            <button
              type="button"
              disabled={hubPage + 1 >= totalPages}
              onClick={() => setHubPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white disabled:opacity-40">
              
              下一页
            </button>
          </div>
        </div>
      </div>);

  };

  const renderTplDetail = (v: Extract<View, {name: 'tpl_detail';}>) => {
    const trail =
    v.trail.length > 0 ? v.trail : categoryTrailForLeaf(cats, v.template.category_leaf_id);
    return (
      <div>
      <button
          type="button"
          className="text-sm text-blue-700 mb-2 inline-flex items-center gap-1"
          onClick={() => {
            navigate('/contract/templates');
            setView({ name: 'hub' });
          }}>
          
        <FaArrowLeft /> 返回模板列表
      </button>
      <p className="text-xs text-gray-500 mb-2">{trailLabels(trail)}</p>
      
      {/* 管理员编辑警告 */}
      {isSuperAdmin && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-amber-800 font-medium">⚠️ 管理员编辑区</span>
          </div>
          <p className="text-amber-700 mt-1 text-xs">
            此为系统标准模板，修改后将影响所有新项目。普通用户无法编辑此模板，只能查看和用于生成新合同。请谨慎操作！
          </p>
        </div>
      )}
      
      {/* 普通用户只读提示 */}
      {!isSuperAdmin && (
        <div className="mb-4 rounded-lg border border-blue-300 bg-blue-50 px-4 py-3 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-blue-800 font-medium">📄 模板查看（只读）</span>
          </div>
          <p className="text-blue-700 mt-1 text-xs">
            此为系统标准模板，您只能查看和用于生成新合同，无法编辑此模板。如需编辑请联系管理员。
          </p>
        </div>
      )}
      
      {v.template.deleted_at ?
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <span>
            该模板在<strong className="font-semibold px-0.5">回收站</strong>中，常规列表已隐藏；恢复后可继续上传版本与生成合同。
          </span>
          <button
            type="button"
            className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-900 text-white text-sm hover:bg-amber-950"
            onClick={async () => {
              setErr(null);
              try {
                await restoreContractTemplateFromTrash(v.template.id, userId);
                const fresh = await getTemplateById(v.template.id, { includeDeleted: true });
                if (fresh) setView({ ...v, template: fresh });
                void loadHub();
              } catch (e: unknown) {
                setErr((e as Error)?.message || '恢复失败');
              }
            }}>
            
            恢复模板
          </button>
        </div> :
        null}
      <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 mb-4 space-y-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">模板名称</label>
          <input
              className="w-full border rounded-lg px-3 py-2 text-sm font-medium text-gray-900 disabled:bg-gray-100"
              value={metaEditTitle}
              disabled={Boolean(v.template.deleted_at)}
              onChange={(e) => setMetaEditTitle(e.target.value)} />
            
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">说明（可选，参与搜索）</label>
          <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm min-h-[72px] text-gray-800 disabled:bg-gray-100"
              value={metaEditDesc}
              disabled={Boolean(v.template.deleted_at)}
              onChange={(e) => setMetaEditDesc(e.target.value)}
              placeholder="模板用途、适用场景…" />
            
        </div>
        <button
            type="button"
            disabled={metaSaveBusy || !metaEditTitle.trim() || Boolean(v.template.deleted_at)}
            onClick={async () => {
              if (!metaEditTitle.trim()) {
                setErr('模板名称不能为空');
                return;
              }
              setMetaSaveBusy(true);
              setErr(null);
              try {
                await updateTemplateMeta(
                  v.template.id,
                  { title: metaEditTitle.trim(), description: metaEditDesc.trim() || null },
                  userId
                );
                setView({
                  ...v,
                  template: {
                    ...v.template,
                    title: metaEditTitle.trim(),
                    description: metaEditDesc.trim() || null
                  }
                });
                void loadHub();
              } catch (e: unknown) {
                setErr((e as Error)?.message || '保存基本信息失败');
              } finally {
                setMetaSaveBusy(false);
              }
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-800 disabled:opacity-50">
            
          <FaSave /> {metaSaveBusy ? '保存中…' : '保存基本信息'}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <span className="text-sm text-gray-600">发布状态</span>
        <SearchableSelect
            className="max-w-xs"
            value={v.template.status}
            disabled={templateStatusBusy || Boolean(v.template.deleted_at)}
            onChange={(st) => {
              void (async () => {
                const prev = v.template.status;
                const nextStatus = st as ContractTemplate['status'];
                setView({ ...v, template: { ...v.template, status: nextStatus } });
                setTemplateStatusBusy(true);
                setErr(null);
                try {
                  await updateTemplateMeta(v.template.id, { status: nextStatus }, userId);
                  void loadHub();
                } catch (ex: unknown) {
                  setView({ ...v, template: { ...v.template, status: prev } });
                  setErr((ex as Error)?.message || '更新状态失败');
                } finally {
                  setTemplateStatusBusy(false);
                }
              })();
            }}
            options={optionsFromTuples([
            { value: 'draft', label: '草稿' },
            { value: 'published', label: '已发布' },
            { value: 'archived', label: '已归档' }]
            )}
            placeholder="状态"
            searchThreshold={99} />
          
        {templateStatusBusy ? <span className="text-xs text-gray-500">保存中…</span> : null}
      </div>
      {!v.template.deleted_at ?
        <div className="mb-4">
          <button
            type="button"
            className="text-sm text-red-700 px-3 py-2 rounded-lg border border-red-200 bg-white hover:bg-red-50"
            onClick={async () => {
              if (
              !confirm(
                '确认将模板移入回收站？移入后不会在常规列表显示，可在列表勾选「查看回收站」后在此恢复。'
              ))
              {
                return;
              }
              setErr(null);
              try {
                await softDeleteContractTemplate(v.template.id, userId);
                navigate('/contract/templates');
                setView({ name: 'hub' });
                void loadHub();
              } catch (e: unknown) {
                setErr((e as Error)?.message || '移入回收站失败');
              }
            }}>
            
            移入回收站
          </button>
        </div> :
        null}
      <div className="mb-3 max-w-xl">
        <label className="block text-xs text-gray-600 mb-1">新版本说明（可选，上传 Word 时写入版本记录）</label>
        <textarea
            className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-100"
            rows={2}
            value={versionUploadSummary}
            onChange={(e) => setVersionUploadSummary(e.target.value)}
            placeholder="例如：修正付款条款、同步法务评审意见…"
            disabled={uploading || Boolean(v.template.deleted_at)} />
          
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <label
            className={`inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm ${
            v.template.deleted_at || uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`
            }>
            
          <FaUpload /> 上传新版本 .docx
          <input
              type="file"
              accept=".docx"
              className="ui-file-input-overlay" data-file-upload-field="true"
              disabled={uploading || Boolean(v.template.deleted_at)}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                void handleUploadVersion(v.template, f ?? null);
              }} />
            
        </label>
        {versions[0] && !v.template.deleted_at ?
          <button
            type="button"
            onClick={() =>
            setView({
              name: 'generate',
              template: v.template,
              version: versions[0],
              trail
            })
            }
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm">
            
            基于此版本生成合同
          </button> :
          null}
      </div>
      <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 space-y-2">
        <p>
          版式级 PDF、合并、变量回写 docx、身份证图嵌入、document.xml diff、页脚戳记由自建服务完成；仓库内{' '}
          <code className="bg-white/70 px-1 rounded">contract-convert-service</code> +{' '}
          <code className="bg-white/70 px-1 rounded">docker compose up contract-convert</code>
          ，Edge 需配置 <code className="bg-white/70 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code>、
          <code className="bg-white/70 px-1 rounded">DOC_CONVERT_WEBHOOK_URL</code>（或{' '}
          <code className="bg-white/70 px-1 rounded">DOC_CONVERT_SERVICE_BASE_URL</code>
          ）及与容器一致的密钥。具法律效力 CA 仍走厂商。
        </p>
        <button
            type="button"
            className="text-blue-800 underline font-medium"
            onClick={async () => {
              setErr(null);
              setConvertInfo(null);
              try {
                const c = await fetchConvertCapabilities();
                setConvertInfo(JSON.stringify(c, null, 2));
              } catch (e: unknown) {
                setErr(
                  (e as Error)?.message ||
                  '请部署 Edge Function：supabase functions deploy contract-document-convert'
                );
              }
            }}>
            
          查询转换网关（capabilities）
        </button>
        {convertInfo ?
          <pre className="mt-2 max-h-48 overflow-auto text-[11px] bg-white/80 rounded p-2 border border-amber-100 whitespace-pre-wrap">
            {convertInfo}
          </pre> :
          null}
      </div>
      <h3 className="font-medium text-gray-800 mb-2">版本历史</h3>
      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">版本</th>
              <th className="px-3 py-2 text-left">文件</th>
              <th className="px-3 py-2 text-left max-w-[200px]">版本说明</th>
              <th className="px-3 py-2 text-left">变量数</th>
              <th className="px-3 py-2 text-left">时间</th>
              <th className="px-3 py-2 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((ver) =>
              <tr key={ver.id} className="border-t">
                <td className="px-3 py-2">{ver.version}</td>
                <td className="px-3 py-2">{ver.original_filename}</td>
                <td className="px-3 py-2 text-gray-600 text-xs max-w-[200px] align-top break-words">
                  {ver.change_summary || '—'}
                </td>
                <td className="px-3 py-2">{ver.variables_json?.length ?? 0}</td>
                <td className="px-3 py-2 text-gray-500">{new Date(ver.created_at).toLocaleString('zh-CN')}</td>
                <td className="px-3 py-2">
                  <a
                    className="text-blue-600 inline-flex items-center gap-1"
                    href={publicUrlForStoragePath(ver.storage_path)}
                    target="_blank"
                    rel="noreferrer">
                    
                    <FaDownload /> 下载
                  </a>
                  {ver.storage_path.toLowerCase().endsWith('.docx') ?
                  <button
                    type="button"
                    className="ml-3 text-violet-700 disabled:opacity-50"
                    disabled={reparseBusyId === ver.id || Boolean(v.template.deleted_at)}
                    title="从 Storage 重新读取 .docx 并写回变量列表（修复乱码）"
                    onClick={async () => {
                      setReparseBusyId(ver.id);
                      setErr(null);
                      try {
                        const url = publicUrlForStoragePath(ver.storage_path);
                        const res = await fetch(url);
                        if (!res.ok) throw new Error(`无法读取模板文件（HTTP ${res.status}）`);
                        const blob = await res.blob();
                        const file = new File(
                          [blob],
                          ver.original_filename || 'template.docx',
                          {
                            type:
                            blob.type ||
                            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                          }
                        );
                        const vars = await extractVariablesFromDocx(file);
                        await reparseTemplateFileVersionVariables(ver.id, vars);
                        setVersions(await listTemplateVersions(v.template.id));
                        void loadHub();
                      } catch (e: unknown) {
                        setErr((e as Error)?.message || '重新解析变量失败');
                      } finally {
                        setReparseBusyId(null);
                      }
                    }}>
                    
                      {reparseBusyId === ver.id ? '解析中…' : '重新解析变量'}
                    </button> :
                  null}
                  <button
                    type="button"
                    className="ml-3 text-amber-700 disabled:opacity-50"
                    disabled={Boolean(v.template.deleted_at)}
                    title="需部署转换容器并配置 Edge 密钥"
                    onClick={async () => {
                      if (!ver.storage_path.toLowerCase().endsWith('.docx')) {
                        setErr('仅支持从 .docx 转换 PDF');
                        return;
                      }
                      const outPath = `contract-templates/${v.template.id}/v${ver.version}.pdf`;
                      setErr(null);
                      try {
                        await convertStorageDocxToPdf(ver.storage_path, outPath);
                        window.open(publicUrlForStoragePath(outPath), '_blank', 'noopener,noreferrer');
                      } catch (e: unknown) {
                        setErr((e as Error)?.message || 'PDF 转换失败');
                      }
                    }}>
                    
                    转 PDF
                  </button>
                  <button
                    type="button"
                    className="ml-3 text-blue-600 disabled:opacity-50"
                    disabled={Boolean(v.template.deleted_at)}
                    onClick={async () => {
                      if (!confirm(`确认以版本 ${ver.version} 为内容新建版本？`)) return;
                      try {
                        await restoreTemplateVersionFrom(ver.id, userId);
                        await loadVersions(v.template.id);
                      } catch (e: unknown) {
                        setErr((e as Error)?.message || '恢复失败');
                      }
                    }}>
                    
                    恢复为新版本
                  </button>
                  {isSuperAdmin ? (
                    <button
                      type="button"
                      className="ml-3 text-red-600 hover:text-red-800 disabled:opacity-50"
                      disabled={Boolean(v.template.deleted_at) || deleteVersionBusy}
                      onClick={async () => {
                        await handleDeleteVersion(v.template.id, ver.id);
                      }}>
                      <FaTrash className="inline mr-1" />
                      删除当前版本
                    </button>
                  ) : null}
                </td>
              </tr>
              )}
          </tbody>
        </table>
      </div>
      {versions[0]?.variables_json?.length ?
        <div className="mt-4 space-y-3">
          <h4 className="text-sm font-medium text-gray-700">当前最新版本变量</h4>
          <p className="text-[11px] text-amber-800/90">
            列表中的「文本 / 图片」类型会按占位符<strong>实时重算</strong>（含关键字规则）；与库里旧数据不一致时仍以本列表为准。若需把更新后的类型写回数据库，请点击版本行的「重新解析变量」。
          </p>
          <ContractVariableNamingHintBox />
          <ul className="text-xs text-gray-600 list-disc list-inside">
            {hydrateDocxVariableTokens(versions[0].variables_json ?? []).map((x, i) =>
            <li key={i}>
                {x.placeholder} →{' '}
                {x.kind === 'image' ? '图片' : x.kind === 'file' ? '文件' : '文本'} · {x.label}
              </li>
            )}
          </ul>
        </div> :
        null}
    </div>);

  };

  const renderGenerate = (v: Extract<View, {name: 'generate';}>) => {
    const vars = hydrateDocxVariableTokens(v.version.variables_json ?? []);
    const genTrail =
    v.trail.length > 0 ? v.trail : categoryTrailForLeaf(cats, v.template.category_leaf_id);
    return (
      <div>
        <button
          type="button"
          className="text-sm text-blue-700 mb-2 inline-flex items-center gap-1"
          onClick={() => setView({ name: 'tpl_detail', template: v.template, trail: genTrail })}>
          
          <FaArrowLeft /> 返回模板
        </button>
        <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-1">生成合同 · {v.template.title}</h2>
        <p className="text-xs text-gray-500 mb-3">版本 {v.version.version} · 分类：{trailLabels(genTrail)}</p>
        <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-xs text-blue-950 space-y-1.5">
          <p className="font-semibold text-blue-900">生成流程（后台三步）</p>
          <ol className="list-decimal list-inside space-y-0.5 leading-relaxed text-blue-900/90">
            <li>
              <strong>数据校验</strong>：甲方、乙方、付款方式、模板变量必填；名称中含「金额/价款/日期」等字段会做格式检查。
            </li>
            <li>
              <strong>变量替换</strong>：将您填写的内容写入 Word 模板（服务端 docxtpl），占位符如{' '}
              <code className="bg-white/90 px-1 rounded">{'{{甲方}}'}</code> → 实际公司名等。
            </li>
            <li>
              <strong>导出正式文件</strong>：生成标准 <strong>.docx</strong> 并写入存储；在转换服务可用时<strong>同步尝试生成 PDF</strong> 便于预览与打印（版式以 LibreOffice 转换结果为准，复杂排版请以 Word 为准）。
            </li>
          </ol>
          <p className="text-[11px] text-blue-800/90 pt-1 border-t border-blue-200/60 mt-2">
            <strong>原理一句话：</strong>
            上传模板 = 拆成固定版式 + 变量占位；在线填写 = 填表 + 预览；点确定生成 = 校验通过后批量替换变量并导出完整 Word（及可选 PDF）。
          </p>
        </div>
        <details className="mb-4 text-xs text-slate-600 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2">
          <summary className="cursor-pointer select-none font-medium text-slate-700">格式与签章位置说明</summary>
          <p className="mt-2 leading-relaxed text-slate-600">
            变量替换在 <strong>.docx</strong> 二进制内完成，可最大限度保留原模板字体、段落与图片位置；盖章区请仍在 Word
            模板中预留。PDF 由 Word 经转换服务渲染，极端复杂版式可能与 Word 略有差异，定稿前请以 Word 预览或下载核对。
          </p>
        </details>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <PartyASelector
            value={genForm.party_a_id}
            onChange={(id) => setGenForm((f) => ({ ...f, party_a_id: id }))}
            label="甲方" />
          
          <PartyBSelector
            value={genForm.party_b_id}
            onChange={(id) => setGenForm((f) => ({ ...f, party_b_id: id }))}
            label="乙方" />
          
          <div>
            <label className="block text-sm text-gray-600 mb-1">工程名称（项目）</label>
            <SearchableSelect
              value={genForm.project_id}
              onChange={(id) => setGenForm((f) => ({ ...f, project_id: id }))}
              options={genProjectSelectOptions}
              placeholder="不关联"
              searchPlaceholder="搜索项目…" />
            
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">付款方式</label>
            <div className="flex flex-wrap gap-1 mb-1">
              {PAYMENT_PRESETS.map((p) =>
              <button
                key={p.label}
                type="button"
                className="text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50"
                onClick={() => setGenForm((f) => ({ ...f, payment_method_text: p.text }))}>
                
                  {p.label}
                </button>
              )}
            </div>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm min-h-[80px]"
              value={genForm.payment_method_text}
              onChange={(e) => setGenForm((f) => ({ ...f, payment_method_text: e.target.value }))} />
            
          </div>
        </div>
        <h3 className="font-medium text-gray-800 mb-2">变量填充</h3>
        <ContractVariableNamingHintBox />
        <p className="text-xs text-gray-500 mb-2 mt-2">
          图片类占位符：① 变量名命中关键字（见上框「关键字自动识别」）；或② 使用前缀{' '}
          <code className="bg-gray-100 px-1 rounded">{'{{图片:…}}'}</code> / <code className="bg-gray-100 px-1 rounded">{'{{图片：…}}'}</code>。
          支持多图上传与缩略预览；单张不超过 5MB。文件占位为 <code className="bg-gray-100 px-1 rounded">{'{{文件:…}}'}</code> /{' '}
          <code className="bg-gray-100 px-1 rounded">{'{{文件：…}}'}</code>。
        </p>
        <div className="space-y-2 mb-4">
          {vars.map((x, i) =>
          <div key={i}>
              <label className="block text-xs text-gray-600 mb-1">
                {x.placeholder}{' '}
                {x.kind === 'image' && '（图片 → Storage 路径，填充时签名）'}
                {x.kind === 'file' && '（文件上传 → 存储 URL 写入合同）'}
              </label>
              {x.kind === 'image' && (
                  <TemplateVariableImageField
                    templateId={v.template.id}
                    value={genForm.vars[x.placeholder] || ''}
                    onChange={(pathsJson) =>
                    setGenForm((f) => ({
                      ...f,
                      vars: { ...f.vars, [x.placeholder]: pathsJson }
                    }))
                    }
                    onError={(msg) => setErr(msg)} />
              )}
              {x.kind === 'file' && (
                    <div className="flex flex-col gap-1">
                  <input
                        type="file"
                        className="w-full text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (!file) return;
                          setErr(null);
                          try {
                            const cleanFileName = sanitizeStorageFileName(file.name);
                            const path = `contract-templates/uploads/${v.template.id}/${crypto.randomUUID()}_${cleanFileName}`;
                            await uploadFileToStorage(path, file);
                            const url = publicUrlForStoragePath(path);
                            setGenForm((f) => ({ ...f, vars: { ...f.vars, [x.placeholder]: url } }));
                          } catch (ex: unknown) {
                            setErr((ex as Error)?.message || '文件上传失败');
                          }
                        }} />
                      
                  {genForm.vars[x.placeholder] ?
                      <a
                        className="text-xs text-blue-600 break-all hover:underline"
                        href={genForm.vars[x.placeholder]}
                        target="_blank"
                        rel="noreferrer">
                        
                      已上传文件
                    </a> :
                      null}
                </div>
              )}
              {x.kind !== 'image' && x.kind !== 'file' && (
                    <input
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={genForm.vars[x.placeholder] || ''}
                      onChange={(e) =>
                      setGenForm((f) => ({ ...f, vars: { ...f.vars, [x.placeholder]: e.target.value } }))
                      } />
              )}
            </div>
          )}
        </div>
        <p className="text-xs text-blue-900 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mb-3">
          提交并校验通过后，系统将<strong>分配合同编号</strong>、<strong>填充 Word</strong>、在服务可用时<strong>尝试生成 PDF</strong>，并进入合同详情；成功时将<strong>自动打开预览浮层</strong>。
        </p>
        <button
          type="button"
          disabled={genSubmitBusy}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
          onClick={async () => {
            setGenSubmitBusy(true);
            setGenFlowNotice(null);
            setErr(null);
            const tplPath = v.version.storage_path?.trim() ?? '';
            if (!tplPath) {
              setErr('当前模板版本未上传 Word 文件，请先到「模板编辑」上传 .docx 后再生成合同。');
              setGenSubmitBusy(false);
              return;
            }
            if (!tplPath.startsWith('contract-templates/') && !tplPath.startsWith('contract-generated/')) {
              setErr(
                '模板 Word 存储路径无效（须为 contract-templates/… 或 contract-generated/…），请重新上传该版本模板文件。'
              );
              setGenSubmitBusy(false);
              return;
            }
            const validated = validateBeforeGenerateContract({
              form: genForm,
              variables: vars
            });
            if (!validated.ok) {
              setErr(validated.errors.join('\n'));
              setGenSubmitBusy(false);
              return;
            }
            try {
              const row = await createGeneratedContract({
                templateId: v.template.id,
                templateFileVersionId: v.version.id,
                projectId: genForm.project_id || null,
                partyAId: genForm.party_a_id || null,
                partyBId: genForm.party_b_id || null,
                paymentMethodText: genForm.payment_method_text || null,
                variablesValues: genForm.vars,
                userId
              });
              let fillMsg: string | null = null;
              try {
                await runDocxFillAfterGeneratedContract({
                  generatedId: row.id,
                  variables: genForm.vars,
                  userId
                });
              } catch (fe: unknown) {
                fillMsg = (fe as Error)?.message || 'Word 自动填充未成功';
              }
              let finalRow = (await getGeneratedContract(row.id)) ?? row;
              if (fillMsg) {
                setWordFillFailure({ id: finalRow.id, message: fillMsg });
                setErr(
                  appendErrorHint(
                    `合同编号已创建，但 Word 自动填充失败：${fillMsg}\n\n请检查：① Supabase Edge「contract-document-convert」已部署且 Secrets 含 SUPABASE_SERVICE_ROLE_KEY、DOC_CONVERT_SERVICE_BASE_URL（或 WEBHOOK_URL）；② 服务器上 contract-convert 可公网访问；③ 浏览器 Network 中该请求是否 401/502。`
                  )
                );
              } else {
                setWordFillFailure(null);
                setErr(null);
                const docxPath = finalRow.generated_docx_storage_path;
                if (docxPath?.toLowerCase().endsWith('.docx')) {
                  try {
                    const pdfOut = `contract-generated/${finalRow.id}/contract-${Date.now()}.pdf`;
                    await convertStorageDocxToPdf(docxPath, pdfOut);
                    await updateGeneratedContract(finalRow.id, { merged_pdf_storage_path: pdfOut }, userId);
                    finalRow = (await getGeneratedContract(row.id)) ?? finalRow;
                    setGenFlowNotice(
                      '已完成：① 数据校验 ② 模板变量已写入 Word（.docx，保留原排版）③ 已同步生成 PDF 副本，可在详情中切换「PDF」预览或继续修订。'
                    );
                  } catch (pe: unknown) {
                    setGenFlowNotice(
                      `已完成：① 数据校验 ② Word（.docx）已生成并保存。PDF 未自动生成：${(pe as Error)?.message || '转换服务不可用'}。请在详情中点击「生成 / 更新 PDF」重试。`
                    );
                  }
                }
              }
              goGenDetail(finalRow, false);
              if (!fillMsg && finalRow.generated_docx_storage_path) {
                requestAnimationFrame(() => {
                  setPreviewContractId(finalRow.id);
                  setContractPreviewOpen(true);
                });
              }
            } catch (e: unknown) {
              setErr(errorMessageFromUnknown(e, '生成失败'));
            } finally {
              setGenSubmitBusy(false);
            }
          }}>
          
          <FaCheck /> {genSubmitBusy ? '正在生成…' : '确定生成合同'}
        </button>
      </div>);

  };

  const renderMy = () =>
  <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <button
        type="button"
        className="text-sm text-blue-700 inline-flex items-center gap-1"
        onClick={() => {
          navigate('/contract/templates');
          setView({ name: 'hub' });
        }}>
        
          <FaArrowLeft /> 返回分类
        </button>
        <div className="flex flex-wrap gap-2">
          <button
          type="button"
          onClick={() => {
            navigate('/contract/templates/my-generated/trash');
            setView({ name: 'my_trash' });
          }}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-lg border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100">
          
            <FaRecycle /> 回收站
          </button>
          <button
          type="button"
          onClick={exportCsv}
          className="px-3 py-2 text-sm border rounded-lg bg-white"
          disabled={myGenRows.length === 0}
          title={myGenRows.length === 0 ? '无数据可导出' : '导出当前筛选与排序结果'}>
          
            导出 CSV
          </button>
          <button
          type="button"
          onClick={() => void loadMy()}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-lg bg-white"
          disabled={myListLoading}>
          
            <FaSync className={myListLoading ? 'animate-spin' : ''} /> 刷新
          </button>
        </div>
      </div>
      <h2 className="text-lg font-semibold text-gray-800 mb-1">📄 已生成正式合同</h2>
      <p className="text-xs text-gray-500 mb-3">
        共 {myList.length} 条记录
        {myGenRows.length !== myList.length ? ` · 当前筛选后 ${myGenRows.length} 条` : null}
      </p>
      
      {/* 从模板新建按钮 */}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => {
            navigate('/contract/templates');
            setView({ name: 'hub' });
          }}
          className="inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-green-600 text-white hover:bg-green-700 text-sm font-medium shadow-md">
          <FaPlus />
          从模板新建业务合同
        </button>
      </div>

      <div className="flex flex-col lg:flex-row flex-wrap gap-3 mb-4">
        <input
        type="search"
        className="flex-1 min-w-[180px] border border-gray-300 rounded-lg px-3 py-2 text-sm"
        placeholder="搜索：编号、模板名、工程、甲乙方…"
        value={myGenSearch}
        onChange={(e) => setMyGenSearch(e.target.value)} />
      
        <SearchableSelect
        className="min-w-[140px] max-w-[220px]"
        value={myGenStatus}
        onChange={(v) => setMyGenStatus(v)}
        options={myGenStatusFilterOptions}
        placeholder="全部状态"
        searchThreshold={99} />
      
        <SearchableSelect
        className="min-w-[180px] max-w-[280px]"
        value={myGenSort}
        onChange={(v) => setMyGenSort(v)}
        options={myGenSortOptions}
        placeholder="排序"
        searchThreshold={99} />
      
      </div>

      {myListLoading ? (
          <div className="py-16 text-center text-gray-500 border rounded-lg bg-white">加载中…</div>
        ) : myList.length === 0 ? (
            <div className="py-16 text-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-gray-600 px-4">
          <p className="font-medium text-gray-800">尚无由模板生成的合同</p>
          <p className="text-sm mt-2 max-w-md mx-auto">在「模板总览」中选择模板并上传 Word 后，使用「从模板生成合同」即可在此查看。</p>
          <button
                type="button"
                className="mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
                onClick={() => {
                  navigate('/contract/templates');
                  setView({ name: 'hub' });
                }}>
                
            前往模板总览
          </button>
        </div>
        ) : myGenRows.length === 0 ? (
              <div className="py-12 text-center rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-sm">
          没有符合当前关键字或状态的合同，请调整筛选条件。
        </div>
        ) : (
              <div className="overflow-x-auto border rounded-lg bg-white shadow-sm">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 whitespace-nowrap">编号</th>
                <th className="px-3 py-2 min-w-[120px]">模板</th>
                <th className="px-3 py-2 min-w-[100px] hidden lg:table-cell">工程</th>
                <th className="px-3 py-2 min-w-[100px] hidden xl:table-cell">甲方</th>
                <th className="px-3 py-2 min-w-[100px] hidden xl:table-cell">乙方</th>
                <th className="px-3 py-2 whitespace-nowrap">状态</th>
                <th className="px-3 py-2 whitespace-nowrap">文档</th>
                <th className="px-3 py-2 whitespace-nowrap hidden md:table-cell">审批</th>
                <th className="px-3 py-2 whitespace-nowrap hidden sm:table-cell">创建</th>
                <th className="px-3 py-2 text-right min-w-[200px]">操作</th>
              </tr>
            </thead>
            <tbody>
              {myGenRows.map((r) => {
                      const hasDocx = Boolean(r.generated_docx_storage_path);
                      const hasPdf = Boolean(r.merged_pdf_storage_path);
                      return (
                        <tr
                          key={r.id}
                          className="border-t border-gray-100 hover:bg-gray-50/80 cursor-pointer"
                          onClick={() => goGenDetail(r, false)}>
                          
                    <td className="px-3 py-2 font-medium text-blue-700 whitespace-nowrap">{r.contract_no}</td>
                    <td className="px-3 py-2 text-gray-800 max-w-[200px] truncate" title={r.contract_templates?.title}>
                      {r.contract_templates?.title ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-600 max-w-[160px] truncate hidden lg:table-cell" title={r.projects?.name}>
                      {r.projects?.name ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-600 max-w-[140px] truncate hidden xl:table-cell" title={r.party_a?.name ?? ''}>
                      {r.party_a?.name ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-600 max-w-[140px] truncate hidden xl:table-cell" title={partyBDisplayNameFromListRow(r)}>
                      {partyBDisplayNameFromListRow(r)}
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(r.status)}`}>
                              
                        {formatGeneratedContractStatusLabel(r.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <span
                                className={`text-[10px] px-1.5 py-0.5 rounded border ${hasDocx ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                
                          Word
                        </span>
                        <span
                                className={`text-[10px] px-1.5 py-0.5 rounded border ${hasPdf ? 'bg-blue-50 text-blue-800 border-blue-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                
                          PDF
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-600 hidden md:table-cell">
                      {r.approval_id ?
                            <span className="text-emerald-700">已关联</span> :

                            <span className="text-gray-400">未发起</span>
                            }
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap hidden sm:table-cell">
                      {new Date(r.created_at).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <button
                                type="button"
                                className="px-2 py-1 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-xs"
                                onClick={() => {
                                  setPreviewContractId(r.id);
                                  setContractPreviewOpen(true);
                                }}>
                                
                          预览
                        </button>
                        {hasPdf ?
                              <a
                                className="btn-download-pdf"
                                href={publicUrlForStoragePath(r.merged_pdf_storage_path!)}
                                target="_blank"
                                rel="noreferrer">
                                
                            <FaDownload className="text-[10px]" /> PDF
                          </a> :
                              null}
                        <button
                                type="button"
                                className="px-2 py-1 rounded-md bg-gray-900 text-white hover:bg-gray-800 text-xs"
                                onClick={() => goGenDetail(r, false)}>
                                
                          详情
                        </button>
                        <button
                                type="button"
                                className="px-2 py-1 rounded-md border border-red-200 bg-red-50 text-red-800 hover:bg-red-100 text-xs"
                                onClick={() => {
                                  setSoftDeleteModalRow(r);
                                  setSoftDeleteReasonDraft('');
                                }}>
                                
                          <FaTrash className="inline mr-0.5 text-[10px]" aria-hidden />
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
              )})}
            </tbody>
          </table>
        </div>
        )}
    </div>;


  const renderGenerationManagement = () =>
  <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <button
        type="button"
        className="text-sm text-blue-700 inline-flex items-center gap-1"
        onClick={() => {
          navigate('/contract/templates');
          setView({ name: 'hub' });
        }}>
        
          <FaArrowLeft /> 返回分类
        </button>
        <div className="flex flex-wrap gap-2">
          <button
          type="button"
          onClick={() => void loadMy()}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-lg bg-white"
          disabled={myListLoading}>
          
            <FaSync className={myListLoading ? 'animate-spin' : ''} /> 刷新
          </button>
        </div>
      </div>
      <h2 className="text-lg font-semibold text-gray-800 mb-1">合同生成管理</h2>
      <p className="text-xs text-gray-500 mb-3">
        管理所有生成的合同，包括生成任务、模板变量处理和生成任务调度
      </p>

      {/* 这里可以添加合同生成管理的具体内容，比如任务列表、调度信息等 */}
      <div className="py-16 text-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-gray-600 px-4">
        <p className="font-medium text-gray-800">合同生成管理功能正在建设中</p>
        <p className="text-sm mt-2 max-w-md mx-auto">该功能将提供合同生成任务的管理、模板变量处理和生成任务调度功能。</p>
      </div>
    </div>;


  const renderMyTrash = () => {
    const allPageSelected = trashRows.length > 0 && trashRows.every((row) => trashSelected.has(row.id));
    const toggleSelectAllPage = () => {
      setTrashSelected((prev) => {
        const n = new Set(prev);
        if (allPageSelected) {
          for (const row of trashRows) n.delete(row.id);
        } else {
          for (const row of trashRows) n.add(row.id);
        }
        return n;
      });
    };
    const trashTotalPages = Math.max(1, Math.ceil(trashTotal / trashPageSize));

    return (
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <button
            type="button"
            className="text-sm text-blue-700 inline-flex items-center gap-1"
            onClick={() => {
              navigate('/contract/templates/my-generated');
              setView({ name: 'my' });
            }}>
            
            <FaArrowLeft /> 我生成的合同
          </button>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadTrash()}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-lg bg-white"
              disabled={trashLoading || trashActionBusy}>
              
              <FaSync className={trashLoading ? 'animate-spin' : ''} /> 刷新
            </button>
          </div>
        </div>

        <h2 className="text-lg font-semibold text-gray-900 mb-1 flex flex-wrap items-center gap-2">
          <FaRecycle className="text-amber-600 shrink-0" aria-hidden />
          合同回收站
        </h2>
        <p className="text-xs text-amber-900/90 mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 leading-relaxed">
          <strong>回收站</strong>中的合同仍保留原业务状态与附件；「恢复」后回到主列表。彻底删除仅<strong>超级管理员</strong>可用，且不可撤销。可在数据库侧配置定时任务调用{' '}
          <code className="text-[11px] bg-white/80 px-1 rounded">purge_contract_template_generated_trash_older_than(30)</code>{' '}
          自动清理软删除超过 30 天的记录。
        </p>

        {trashSelected.size > 0 ?
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 mb-3 p-3 rounded-lg border border-slate-200 bg-slate-50">
            <span className="text-sm text-slate-800">已选 {trashSelected.size} 条</span>
            <div className="flex flex-wrap gap-2">
              <button
              type="button"
              disabled={trashActionBusy}
              onClick={() => void batchRestoreTrash()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50">
              
                <FaUndo className="text-xs" /> 批量恢复
              </button>
              {isSuperAdmin ?
            <button
              type="button"
              disabled={trashActionBusy}
              onClick={() => setPermaConfirm({ ids: [...trashSelected], typed: '' })}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-300 bg-red-50 text-red-900 text-sm hover:bg-red-100 disabled:opacity-50">
              
                  <FaTrash className="text-xs" /> 批量彻底删除
                </button> :
            null}
            </div>
          </div> :
        null}

        <div className="flex flex-col lg:flex-row flex-wrap gap-3 mb-4">
          <input
            type="search"
            className="flex-1 min-w-[160px] border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="按合同编号筛选…"
            value={trashNoSearch}
            onChange={(e) => setTrashNoSearch(e.target.value)} />
          
          <SearchableSelect
            className="min-w-[200px] max-w-[280px]"
            value={trashSort}
            onChange={(v) => setTrashSort(v as TrashCompositeSort)}
            options={trashSortOptions}
            placeholder="排序"
            searchThreshold={99} />
          
        </div>

        <p className="text-xs text-gray-500 mb-3">
          共 {trashTotal} 条在回收站
          {trashTotalPages > 1 ? ` · 第 ${trashPage + 1} / ${trashTotalPages} 页` : null}
        </p>

        {trashTotalPages > 1 ?
        <div className="flex flex-wrap items-center gap-2 mb-3">
            <button
            type="button"
            className="px-3 py-1.5 text-sm border rounded-lg bg-white disabled:opacity-40"
            disabled={trashPage <= 0 || trashLoading}
            onClick={() => setTrashPage((p) => Math.max(0, p - 1))}>
            
              上一页
            </button>
            <button
            type="button"
            className="px-3 py-1.5 text-sm border rounded-lg bg-white disabled:opacity-40"
            disabled={trashPage + 1 >= trashTotalPages || trashLoading}
            onClick={() => setTrashPage((p) => p + 1)}>
            
              下一页
            </button>
          </div> :
        null}

        {trashLoading ? (
              <div className="py-16 text-center text-gray-500 border rounded-lg bg-white">加载中…</div>
            ) : trashTotal === 0 ? (
                <div className="py-16 text-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-gray-600 px-4">
            <p className="font-medium text-gray-800">回收站为空</p>
            <p className="text-sm mt-2">在「我生成的合同」列表中删除的合同会出现在这里。</p>
          </div>
            ) : (

                <div className="overflow-x-auto border rounded-lg bg-white shadow-sm">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-amber-50/80 text-gray-700 border-b border-amber-100">
                <tr>
                  <th className="px-2 py-2 w-10">
                    <input
                            type="checkbox"
                            className="rounded border-gray-300"
                            checked={allPageSelected}
                            onChange={toggleSelectAllPage}
                            aria-label="全选本页" />
                          
                  </th>
                  <th className="px-3 py-2 whitespace-nowrap">编号</th>
                  <th className="px-3 py-2 min-w-[100px]">模板</th>
                  <th className="px-3 py-2 whitespace-nowrap">状态</th>
                  <th className="px-3 py-2 whitespace-nowrap hidden sm:table-cell">删除时间</th>
                  <th className="px-3 py-2 min-w-[120px] hidden md:table-cell">删除原因</th>
                  <th className="px-3 py-2 text-right min-w-[200px]">操作</th>
                </tr>
              </thead>
              <tbody>
                {trashRows.map((row) => {
                        const checked = trashSelected.has(row.id);
                        return (
                          <tr
                            key={row.id}
                            className="border-t border-amber-100/80 hover:bg-amber-50/40 cursor-pointer"
                            onClick={() => goGenDetail(row, true)}>
                            
                      <td className="px-2 py-2 align-middle" onClick={(e) => e.stopPropagation()}>
                        <input
                                type="checkbox"
                                className="rounded border-gray-300"
                                checked={checked}
                                onChange={() => {
                                  setTrashSelected((prev) => {
                                    const n = new Set(prev);
                                    if (n.has(row.id)) n.delete(row.id);else
                                    n.add(row.id);
                                    return n;
                                  });
                                }}
                                aria-label={`选择 ${row.contract_no}`} />
                              
                      </td>
                      <td className="px-3 py-2 font-medium text-amber-950 whitespace-nowrap">
                        {row.contract_no}
                        <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-200 text-amber-950">已删除</span>
                      </td>
                      <td className="px-3 py-2 text-gray-800 max-w-[180px] truncate" title={row.contract_templates?.title}>
                        {row.contract_templates?.title ?? '—'}
                      </td>
                      <td className="px-3 py-2">
                        <span
                                className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(row.status)}`}>
                                
                          {formatGeneratedContractStatusLabel(row.status)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap hidden sm:table-cell">
                        {row.deleted_at ? new Date(row.deleted_at).toLocaleString('zh-CN') : '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-600 text-xs max-w-[200px] truncate hidden md:table-cell" title={row.delete_reason ?? ''}>
                        {row.delete_reason?.trim() ? row.delete_reason : '—'}
                      </td>
                      <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <button
                                  type="button"
                                  disabled={trashActionBusy}
                                  className="px-2 py-1 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 text-xs disabled:opacity-50"
                                  onClick={() => void restoreOneTrash(row.id)}>
                                  
                            <FaUndo className="inline mr-0.5 text-[10px]" /> 恢复
                          </button>
                          {isSuperAdmin ?
                                <button
                                  type="button"
                                  disabled={trashActionBusy}
                                  className="btn-action-danger disabled:opacity-50"
                                  onClick={() => setPermaConfirm({ ids: [row.id], typed: '' })}>
                                  
                              彻底删除
                            </button> :

                                <span className="text-[10px] text-gray-400 self-center">彻底删除限超管</span>
                                }
                        </div>
                      </td>
                    </tr>
                        )})}
              </tbody>
            </table>
          </div>
            )}
      </div>);

  };

  const renderGenDetail = (v: Extract<View, {name: 'gen_detail';}>) => {
    const r = v.row;
    return (
      <div>
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            type="button"
            className="text-sm text-blue-700 inline-flex items-center gap-1"
            onClick={() => {
              if (genDetailFromTrash) {
                navigate('/contract/templates/my-generated/trash');
                setView({ name: 'my_trash' });
              } else {
                navigate('/contract/templates/my-generated');
                setView({ name: 'my' });
              }
            }}>
            
            <FaArrowLeft /> {genDetailFromTrash ? '回收站' : '我生成的合同'}
          </button>
          <button
            type="button"
            className="text-sm text-gray-600 inline-flex items-center gap-1"
            onClick={() => {
              navigate('/contract/templates');
              setView({ name: 'hub' });
            }}>
            
            模板总览
          </button>
        </div>
        <h2 className="text-xl font-semibold text-gray-900">{r.contract_no}</h2>
        <p className="text-sm text-gray-500 mb-2">
          状态：
          <span className={`inline-flex ml-1 px-2 py-0.5 rounded text-xs ${statusBadgeClass(r.status)}`}>
            {r.status === 'contract_final' ?
            '已保存为合同（Word 定稿）' :
            formatGeneratedContractStatusLabel(r.status)}
          </span>
        </p>
        <p className="text-xs text-gray-500 mb-4">
          创建：{new Date(r.created_at).toLocaleString('zh-CN')}
        </p>

        {r.deleted_at ?
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm space-y-2">
            <p className="font-semibold flex flex-wrap items-center gap-2">
              <FaRecycle className="shrink-0" aria-hidden />
              本合同在回收站中（删除时间：{new Date(r.deleted_at).toLocaleString('zh-CN')}）
            </p>
            {r.delete_reason?.trim() ?
          <p className="text-xs">
                <span className="font-medium">删除说明：</span>
                {r.delete_reason}
              </p> :
          null}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
              type="button"
              disabled={trashActionBusy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
              onClick={async () => {
                await restoreOneTrash(r.id);
                const fresh = await getGeneratedContract(r.id);
                if (fresh && !fresh.deleted_at) {
                  setGenDetailFromTrash(false);
                  goGenDetail(fresh, false);
                } else {
                  navigate('/contract/templates/my-generated');
                  setView({ name: 'my' });
                }
              }}>
              
                <FaUndo className="text-xs" /> 恢复至主列表
              </button>
              {isSuperAdmin ?
            <button
              type="button"
              disabled={trashActionBusy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-300 bg-red-50 text-red-900 text-sm hover:bg-red-100 disabled:opacity-50"
              onClick={() => setPermaConfirm({ ids: [r.id], typed: '' })}>
              
                  彻底删除
                </button> :
            null}
            </div>
          </div> :
        null}

        {!r.deleted_at && !r.generated_docx_storage_path ?
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm">
            <p className="font-semibold text-amber-900">尚未生成填充后的 Word 文件</p>
            <p className="mt-1 text-xs text-amber-900/90 leading-relaxed">
              数据库中已有合同编号与变量快照，但 <code className="bg-white/80 px-1 rounded text-[11px]">generated_docx_storage_path</code>{' '}
              仍为空，通常表示 <strong>fill_docx</strong> 未成功（Edge / 自建转换服务 / 网络）。请查看页面顶部红色错误区，或点击下方重试。
            </p>
            {wordFillFailure?.id === r.id ?
          <pre className="mt-2 max-h-32 overflow-auto rounded bg-white/70 border border-amber-200/80 p-2 text-[11px] text-amber-950 whitespace-pre-wrap break-words font-sans">
                {wordFillFailure.message}
              </pre> :
          null}
            <button
            type="button"
            disabled={retryFillBusy}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-700 text-white text-sm hover:bg-amber-800 disabled:opacity-50"
            onClick={async () => {
              if (!userId) {
                setErr('请先登录后再重试 Word 填充');
                return;
              }
              setRetryFillBusy(true);
              setErr(null);
              try {
                await runDocxFillAfterGeneratedContract({
                  generatedId: r.id,
                  variables: r.variables_values || {},
                  userId
                });
                const fresh = await getGeneratedContract(r.id);
                if (fresh) {
                  setWordFillFailure(null);
                  setView({ name: 'gen_detail', row: fresh });
                  if (fresh.generated_docx_storage_path) {
                    setPreviewContractId(fresh.id);
                    setContractPreviewOpen(true);
                  }
                }
              } catch (e: unknown) {
                const msg = (e as Error)?.message || '重试失败';
                setWordFillFailure({ id: r.id, message: msg });
                setErr(appendErrorHint(msg));
              } finally {
                setRetryFillBusy(false);
              }
            }}>
            
              {retryFillBusy ? '正在重试填充…' : '重新执行 Word 填充'}
            </button>
          </div> :
        null}

        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/40 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800 flex items-center gap-2">
              <FaInfoCircle className="text-blue-600 shrink-0" aria-hidden />
              生成结果预览
            </p>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              在浮层中查看 Word 填充效果、修订与 PDF；与下方工作台数据一致。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 shadow-sm"
              onClick={() => {
                setPreviewContractId(r.id);
                setContractPreviewOpen(true);
              }}>
              
              打开预览浮层
            </button>
            {r.generated_docx_storage_path ?
            <a
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 hover:bg-slate-50"
              href={publicUrlForStoragePath(r.generated_docx_storage_path)}
              target="_blank"
              rel="noreferrer">
              
                <FaDownload className="text-xs" /> 下载 Word
              </a> :
            null}
          </div>
        </div>

        {!r.deleted_at ?
        <>
            <GeneratedContractRichWorkspace
            key={r.id + (r.updated_at || '')}
            row={r}
            userId={userId}
            genDocxBusy={genDocxBusy}
            onSaveRevision={async (html) => {
              setErr(null);
              try {
                await saveGeneratedRichTextRevision({
                  generatedId: r.id,
                  html,
                  userId
                });
                await loadRevisions(r.id);
                const fresh = await getGeneratedContract(r.id);
                if (fresh) setView({ name: 'gen_detail', row: fresh });
              } catch (e: unknown) {
                setErr((e as Error)?.message || '保存修订失败');
              }
            }}
            onUploadDocx={async (f) => {
              await handleUploadGeneratedContractDocx(r, f);
            }} />
          

            <div className="flex flex-wrap gap-2 mt-4 mb-4 items-center">
              <button
              type="button"
              onClick={() => void handleSaveGeneratedContractFinal(r)}
              className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-800">
              
                <FaSave className="inline mr-1" />
                保存为合同（定稿）
              </button>
              <button
              type="button"
              disabled={genPdfBusy}
              onClick={() => void handleConvertGeneratedContractPdf(r)}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50">
              
                {genPdfBusy ? '正在生成 PDF…' : '生成 / 更新 PDF'}
              </button>
              {r.merged_pdf_storage_path ?
            <a
              className="px-4 py-2 rounded-lg border border-blue-200 text-blue-800 text-sm hover:bg-blue-50 inline-flex items-center gap-2"
              href={publicUrlForStoragePath(r.merged_pdf_storage_path)}
              target="_blank"
              rel="noreferrer">
              
                  <FaDownload /> 下载 PDF
                </a> :
            null}
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <button
              type="button"
              onClick={() => startApproval(r)}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm">
              
                发起审批
              </button>
              <button
              type="button"
              onClick={() => applySealDemo(r)}
              className="px-4 py-2 rounded-lg border text-sm">
              
                模拟签章（写入审批人+时间）
              </button>
            </div>
          </> :

        <p className="my-4 text-sm text-gray-600 border border-gray-200 rounded-lg px-4 py-3 bg-gray-50">
            回收站中不可在线编辑、定稿或发起审批；请先使用上方「恢复至主列表」。
          </p>
        }

        {r.seal_annotation ?
        <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded px-3 py-2 mb-4">
            签章信息：{r.seal_annotation}
          </p> :
        null}
        <h3 className="font-medium text-gray-800 mt-2 mb-2">修订历史</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          {revisions.map((rv) =>
          <li key={rv.id}>
              第 {rv.revision} 版 · {new Date(rv.created_at).toLocaleString('zh-CN')}
            </li>
          )}
        </ul>
      </div>);

  };

  const renderAdmin = () => {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAdminOpen(false)}>
        <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-lg font-semibold mb-4">新增二级分类</h3>
          <p className="text-xs text-gray-500 mb-3">一级 8 类不可增删；请在对应父级下添加名称。</p>
          <label className="block text-sm text-gray-600 mb-1">父级分类</label>
          <SearchableSelect
            className="mb-3"
            value={adminParentCatId}
            onChange={(v) => setAdminParentCatId(v)}
            options={adminParentCatOptions}
            placeholder="选择父级…"
            searchPlaceholder="搜索父级…" />
          
          <label className="block text-sm text-gray-600 mb-1">新分类名称</label>
          <input
            className="w-full border rounded-lg px-3 py-2 mb-4"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)} />
          
          <div className="flex justify-end gap-2">
            <button type="button" className="px-4 py-2 border rounded-lg" onClick={() => setAdminOpen(false)}>
              关闭
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg"
              onClick={async () => {
                const pid = adminParentCatId;
                if (!pid || !newCatName.trim()) {
                  setErr('请选择父级并填写名称');
                  return;
                }
                setErr(null);
                try {
                  await insertCategory({ parent_id: pid, name: newCatName.trim() });
                  setNewCatName('');
                  setAdminParentCatId('');
                  setAdminOpen(false);
                  await reloadCats();
                  await loadHub();
                } catch (e: unknown) {
                  setErr((e as Error)?.message || '添加失败');
                }
              }}>
              
              添加
            </button>
          </div>
        </div>
      </div>);

  };

  return (
    <div className="p-4 sm:p-5 md:p-6 w-full min-w-0 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
        <div className="p-3 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-50 text-blue-800 shrink-0 self-start">
          <FaLayerGroup className="w-8 h-8" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">合同模板管理</h1>
          <p className="text-gray-600 text-sm mt-1 leading-relaxed">
            标准化分类、Word 模板与版本、变量填充、生成编号、在线修订与审批衔接。
          </p>
          <details className="mt-2 text-xs text-slate-600 max-w-3xl group">
            <summary className="cursor-pointer select-none inline-flex items-center gap-1.5 text-indigo-700 font-medium list-none [&::-webkit-details-marker]:hidden">
              <FaInfoCircle className="shrink-0" aria-hidden />
              Word 模板原理（上传 → 填表 → 生成）
            </summary>
            <div className="mt-2 space-y-3 rounded-lg border border-indigo-100 bg-indigo-50/40 px-3 py-3 text-slate-800 leading-relaxed">
              <section>
                <p className="font-semibold text-slate-900">第一步：把 Word 模板上传到模板库后，后台在做什么</p>
                <ul className="list-disc pl-4 mt-1.5 space-y-1">
                  <li>
                    读取 <strong>.docx</strong> 内正文（<code className="bg-white/80 px-1 rounded">word/document.xml</code>
                    等），按段落顺序还原文字流，尽量保留您在 Word 里看到的<strong>字体、段落、排版</strong>（整份文件原样存入对象存储）。
                  </li>
                  <li>
                    自动识别所有 <code className="bg-white/80 px-1 rounded">{'{{xxx}}'}</code> 占位符，生成<strong>可填写变量列表</strong>：变量名若包含正面、反面、营业执照、身份证、清单、开户许可、证书、证等关键字之一（模糊包含），归类为<strong>图片</strong>；另支持前缀{' '}
                    <code className="bg-white/80 px-1 rounded">{'{{图片:字段}}'}</code> / <code className="bg-white/80 px-1 rounded">{'{{图片：字段}}'}</code>、
                    <code className="bg-white/80 px-1 rounded">{'{{文件:字段}}'}</code> / <code className="bg-white/80 px-1 rounded">{'{{文件：字段}}'}</code>{' '}
                    识别为图片 / 文件。占位符内请勿使用半角冒号「:」（「图片:」「文件:」前缀除外），详见「变量名规范」提示框。
                  </li>
                  <li>
                    概念上可把一份模板看成两块：<strong>固定条款与版式</strong>（标题、条款、换行等，随 .docx 一起保存）与{' '}
                    <strong>动态变量位</strong>（甲方、金额、日期等，每次生成时替换）。系统里对应的是「整份模板文件 + 变量元数据」，而不是两份独立 Word。
                  </li>
                  <li>此时模板已从「普通 Word」升级为可在系统里<strong>按变量批量填充</strong>的智能模板。</li>
                </ul>
              </section>
              <section>
                <p className="font-semibold text-slate-900">第二步：在软件里「从模板生成合同」</p>
                <ul className="list-disc pl-4 mt-1.5 space-y-1">
                  <li>
                    <strong>您看到的界面</strong>：本页为<strong>表单区</strong>（甲方/乙方/付款方式 + 各变量输入框）。可在模板详情中打开「整文
                    Word 预览」对照条款；生成并保存后，在合同详情 / 预览浮层中用与模板相同的渲染方式查看<strong>已填充</strong>的 .docx。
                  </li>
                  <li>
                    <strong>与「左表右文、每敲一字立刻改合同」的差异</strong>：本系统不在浏览器里对整份 Word 做逐键实时重排；您先完成表单，点击「确定生成合同」后，由<strong>服务端</strong>在
                    .docx 内做<strong>全局占位符替换</strong>（docxtpl），再生成可下载的正式文件。这样更接近 Word 的版式稳定性。
                  </li>
                </ul>
              </section>
              <section>
                <p className="font-semibold text-slate-900">第三步：填完所有项后，点击「生成合同」</p>
                <ol className="list-decimal pl-4 mt-1.5 space-y-1">
                  <li>
                    <strong>校验</strong>：检查必填项、金额/日期等格式（见本页上方「生成流程」说明）。
                  </li>
                  <li>
                    <strong>变量替换</strong>：将您填写的值写入模板，例如 <code className="bg-white/80 px-1 rounded">{'{{甲方}}'}</code> →
                    实际公司名、<code className="bg-white/80 px-1 rounded">{'{{金额}}'}</code> → 数字文本等。
                  </li>
                  <li>
                    <strong>导出正式文件</strong>：合成<strong>无占位符</strong>的完整 <strong>.docx</strong>；在转换服务可用时另存{' '}
                    <strong>PDF</strong> 便于预览与打印（复杂版式请以 Word 或下载文件为准）。
                  </li>
                </ol>
              </section>
              <p className="pt-2 border-t border-indigo-200/60 text-[11px] text-slate-700">
                <strong>极简总结：</strong>
                模板用 <code className="bg-white/80 px-1 rounded">{'{{变量}}'}</code> 留空位 → 上传后解析出变量列表并保存整份 Word →
                生成合同 = 校验 + 批量替换占位符 + 写出正式 .docx（及可选 PDF）。
              </p>
            </div>
          </details>
          <details className="mt-3 text-xs text-slate-600 max-w-3xl group">
            <summary className="cursor-pointer select-none inline-flex items-center gap-1.5 text-blue-700 font-medium list-none [&::-webkit-details-marker]:hidden">
              <FaInfoCircle className="shrink-0" aria-hidden />
              使用说明与部署提示
            </summary>
            <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-2.5 text-slate-700 leading-relaxed">
              <p>
                <strong>流程：</strong>选择分类 → 新建模板 → 在编辑页上传 .docx 版本 →「从模板生成合同」填写变量 → 在详情中预览 / 定稿 / 导出 PDF。
              </p>
              <p>
                <strong>列表筛选：</strong>若启用一级/二级筛选，仅显示该范围内的模板；新建后若未看到新模板，请点模板库中的「清除筛选」或清空关键字。
              </p>
              <p>
                <strong>部署：</strong>更新前端后请执行 <code className="bg-white px-1 rounded">bash scripts/deploy-site.sh</code> 将 <code className="bg-white px-1 rounded">dist</code> 同步到站点根目录，并清理 CDN 缓存后强制刷新。
              </p>
            </div>
          </details>
        </div>
      </div>
      {err ?
      <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 shadow-sm">
          <div className="flex justify-between gap-2 items-start">
            <p className="font-semibold">出错了</p>
            <button
            type="button"
            className="shrink-0 text-red-700 hover:text-red-950 p-1 rounded-md hover:bg-red-100"
            aria-label="关闭错误提示"
            onClick={() => setErr(null)}>
            
              <FaTimes />
            </button>
          </div>
          <pre className="mt-2 text-red-800/95 whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed">{err}</pre>
        </div> :
      null}
      {genFlowNotice ?
      <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 shadow-sm">
          <div className="flex justify-between gap-2 items-start">
            <p className="whitespace-pre-wrap leading-relaxed pr-2">{genFlowNotice}</p>
            <button
            type="button"
            className="shrink-0 text-emerald-800 hover:text-emerald-950 p-1 rounded-md hover:bg-emerald-100"
            aria-label="关闭提示"
            onClick={() => setGenFlowNotice(null)}>
            
              <FaTimes />
            </button>
          </div>
        </div> :
      null}
      <div className="w-full min-w-0 rounded-xl border border-gray-200 bg-white p-4 sm:p-5 md:p-6 shadow-sm flex flex-col">
        {view.name === 'hub' && renderHub()}
        {view.name === 'tpl_detail' && renderTplDetail(view)}
        {view.name === 'generate' && renderGenerate(view)}
        {view.name === 'my' && (
          <MyGeneratedTable
            rows={myList}
            filteredRows={myGenRows}
            loading={myListLoading}
            search={myGenSearch}
            statusFilter={myGenStatus}
            sort={myGenSort}
            statusFilterOptions={myGenStatusFilterOptions}
            sortOptions={myGenSortOptions}
            onSearchChange={(v) => setMyGenSearch(v)}
            onStatusFilterChange={(v) => setMyGenStatus(v)}
            onSortChange={(v) => setMyGenSort(v)}
            onRefresh={() => void loadMy()}
            onNavigateBack={() => {
              navigate('/contract/templates');
              setView({ name: 'hub' });
            }}
            onNavigateTrash={() => {
              navigate('/contract/templates/my-generated/trash');
              setView({ name: 'my_trash' });
            }}
            onNavigateNewFromTemplate={() => {
              navigate('/contract/templates');
              setView({ name: 'hub' });
            }}
            onExportCsv={exportCsv}
            onPreview={(r) => {
              setPreviewContractId(r.id);
              setContractPreviewOpen(true);
            }}
            onViewDetail={(r) => goGenDetail(r, false)}
            onDelete={(r) => {
              setSoftDeleteModalRow(r);
              setSoftDeleteReasonDraft('');
            }}
            buildPublicUrl={publicUrlForStoragePath}
          />
        )}
        {view.name === 'my_trash' && (
          <TrashTable
            rows={trashRows}
            selected={trashSelected}
            loading={trashLoading}
            actionBusy={trashActionBusy}
            total={trashTotal}
            page={trashPage}
            pageSize={trashPageSize}
            sort={trashSort}
            search={trashNoSearch}
            sortOptions={trashSortOptions}
            isSuperAdmin={isSuperAdmin}
            onSelectChange={(s) => setTrashSelected(s)}
            onPageChange={(p) => setTrashPage(p)}
            onSortChange={(v) => setTrashSort(v as TrashCompositeSort)}
            onSearchChange={(v) => setTrashNoSearch(v)}
            onRefresh={() => void loadTrash()}
            onBatchRestore={() => void batchRestoreTrash()}
            onRestoreOne={(id) => void restoreOneTrash(id)}
            onPermanentDelete={(ids) => setPermaConfirm({ ids, typed: '' })}
            onViewDetail={(row) => goGenDetail(row, true)}
            onNavigateBack={() => {
              navigate('/contract/templates/my-generated');
              setView({ name: 'my' });
            }}
          />
        )}
        {view.name === 'gen_detail' && (() => {
          const r = (view as Extract<View, {name: 'gen_detail';}>).row;
          return (
            <GenDetailPanel
              row={r}
              genDetailFromTrash={genDetailFromTrash}
              trashActionBusy={trashActionBusy}
              revisions={revisions}
              wordFillFailure={wordFillFailure}
              retryFillBusy={retryFillBusy}
              userId={userId}
              isSuperAdmin={isSuperAdmin}
              genDocxBusy={genDocxBusy}
              genPdfBusy={genPdfBusy}
              statusBadgeClass={statusBadgeClass}
              formatStatusLabel={formatGeneratedContractStatusLabel}
              buildPublicUrl={publicUrlForStoragePath}
              onNavigateBack={async () => {
                if (genDetailFromTrash) {
                  navigate('/contract/templates/my-generated/trash');
                  setView({ name: 'my_trash' });
                } else {
                  navigate('/contract/templates/my-generated');
                  setView({ name: 'my' });
                }
              }}
              onNavigateToHub={() => {
                navigate('/contract/templates');
                setView({ name: 'hub' });
              }}
              onRestore={async () => {
                await restoreOneTrash(r.id);
                const fresh = await getGeneratedContract(r.id);
                if (fresh && !fresh.deleted_at) {
                  setGenDetailFromTrash(false);
                  goGenDetail(fresh, false);
                } else {
                  navigate('/contract/templates/my-generated');
                  setView({ name: 'my' });
                }
              }}
              onPermanentDelete={() => setPermaConfirm({ ids: [r.id], typed: '' })}
              onRetryFill={async () => {
                if (!userId) {
                  setErr('请先登录后再重试 Word 填充');
                  return;
                }
                setRetryFillBusy(true);
                setErr(null);
                try {
                  const { runDocxFillAfterGeneratedContract } = await import('../../services/contractGenerationService');
                  await runDocxFillAfterGeneratedContract({
                    generatedId: r.id,
                    variables: r.variables_values || {},
                    userId,
                  });
                  const fresh = await getGeneratedContract(r.id);
                  if (fresh) {
                    setWordFillFailure(null);
                    setView({ name: 'gen_detail', row: fresh });
                    if (fresh.generated_docx_storage_path) {
                      setPreviewContractId(fresh.id);
                      setContractPreviewOpen(true);
                    }
                  }
                } catch (e: unknown) {
                  const msg = (e as Error)?.message || '重试失败';
                  setWordFillFailure({ id: r.id, message: msg });
                  setErr(msg + '\n\n建议：缩小筛选范围或稍后再试；若持续超时请联系管理员优化查询。');
                } finally {
                  setRetryFillBusy(false);
                }
              }}
              onPreview={() => {
                setPreviewContractId(r.id);
                setContractPreviewOpen(true);
              }}
              onSaveFinal={() => void handleSaveGeneratedContractFinal(r)}
              onGeneratePdf={() => void handleConvertGeneratedContractPdf(r)}
              onStartApproval={() => void startApproval(r)}
              onApplySeal={() => void applySealDemo(r)}
              onSaveRevision={async (html) => {
                setErr(null);
                try {
                  const { saveGeneratedRichTextRevision } = await import('../../services/contractGenerationService');
                  await saveGeneratedRichTextRevision({ generatedId: r.id, html, userId });
                  await loadRevisions(r.id);
                  const fresh = await getGeneratedContract(r.id);
                  if (fresh) setView({ name: 'gen_detail', row: fresh });
                } catch (e: unknown) {
                  setErr((e as Error)?.message || '保存修订失败');
                }
              }}
              onUploadDocx={async (f) => {
                await handleUploadGeneratedContractDocx(r, f);
              }}
            />
          );
        })()}
        {view.name === 'generation_management' && renderGenerationManagement()}
      </div>
      {toast ?
      <div
        className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 max-w-md w-[min(100%-2rem,28rem)] rounded-lg border border-emerald-300 bg-emerald-950 text-emerald-50 px-4 py-3 text-sm shadow-lg"
        role="status">
        
          {toast}
        </div> :
      null}
      {softDeleteModalRow ?
      <div
        className="fixed inset-0 z-[65] flex items-center justify-center bg-black/50 p-4"
        onClick={() => {
          if (!softDeleteBusy) setSoftDeleteModalRow(null);
        }}>
        
          <div
          className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl"
          onClick={(e) => e.stopPropagation()}>
          
            <h3 className="text-lg font-semibold text-gray-900 mb-1">移入回收站</h3>
            <p className="text-sm text-gray-600 mb-3">
              合同 <strong>{softDeleteModalRow.contract_no}</strong> 将从主列表隐藏，可在「回收站」恢复或（仅超级管理员）彻底删除。
            </p>
            <label className="block text-xs text-gray-500 mb-1">删除原因（可选）</label>
            <textarea
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 min-h-[88px]"
            placeholder="例如：重复创建、信息填写错误…"
            value={softDeleteReasonDraft}
            onChange={(e) => setSoftDeleteReasonDraft(e.target.value)} />
          
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
              type="button"
              className="px-4 py-2 border rounded-lg text-sm"
              disabled={softDeleteBusy}
              onClick={() => setSoftDeleteModalRow(null)}>
              
                取消
              </button>
              <button
              type="button"
              className="px-4 py-2 rounded-lg bg-amber-700 text-white text-sm hover:bg-amber-800 disabled:opacity-50"
              disabled={softDeleteBusy}
              onClick={() => void confirmSoftDeleteRun()}>
              
                {softDeleteBusy ? '处理中…' : '确认移入回收站'}
              </button>
            </div>
          </div>
        </div> :
      null}
      {permaConfirm ?
      <div
        className="fixed inset-0 z-[65] flex items-center justify-center bg-black/50 p-4"
        onClick={() => {
          if (!permaBusy) setPermaConfirm(null);
        }}>
        
          <div
          className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl"
          onClick={(e) => e.stopPropagation()}>
          
            <h3 className="text-lg font-semibold text-red-900 mb-1">彻底删除</h3>
            <p className="text-sm text-gray-700 mb-3">
              将<strong>永久</strong>删除 {permaConfirm.ids.length} 条合同及关联修订与附件，操作不可撤销。请在下方输入「彻底删除」以确认。
            </p>
            <input
            type="text"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4"
            autoComplete="off"
            placeholder="在此输入：彻底删除"
            value={permaConfirm.typed}
            onChange={(e) => setPermaConfirm({ ...permaConfirm, typed: e.target.value })} />
          
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
              type="button"
              className="px-4 py-2 border rounded-lg text-sm"
              disabled={permaBusy}
              onClick={() => setPermaConfirm(null)}>
              
                取消
              </button>
              <button
              type="button"
              className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-40"
              disabled={permaBusy || permaConfirm.typed !== '彻底删除'}
              onClick={() => void runPermanentDelete(permaConfirm.ids)}>
              
                {permaBusy ? '删除中…' : '确认彻底删除'}
              </button>
            </div>
          </div>
        </div> :
      null}
      {previewOpen ?
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={() => setPreviewOpen(null)}>
        
          <div
          className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}>
          
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 truncate pr-2">预览 · {previewOpen.template.title}</h3>
              <button
              type="button"
              className="text-gray-500 hover:text-gray-800 px-2"
              onClick={() => setPreviewOpen(null)}>
              
                ✕
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1 space-y-3">
              {previewLoading ? (
                  <p className="text-gray-500 text-sm">加载版本信息…</p>
                ) : previewOpen.versions[0] ? (
                    <>
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <h4 className="font-medium text-blue-900 mb-2">合同模板预览</h4>
                    <p className="text-xs text-gray-600 mb-3">
                      这是只读的合同模板。要使用此模板，请点击下方按钮创建您自己的合同副本。
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{previewOpen.versions[0].original_filename}</p>
                        <p className="text-xs text-gray-500">版本 v{previewOpen.versions[0].version}</p>
                      </div>
                      <a
                        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5"
                        href={publicUrlForStoragePath(previewOpen.versions[0].storage_path)}
                        target="_blank"
                        rel="noreferrer">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        下载模板
                      </a>
                    </div>
                  </div>
                </>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-gray-600 mb-4">该模板尚无已上传版本。</p>
                {isSuperAdmin && (
                  <p className="text-xs text-gray-500">管理员可以在「编辑」中上传 .docx 文件。</p>
                )}
              </div>
            )}
            </div>
          </div>
        </div> :
      null}
      {newTplModalOpen ?
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 overflow-y-auto"
        onClick={() => setNewTplModalOpen(false)}>
        
          <div
          className="bg-white rounded-2xl max-w-xl w-full max-h-[min(92vh,720px)] shadow-2xl flex flex-col my-auto border border-gray-100"
          onClick={(e) => e.stopPropagation()}>
          
            <div className="px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">新建模板</h3>
              <ol className="mt-3 flex flex-wrap gap-3 text-xs text-gray-600">
                <li className="flex items-center gap-1.5">
                  <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${modalFilterL1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                  
                    1
                  </span>
                  选一级 → 二级（用途）
                </li>
                <li className="flex items-center gap-1.5">
                  <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${newTplTitle.trim() ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                  
                    2
                  </span>
                  填写名称与说明
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-gray-600 text-[11px] font-bold">
                    3
                  </span>
                  创建后在编辑页上传 .docx
                </li>
              </ol>
            </div>
            <div className="px-5 py-4 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col">
                  <label className="block text-xs font-medium text-gray-600 mb-1">一级分类</label>
                  <SearchableSelect
                  value={modalFilterL1}
                  onChange={(v) => {
                    setModalFilterL1(v);
                    setModalFilterL2('');
                    setNewTplLeafId('');
                  }}
                  options={newTplModalL1Options}
                  placeholder="请选择…"
                  searchPlaceholder="搜索一级…"
                  searchThreshold={99} />
                
                </div>
                <div className="flex flex-col">
                  <label className="block text-xs font-medium text-gray-600 mb-1">二级（用途）<span className="text-red-600">*</span></label>
                  <SearchableSelect
                  value={newTplLeafId}
                  disabled={!modalFilterL1}
                  onChange={(v) => {
                    setModalFilterL2(v);
                    setNewTplLeafId(v);
                  }}
                  options={newTplModalL2Options}
                  placeholder="请选择…"
                  searchPlaceholder="搜索二级…"
                  searchThreshold={99} />
                
                </div>
              </div>
              {newTplLeafId ?
            <p className="text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 leading-relaxed">
                  <span className="font-medium">已选路径：</span>
                  {trailLabels(categoryTrailForLeaf(cats, newTplLeafId))}
                </p> :

            <p className="text-xs text-gray-500">请依次选择到二级分类；模板将归入该用途下，便于在列表中筛选。</p>
            }
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">模板名称 <span className="text-red-600">*</span></label>
                <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={newTplTitle}
                onChange={(e) => setNewTplTitle(e.target.value)}
                placeholder="例如：某某专业分包合同（标准版）" />
              
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">说明（可选，参与搜索）</label>
                <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[72px] resize-y"
                value={newTplDescription}
                onChange={(e) => setNewTplDescription(e.target.value)}
                placeholder="用途、适用场景、修订要点…" />
              
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex flex-col-reverse sm:flex-row justify-end gap-2 shrink-0 bg-gray-50/80 rounded-b-2xl">
              <button
              type="button"
              className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white hover:bg-gray-50"
              onClick={() => setNewTplModalOpen(false)}>
              
                取消
              </button>
              <button
              type="button"
              className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm disabled:opacity-50"
              disabled={!newTplLeafId || !newTplTitle.trim()}
              onClick={() => void handleCreateTemplate()}>
              
                创建并进入编辑
              </button>
            </div>
          </div>
        </div> :
      null}
      {adminOpen && renderAdmin()}
      <ContractPreviewModal
        isOpen={contractPreviewOpen}
        onClose={() => setContractPreviewOpen(false)}
        contractId={previewContractId} />
      
    </div>);

}