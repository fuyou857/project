import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaTimes, FaCheck, FaTrash, FaFile, FaImage, FaPaperclip, FaDownload, FaEye } from 'react-icons/fa';
import { supabase } from '../supabase/client';
import { alertMissingRequiredFields } from '../utils/contractSubPage';
import { useCompanyScope } from '../hooks/useCompanyScope';
import { projectIdsForCompanies } from '../utils/companyProjectScope';
import { SearchableSelect, SegmentedControl } from '../components/ui';
import { projectSelectOptions } from '../components/ui/options';



interface SealUsageRecord {
  id: string;
  usage_type: string;
  usage_reason: string;
  borrower_name: string | null;
  borrower_id_card_file: string | null;
  expected_return_date: string | null;
  actual_return_date: string | null;
  attachment_files: string[] | null;
  seal_type: string | null;
  project_id: string | null;
  project_name: string | null;
  status: string;
  created_at: string;
}

interface Project { id: string; name: string; }

type TabType = 'apply' | 'project' | 'borrow' | 'history';

function getActiveTabFromPath(pathname: string): TabType {
  if (pathname.includes('/project')) return 'project';
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
  borrower_id_card_file: '',
  expected_return_date: '',
  attachment_files: [] as string[],
};

export default function SealManagement() {
  const { currentCompany, companies, companyIds } = useCompanyScope();
  const location = useLocation();
  const activeTab = getActiveTabFromPath(location.pathname);
  const [records, setRecords] = useState<SealUsageRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [idCardUploading, setIdCardUploading] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const idCardInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchRecords = useCallback(async () => {
    try {

      let projectsQuery = supabase.from('projects').select('id, name').order('name');

      if (companyIds.length > 0) {
        projectsQuery = projectsQuery.in('company_id', companyIds);
      }

      const projectIds = companyIds.length > 0 ? await projectIdsForCompanies(companyIds) : null;

      let recordsQuery = supabase.from('seal_usage_records').select('*').order('id', { ascending: false }).limit(15);
      if (projectIds !== null) {
        if (projectIds.length === 0) {
          const [projectsRes] = await Promise.all([projectsQuery]);
          if (projectsRes.error) console.error('[SealManagement] projects', projectsRes.error);
          else if (projectsRes.data) setProjects(projectsRes.data);
          setRecords([]);
          return;
        }
        recordsQuery = recordsQuery.in('project_id', projectIds);
      }

      const [recordsRes, projectsRes] = await Promise.all([recordsQuery, projectsQuery]);
      if (recordsRes.error) console.error('[SealManagement] seal_usage_records', recordsRes.error);
      else if (recordsRes.data) setRecords(recordsRes.data);
      if (projectsRes.error) console.error('[SealManagement] projects', projectsRes.error);
      else if (projectsRes.data) setProjects(projectsRes.data);
    } catch (e) {
      console.error('[SealManagement] fetchRecords', e);
      setRecords([]);
    }
  }, [companyIds]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords, currentCompany, companies]);

  const applyRecords = records;
  const projectRecords = records.filter(r => r.usage_type === '项目盖章');
  const borrowRecords = records.filter(r => r.usage_type === '印章外借' && r.status === 'active');
  const historyRecords = records.filter(r => r.usage_type === '印章外借' && r.status === 'returned');

  const openPreview = (url: string) => { setPreviewUrl(url); setShowPreview(true); };

  const handleFileUpload = async (file: File, isIdCard: boolean) => {
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) { alert('文件大小不能超过10MB'); return; }
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) { alert('仅支持 jpg, jpeg, png, gif, pdf 格式'); return; }
    if (isIdCard) setIdCardUploading(true); else setFileUploading(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const ext = file.name.split('.').pop();
        const path = `seal_files/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
        const { error } = await supabase.storage.from('files').upload(path, Uint8Array.from(atob(base64), c => c.charCodeAt(0)), { contentType: file.type });
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('files').getPublicUrl(path);
        if (isIdCard) { setForm({ ...form, borrower_id_card_file: publicUrl }); } 
        else { setForm({ ...form, attachment_files: [...form.attachment_files, publicUrl] }); }
        if (isIdCard) setIdCardUploading(false); else setFileUploading(false);
      };
    } catch (err) { alert('上传失败，请重试'); if (isIdCard) setIdCardUploading(false); else setFileUploading(false); }
  };

  const removeAttachmentFile = (index: number) => { setForm({ ...form, attachment_files: form.attachment_files.filter((_, i) => i !== index) }); };
  const removeIdCard = () => { setForm({ ...form, borrower_id_card_file: '' }); };
  function isImage(url: string) { const ext = url.split('.').pop()?.toLowerCase(); return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || ''); }
  function getFileName(url: string) { return url.split('/').pop() || url; }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const missing: string[] = [];
    if (form.usage_type === '项目盖章' && !form.project_id) missing.push('关联项目');
    if (!form.seal_type) missing.push('印章类型');
    if (form.seal_type === '其他' && !form.seal_type_other?.trim()) missing.push('印章类型(其他)');
    if (!form.borrower_id_card_file) missing.push('借章人身份证附件');
    if (form.attachment_files.length === 0) missing.push('盖章文件附件');
    if (form.usage_type === '印章外借' && !form.expected_return_date) missing.push('预计归还日期');
    if (alertMissingRequiredFields(missing)) return
    const selectedProject = projects.find(p => p.id === form.project_id);
    const finalSealType = form.seal_type === '其他' ? form.seal_type_other : form.seal_type;
    await supabase.from('seal_usage_records').insert({
      usage_type: form.usage_type, seal_type: finalSealType,
      project_id: form.usage_type === '项目盖章' ? form.project_id : null,
      project_name: form.usage_type === '项目盖章' ? selectedProject?.name : null,
      company_id: currentCompany?.id ?? null,
      usage_reason: form.usage_reason, borrower_name: form.borrower_name || null,
      borrower_id_card_file: form.borrower_id_card_file || null,
      expected_return_date: form.expected_return_date ? new Date(form.expected_return_date).toISOString() : null,
      attachment_files: form.attachment_files.length > 0 ? form.attachment_files : null, status: 'active',
    });
    setShowModal(false); setForm(initialForm); setShowSuccess(true); fetchRecords();
  }

  function handleReturnClick(id: string) { setSelectedId(id); setShowConfirm(true); }
  async function confirmReturn() {
    if (!selectedId) return;
    await supabase.from('seal_usage_records').update({ status: 'returned', actual_return_date: new Date().toISOString() }).eq('id', selectedId);
    setShowConfirm(false); setSelectedId(null); fetchRecords();
  }

  function renderFilePreview(url: string, index?: number) {
    const fileName = getFileName(url);
    return (
      <div key={index} className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg group">
        {isImage(url) ? <FaImage className="text-blue-400" /> : <FaFile className="text-yellow-400" />}
        <button onClick={() => openPreview(url)} className="text-blue-400 hover:text-blue-300 text-sm flex-1 truncate text-left">{fileName}</button>
        <a href={url} download className="text-green-400 hover:text-green-300"><FaDownload className="w-4 h-4" /></a>
        {index !== undefined && <button onClick={() => removeAttachmentFile(index)} className="text-red-400 hover:text-red-300 ml-1"><FaTrash className="w-3 h-3" /></button>}
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
        </tr></thead>
        <tbody>
          {data.map(r => (
            <tr key={r.id} className="border-b border-gray-200/50 hover:bg-gray-50/30">
              <td className="py-3 px-4 text-gray-800">{r.seal_type || '-'}</td><td className="py-3 px-4 text-gray-800">{r.usage_type}</td>
              <td className="py-3 px-4 text-gray-700">{r.usage_reason}</td><td className="py-3 px-4 text-gray-700">{r.project_name || '-'}</td>
              <td className="py-3 px-4 text-gray-700">{r.borrower_name || '-'}</td>
              <td className="py-3 px-4 text-gray-700">{r.expected_return_date ? new Date(r.expected_return_date).toLocaleString('zh-CN') : '-'}</td>
              <td className="py-3 px-4 text-gray-700">{r.actual_return_date ? new Date(r.actual_return_date).toLocaleString('zh-CN') : '-'}</td>
              {showReturnBtn && <td className="py-3 px-4 text-center"><button onClick={() => handleReturnClick(r.id)} className="px-3 py-1 bg-green-600 hover:bg-green-700 text-gray-800 text-sm rounded flex items-center gap-1 mx-auto"><FaCheck /> 已归还销号</button></td>}
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
        </tr></thead>
        <tbody>
          {data.map(r => (
            <tr key={r.id} className="border-b border-gray-200/50 hover:bg-gray-50/30">
              <td className="py-3 px-4 text-gray-700">{r.created_at?.slice(0, 10) || '-'}</td>
              <td className="py-3 px-4 text-gray-800">{r.project_name || '-'}</td>
              <td className="py-3 px-4 text-gray-700">{r.seal_type || '-'}</td>
              <td className="py-3 px-4 text-gray-700 max-w-xs truncate">{r.usage_reason || '-'}</td>
              <td className="py-3 px-4 text-gray-700">{r.borrower_name || '-'}</td>
              <td className="py-3 px-4 text-center">
                <div className="flex items-center justify-center gap-1">
                  {r.attachment_files?.map((url, idx) => (
                    <button key={idx} onClick={() => openPreview(url)} className="p-1 text-blue-400 hover:text-blue-300"><FaEye className="w-4 h-4" /></button>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  const tabTitles: Record<TabType, string> = {
    apply: '用章申请',
    project: '项目盖章情况',
    borrow: '印章外借情况',
    history: '历史记录',
  };

  const projectOptionsSeal = useMemo(() => projectSelectOptions(projects, '请选择关联项目'), [projects]);
  const sealTypeSelectOptions = useMemo(
    () => [{ value: '', label: '请选择印章类型' }, ...sealTypes.map(t => ({ value: t.value, label: t.label }))],
    [],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">{tabTitles[activeTab]}</h2>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-gray-800 rounded-lg"><FaPlus /> 用章信息录入</button>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-lg p-6">
        {activeTab === 'apply' && <div><h3 className="text-lg font-medium text-gray-800 mb-4">用章申请记录</h3>{renderTable(applyRecords, false)}</div>}
        {activeTab === 'project' && <div><h3 className="text-lg font-medium text-gray-800 mb-4">项目盖章情况</h3>{renderProjectTable(projectRecords)}</div>}
        {activeTab === 'borrow' && <div><h3 className="text-lg font-medium text-gray-800 mb-4">当前外借记录（未销号）{borrowRecords.length > 0 && <span className="ml-2 bg-red-500 text-gray-800 text-xs px-2 py-0.5 rounded">{borrowRecords.length}</span>}</h3>{renderTable(borrowRecords, true)}</div>}
        {activeTab === 'history' && <div><h3 className="text-lg font-medium text-gray-800 mb-4">历史外借记录（已销号）</h3>{renderTable(historyRecords, false)}</div>}
      </motion.div>

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-gray-800">用章信息录入</h3><button onClick={(e) => { e.stopPropagation(); setShowModal(false); setForm(initialForm); }} className="text-gray-500 hover:text-gray-800"><FaTimes /></button></div>
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
                  {form.seal_type === '其他' && <div><label className="block text-sm text-gray-500 mb-2">请输入印章类型 *</label><input type="text" value={form.seal_type_other} onChange={e => setForm({ ...form, seal_type_other: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" placeholder="请输入印章类型" /></div>}
                </div>
                <div><label className="block text-sm text-gray-500 mb-2">用印事由 *</label><textarea required value={form.usage_reason} onChange={e => setForm({ ...form, usage_reason: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" rows={3} placeholder="请输入用印事由" /></div>
                <div><label className="block text-sm text-gray-500 mb-2">借章人姓名</label><input type="text" value={form.borrower_name} onChange={e => setForm({ ...form, borrower_name: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" placeholder="请输入借章人姓名" /></div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">借章人身份证（附件）*</label>
                  <input type="file" ref={idCardInputRef} accept="image/jpeg,image/jpg,image/png,image/gif,application/pdf" onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0], true)} className="hidden" />
                  <div className="space-y-2">
                    {form.borrower_id_card_file ? (
                      <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
                        {isImage(form.borrower_id_card_file) ? <FaImage className="text-blue-400" /> : <FaFile className="text-yellow-400" />}
                        <button onClick={() => openPreview(form.borrower_id_card_file)} className="text-blue-400 hover:text-blue-300 text-sm flex-1 truncate text-left">{getFileName(form.borrower_id_card_file)}</button>
                        <button type="button" onClick={removeIdCard} className="text-red-400 hover:text-red-300"><FaTrash className="w-4 h-4" /></button>
                      </div>
                    ) : (<button type="button" onClick={() => idCardInputRef.current?.click()} disabled={idCardUploading} className="w-full px-4 py-2 bg-gray-500 hover:bg-slate-500 text-gray-800 rounded-lg flex items-center justify-center gap-2">{idCardUploading ? '上传中...' : <><FaPaperclip /> 上传身份证（jpg/png/pdf）</>}</button>)}
                  </div>
                </div>
                {form.usage_type === '印章外借' && <div><label className="block text-sm text-gray-500 mb-2">预计归还时间 *</label><input type="datetime-local" required value={form.expected_return_date} onChange={e => setForm({ ...form, expected_return_date: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>}
                <div>
                  <label className="block text-sm text-gray-500 mb-2">盖章文件/借条证明文件 *（支持多文件）</label>
                  <input type="file" ref={fileInputRef} accept="image/jpeg,image/jpg,image/png,image/gif,application/pdf" multiple onChange={e => { if (e.target.files) { Array.from(e.target.files).forEach(file => handleFileUpload(file, false)); } }} className="hidden" />
                  <div className="space-y-2">
                    {form.attachment_files.length > 0 && <div className="space-y-2">{form.attachment_files.map((url, idx) => renderFilePreview(url, idx))}</div>}
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={fileUploading} className="w-full px-4 py-2 bg-gray-500 hover:bg-slate-500 text-gray-800 rounded-lg flex items-center justify-center gap-2">{fileUploading ? '上传中...' : <><FaPaperclip /> 上传文件（jpg/png/pdf，可多选）</>}</button>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={(e) => { e.stopPropagation(); setShowModal(false); setForm(initialForm); }} className="px-4 py-2 bg-gray-500 text-gray-800 rounded-lg">取消</button><button type="submit" className="px-4 py-2 bg-blue-600 text-gray-800 rounded-lg">保存</button></div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowConfirm(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-bold text-gray-800 mb-4">确认归还销号</h3><p className="text-gray-700 mb-6">确认章已归还？此操作将移除外借记录并归档到历史记录。</p>
              <div className="flex justify-end gap-3"><button onClick={() => setShowConfirm(false)} className="px-4 py-2 bg-gray-500 text-gray-800 rounded-lg">取消</button><button onClick={confirmReturn} className="px-4 py-2 bg-green-600 text-gray-800 rounded-lg">确认归还</button></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSuccess && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowSuccess(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="text-center"><div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4"><FaCheck className="w-8 h-8 text-gray-800" /></div><h3 className="text-xl font-bold text-gray-800 mb-2">用章申请已提交</h3><p className="text-gray-700 mb-6">您的用章申请已成功提交</p><button onClick={() => setShowSuccess(false)} className="px-6 py-2 bg-blue-600 text-gray-800 rounded-lg">确定</button></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPreview && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-8" onClick={() => setShowPreview(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-xl p-4 max-w-4xl max-h-full overflow-auto" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4"><h3 className="text-gray-800 font-medium">附件预览</h3><button onClick={() => setShowPreview(false)} className="text-gray-500 hover:text-gray-800"><FaTimes /></button></div>
              {isImage(previewUrl) ? <img src={previewUrl} alt="preview" className="max-w-full max-h-[70vh] object-contain" /> : <iframe src={previewUrl} className="w-[800px] h-[70vh]" title="preview" />}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
