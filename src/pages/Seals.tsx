import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaStamp, FaHandshake, FaCheck, FaTimes, FaHistory, FaDownload, FaExclamationTriangle, FaTrash, FaFile, FaImage, FaPaperclip } from 'react-icons/fa';
import { supabase } from '../supabase/client';
import { alertMissingRequiredFields } from '../utils/contractSubPage';
import { useCompanyScope } from '../hooks/useCompanyScope';
import { projectIdsForCompanies } from '../utils/companyProjectScope';
import { SearchableSelect, SegmentedControl } from '../components/ui';
import { projectSelectOptions } from '../components/ui/options';

interface Seal { id: string; name: string; seal_type: string; file_url: string; status: string; }
interface Project { id: string; name: string; }
interface SealUsageRecord {
  id: string; usage_type: string; usage_reason: string; borrower_name: string | null;
  borrower_id_card_file: string | null; expected_return_date: string | null; actual_return_date: string | null;
  attachment_files: string[] | null; remarks: string | null; seal_id: string | null; seal_type: string | null;
  project_id: string | null; project_name: string | null; status: string; created_at: string;
}

const sealTypes = [{ value: '公章', label: '公章' }, { value: '合同章', label: '合同章' }, { value: '财务章', label: '财务章' }, { value: '法人章', label: '法人章' }, { value: '其他', label: '其他' }];
const initialFormData = { usage_type: '项目盖章', seal_type: '', seal_type_other: '', project_id: '', usage_reason: '', borrower_name: '', borrower_id_card_file: '', expected_return_date: '', attachment_files: [] as string[], remarks: '', seal_id: '' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function Seals() {
  const { currentCompany, companies, companyIds } = useCompanyScope();
  const [seals, setSeals] = useState<Seal[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [usageRecords, setUsageRecords] = useState<SealUsageRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'project' | 'temp' | 'borrow' | 'history'>('project');
  const [showModal, setShowModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<SealUsageRecord | null>(null);
  const [formData, setFormData] = useState(initialFormData);
  const [idCardUploading, setIdCardUploading] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const idCardInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { void fetchData(); }, [currentCompany, companies, companyIds]);
  useEffect(() => { void checkOverdueSeals(); }, [usageRecords]);

  async function checkOverdueSeals() {
    try {
      const { data: overdueRecords, error } = await supabase
        .from('seal_usage_records')
        .select('*')
        .eq('usage_type', '印章外借')
        .eq('status', 'active')
        .lt('expected_return_date', new Date().toISOString());
      if (error) {
        console.error('[Seals] checkOverdueSeals query', error);
        return;
      }
      if (overdueRecords && overdueRecords.length > 0) {
        for (const record of overdueRecords) {
          const pid = record.project_id;
          if (!pid || !UUID_RE.test(String(pid))) continue;
          const { data: existing, error: exErr } = await supabase
            .from('warnings')
            .select('id')
            .eq('warning_type', '印章外借超期')
            .eq('project_id', pid)
            .eq('status', 'pending')
            .maybeSingle();
          if (exErr) {
            console.error('[Seals] checkOverdueSeals existing', exErr);
            continue;
          }
          if (!existing) {
            const { error: insErr } = await supabase.from('warnings').insert({
              warning_type: '印章外借超期',
              content: `印章外借超期未归还，借章人：${record.borrower_name || '未知'}`,
              project_id: pid,
              status: 'pending',
            });
            if (insErr) console.error('[Seals] checkOverdueSeals insert', insErr);
          }
        }
      }
    } catch (e) {
      console.error('[Seals] checkOverdueSeals', e);
    }
  }

  async function fetchData() {
    try {
      const usagePromise =
        companyIds.length > 0
          ? (async () => {
              const projectIds = await projectIdsForCompanies(companyIds);
              if (projectIds.length === 0) return { data: [] as SealUsageRecord[], error: null };
              return supabase.from('seal_usage_records').select('*').order('id', { ascending: false }).limit(15).in('project_id', projectIds);
            })()
          : supabase.from('seal_usage_records').select('*').order('id', { ascending: false }).limit(15);

      const [sealsRes, usageRes, projectsRes] = await Promise.all([
        supabase.from('seals').select('*').order('id', { ascending: false }).limit(15),
        usagePromise,
        supabase.from('projects').select('id, name').order('name'),
      ]);
      if (sealsRes.error) console.error('[Seals] seals', sealsRes.error);
      else if (sealsRes.data) setSeals(sealsRes.data);
      if (usageRes.error) console.error('[Seals] seal_usage_records', usageRes.error);
      else if (usageRes.data) setUsageRecords(usageRes.data);
      if (projectsRes.error) console.error('[Seals] projects', projectsRes.error);
      else if (projectsRes.data) setProjects(projectsRes.data);
    } catch (e) {
      console.error('[Seals] fetchData', e);
    }
  }

  const projectRecords = usageRecords.filter(r => r.usage_type === '项目盖章');
  const tempRecords = usageRecords.filter(r => r.usage_type === '临时盖章');
  const borrowRecords = usageRecords.filter(r => r.usage_type === '印章外借' && r.status === 'active');
  const historyRecords = usageRecords.filter(r => r.usage_type === '印章外借' && r.status === 'returned');
  const overdueRecords = borrowRecords.filter(r => r.expected_return_date && new Date(r.expected_return_date) < new Date());

  const sealProjectOptions = useMemo(() => projectSelectOptions(projects, '请选择关联项目'), [projects]);
  const sealPickerOptions = useMemo(
    () => [{ value: '', label: '选择印章（可选）' }, ...seals.map(s => ({ value: s.id, label: s.name }))],
    [seals],
  );
  const sealTypeFieldOptions = useMemo(
    () => [{ value: '', label: '请选择印章类型' }, ...sealTypes.map(t => ({ value: t.value, label: t.label }))],
    [],
  );

  const handleFileUpload = async (file: File, isIdCard: boolean) => {
    if (file.size > 10 * 1024 * 1024) return alert('文件大小不能超过10MB');
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) return alert('仅支持 jpg, jpeg, png, gif, pdf 格式');
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
        if (isIdCard) setFormData({ ...formData, borrower_id_card_file: publicUrl });
        else setFormData({ ...formData, attachment_files: [...formData.attachment_files, publicUrl] });
        if (isIdCard) setIdCardUploading(false); else setFileUploading(false);
      };
    } catch { alert('上传失败，请重试'); if (isIdCard) setIdCardUploading(false); else setFileUploading(false); }
  };

  const removeAttachmentFile = (index: number) => setFormData({ ...formData, attachment_files: formData.attachment_files.filter((_, i) => i !== index) });
  const removeIdCard = () => setFormData({ ...formData, borrower_id_card_file: '' });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const missing: string[] = [];
    if (formData.usage_type === '项目盖章' && !formData.project_id) missing.push('关联项目');
    if (!formData.seal_type) missing.push('印章类型');
    if (formData.seal_type === '其他' && !formData.seal_type_other?.trim()) missing.push('印章类型(其他)');
    if (!formData.borrower_id_card_file) missing.push('借章人身份证附件');
    if (formData.attachment_files.length === 0) missing.push('盖章文件附件');
    if (formData.usage_type === '印章外借' && !formData.expected_return_date) missing.push('预计归还日期');
    if (alertMissingRequiredFields(missing)) return
    const selectedProject = projects.find(p => p.id === formData.project_id);
    const finalSealType = formData.seal_type === '其他' ? formData.seal_type_other : formData.seal_type;
    await supabase.from('seal_usage_records').insert({
      usage_type: formData.usage_type, seal_type: finalSealType, project_id: formData.usage_type === '项目盖章' ? formData.project_id : null,
      project_name: formData.usage_type === '项目盖章' ? selectedProject?.name : null, usage_reason: formData.usage_reason,
      borrower_name: formData.borrower_name || null, borrower_id_card_file: formData.borrower_id_card_file || null,
      expected_return_date: formData.expected_return_date ? new Date(formData.expected_return_date).toISOString() : null,
      attachment_files: formData.attachment_files.length > 0 ? formData.attachment_files : null, remarks: formData.remarks || null,
      seal_id: formData.seal_id || null, status: 'active',
      company_id: currentCompany?.id ?? null,
    });
    setShowModal(false); setFormData(initialFormData); setShowSuccessModal(true); fetchData();
  }

  async function handleReturn(id: string) { setSelectedRecordId(id); setShowConfirmModal(true); }
  async function confirmReturn() {
    if (!selectedRecordId) return;
    await supabase.from('seal_usage_records').update({ status: 'returned', actual_return_date: new Date().toISOString() }).eq('id', selectedRecordId);
    setShowConfirmModal(false); setSelectedRecordId(null); fetchData();
  }

  function viewDetail(record: SealUsageRecord) { setSelectedRecord(record); setShowDetailModal(true); }
  function getFileName(url: string) { return url.split('/').pop() || url; }
  function isPreviewable(url: string) { const ext = url.split('.').pop()?.toLowerCase(); return ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'webp'].includes(ext || ''); }
  function isImage(url: string) { const ext = url.split('.').pop()?.toLowerCase(); return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || ''); }

  function renderFilePreview(url: string, index?: number) {
    return (
      <div key={index} className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg group">
        {isImage(url) ? <FaImage className="text-blue-400" /> : <FaFile className="text-yellow-400" />}
        {isPreviewable(url) ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm flex-1 truncate">{getFileName(url)}</a> : <span className="text-gray-700 text-sm flex-1 truncate">{getFileName(url)}</span>}
        <a href={url} download className="text-green-400 hover:text-green-300"><FaDownload className="w-4 h-4" /></a>
        {index !== undefined && <button onClick={() => removeAttachmentFile(index)} className="text-red-400 hover:text-red-300 ml-1"><FaTrash className="w-3 h-3" /></button>}
      </div>
    );
  }

  function renderRecordsTable(records: SealUsageRecord[], showReturnBtn = false) {
    if (records.length === 0) return <div className="text-center text-gray-500 py-8">暂无记录</div>;
    return (
      <table className="w-full">
        <thead><tr className="border-b border-gray-200 text-gray-500 text-sm"><th className="text-left py-3 px-4">印章类型</th><th className="text-left py-3 px-4">用印事由</th><th className="text-left py-3 px-4">关联项目</th><th className="text-left py-3 px-4">借章人</th><th className="text-left py-3 px-4">预计归还</th><th className="text-left py-3 px-4">附件</th>{showReturnBtn && <th className="text-center py-3 px-4">操作</th>}</tr></thead>
        <tbody>
          {records.map(record => {
            const isOverdue = record.expected_return_date && new Date(record.expected_return_date) < new Date() && record.status === 'active';
            return (
              <tr key={record.id} className="border-b border-gray-200/50 hover:bg-gray-50/30">
                <td className="py-3 px-4 text-gray-800">{record.seal_type || '-'}</td>
                <td className="py-3 px-4 text-gray-800"><button onClick={() => viewDetail(record)} className="text-blue-400 hover:text-blue-300 hover:underline">{record.usage_reason}</button></td>
                <td className="py-3 px-4 text-gray-700">{record.project_name || '-'}</td>
                <td className="py-3 px-4 text-gray-700">{record.borrower_name || '-'}</td>
                <td className={`py-3 px-4 ${isOverdue ? 'text-red-400' : 'text-gray-700'}`}>{record.expected_return_date ? new Date(record.expected_return_date).toLocaleString('zh-CN') : '-'}{isOverdue && <FaExclamationTriangle className="inline ml-1 text-red-400" />}</td>
                <td className="py-3 px-4">{record.attachment_files && record.attachment_files.length > 0 ? <span className="text-xs bg-gray-500 px-2 py-1 rounded text-gray-700">{record.attachment_files.length}个文件</span> : <span className="text-slate-500">-</span>}</td>
                {showReturnBtn && <td className="py-3 px-4 text-center"><button onClick={() => handleReturn(record.id)} className="px-3 py-1 bg-green-600 hover:bg-green-700 text-gray-800 text-sm rounded flex items-center gap-1 mx-auto"><FaCheck /> 已归还销号</button></td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">印章管理</h2>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-gray-800 rounded-lg"><FaPlus /> 用章信息录入</button>
      </div>
      {overdueRecords.length > 0 && <div className="bg-red-900/30 border-l-4 border-red-500 p-4 rounded-lg"><div className="flex items-center gap-2 text-red-400"><FaExclamationTriangle /><span>有 {overdueRecords.length} 条印章外借记录已超过预计归还时间，请及时处理！</span></div></div>}
      <div className="flex gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
        <button onClick={() => setActiveTab('project')} className={`px-4 py-2 rounded-t-lg whitespace-nowrap ${activeTab === 'project' ? 'bg-blue-600 text-gray-800' : 'text-gray-500 hover:text-gray-800'}`}><FaStamp className="inline mr-2" />项目盖章情况</button>
        <button onClick={() => setActiveTab('temp')} className={`px-4 py-2 rounded-t-lg whitespace-nowrap ${activeTab === 'temp' ? 'bg-blue-600 text-gray-800' : 'text-gray-500 hover:text-gray-800'}`}><FaStamp className="inline mr-2" />临时盖章情况</button>
        <button onClick={() => setActiveTab('borrow')} className={`px-4 py-2 rounded-t-lg whitespace-nowrap ${activeTab === 'borrow' ? 'bg-blue-600 text-gray-800' : 'text-gray-500 hover:text-gray-800'}`}><FaHandshake className="inline mr-2" />印章外借情况{borrowRecords.length > 0 && <span className="ml-1 bg-red-500 text-gray-800 text-xs px-1 rounded">{borrowRecords.length}</span>}</button>
        <button onClick={() => setActiveTab('history')} className={`px-4 py-2 rounded-t-lg whitespace-nowrap ${activeTab === 'history' ? 'bg-blue-600 text-gray-800' : 'text-gray-500 hover:text-gray-800'}`}><FaHistory className="inline mr-2" />历史外借记录</button>
      </div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-lg p-6">
        {activeTab === 'project' && <div><h3 className="text-lg font-medium text-gray-800 mb-4">项目盖章记录</h3>{renderRecordsTable(projectRecords, false)}</div>}
        {activeTab === 'temp' && <div><h3 className="text-lg font-medium text-gray-800 mb-4">临时盖章记录</h3>{renderRecordsTable(tempRecords, false)}</div>}
        {activeTab === 'borrow' && <div><h3 className="text-lg font-medium text-gray-800 mb-4">当前外借记录（未销号）</h3>{renderRecordsTable(borrowRecords, true)}</div>}
        {activeTab === 'history' && <div><h3 className="text-lg font-medium text-gray-800 mb-4">历史外借记录（已销号）</h3>{renderRecordsTable(historyRecords, false)}</div>}
      </motion.div>

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowModal(false); setFormData(initialFormData); }}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-gray-800">用章信息录入</h3><button onClick={() => { setShowModal(false); setFormData(initialFormData); }} className="text-gray-500 hover:text-gray-800"><FaTimes /></button></div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="ui-label mb-2 block">用印方式 *</label>
                    <SegmentedControl
                      value={formData.usage_type as '项目盖章' | '临时盖章' | '印章外借'}
                      onChange={v => setFormData({ ...formData, usage_type: v, project_id: '' })}
                      options={[
                        { value: '项目盖章', label: '项目盖章' },
                        { value: '临时盖章', label: '临时盖章' },
                        { value: '印章外借', label: '印章外借' },
                      ]}
                      aria-label="用印方式"
                    />
                  </div>
                  <div>
                    <label className="ui-label mb-2 block">关联印章</label>
                    <SearchableSelect
                      value={formData.seal_id}
                      onChange={v => setFormData({ ...formData, seal_id: v })}
                      options={sealPickerOptions}
                      placeholder="选择印章（可选）"
                      searchPlaceholder="搜索印章…"
                    />
                  </div>
                </div>
                {formData.usage_type === '项目盖章' && (
                  <div>
                    <label className="ui-label mb-2 block">关联项目 *</label>
                    <SearchableSelect
                      required
                      allowEmpty={false}
                      value={formData.project_id}
                      onChange={v => setFormData({ ...formData, project_id: v })}
                      options={sealProjectOptions}
                      placeholder="请选择关联项目"
                      searchPlaceholder="搜索项目…"
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="ui-label mb-2 block">印章类型 *</label>
                    <SearchableSelect
                      required
                      allowEmpty={false}
                      value={formData.seal_type}
                      onChange={v => setFormData({ ...formData, seal_type: v })}
                      options={sealTypeFieldOptions}
                      placeholder="请选择印章类型"
                      searchPlaceholder="搜索类型…"
                    />
                  </div>
                  {formData.seal_type === '其他' && <div><label className="block text-sm text-gray-500 mb-2">请输入印章类型 *</label><input type="text" value={formData.seal_type_other} onChange={e => setFormData({ ...formData, seal_type_other: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" placeholder="请输入印章类型" /></div>}
                </div>
                <div><label className="block text-sm text-gray-500 mb-2">用印事由 *</label><input type="text" required value={formData.usage_reason} onChange={e => setFormData({ ...formData, usage_reason: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" placeholder="请输入用印事由" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm text-gray-500 mb-2">借章人姓名</label><input type="text" value={formData.borrower_name} onChange={e => setFormData({ ...formData, borrower_name: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" placeholder="请输入借章人姓名" /></div>
                  <div><label className="block text-sm text-gray-500 mb-2">借章人身份证（附件）*</label><input type="file" ref={idCardInputRef} accept="image/jpeg,image/jpg,image/png,image/gif,application/pdf" onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0], true)} className="hidden" />
                    <div className="space-y-2">{formData.borrower_id_card_file ? (<div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">{isImage(formData.borrower_id_card_file) ? <FaImage className="text-blue-400" /> : <FaFile className="text-yellow-400" />}<a href={formData.borrower_id_card_file} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm flex-1 truncate">{getFileName(formData.borrower_id_card_file)}</a><button type="button" onClick={removeIdCard} className="text-red-400 hover:text-red-300"><FaTrash className="w-4 h-4" /></button></div>) : (<button type="button" onClick={() => idCardInputRef.current?.click()} disabled={idCardUploading} className="w-full px-4 py-2 bg-gray-500 hover:bg-slate-500 text-gray-800 rounded-lg flex items-center justify-center gap-2">{idCardUploading ? '上传中...' : <><FaPaperclip /> 上传身份证（jpg/png/pdf）</>}</button>)}</div></div>
                </div>
                {formData.usage_type === '印章外借' && <div><label className="block text-sm text-gray-500 mb-2">预计归还时间 *</label><input type="datetime-local" required value={formData.expected_return_date} onChange={e => setFormData({ ...formData, expected_return_date: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>}
                <div><label className="block text-sm text-gray-500 mb-2">盖章文件/借条证明文件 *（支持多文件）</label><input type="file" ref={fileInputRef} accept="image/jpeg,image/jpg,image/png,image/gif,application/pdf" multiple onChange={e => { if (e.target.files) Array.from(e.target.files).forEach(file => handleFileUpload(file, false)); }} className="hidden" />
                  <div className="space-y-2">{formData.attachment_files.length > 0 && <div className="space-y-2">{formData.attachment_files.map((url, idx) => renderFilePreview(url, idx))}</div>}<button type="button" onClick={() => fileInputRef.current?.click()} disabled={fileUploading} className="w-full px-4 py-2 bg-gray-500 hover:bg-slate-500 text-gray-800 rounded-lg flex items-center justify-center gap-2">{fileUploading ? '上传中...' : <><FaPaperclip /> 上传文件（jpg/png/pdf，可多选）</>}</button></div></div>
                <div><label className="block text-sm text-gray-500 mb-2">备注</label><textarea value={formData.remarks} onChange={e => setFormData({ ...formData, remarks: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" rows={3} placeholder="可选备注信息" /></div>
                <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={() => { setShowModal(false); setFormData(initialFormData); }} className="px-4 py-2 bg-gray-500 text-gray-800 rounded-lg">取消</button><button type="submit" className="px-4 py-2 bg-blue-600 text-gray-800 rounded-lg">保存</button></div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showConfirmModal && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowConfirmModal(false)}><motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}><h3 className="text-xl font-bold text-gray-800 mb-4">确认归还销号</h3><p className="text-gray-700 mb-6">确认章已归还？此操作将移除外借记录并归档到历史记录。</p><div className="flex justify-end gap-3"><button onClick={() => setShowConfirmModal(false)} className="px-4 py-2 bg-gray-500 text-gray-800 rounded-lg">取消</button><button onClick={confirmReturn} className="px-4 py-2 bg-green-600 text-gray-800 rounded-lg">确认归还</button></div></motion.div></motion.div>}
      </AnimatePresence>

      <AnimatePresence>
        {showSuccessModal && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowSuccessModal(false)}><motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}><div className="text-center"><div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4"><FaCheck className="w-8 h-8 text-gray-800" /></div><h3 className="text-xl font-bold text-gray-800 mb-2">用章申请已提交</h3><p className="text-gray-700 mb-6">您的用章申请已成功提交</p><button onClick={() => setShowSuccessModal(false)} className="px-6 py-2 bg-blue-600 text-gray-800 rounded-lg">确定</button></div></motion.div></motion.div>}
      </AnimatePresence>

      <AnimatePresence>
        {showDetailModal && selectedRecord && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDetailModal(false)}><motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}><div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-gray-800">用章详情</h3><button onClick={() => setShowDetailModal(false)} className="text-gray-500 hover:text-gray-800"><FaTimes /></button></div><div className="space-y-4"><div className="grid grid-cols-2 gap-4"><div><div className="text-sm text-gray-500">用印方式</div><div className="text-gray-800">{selectedRecord.usage_type}</div></div><div><div className="text-sm text-gray-500">印章类型</div><div className="text-gray-800">{selectedRecord.seal_type || '-'}</div></div></div>{selectedRecord.project_name && <div><div className="text-sm text-gray-500">关联项目</div><div className="text-gray-800">{selectedRecord.project_name}</div></div>}<div><div className="text-sm text-gray-500">用印事由</div><div className="text-gray-800">{selectedRecord.usage_reason}</div></div><div className="grid grid-cols-2 gap-4"><div><div className="text-sm text-gray-500">借章人</div><div className="text-gray-800">{selectedRecord.borrower_name || '-'}</div></div><div><div className="text-sm text-gray-500">预计归还时间</div><div className="text-gray-800">{selectedRecord.expected_return_date ? new Date(selectedRecord.expected_return_date).toLocaleString('zh-CN') : '-'}</div></div></div><div><div className="text-sm text-gray-500">创建时间</div><div className="text-gray-800">{new Date(selectedRecord.created_at).toLocaleString('zh-CN')}</div></div></div><div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200"><button onClick={() => setShowDetailModal(false)} className="px-4 py-2 bg-gray-500 text-gray-800 rounded-lg">关闭</button></div></motion.div></motion.div>}
      </AnimatePresence>
    </div>
  );
}
