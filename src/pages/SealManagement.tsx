import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaCheck, FaTrash, FaFile, FaImage, FaDownload, FaEye, FaExclamationTriangle, FaCloudUploadAlt } from 'react-icons/fa';
import { supabase } from '../supabase/client';
import { alertMissingRequiredFields, tryCreateApproval } from '../utils/contractSubPage';
import { useCompanyScope } from '../hooks/useCompanyScope';
import { projectIdsForCompanies } from '../utils/companyProjectScope';
import { getStoredUser, isSuperAdminUser } from '../utils/sessionUser';
import { SearchableSelect, SegmentedControl } from '../components/ui';
import { projectSelectOptions } from '../components/ui/options';

interface SealUsageRecord {
  id: string;
  project_id: string | null;
  seal_type: string | null;
  borrower: string | null;
  borrower_id_card: string | null;
  borrower_id_card_file: string | null;
  borrower_id_card_files: string[] | null;
  borrow_date: string;
  expected_return_date: string | null;
  actual_return_date: string | null;
  purpose: string | null;
  attachment_files: string[] | null;
  status: string;
  created_at: string;
  updated_at: string;
  company_id: string | null;
}

function parseBorrowerIdCards(val: unknown): string[] | null {
  if (!val) return null;
  if (typeof val === 'string') {
    if (val.startsWith('[')) { try { return JSON.parse(val); } catch { return [val]; } }
    return [val];
  }
  if (Array.isArray(val)) return val;
  return null;
}

interface Project { id: string; name: string; }

type TabType = 'apply' | 'project' | 'temp' | 'borrow' | 'history';

function getActiveTabFromPath(pathname: string): TabType {
  if (pathname.includes('/project')) return 'project';
  if (pathname.includes('/temp')) return 'temp';
  if (pathname.includes('/borrow')) return 'borrow';
  if (pathname.includes('/history')) return 'history';
  return 'apply';
}

const sealTypes = [
  { value: '公章', label: '公章' },
  { value: '合同章', label: '合同章' },
  { value: '财务章', label: '财务章' },
  { value: '法人章', label: '法人章' },
  { value: '其他', label: '其他' },
];

const initialForm = {
  usage_type: '项目盖章',
  seal_type: '',
  seal_type_other: '',
  project_id: '',
  usage_reason: '',
  borrower_name: '',
  borrower_id_card_files: [] as string[],
  expected_return_date: '',
  attachment_files: [] as string[],
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const tabTitles: Record<TabType, string> = {
  apply: '用章申请',
  project: '项目盖章情况',
  temp: '临时盖章情况',
  borrow: '印章外借情况',
  history: '历史记录',
};

export default function SealManagement() {
  const { currentCompany, companies, companyIds } = useCompanyScope();
  const location = useLocation();
  const activeTab = getActiveTabFromPath(location.pathname);
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<SealUsageRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [idCardUploading, setIdCardUploading] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const [idCardDragOver, setIdCardDragOver] = useState(false);
  const [attachDragOver, setAttachDragOver] = useState(false);
  const idCardInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSuperAdmin = isSuperAdminUser();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let projectsQuery = supabase.from('projects').select('id, name').order('name');
      if (companyIds.length > 0) {
        projectsQuery = projectsQuery.in('company_id', companyIds);
      }

      const projectIds = companyIds.length > 0 ? await projectIdsForCompanies(companyIds) : null;

      if (activeTab !== 'apply') {
        let recordsQuery = supabase.from('seal_usage_records').select('*').order('id', { ascending: false }).limit(50);
        if (projectIds !== null) {
          if (projectIds.length === 0) {
            const [projectsRes] = await Promise.all([projectsQuery]);
            if (projectsRes.error) console.error('[SealManagement] projects', projectsRes.error);
            else if (projectsRes.data) setProjects(projectsRes.data);
            setRecords([]);
            setLoading(false);
            return;
          }
          recordsQuery = recordsQuery.in('project_id', projectIds);
        }
        const [recordsRes, projectsRes] = await Promise.all([recordsQuery, projectsQuery]);
        if (recordsRes.error) console.error('[SealManagement] seal_usage_records', recordsRes.error);
        else if (recordsRes.data) setRecords(recordsRes.data.map(r => ({ ...r, borrower_id_card_files: parseBorrowerIdCards(r.borrower_id_card_file) })));
        if (projectsRes.error) console.error('[SealManagement] projects', projectsRes.error);
        else if (projectsRes.data) setProjects(projectsRes.data);
      } else {
        const { data, error } = await projectsQuery;
        if (error) console.error('[SealManagement] projects', error);
        else if (data) setProjects(data);
      }
    } catch (e) {
      console.error('[SealManagement] fetchData', e);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [companyIds, activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData, currentCompany, companies]);

  useEffect(() => { void checkOverdueSeals(); }, [records]);

  async function checkOverdueSeals() {
    try {
      if (!overdueRecords.length) return;
      for (const record of overdueRecords) {
        const pid = record.project_id;
        if (!pid || !UUID_RE.test(String(pid))) continue;
        const { data: existing } = await supabase
          .from('warnings')
          .select('id')
          .eq('warning_type', '印章外借超期')
          .eq('project_id', pid)
          .eq('status', 'pending')
          .maybeSingle();
        if (existing) continue;
        await supabase.from('warnings').insert({
          warning_type: '印章外借超期',
          content: `印章外借超期未归还，借章人：${record.borrower || '未知'}`,
          project_id: pid,
          status: 'pending',
        });
      }
    } catch (e) {
      console.error('[SealManagement] checkOverdueSeals', e);
    }
  }

  function getUsageTypeFromPurpose(purpose: string | null): string {
    if (!purpose) return '项目盖章';
    const m = purpose.match(/^\[(.+?)\]\s*/);
    if (m && ['项目盖章', '临时盖章', '印章外借'].includes(m[1])) return m[1];
    return '项目盖章';
  }

  function getUsageReason(purpose: string | null): string {
    if (!purpose) return '';
    return purpose.replace(/^\[(.+?)\]\s*/, '');
  }

  const projectRecords = records.filter(r => getUsageTypeFromPurpose(r.purpose) === '项目盖章');
  const tempRecords = records.filter(r => getUsageTypeFromPurpose(r.purpose) === '临时盖章');
  const borrowRecords = records.filter(r => getUsageTypeFromPurpose(r.purpose) === '印章外借' && r.status === 'borrowed');
  const historyRecords = records.filter(r => getUsageTypeFromPurpose(r.purpose) === '印章外借' && (r.status === 'returned' || r.status === 'rejected'));
  const overdueRecords = borrowRecords.filter(r => r.expected_return_date && new Date(r.expected_return_date) < new Date());

  const openPreview = (url: string) => { setPreviewUrl(url); setShowPreview(true); };

  const handleFileUpload = async (files: File[], isIdCard: boolean) => {
    const maxSize = 10 * 1024 * 1024;
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
    for (const file of files) {
      if (file.size > maxSize) { setErrorMessage(`文件 "${file.name}" 大小不能超过10MB`); setShowError(true); return; }
      if (!allowedTypes.includes(file.type)) { setErrorMessage(`文件 "${file.name}" 格式不支持，仅支持 jpg/png/gif/pdf/doc/docx/xls/xlsx`); setShowError(true); return; }
    }
    if (isIdCard) setIdCardUploading(true); else setFileUploading(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of files) {
        const ext = file.name.split('.').pop();
        const path = `seal_files/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
        const { error } = await supabase.storage.from('files').upload(path, file, { contentType: file.type });
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('files').getPublicUrl(path);
        uploadedUrls.push(publicUrl);
      }
      if (isIdCard) { setForm({ ...form, borrower_id_card_files: [...form.borrower_id_card_files, ...uploadedUrls] }); }
      else { setForm({ ...form, attachment_files: [...form.attachment_files, ...uploadedUrls] }); }
    } catch (err) { setErrorMessage('文件上传失败，请重试'); setShowError(true); }
    if (isIdCard) setIdCardUploading(false); else setFileUploading(false);
  };

  const removeAttachmentFile = (index: number) => { setForm({ ...form, attachment_files: form.attachment_files.filter((_, i) => i !== index) }); };
  const removeIdCard = (index: number) => { setForm({ ...form, borrower_id_card_files: form.borrower_id_card_files.filter((_, i) => i !== index) }); };
  function isImage(url: string) { const ext = url.split('.').pop()?.toLowerCase(); return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || ''); }
  function isOfficeDoc(url: string) { const ext = url.split('.').pop()?.toLowerCase(); return ['doc', 'docx', 'xls', 'xlsx'].includes(ext || ''); }
  function getFileName(url: string) { return url.split('/').pop() || url; }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const missing: string[] = [];
    if (form.usage_type === '项目盖章' && !form.project_id) missing.push('关联项目');
    if (!form.seal_type) missing.push('印章类型');
    if (form.seal_type === '其他' && !form.seal_type_other?.trim()) missing.push('印章类型(其他)');
    if (form.usage_type === '印章外借' && form.borrower_id_card_files.length === 0) missing.push('借章人身份证附件');
    if (form.attachment_files.length === 0) missing.push('盖章文件附件');
    if (form.usage_type === '印章外借' && !form.expected_return_date) missing.push('预计归还日期');
    if (form.usage_type === '印章外借' && !form.borrower_name?.trim()) missing.push('借章人姓名');
    if (alertMissingRequiredFields(missing)) return
    const finalSealType = form.seal_type === '其他' ? form.seal_type_other : form.seal_type;
    const { data, error } = await supabase.from('seal_usage_records').insert({
      seal_type: finalSealType,
      project_id: form.usage_type === '项目盖章' ? form.project_id : null,
      company_id: currentCompany?.id ?? null,
      purpose: `[${form.usage_type}] ${form.usage_reason}`,
      borrower: form.usage_type === '印章外借' ? (form.borrower_name || '') : '',
      borrower_id_card_file: form.borrower_id_card_files.length > 0 ? JSON.stringify(form.borrower_id_card_files) : null,
      borrow_date: new Date().toISOString(),
      expected_return_date: form.expected_return_date ? new Date(form.expected_return_date).toISOString() : null,
      attachment_files: form.attachment_files.length > 0 ? form.attachment_files : null,
      status: 'pending_approval',
    }).select();
    if (error) {
      setErrorMessage('保存失败：' + error.message);
      setShowError(true);
      return;
    }
    // 尝试发起审批
    const user = getStoredUser();
    if (data && data.length > 0 && user.id) {
      try {
        const result = await tryCreateApproval(
          'seal_usage',
          data[0].id,
          `用章申请 - ${form.usage_reason}`,
          { projectId: form.usage_type === '项目盖章' ? form.project_id : undefined },
        );
        if (result === 'error') {
          setErrorMessage('用章申请已保存，但审批提交失败，请联系管理员');
          setShowError(true);
          setForm(initialForm);
          return;
        }
        if (result === true) {
          setSuccessMessage('用章申请已提交并发起审批');
        } else {
          setSuccessMessage('用章申请已提交（未配置审批流程）');
        }
      } catch (e) {
        console.error('[SealManagement] tryCreateApproval', e);
        setErrorMessage('用章申请已保存，但审批提交异常，请联系管理员');
        setShowError(true);
        setForm(initialForm);
        return;
      }
    }
    setForm(initialForm);
    setShowSuccess(true);
  }

  function handleReturnClick(id: string) { setSelectedId(id); setShowConfirm(true); }
  async function confirmReturn() {
    if (!selectedId) return;
    const { error } = await supabase.from('seal_usage_records').update({ status: 'returned', actual_return_date: new Date().toISOString() }).eq('id', selectedId);
    if (error) {
      setErrorMessage('归还失败：' + error.message);
      setShowError(true);
      return;
    }
    setShowConfirm(false); setSelectedId(null);
    fetchData();
  }

  function handleDeleteClick(id: string) { setDeleteTargetId(id); setShowDeleteConfirm(true); }
  async function confirmDelete() {
    if (!deleteTargetId) return;
    const { error } = await supabase.from('seal_usage_records').delete().eq('id', deleteTargetId);
    if (error) {
      setErrorMessage('删除失败：' + error.message);
      setShowError(true);
      return;
    }
    setShowDeleteConfirm(false); setDeleteTargetId(null);
    fetchData();
  }

  function renderFilePreview(url: string, index?: number, isIdCard?: boolean) {
    const fileName = getFileName(url);
    let Icon = FaFile;
    if (isImage(url)) Icon = FaImage;
    else if (isOfficeDoc(url)) Icon = FaFile;
    return (
      <div key={isIdCard ? `idcard-${index}` : index} className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg group">
        <Icon className={isImage(url) ? 'text-blue-400' : isOfficeDoc(url) ? 'text-green-400' : 'text-yellow-400'} />
        <button onClick={() => openPreview(url)} className="text-blue-400 hover:text-blue-300 text-sm flex-1 truncate text-left">{fileName}</button>
        <a href={url} download className="text-green-400 hover:text-green-300"><FaDownload className="w-4 h-4" /></a>
        {index !== undefined && <button onClick={() => (isIdCard ? removeIdCard(index) : removeAttachmentFile(index))} className="text-red-400 hover:text-red-300 ml-1"><FaTrash className="w-3 h-3" /></button>}
      </div>
    );
  }

  function renderTable(data: SealUsageRecord[], showReturnBtn = false) {
    if (data.length === 0) return <div className="text-center text-gray-500 py-8">暂无记录</div>;
    return (
      <table className="w-full">
        <thead><tr className="border-b border-gray-200 text-gray-500 text-sm">
          <th className="text-left py-3 px-4">印章类型</th><th className="text-left py-3 px-4">用印方式</th><th className="text-left py-3 px-4">用印事由</th>
          <th className="text-left py-3 px-4">关联项目</th><th className="text-left py-3 px-4">借章人</th>
          <th className="text-left py-3 px-4">预计归还</th><th className="text-left py-3 px-4">实际归还</th>
          {showReturnBtn && <th className="text-center py-3 px-4">操作</th>}
          {isSuperAdmin && <th className="text-center py-3 px-4">管理</th>}
        </tr></thead>
        <tbody>
          {data.map(r => (
            <tr key={r.id} className="border-b border-gray-200/50 hover:bg-gray-50/30">
              <td className="py-3 px-4 text-gray-800">{r.seal_type || '-'}</td><td className="py-3 px-4 text-gray-800">{getUsageTypeFromPurpose(r.purpose)}</td>
              <td className="py-3 px-4 text-gray-700">{getUsageReason(r.purpose)}</td><td className="py-3 px-4 text-gray-700">{projects.find(p => p.id === r.project_id)?.name || '-'}</td>
              <td className="py-3 px-4 text-gray-700">{r.borrower || '-'}</td>
              <td className="py-3 px-4 text-gray-700">{r.expected_return_date ? new Date(r.expected_return_date).toLocaleString('zh-CN') : '-'}</td>
              <td className="py-3 px-4 text-gray-700">{r.actual_return_date ? new Date(r.actual_return_date).toLocaleString('zh-CN') : '-'}</td>
              {showReturnBtn && <td className="py-3 px-4 text-center"><button onClick={() => handleReturnClick(r.id)} className="px-3 py-1 bg-green-600 hover:bg-green-700 text-gray-800 text-sm rounded flex items-center gap-1 mx-auto"><FaCheck /> 已归还销号</button></td>}
              {isSuperAdmin && <td className="py-3 px-4 text-center"><button onClick={() => handleDeleteClick(r.id)} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-gray-800 text-sm rounded">删除</button></td>}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  function renderProjectTable(data: SealUsageRecord[]) {
    if (data.length === 0) return <div className="text-center text-gray-500 py-8">暂无记录</div>;
    return (
      <table className="w-full">
        <thead><tr className="border-b border-gray-200 text-gray-500 text-sm">
          <th className="text-left py-3 px-4">时间</th><th className="text-left py-3 px-4">关联项目</th>
          <th className="text-left py-3 px-4">印章类型</th><th className="text-left py-3 px-4">盖章内容</th>
          <th className="text-left py-3 px-4">盖章人</th><th className="text-center py-3 px-4">附件</th>
          {isSuperAdmin && <th className="text-center py-3 px-4">管理</th>}
        </tr></thead>
        <tbody>
          {data.map(r => (
            <tr key={r.id} className="border-b border-gray-200/50 hover:bg-gray-50/30">
              <td className="py-3 px-4 text-gray-700">{r.created_at?.slice(0, 10) || '-'}</td>
              <td className="py-3 px-4 text-gray-800">{projects.find(p => p.id === r.project_id)?.name || '-'}</td>
              <td className="py-3 px-4 text-gray-700">{r.seal_type || '-'}</td>
              <td className="py-3 px-4 text-gray-700 max-w-xs truncate">{getUsageReason(r.purpose)}</td>
              <td className="py-3 px-4 text-gray-700">{r.borrower || '-'}</td>
              <td className="py-3 px-4 text-center">
                <div className="flex items-center justify-center gap-1">
                  {r.attachment_files?.map((url, idx) => (
                    <button key={idx} onClick={() => openPreview(url)} className="p-1 text-blue-400 hover:text-blue-300"><FaEye className="w-4 h-4" /></button>
                  ))}
                </div>
              </td>
              {isSuperAdmin && <td className="py-3 px-4 text-center"><button onClick={() => handleDeleteClick(r.id)} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-gray-800 text-sm rounded">删除</button></td>}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  const projectOptionsSeal = useMemo(() => projectSelectOptions(projects, '请选择关联项目'), [projects]);
  const sealTypeSelectOptions = useMemo(
    () => [{ value: '', label: '请选择印章类型' }, ...sealTypes.map(t => ({ value: t.value, label: t.label }))],
    [],
  );

  // ── 通用模态窗：错误提示 ──
  function renderErrorModal() {
    return (
      <AnimatePresence>
        {showError && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowError(false)}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-white rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="text-center">
                <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4"><FaTimes className="w-8 h-8 text-gray-800" /></div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">操作失败</h3>
                <p className="text-gray-700 mb-6">{errorMessage}</p>
                <button onClick={() => setShowError(false)} className="px-6 py-2 bg-blue-600 text-gray-800 rounded-lg">确定</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // ── 通用模态窗：成功提示 ──
  function renderSuccessModal() {
    return (
      <AnimatePresence>
        {showSuccess && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowSuccess(false)}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-white rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="text-center">
                <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4"><FaCheck className="w-8 h-8 text-gray-800" /></div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">操作成功</h3>
                <p className="text-gray-700 mb-6">{successMessage || '操作已完成'}</p>
                <button onClick={() => setShowSuccess(false)} className="px-6 py-2 bg-blue-600 text-gray-800 rounded-lg">确定</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // ── 通用模态窗：预览 ──
  function renderPreviewModal() {
    return (
      <AnimatePresence>
        {showPreview && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-8" onClick={() => setShowPreview(false)}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-white rounded-xl p-4 max-w-4xl max-h-full overflow-auto" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4"><h3 className="text-gray-800 font-medium">附件预览</h3><button onClick={() => setShowPreview(false)} className="text-gray-500 hover:text-gray-800"><FaTimes /></button></div>
              {isImage(previewUrl) ? <img src={previewUrl} alt="preview" className="max-w-full max-h-[70vh] object-contain" /> : isOfficeDoc(previewUrl) ? <iframe src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl)}`} className="w-full max-w-[800px] h-[70vh]" title="preview" /> : <iframe src={previewUrl} className="w-full max-w-[800px] h-[70vh]" title="preview" />}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // ── 通用模态窗：删除确认 ──
  function renderDeleteConfirmModal() {
    return (
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDeleteConfirm(false)}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-white rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-bold text-gray-800 mb-4">确认删除</h3>
              <p className="text-gray-700 mb-6">确定要删除此记录吗？此操作不可撤销。</p>
              <div className="flex justify-end gap-3"><button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 bg-gray-500 text-gray-800 rounded-lg">取消</button><button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-gray-800 rounded-lg">确认删除</button></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // ── 表单页（用章申请） ──
  if (activeTab === 'apply') {
    return (
      <div className="min-h-[calc(100vh-4rem)]">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="w-full bg-white p-6 min-h-[calc(100vh-4rem)]"
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-800">用章信息录入</h3>
            <button onClick={() => { setForm(initialForm); }} className="text-gray-500 hover:text-gray-800"><FaTimes /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="ui-label mb-2 block">用印方式 *</label>
                <SegmentedControl
                  value={form.usage_type as '项目盖章' | '临时盖章' | '印章外借'}
                  onChange={v => setForm({ ...form, usage_type: v, project_id: '' })}
                  options={[
                    { value: '项目盖章', label: '项目盖章' },
                    { value: '临时盖章', label: '临时盖章' },
                    { value: '印章外借', label: '印章外借' },
                  ]}
                />
              </div>
            </div>
            {form.usage_type === '项目盖章' && (
              <div>
                <label className="ui-label mb-2 block">关联项目 *</label>
                <SearchableSelect
                  required
                  allowEmpty={false}
                  value={form.project_id}
                  onChange={v => setForm({ ...form, project_id: v })}
                  options={projectOptionsSeal}
                  placeholder="请选择关联项目"
                  searchPlaceholder="搜索项目…"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="ui-label mb-2 block">印章类型 *</label>
                <SearchableSelect
                  allowEmpty={false}
                  value={form.seal_type}
                  onChange={v => setForm({ ...form, seal_type: v })}
                  options={sealTypeSelectOptions}
                  placeholder="请选择印章类型"
                  searchThreshold={4}
                />
              </div>
              {form.seal_type === '其他' && <div><label className="block text-sm text-gray-500 mb-2">请输入印章类型 *</label><input type="text" value={form.seal_type_other} onChange={e => setForm({ ...form, seal_type_other: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800" placeholder="请输入印章类型" /></div>}
            </div>
            <div><label className="block text-sm text-gray-500 mb-2">用印事由 *</label><textarea required value={form.usage_reason} onChange={e => setForm({ ...form, usage_reason: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800" rows={3} placeholder="请输入用印事由（最多500字）" maxLength={500} /></div>
            {form.usage_type === '印章外借' && (<>
            <div><label className="block text-sm text-gray-500 mb-2">借章人姓名</label><input type="text" value={form.borrower_name} onChange={e => setForm({ ...form, borrower_name: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800" placeholder="请输入借章人姓名" /></div>
            <div>
              <label className="block text-sm text-gray-500 mb-2">借章人身份证及借条（附件）*</label>
              <input type="file" ref={idCardInputRef} accept="image/jpeg,image/jpg,image/png,image/gif,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword" multiple className="hidden" onChange={e => { if (e.target.files?.length) { handleFileUpload(Array.from(e.target.files), true); e.target.value = ''; } }} />
              <div
                onDragOver={e => { e.preventDefault(); setIdCardDragOver(true); }}
                onDragLeave={() => setIdCardDragOver(false)}
                onDrop={e => { e.preventDefault(); setIdCardDragOver(false); if (!idCardUploading && e.dataTransfer.files.length) { handleFileUpload(Array.from(e.dataTransfer.files), true); } }}
                onClick={() => idCardInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition cursor-pointer ${idCardDragOver ? 'border-blue-400 bg-blue-900/20' : 'border-gray-400 bg-gray-800/20 hover:border-blue-300'}`}
              >
                {idCardUploading ? <span className="text-gray-400">上传中...</span> : <><FaCloudUploadAlt className="text-4xl text-gray-400 mb-2" /><span className="text-gray-400 text-sm">拖拽文件到此处或点击上传（支持 jpg/png/pdf/doc/docx/xls/xlsx，可多选）</span></>}
              </div>
              {form.borrower_id_card_files.length > 0 && <div className="space-y-2 mt-2">{form.borrower_id_card_files.map((url, idx) => renderFilePreview(url, idx, true))}</div>}
            </div>
            </>)}
            {form.usage_type === '印章外借' && <div><label className="block text-sm text-gray-500 mb-2">预计归还时间 *</label><input type="datetime-local" required value={form.expected_return_date} onChange={e => setForm({ ...form, expected_return_date: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800" /></div>}
            <div>
              <label className="block text-sm text-gray-500 mb-2">盖章文件资料附件 *（支持多文件）</label>
              <input type="file" ref={fileInputRef} accept="image/jpeg,image/jpg,image/png,image/gif,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword" multiple className="hidden" onChange={e => { if (e.target.files?.length) { handleFileUpload(Array.from(e.target.files), false); e.target.value = ''; } }} />
              <div
                onDragOver={e => { e.preventDefault(); setAttachDragOver(true); }}
                onDragLeave={() => setAttachDragOver(false)}
                onDrop={e => { e.preventDefault(); setAttachDragOver(false); if (!fileUploading && e.dataTransfer.files.length) { handleFileUpload(Array.from(e.dataTransfer.files), false); } }}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition cursor-pointer ${attachDragOver ? 'border-blue-400 bg-blue-900/20' : 'border-gray-400 bg-gray-800/20 hover:border-blue-300'}`}
              >
                {fileUploading ? <span className="text-gray-400">上传中...</span> : <><FaCloudUploadAlt className="text-4xl text-gray-400 mb-2" /><span className="text-gray-400 text-sm">拖拽文件到此处或点击上传（支持 jpg/png/pdf/doc/docx/xls/xlsx，可多选）</span></>}
              </div>
              {form.attachment_files.length > 0 && <div className="space-y-2 mt-2">{form.attachment_files.map((url, idx) => renderFilePreview(url, idx, false))}</div>}
            </div>
            <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={() => { setForm(initialForm); }} className="px-4 py-2 bg-gray-500 text-gray-800 rounded-lg">重置</button><button type="submit" className="px-4 py-2 bg-blue-600 text-gray-800 rounded-lg">保存</button></div>
          </form>
        </motion.div>

        {renderErrorModal()}
        {renderSuccessModal()}
        {renderPreviewModal()}
      </div>
    );
  }

  // ── 列表页 ──
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">{tabTitles[activeTab]}</h2>
      </div>

      {activeTab === 'borrow' && overdueRecords.length > 0 && (
        <div className="bg-red-900/30 border-l-4 border-red-500 p-4 rounded-lg mb-6">
          <div className="flex items-center gap-2 text-red-400">
            <FaExclamationTriangle /><span>有 {overdueRecords.length} 条印章外借记录已超过预计归还时间，请及时处理！</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center text-gray-500 py-8">加载中...</div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-lg p-6">
          {activeTab === 'project' && <div><h3 className="text-lg font-medium text-gray-800 mb-4">项目盖章记录</h3>{renderProjectTable(projectRecords)}</div>}
          {activeTab === 'temp' && <div><h3 className="text-lg font-medium text-gray-800 mb-4">临时盖章记录</h3>{renderTable(tempRecords, false)}</div>}
          {activeTab === 'borrow' && <div><h3 className="text-lg font-medium text-gray-800 mb-4">当前外借记录（未销号）{borrowRecords.length > 0 && <span className="ml-2 bg-red-500 text-gray-800 text-xs px-2 py-0.5 rounded">{borrowRecords.length}</span>}</h3>{renderTable(borrowRecords, true)}</div>}
          {activeTab === 'history' && <div><h3 className="text-lg font-medium text-gray-800 mb-4">历史外借记录（已销号）</h3>{renderTable(historyRecords, false)}</div>}
        </motion.div>
      )}

      {/* 归还确认 */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowConfirm(false)}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-white rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-bold text-gray-800 mb-4">确认归还销号</h3><p className="text-gray-700 mb-6">确认章已归还？此操作将移除外借记录并归档到历史记录。</p>
              <div className="flex justify-end gap-3"><button onClick={() => setShowConfirm(false)} className="px-4 py-2 bg-gray-500 text-gray-800 rounded-lg">取消</button><button onClick={confirmReturn} className="px-4 py-2 bg-green-600 text-gray-800 rounded-lg">确认归还</button></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {renderDeleteConfirmModal()}
      {renderErrorModal()}
      {renderPreviewModal()}
    </div>
  );
}