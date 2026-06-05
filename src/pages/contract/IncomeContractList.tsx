import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaTimes, FaEdit, FaTrash, FaSearch, FaFileExcel, FaUpload, FaBell, FaBellSlash, FaEye, FaFilePdf, FaFileWord, FaLink } from 'react-icons/fa';
import { supabase } from '../../supabase/client';
import { useCompany } from '../../components/Layout';
import SignatoryUnitSelector from '../../components/SignatoryUnitSelector';
import PartyASelector from '../../components/PartyASelector';
import ContractListToast from '../../components/contract/ContractListToast';
import ContractListToolbar from '../../components/contract/ContractListToolbar';
import ContractListSearchBar from '../../components/contract/ContractListSearchBar';
import ContractListPagination from '../../components/contract/ContractListPagination';
import ContractDeleteConfirmModal from '../../components/contract/ContractDeleteConfirmModal';
import ContractReminderDetailModal from '../../components/contract/ContractReminderDetailModal';
import ApprovalStatusBadge from '../../components/ApprovalStatusBadge';
import SubmitApprovalListAction from '../../components/approval/SubmitApprovalListAction';
import { tryCreateApproval } from '../../utils/contractSubPage';
import { SearchableSelect, SegmentedControl } from '../../components/ui';
import { projectSelectOptions } from '../../components/ui/options';
import { useSingleToast } from '../../hooks/useSingleToast';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useContractReminders } from '../../hooks/useContractReminders';
import { readExcelFirstSheetRows, downloadJsonRowsAsXlsx } from '../../utils/excelSheet';
import {
  contractApprovalStatusClass,
  contractApprovalStatusLabel,
  incomeContractExportStatusLabel,
} from '../../utils/contractDisplayHelpers';
import { getStoredUser, isSuperAdminUser } from '../../utils/sessionUser';
import { listGeneratedContracts } from '../../services/contractGenerationService';
import {
  parseContractAttachmentField,
  persistContractAttachments,
} from '../../utils/contractAttachments';

interface Project {id: string;name: string;}
interface PartyA {id: string;name: string;}
interface Signatory {id: string;unit_name: string;}

interface ContractAttachment {
  id?: string;
  name: string;
  type: 'local' | 'generated';
  file?: File;
  url?: string;
  generatedContractId?: string;
  size?: number;
}

const PAGE_SIZE = 15;

export default function IncomeContractList() {
  const { currentCompany, getCompanyIds } = useCompany();
  const { toast, showToast } = useSingleToast();
  const {
    contractReminders,
    showReminderDetail,
    selectedContract,
    contractReminderList,
    fetchReminders,
    openReminderDetail,
    closeReminderDetail,
  } = useContractReminders('income');
  const [contracts, setContracts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [showModal, setShowModal] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ contract_name: '', contract_code: '', project_id: '', party_a_id: '', signatory_id: '', contract_amount: 0, signing_date: '', start_date: '', end_date: '', status: 'draft' });
  const [projects, setProjects] = useState<Project[]>([]);
  const [partyAList, setPartyAList] = useState<PartyA[]>([]);
  const [signatoryList, setSignatoryList] = useState<Signatory[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentFileInputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(true);
  
  // 附件相关状态
  const [attachments, setAttachments] = useState<ContractAttachment[]>([]);
  const [showAttachmentSelector, setShowAttachmentSelector] = useState(false);
  const [generatedContracts, setGeneratedContracts] = useState<any[]>([]);
  const [loadingGeneratedContracts, setLoadingGeneratedContracts] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;
    fetchData();fetchOptions();fetchReminders();
    return () => { isMountedRef.current = false; };
  }, [page, debouncedSearch, currentCompany]);

  // 加载已生成的合同列表（用于附件选择）
  const loadGeneratedContracts = useCallback(async () => {
    try {
      setLoadingGeneratedContracts(true);
      const data = await listGeneratedContracts();
      setGeneratedContracts(data || []);
    } catch (err) {
      console.error('加载已生成合同失败:', err);
      showToast('error', '加载已生成合同列表失败');
    } finally {
      setLoadingGeneratedContracts(false);
    }
  }, []);

  async function fetchOptions() {
    const [pRes, paRes, sRes] = await Promise.all([
    supabase.from('projects').select('id, name'),
    supabase.from('party_a').select('id, name'),
    supabase.from('signatory_units').select('id, unit_name')]
    );
    if (!isMountedRef.current) return;
    if (pRes.data) setProjects(pRes.data);
    if (paRes.data) setPartyAList(paRes.data);
    if (sRes.data) setSignatoryList(sRes.data);
  }
  
  // 处理本地文件上传
  const handleLocalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newAttachments: ContractAttachment[] = Array.from(files).map(file => ({
        name: file.name,
        type: 'local',
        file,
        size: file.size,
      }));
      setAttachments(prev => [...prev, ...newAttachments]);
    }
    e.target.value = '';
  };
  
  // 添加已生成的合同作为附件
  const handleAddGeneratedContract = (contract: any) => {
    const newAttachment: ContractAttachment = {
      id: contract.id,
      name: `${contract.contract_no} - ${contract.contract_templates?.title || '合同'}`,
      type: 'generated',
      generatedContractId: contract.id,
    };
    setAttachments(prev => [...prev, newAttachment]);
    setShowAttachmentSelector(false);
  };
  
  // 移除附件
  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };
  
  // 重置模态框
  const resetModalState = () => {
    setForm({ contract_name: '', contract_code: '', project_id: '', party_a_id: '', signatory_id: '', contract_amount: 0, signing_date: '', start_date: '', end_date: '', status: 'draft' });
    setAttachments([]);
    setEditingId(null);
  };
  
  // 打开编辑模态框
  const openEdit = (c: any) => {
    setEditingId(c.id);
    setForm({ 
      contract_name: c.contract_name, 
      contract_code: c.contract_code, 
      project_id: c.project_id || '', 
      party_a_id: c.party_a_id || '', 
      signatory_id: c.signatory_id || '', 
      contract_amount: c.contract_amount, 
      signing_date: c.signing_date || '', 
      start_date: c.start_date || '', 
      end_date: c.end_date || '', 
      status: c.status 
    });
    setAttachments(parseContractAttachmentField(c.attachment_url));
    setShowModal(true);
  };

  async function fetchData() {
    const companyIds = getCompanyIds();
    const offset = (page - 1) * PAGE_SIZE;
    let query = supabase.from('income_contracts').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (companyIds.length > 0) {
      query = query.in('company_id', companyIds);
    }
    if (debouncedSearch) query = query.ilike('contract_name', `%${debouncedSearch}%`);
    const { data, count } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (!isMountedRef.current) return;
    if (data) setContracts(data);
    setTotal(count || 0);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
        const json = await readExcelFirstSheetRows(file);
        if (!json.length) {showToast('error', 'Excel文件为空');return;}
        const errors: string[] = [];
        for (let i = 0; i < json.length; i++) {
          const row = json[i];
          const project = projects.find((p) => p.name === row['项目名称']);
          const partyA = partyAList.find((p) => p.name === row['甲方单位']);
          const signatory = signatoryList.find((s) => s.unit_name === row['签约单位']);
          if (!project) {errors.push(`第${i + 2}行：项目"${row['项目名称']}"不存在`);continue;}
          if (row['甲方单位'] && !partyA) {errors.push(`第${i + 2}行：甲方单位"${row['甲方单位']}"不存在`);continue;}
          if (row['签约单位'] && !signatory) {errors.push(`第${i + 2}行：签约单位"${row['签约单位']}"不存在`);continue;}
          const { error } = await supabase.from('income_contracts').insert({
            contract_name: row['合同名称'], contract_code: row['合同编号'], project_id: project.id,
            party_a_id: partyA?.id || null, signatory_id: signatory?.id || null,
            contract_amount: Number(row['合同金额']) || 0, signing_date: row['签订日期'], status: 'draft'
          });
          if (error) errors.push(`第${i + 2}行：${error.message}`);
        }
        if (errors.length) showToast('error', errors.slice(0, 3).join('；') + (errors.length > 3 ? '...' : ''));else
        {showToast('success', `成功导入${json.length}条合同`);}
        fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast('error', '解析Excel失败：' + msg);
    }
    e.target.value = '';
  }

  async function handleExport() {
    const { data } = await supabase.from('income_contracts').select('*, project:projects(name), party_a:party_a(name), signatory:signatory_units(unit_name)');
    if (!data?.length) {showToast('error', '没有可导出的数据');return;}
    const rows = data.map((c) => ({
      合同名称: c.contract_name, 合同编号: c.contract_code, 项目名称: (c as any).project?.name || '',
      甲方单位: (c as any).party_a?.name || '', 签约单位: (c as any).signatory?.unit_name || '',
      合同金额: c.contract_amount, 签订日期: c.signing_date,
      状态: incomeContractExportStatusLabel(c.status),
    }));
    await downloadJsonRowsAsXlsx(rows, '收入合同', '收入合同列表.xlsx');
    showToast('success', '导出成功');
  }

  function buildContractSummaryRows(c: {
    contract_code?: string | null;
    contract_name?: string | null;
    contract_amount?: number | null;
    project_id?: string | null;
    party_a_id?: string | null;
    signatory_id?: string | null;
  }) {
    const projectName = projects.find((p) => p.id === c.project_id)?.name || '';
    const partyName = partyAList.find((p) => p.id === c.party_a_id)?.name || '';
    const signatoryName = signatoryList.find((s) => s.id === c.signatory_id)?.unit_name || '';
    const amountText =
      c.contract_amount != null
        ? `¥${Number(c.contract_amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`
        : '—';
    return [
      { label: '合同编号', value: c.contract_code || '—' },
      { label: '合同名称', value: c.contract_name || '—' },
      { label: '合同金额', value: amountText },
      { label: '所属项目', value: projectName || '—' },
      { label: '甲方单位', value: partyName || '—' },
      { label: '乙方单位', value: signatoryName || '—' },
    ];
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.contract_name || !form.project_id) {showToast('error', '请填写必填项');return;}
    const attachment_url = await persistContractAttachments(
      attachments,
      'income-contracts',
      editingId || undefined,
    );
    const payload = {
      ...form,
      contract_amount: Number(form.contract_amount),
      attachment_url,
      company_id: currentCompany?.id || null,
    };

    if (editingId) {
      const { error } = await supabase.from('income_contracts').update(payload).eq('id', editingId);
      if (error) {showToast('error', '保存失败');return;}
      showToast('success', '更新成功');
    } else {
      const { data, error } = await supabase.from('income_contracts').insert(payload).select().single();
      if (error) {showToast('error', '保存失败');return;}

      const approvalSubmitted = await tryCreateApproval('income_contract', data.id, data.contract_name, {
        projectId: data.project_id,
        summaryRows: buildContractSummaryRows(data),
      });
      showToast(
        'success',
        approvalSubmitted ? '创建成功，已提交审批' : '创建成功（未提交审批或已取消）',
      );
    }

    setShowModal(false);setForm({ contract_name: '', contract_code: '', project_id: '', party_a_id: '', signatory_id: '', contract_amount: 0, signing_date: '', start_date: '', end_date: '', status: 'draft' });
    setEditingId(null);fetchData();
  }

  async function handleDelete() {
    if (!deleteId) return;
    await supabase.from('income_contracts').delete().eq('id', deleteId);
    showToast('success', '删除成功');
    setShowDelete(false);setDeleteId(null);fetchData();
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const projectOptions = useMemo(() => projectSelectOptions(projects), [projects]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {toast && <ContractListToast type={toast.type} message={toast.message} />}
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-gray-800">收入合同签约管理</h3>
        <div className="flex gap-2">
          <input type="file" ref={fileInputRef} accept=".xlsx,.xls" onChange={handleImport} className="ui-file-input-safe" data-file-upload-field="true" />
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-gray-800 rounded-lg"><FaUpload /> 导入Excel</button>
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-gray-800 rounded-lg"><FaFileExcel /> 导出Excel</button>
          <button onClick={() => {
            resetModalState();
            setShowModal(true);
          }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-gray-800 rounded-lg"><FaPlus /> 新增合同</button>
        </div>
      </div>
      <div className="bg-white rounded-xl p-4 border border-gray-200">
        <div className="relative mb-4"><FaSearch className="absolute left-3 top-3 text-gray-500" /><input type="text" placeholder="搜索合同名称..." value={search} onChange={(e) => {setSearch(e.target.value);setPage(1);}} className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50"><tr className="text-gray-700 text-sm"><th className="text-left py-3 px-4">合同名称</th><th className="text-left py-3 px-4">合同编号</th><th className="text-right py-3 px-4">合同金额</th><th className="text-left py-3 px-4">签订日期</th><th className="text-center py-3 px-4">状态</th><th className="text-center py-3 px-4">提醒</th><th className="text-center py-3 px-4">审批状态</th><th className="text-center py-3 px-4">操作</th></tr></thead>
            <tbody>
              {contracts.length === 0 ? <tr><td colSpan={8} className="text-center text-slate-500 py-8">暂无合同</td></tr> : contracts.map((c) => {
                const reminderCount = contractReminders.get(c.id) || 0;
                return (
                  <tr key={c.id} className="border-b border-gray-200/50 hover:bg-gray-50/30">
                  <td className="py-3 px-4 text-gray-800">{c.contract_name}</td>
                  <td className="py-3 px-4 text-gray-700">{c.contract_code || '-'}</td>
                  <td className="py-3 px-4 text-right text-gray-700">{c.contract_amount?.toLocaleString() || '-'}</td>
                  <td className="py-3 px-4 text-gray-700">{c.signing_date?.slice(0, 10) || '-'}</td>
                  <td className="py-3 px-4 text-center"><span className={`px-2 py-1 rounded text-xs ${contractApprovalStatusClass(c.status)}`}>{contractApprovalStatusLabel(c.status)}</span></td>
                  <td className="py-3 px-4 text-center">
                    {reminderCount > 0 ?
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">
                        <FaBell className="w-4 h-4" />
                        {reminderCount}
                      </span> :

                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-400 rounded text-xs">
                        <FaBellSlash className="w-4 h-4" />
                      </span>
                      }
                  </td>
                  <td className="py-3 px-4 text-center"><ApprovalStatusBadge sourceType="income_contract" sourceId={c.id} sourceName={c.contract_name} /></td>
                  <td className="py-3 px-4"><div className="flex items-center justify-center gap-1">
                    <SubmitApprovalListAction
                      sourceType="income_contract"
                      sourceId={c.id}
                      sourceName={c.contract_name}
                      projectId={c.project_id}
                      summaryRows={buildContractSummaryRows(c)}
                      onDone={(ok) =>
                        showToast(
                          'success',
                          ok ? '已提交审批' : '未提交审批（已取消或未配置流程）',
                        )
                      }
                    />
                    <button onClick={() => {
                      openEdit(c);
                    }} className="p-2 text-yellow-400 hover:bg-yellow-500/20 rounded-lg" title="编辑"><FaEdit className="w-4 h-4" /></button>
                    <button onClick={() => openReminderDetail(c, (msg) => showToast('error', msg))} className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg" title="查看提醒"><FaEye className="w-4 h-4" /></button>
                    {isSuperAdminUser() && <button onClick={() => {setDeleteId(c.id);setShowDelete(true);}} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg" title="删除"><FaTrash className="w-4 h-4" /></button>}
                  </div></td>
                </tr>);
              })}
            </tbody>
          </table>
        </div>
        <ContractListPagination
          total={total}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>
      <AnimatePresence>
        {showModal &&
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-white rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-gray-800">{editingId ? '编辑' : '新增'}收入合同</h3><button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-800"><FaTimes /></button></div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="block text-sm text-gray-500 mb-2">合同名称 *</label><input required value={form.contract_name || ''} onChange={(e) => setForm({ ...form, contract_name: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="ui-label mb-2 block">关联项目 *</label>
                    <SearchableSelect
                    required
                    allowEmpty={false}
                    value={form.project_id}
                    onChange={(v) => setForm({ ...form, project_id: v })}
                    options={projectOptions}
                    placeholder="选择项目"
                    searchPlaceholder="搜索项目…" />
                  
                  </div>
                  <div><label className="block text-sm text-gray-500 mb-2">合同编号</label><input value={form.contract_code || ''} onChange={(e) => setForm({ ...form, contract_code: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <PartyASelector value={form.party_a_id} onChange={(value) => setForm({ ...form, party_a_id: value })} label="甲方单位" /><SignatoryUnitSelector value={form.signatory_id} onChange={(value) => setForm({ ...form, signatory_id: value })} label="签约单位" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm text-gray-500 mb-2">合同金额(元)</label><input type="number" value={form.contract_amount || ''} onChange={(e) => setForm({ ...form, contract_amount: Number(e.target.value) })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                  <div><label className="block text-sm text-gray-500 mb-2">签订日期</label><input type="date" value={form.signing_date || ''} onChange={(e) => setForm({ ...form, signing_date: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                </div>
                <div>
                  <label className="ui-label mb-2 block">状态</label>
                  <SegmentedControl
                  value={form.status as 'draft' | 'signed' | 'completed'}
                  onChange={(v) => setForm({ ...form, status: v })}
                  options={[
                  { value: 'draft', label: '草稿' },
                  { value: 'signed', label: '已签订' },
                  { value: 'completed', label: '已完成' }]
                  } />
                
                </div>
                
                {/* 附件管理区域 */}
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-800">附件管理</h4>
                    <div className="flex gap-2">
                      <input 
                        type="file" 
                        ref={attachmentFileInputRef} 
                        className="ui-file-input-safe" data-file-upload-field="true" 
                        multiple 
                        onChange={handleLocalFileSelect}
                      />
                      <button 
                        type="button"
                        onClick={() => attachmentFileInputRef.current?.click()}
                        className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 flex items-center gap-1"
                      >
                        <FaUpload className="w-3.5 h-3.5" />
                        本地上传
                      </button>
                      <button 
                        type="button"
                        onClick={async () => {
                          await loadGeneratedContracts();
                          setShowAttachmentSelector(true);
                        }}
                        className="px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-md hover:bg-green-200 flex items-center gap-1"
                      >
                        <FaLink className="w-3.5 h-3.5" />
                        从已生成合同选择
                      </button>
                    </div>
                  </div>
                  
                  {/* 附件列表 */}
                  {attachments.length === 0 ? (
                    <p className="text-sm text-gray-500 py-4 text-center">暂无附件</p>
                  ) : (
                    <div className="space-y-2">
                      {attachments.map((attachment, index) => (
                        <div key={index} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2">
                            {attachment.type === 'local' ? (
                              attachment.name.endsWith('.pdf') ? (
                                <FaFilePdf className="text-red-500" />
                              ) : (
                                <FaFileWord className="text-blue-500" />
                              )
                            ) : (
                              <FaLink className="text-green-600" />
                            )}
                            <span className="text-sm text-gray-700">{attachment.name}</span>
                            {attachment.size && (
                              <span className="text-xs text-gray-400">
                                ({(attachment.size / 1024).toFixed(1)} KB)
                              </span>
                            )}
                          </div>
                          <button 
                            type="button"
                            onClick={() => handleRemoveAttachment(index)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <FaTimes className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowModal(false); }} className="px-4 py-2 bg-gray-500 text-gray-800 rounded-lg">取消</button><button type="submit" className="px-4 py-2 bg-blue-600 text-gray-800 rounded-lg">{editingId ? '保存' : '保存并提交审批'}</button></div>
              </form>
              
              {/* 已生成合同选择器弹窗 */}
              {showAttachmentSelector && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={() => setShowAttachmentSelector(false)}>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-lg font-bold text-gray-800">选择已生成的合同作为附件</h4>
                      <button onClick={() => setShowAttachmentSelector(false)} className="text-gray-500 hover:text-gray-800"><FaTimes /></button>
                    </div>
                    
                    {loadingGeneratedContracts ? (
                      <div className="py-8 text-center text-gray-500">加载中...</div>
                    ) : generatedContracts.length === 0 ? (
                      <div className="py-8 text-center text-gray-500">暂无已生成的合同</div>
                    ) : (
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {generatedContracts.map((contract) => (
                          <button
                            key={contract.id}
                            type="button"
                            onClick={() => handleAddGeneratedContract(contract)}
                            className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-blue-50 flex items-center justify-between"
                          >
                            <div>
                              <div className="font-medium text-gray-800">{contract.contract_no}</div>
                              <div className="text-sm text-gray-500">
                                {contract.contract_templates?.title || '合同'} · {new Date(contract.created_at).toLocaleDateString('zh-CN')}
                              </div>
                            </div>
                            <FaPlus className="text-blue-500" />
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>
      <ContractDeleteConfirmModal open={showDelete} onClose={() => setShowDelete(false)} onConfirm={handleDelete} />
      <ContractReminderDetailModal
        open={showReminderDetail}
        contract={selectedContract}
        signDateLabel={selectedContract?.signing_date?.slice(0, 10) || '-'}
        reminders={contractReminderList}
        onClose={closeReminderDetail}
      />
    </motion.div>);

}