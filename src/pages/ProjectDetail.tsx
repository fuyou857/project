import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaSave, FaPlus, FaTrash, FaCheck, FaTimes, FaUpload, FaArrowLeft, FaEdit, FaEye, FaDownload, FaPrint, FaExclamationTriangle } from 'react-icons/fa';
import { supabase } from '../supabase/client';
import { alertMissingRequiredFields } from '../utils/contractSubPage';
import { getStatusLabel, getStatusColor } from './Projects/types';
import { SearchableSelect, SegmentedControl } from '../components/ui';
import { projectSelectOptions } from '../components/ui/options';

interface Project {
  id: string;
  name: string;
  project_code?: string;
  bid_amount: number;
  duration: string;
  start_date: string;
  end_date: string;
  project_manager: string;
  manager_phone: string;
  manager_id_card_url?: string;
  management_fee_rate: number;
  tax_rate: number;
  cost_ticket_rate?: number;
  management_fee_amount?: number;
  tender_method?: string;
  party_a_id: string;
  party_a_contact?: string;
  stamp_person?: string;
  stamp_person_phone?: string;
  stamp_authorization_url?: string;
  signatory_id: string;
  status?: string;
  owner_name?: string;
  owner_credit_code?: string;
  owner_address?: string;
  owner_bank?: string;
  owner_account?: string;
  owner_contact?: string;
  owner_contact_phone?: string;
}
interface Attachment {id: string;project_id: string;attachment_type: string;file_name: string;file_url: string;}
interface Supplier {id: string;name: string;supply_category: string;supply_content: string;contract_amount: number;contract_file: string;business_license: string;bank_account: string;bank_name: string;bank_license_file: string;remark: string;}
interface PartyB {id: string;unit_name: string;unit_type: string;}
interface PartyA {id: string;name: string;}
interface Signatory {id: string;unit_name: string;}
const ATTACHMENT_TYPES = [{ type: 'contract', label: '施工合同' }, { type: 'bid_notice', label: '中标通知书' }, { type: 'insurance', label: '项目保险' }, { type: 'internal_contract', label: '内部承包合同' }, { type: 'manager_id_card', label: '项目负责人身份证' }, { type: 'stamp_authorization', label: '盖章人委托书附件' }, { type: 'guarantee_letter', label: '项目保函' }, { type: 'counter_guarantee', label: '反担保' }, { type: 'budget', label: '预算书' }, { type: 'settlement', label: '结算书' }, { type: 'audit_report', label: '审计报告' }, { type: 'other', label: '其他' }];
const initialSupplierForm: {
  name: string;
  supply_category: string;
  supply_content: string;
  contract_amount: number | null;
  contract_file: string;
  business_license: string;
  bank_account: string;
  bank_name: string;
  bank_license_file: string;
  remark: string;
} = { name: '', supply_category: '材料', supply_content: '', contract_amount: null, contract_file: '', business_license: '', bank_account: '', bank_name: '', bank_license_file: '', remark: '' };

type ProjectArchiveRow = Record<string, unknown>;
type ArchiveAddForm = Record<string, string>;

function archiveNum(row: ProjectArchiveRow, field: string): number {
  const x = row[field];
  if (typeof x === 'number' && !Number.isNaN(x)) return x;
  if (typeof x === 'string') return parseFloat(x) || 0;
  return 0;
}

function archiveStr(row: ProjectArchiveRow, field: string): string {
  const x = row[field];
  if (typeof x === 'string') return x;
  if (typeof x === 'number' || typeof x === 'boolean') return String(x);
  if (x == null) return '';
  return String(x);
}

function archiveDisplay(row: ProjectArchiveRow, field: string): string {
  const s = archiveStr(row, field);
  return s === '' ? '-' : s;
}

function archiveDateSlice(row: ProjectArchiveRow, field: string): string {
  const s = archiveStr(row, field);
  if (!s) return '-';
  return s.length >= 10 ? s.slice(0, 10) : s;
}

export default function ProjectDetail() {
  const { id } = useParams<{id: string;}>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'info' | 'attachments' | 'suppliers' | 'project-archive'>('info');
  const [project, setProject] = useState<Project | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [partyBList, setPartyBList] = useState<PartyB[]>([]);
  const [partyAList, setPartyAList] = useState<PartyA[]>([]);
  const [signatoryList, setSignatoryList] = useState<Signatory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showAddPartyBModal, setShowAddPartyBModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState<Partial<Project>>({});
  const [supplierForm, setSupplierForm] = useState(initialSupplierForm);
  const [selectedPartyBIds, setSelectedPartyBIds] = useState<string[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [sealRecords, setSealRecords] = useState<ProjectArchiveRow[]>([]);
  const [incomeInvoices, setIncomeInvoices] = useState<ProjectArchiveRow[]>([]);
  const [projectIncome, setProjectIncome] = useState<ProjectArchiveRow[]>([]);
  const [otherIncome, setOtherIncome] = useState<ProjectArchiveRow[]>([]);
  const [expenseInvoices, setExpenseInvoices] = useState<ProjectArchiveRow[]>([]);
  const [paymentRecords, setPaymentRecords] = useState<ProjectArchiveRow[]>([]);
  const [depositRecords, setDepositRecords] = useState<ProjectArchiveRow[]>([]);
  const [otherMatters, setOtherMatters] = useState<ProjectArchiveRow[]>([]);
  const [showAddModal, setShowAddModal] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<ArchiveAddForm>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteRelatedData, setDeleteRelatedData] = useState<{
    attachments: number;
    suppliers: number;
    sealRecords: number;
    incomeInvoices: number;
    expenseInvoices: number;
    paymentRecords: number;
    depositRecords: number;
    otherMatters: number;
  } | null>(null);
  const fileInputRefs = useRef<{[key: string]: HTMLInputElement | null;}>({});
  const [previewFile, setPreviewFile] = useState<{file_name: string;file_url: string;} | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [projRes, attRes, supRes, partyBRes, partyARes, signatoryRes] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).maybeSingle(),
    supabase.from('project_attachments').select('*').eq('project_id', id),
    supabase.from('suppliers').select('*').eq('project_id', id),
    supabase.from('party_b').select('*'),
    supabase.from('party_a').select('id, name'),
    supabase.from('signatory_units').select('id, unit_name')]
    );
    if (projRes.data) {setProject(projRes.data);setFormData(projRes.data);}
    if (attRes.data) setAttachments(attRes.data);
    if (supRes.data) setSuppliers(supRes.data);
    if (partyBRes.data) setPartyBList(partyBRes.data);
    if (partyARes.data) setPartyAList(partyARes.data);
    if (signatoryRes.data) setSignatoryList(signatoryRes.data);
    setLoading(false);
  }, [id]);

  const fetchArchiveData = useCallback(async () => {
    if (!id || id === 'new') {setArchiveLoading(false);return;}
    setArchiveLoading(true);
    try {
      const [sealRes, invRes, payRes, otherIncRes, depRes, matterRes, newOtherIncRes] = await Promise.all([
      supabase.from('seal_usage_records').select('*').eq('project_id', id).eq('usage_type', '项目盖章').order('created_at', { ascending: false }).limit(100),
      supabase.from('cost_invoices').select('*').eq('project_id', id).order('created_at', { ascending: false }).limit(100),
      supabase.from('payment_records').select('*').eq('project_id', id).order('transfer_date', { ascending: false }).limit(100),
      supabase.from('project_other_income').select('*').eq('project_id', id).order('income_date', { ascending: false }).limit(100),
      supabase.from('project_deposit_records').select('*').eq('project_id', id).order('created_at', { ascending: false }).limit(100),
      supabase.from('project_other_matters').select('*').eq('project_id', id).order('created_at', { ascending: false }).limit(100),
      supabase.from('other_incomes').select('*').eq('project_id', id).order('income_date', { ascending: false }).limit(100)]
      );
      setSealRecords(sealRes.data || []);
      setIncomeInvoices(invRes.data || []);
      setPaymentRecords(payRes.data || []);
      const combinedOtherIncome = [...(otherIncRes.data || []), ...(newOtherIncRes.data || [])];
      setOtherIncome(combinedOtherIncome);
      setDepositRecords(depRes.data || []);
      setOtherMatters(matterRes.data || []);
      const incomeRes = await supabase.from('income_invoices').select('*').eq('project_id', id).order('invoice_date', { ascending: false }).limit(100);
      setProjectIncome(incomeRes.data || []);
      const expInvRes = await supabase.from('cost_invoices').select('*').eq('project_id', id).order('invoice_date', { ascending: false }).limit(100);
      setExpenseInvoices(expInvRes.data || []);
    } catch (err) {console.error('fetchArchiveData error:', err);}
    setArchiveLoading(false);
  }, [id]);

  useEffect(() => {if (id && id !== 'new') fetchData();else {setLoading(false);setEditing(true);}}, [id, fetchData]);
  useEffect(() => {if (activeTab === 'project-archive' && id) fetchArchiveData();}, [activeTab, id, fetchArchiveData]);

  const tenderMethodSelectOptions = useMemo(
    () => [
    { value: '', label: '请选择' },
    { value: 'public_tender', label: '公开招标' },
    { value: 'direct_contract', label: '直接发包' }],

    []
  );
  const signatorySelectOptions = useMemo(
    () => projectSelectOptions(signatoryList.map((s) => ({ id: s.id, name: s.unit_name })), '请选择'),
    [signatoryList]
  );
  const partyASelectOptions = useMemo(() => projectSelectOptions(partyAList, '请选择'), [partyAList]);
  const supplyCategorySegments = useMemo(
    () =>
    [
    { value: '人工', label: '人工' },
    { value: '材料', label: '材料' },
    { value: '机械', label: '机械' },
    { value: '其他', label: '其他' }] as
    const,
    []
  );

  async function handleSave() {
    const missing: string[] = [];
    if (!formData.name?.trim()) missing.push('项目名称');
    if (alertMissingRequiredFields(missing)) return
    if (id === 'new') {
      const { data } = await supabase.from('projects').insert(formData).select().maybeSingle();
      if (data) navigate(`/projects/${data.id}`, { replace: true });
    } else {await supabase.from('projects').update(formData).eq('id', id);}
    setEditing(false);
    fetchData();
  }

  async function handleAddSupplier() {
    const missing: string[] = [];
    if (!supplierForm.name?.trim()) missing.push('乙方单位名称');
    if (!supplierForm.contract_amount || supplierForm.contract_amount <= 0) missing.push('合同金额');
    if (alertMissingRequiredFields(missing)) return
    await supabase.from('suppliers').insert({ project_id: id, name: supplierForm.name, supply_category: supplierForm.supply_category, supply_content: supplierForm.supply_content, contract_amount: supplierForm.contract_amount, contract_file: supplierForm.contract_file, business_license: supplierForm.business_license, bank_account: supplierForm.bank_account, bank_name: supplierForm.bank_name, bank_license_file: supplierForm.bank_license_file, remark: supplierForm.remark, status: 'active' });
    setShowSupplierModal(false);
    setSupplierForm(initialSupplierForm);
    fetchData();
  }

  async function handleAddSelectedPartyB() {
    if (!id || selectedPartyBIds.length === 0) return;
    for (const partyBId of selectedPartyBIds) {
      const partyB = partyBList.find((p) => p.id === partyBId);
      if (partyB) {
        await supabase.from('suppliers').insert({ project_id: id, name: partyB.unit_name, supply_category: partyB.unit_type || '材料', contract_amount: 0, status: 'active' });
      }
    }
    setShowAddPartyBModal(false);
    setSelectedPartyBIds([]);
    fetchData();
  }

  async function handleUpdateSupplier() {
    if (!editingSupplier || !id) return;
    await supabase.from('suppliers').update({ name: editingSupplier.name, supply_category: editingSupplier.supply_category, supply_content: editingSupplier.supply_content, contract_amount: editingSupplier.contract_amount }).eq('id', editingSupplier.id);
    setEditingSupplier(null);
    fetchData();
  }

  async function handleDeleteSupplier(supplierId: string) {
    if (!confirm('确定要删除此乙方单位吗？')) return;
    await supabase.from('suppliers').delete().eq('id', supplierId);
    fetchData();
  }

  async function fetchRelatedDataForDelete() {
    if (!id) return null;
    const [attRes, supRes, sealRes, incInvRes, expInvRes, payRes, depRes, matRes] = await Promise.all([
    supabase.from('project_attachments').select('id', { count: 'exact' }).eq('project_id', id),
    supabase.from('suppliers').select('id', { count: 'exact' }).eq('project_id', id),
    supabase.from('seal_usage_records').select('id', { count: 'exact' }).eq('project_id', id),
    supabase.from('income_invoices').select('id', { count: 'exact' }).eq('project_id', id),
    supabase.from('cost_invoices').select('id', { count: 'exact' }).eq('project_id', id),
    supabase.from('payment_records').select('id', { count: 'exact' }).eq('project_id', id),
    supabase.from('project_deposit_records').select('id', { count: 'exact' }).eq('project_id', id),
    supabase.from('project_other_matters').select('id', { count: 'exact' }).eq('project_id', id)]
    );
    return {
      attachments: attRes.count || 0,
      suppliers: supRes.count || 0,
      sealRecords: sealRes.count || 0,
      incomeInvoices: incInvRes.count || 0,
      expenseInvoices: expInvRes.count || 0,
      paymentRecords: payRes.count || 0,
      depositRecords: depRes.count || 0,
      otherMatters: matRes.count || 0
    };
  }

  async function handleDeleteProjectClick() {
    if (!id) return;
    const relatedData = await fetchRelatedDataForDelete();
    setDeleteRelatedData(relatedData);
    setShowDeleteConfirm(true);
  }

  async function handleConfirmDeleteProject() {
    if (!id) return;
    try {
      await supabase.from('projects').delete().eq('id', id);
      navigate('/projects');
    } catch (err) {
      alert('删除失败');
    }
  }

  async function handleAttachmentUpload(type: string, file: File) {
    if (!id || id === 'new') {alert('请先保存项目，再上传附件');return;}
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      const ext = file.name.split('.').pop();
      const path = `project_attachments/${id}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
      const { error } = await supabase.storage.from('files').upload(path, Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)), { contentType: file.type });
      if (error) return alert('上传失败');
      const { data: { publicUrl } } = supabase.storage.from('files').getPublicUrl(path);
      await supabase.from('project_attachments').insert({ project_id: id, attachment_type: type, file_name: file.name, file_url: publicUrl });
      fetchData();
    };
  }

  async function handleDeleteAttachment(attachmentId: string, fileUrl: string) {
    if (!confirm('确定要删除这个附件吗？')) return;
    try {
      const path = fileUrl.split('/').slice(-4).join('/');
      await supabase.storage.from('files').remove([path]);
      await supabase.from('project_attachments').delete().eq('id', attachmentId);
      fetchData();
    } catch (err) {
      alert('删除失败');
    }
  }

  function isPreviewable(fileName: string): boolean {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    return ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext);
  }

  function handlePreview(file: {file_name: string;file_url: string;}) {
    setPreviewFile(file);
  }

  function handleDownload(file_url: string, file_name: string) {
    const link = document.createElement('a');
    link.href = file_url;
    link.download = file_name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handlePrint(file_url: string, _file_name: string) {
    const printWindow = window.open(file_url, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 500);
      };
    }
  }

  async function handleAddArchiveRecord() {
    if (!id) return;
    if (showAddModal === 'otherIncome') {
      await supabase.from('project_other_income').insert({
        project_id: id,
        income_date: addForm.income_date ?? '',
        income_amount: parseFloat(addForm.income_amount ?? '') || 0,
        payer_name: addForm.payer_name || null,
        remark: addForm.remark || null
      });
    } else if (showAddModal === 'deposit') {
      await supabase.from('project_deposit_records').insert({
        project_id: id,
        bid_bond: parseFloat(addForm.bid_bond ?? '') || null,
        bid_bond_remark: addForm.bid_bond_remark || null,
        performance_bond: parseFloat(addForm.performance_bond ?? '') || null,
        performance_bond_remark: addForm.performance_bond_remark || null,
        quality_bond: parseFloat(addForm.quality_bond ?? '') || null,
        quality_bond_remark: addForm.quality_bond_remark || null
      });
    } else if (showAddModal === 'matters') {
      await supabase.from('project_other_matters').insert({ project_id: id, content: addForm.content ?? '' });
    }
    setShowAddModal(null);
    setAddForm({});
    fetchArchiveData();
  }


  const formatMoney = (amount: number) => `¥${(amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
  const incomeTotal = projectIncome.reduce((sum, i) => sum + archiveNum(i, 'invoice_amount'), 0);
  const otherIncomeTotal = otherIncome.reduce((sum, i) => sum + archiveNum(i, 'income_amount'), 0);
  const totalIncome = incomeTotal + otherIncomeTotal;
  const expenseTotal = expenseInvoices.reduce((sum, i) => sum + archiveNum(i, 'invoice_amount'), 0);
  const paymentTotal = paymentRecords.reduce((sum, p) => sum + archiveNum(p, 'amount'), 0);
  const remaining = totalIncome - paymentTotal;

  const getPartyAName = (partyAId: string | undefined) => {
    if (!partyAId) return '-';
    const partyA = partyAList.find((p) => p.id === partyAId);
    return partyA?.name || '-';
  };

  const getSignatoryName = (signatoryId: string | undefined) => {
    if (!signatoryId) return '-';
    const signatory = signatoryList.find((s) => s.id === signatoryId);
    return signatory?.unit_name || '-';
  };

  const getTenderMethodLabel = (method: string | undefined) => {
    if (!method) return '-';
    return (() => {if (method === 'public_tender') {return '公开招标';} else {if (method === 'direct_contract') {return '直接发包';} else {return method;}}})();
  };

  if (loading) return <div className="text-center text-gray-500 py-12">加载中...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/projects')} className="p-2 text-gray-500 hover:text-gray-700"><FaArrowLeft /></button>
          <h2 className="text-2xl font-bold text-gray-800">{(() => {if (editing) {if (id === 'new') {return '新建项目';} else {return '编辑项目';}} else {return project?.name;}})()}</h2>
          {project?.status && !editing &&
          <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(project.status)}`}>
              {getStatusLabel(project.status)}
            </span>
          }
        </div>
        <div className="flex gap-2">
          {editing ?
          <>
              <button onClick={() => id === 'new' ? navigate('/projects') : setEditing(false)} className="px-4 py-2 bg-gray-500 text-white rounded-lg flex items-center gap-2"><FaTimes /> 取消</button>
              <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2"><FaSave /> 保存</button>
            </> :

          <>
              <button onClick={handleDeleteProjectClick} className="px-4 py-2 bg-red-600 text-white rounded-lg flex items-center gap-2"><FaTrash /> 删除项目</button>
              <button onClick={() => setEditing(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg">编辑项目</button>
            </>
          }
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200 pb-2">
        {(['info', 'attachments', 'suppliers', 'project-archive'] as const).map((tab) =>
        <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-t-lg ${activeTab === tab ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
            {(() => {if (tab === 'info') {return '项目信息';} else {if (tab === 'attachments') {return '附件管理';} else {if (tab === 'suppliers') {return '乙方单位管理';} else {return '项目档案表';}}}})()}
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'info' &&
        <motion.div key="info" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* 一、基本信息 */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <h4 className="text-gray-800 font-medium mb-4 text-lg">一、基本信息</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">项目编号</label>
                  {editing ?
                <input type="text" value={formData.project_code || ''} onChange={(e) => setFormData({ ...formData, project_code: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800" /> :

                <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-800">{formData.project_code || '-'}</div>
                }
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">项目名称 <span className="text-red-500">*</span></label>
                  {editing ?
                <input type="text" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800" /> :

                <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-800">{formData.name || '-'}</div>
                }
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">中标金额(万元)</label>
                  {editing ?
                <input type="number" step="0.01" value={formData.bid_amount ?? ''} onChange={(e) => {const v = parseFloat(e.target.value);setFormData({ ...formData, bid_amount: Number.isFinite(v) ? v : undefined });}} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800" /> :

                <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-800">{formData.bid_amount ? formData.bid_amount.toLocaleString() : '-'}</div>
                }
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">工期（天）</label>
                  {editing ?
                <input type="number" value={formData.duration || ''} onChange={(e) => setFormData({ ...formData, duration: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800" /> :

                <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-800">{formData.duration || '-'}</div>
                }
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">开工日期</label>
                  {editing ?
                <input type="date" value={formData.start_date || ''} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800" /> :

                <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-800">{formData.start_date || '-'}</div>
                }
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">竣工日期</label>
                  {editing ?
                <input type="date" value={formData.end_date || ''} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800" /> :

                <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-800">{formData.end_date || '-'}</div>
                }
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">招标方式</label>
                  {editing ?
                <SearchableSelect
                  value={formData.tender_method || ''}
                  onChange={(v) => setFormData({ ...formData, tender_method: v })}
                  options={tenderMethodSelectOptions}
                  placeholder="请选择"
                  emptyLabel="请选择"
                  searchThreshold={10}
                  metricsContext="page:project_detail:tender_method" /> :


                <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-800">{getTenderMethodLabel(formData.tender_method)}</div>
                }
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">状态</label>
                  {editing ?
                <SegmentedControl
                  value={formData.status || 'not_started'}
                  onChange={(v) => setFormData({ ...formData, status: v })}
                  options={[
                  { value: 'not_started', label: '未开工' },
                  { value: 'in_progress', label: '进行中' },
                  { value: 'completed', label: '已完工' }]
                  }
                  metricsContext="page:project_detail:project_status"
                  aria-label="项目状态" /> :


                <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-800">{getStatusLabel(formData.status || 'not_started')}</div>
                }
                </div>
              </div>
            </div>

            {/* 二、费用信息 */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <h4 className="text-gray-800 font-medium mb-4 text-lg">二、费用信息</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">管理费比例(%)</label>
                  {editing ?
                <input type="number" step="0.01" value={formData.management_fee_rate ?? ''} onChange={(e) => {const v = parseFloat(e.target.value);setFormData({ ...formData, management_fee_rate: Number.isFinite(v) ? v : undefined });}} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800" /> :

                <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-800">{formData.management_fee_rate || '-'}</div>
                }
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">管理费金额(万元)</label>
                  {editing ?
                <input type="number" step="0.01" value={formData.management_fee_amount ?? ''} onChange={(e) => {const v = parseFloat(e.target.value);setFormData({ ...formData, management_fee_amount: Number.isFinite(v) ? v : undefined });}} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800" /> :

                <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-800">{formData.management_fee_amount ? formData.management_fee_amount.toLocaleString() : '-'}</div>
                }
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">成本票比例(%)</label>
                  {editing ?
                <input type="number" step="0.01" value={formData.cost_ticket_rate ?? ''} onChange={(e) => {const v = parseFloat(e.target.value);setFormData({ ...formData, cost_ticket_rate: Number.isFinite(v) ? v : undefined });}} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800" /> :

                <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-800">{formData.cost_ticket_rate || '-'}</div>
                }
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">综合税率(%)</label>
                  {editing ?
                <input type="number" step="0.01" value={formData.tax_rate ?? ''} onChange={(e) => {const v = parseFloat(e.target.value);setFormData({ ...formData, tax_rate: Number.isFinite(v) ? v : undefined });}} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800" /> :

                <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-800">{formData.tax_rate || '-'}</div>
                }
                </div>
              </div>
            </div>

            {/* 三、项目负责人 */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <h4 className="text-gray-800 font-medium mb-4 text-lg">三、项目负责人</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">项目负责人</label>
                  {editing ?
                <input type="text" value={formData.project_manager || ''} onChange={(e) => setFormData({ ...formData, project_manager: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800" /> :

                <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-800">{formData.project_manager || '-'}</div>
                }
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">负责人电话</label>
                  {editing ?
                <input type="text" value={formData.manager_phone || ''} onChange={(e) => setFormData({ ...formData, manager_phone: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800" /> :

                <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-800">{formData.manager_phone || '-'}</div>
                }
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">负责人身份证</label>
                  {editing ?
                <input type="text" value={formData.manager_id_card_url || ''} onChange={(e) => setFormData({ ...formData, manager_id_card_url: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800" /> :

                <div className="px-3 py-2 bg-gray-50 rounded-lg">
                      {formData.manager_id_card_url ?
                  <div className="flex gap-2">
                          <button onClick={() => {const u = formData.manager_id_card_url;if (u) handlePreview({ file_name: '身份证.jpg', file_url: u });}} className="text-blue-600 hover:underline flex items-center gap-1">
                            <FaEye className="w-4 h-4" /> 预览
                          </button>
                          <button onClick={() => {const u = formData.manager_id_card_url;if (u) handleDownload(u, '身份证.jpg');}} className="text-green-600 hover:underline flex items-center gap-1">
                            <FaDownload className="w-4 h-4" /> 下载
                          </button>
                        </div> :
                  <span className="text-gray-800">-</span>}
                    </div>
                }
                </div>
              </div>
            </div>

            {/* 四、签约单位 */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <h4 className="text-gray-800 font-medium mb-4 text-lg">四、签约单位</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">签约单位</label>
                  {editing ?
                <SearchableSelect
                  value={formData.signatory_id || ''}
                  onChange={(v) => setFormData({ ...formData, signatory_id: v })}
                  options={signatorySelectOptions}
                  placeholder="请选择"
                  emptyLabel="请选择"
                  searchPlaceholder="搜索签约单位…"
                  metricsContext="page:project_detail:signatory" /> :


                <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-800">{getSignatoryName(formData.signatory_id)}</div>
                }
                </div>
              </div>
            </div>

            {/* 五、建设单位 */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <h4 className="text-gray-800 font-medium mb-4 text-lg">五、建设单位</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">建设单位</label>
                  {editing ?
                <SearchableSelect
                  value={formData.party_a_id || ''}
                  onChange={(v) => setFormData({ ...formData, party_a_id: v })}
                  options={partyASelectOptions}
                  placeholder="请选择"
                  emptyLabel="请选择"
                  searchPlaceholder="搜索建设单位…"
                  metricsContext="page:project_detail:party_a" /> :


                <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-800">{getPartyAName(formData.party_a_id)}</div>
                }
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">建设单位联系人</label>
                  {editing ?
                <input type="text" value={formData.party_a_contact || ''} onChange={(e) => setFormData({ ...formData, party_a_contact: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800" /> :

                <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-800">{formData.party_a_contact || '-'}</div>
                }
                </div>
              </div>
            </div>

            {/* 六、盖章授权 */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <h4 className="text-gray-800 font-medium mb-4 text-lg">六、盖章授权</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">盖章人</label>
                  {editing ?
                <input type="text" value={formData.stamp_person || ''} onChange={(e) => setFormData({ ...formData, stamp_person: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800" /> :

                <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-800">{formData.stamp_person || '-'}</div>
                }
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">盖章人电话</label>
                  {editing ?
                <input type="text" value={formData.stamp_person_phone || ''} onChange={(e) => setFormData({ ...formData, stamp_person_phone: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800" /> :

                <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-800">{formData.stamp_person_phone || '-'}</div>
                }
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">盖章授权书</label>
                  {editing ?
                <input type="text" value={formData.stamp_authorization_url || ''} onChange={(e) => setFormData({ ...formData, stamp_authorization_url: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800" /> :

                <div className="px-3 py-2 bg-gray-50 rounded-lg">
                      {formData.stamp_authorization_url ?
                  <div className="flex gap-2">
                          <button onClick={() => {const u = formData.stamp_authorization_url;if (u) handlePreview({ file_name: '盖章授权书.pdf', file_url: u });}} className="text-blue-600 hover:underline flex items-center gap-1">
                            <FaEye className="w-4 h-4" /> 预览
                          </button>
                          <button onClick={() => {const u = formData.stamp_authorization_url;if (u) handleDownload(u, '盖章授权书.pdf');}} className="text-green-600 hover:underline flex items-center gap-1">
                            <FaDownload className="w-4 h-4" /> 下载
                          </button>
                        </div> :
                  <span className="text-gray-800">-</span>}
                    </div>
                }
                </div>
              </div>
            </div>
          </motion.div>
        }

        {activeTab === 'attachments' &&
        <motion.div key="attachments" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ATTACHMENT_TYPES.map((att) => {
              const files = attachments.filter((a) => a.attachment_type === att.type);
              return (
                <div key={att.type} className="border border-gray-200 rounded-lg p-3 bg-gray-50/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-base ${files.length > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                          {files.length > 0 ? <FaCheck /> : <FaUpload />}
                        </span>
                        <span className="text-gray-800 font-medium text-sm">{att.label}</span>
                        {files.length > 0 &&
                      <span className="text-xs text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded-full">
                            {files.length}
                          </span>
                      }
                      </div>
                      <input
                      type="file"
                      ref={(el) => fileInputRefs.current[att.type] = el}
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleAttachmentUpload(att.type, e.target.files[0])} />
                    
                      <button
                      onClick={() => fileInputRefs.current[att.type]?.click()}
                      disabled={!id || id === 'new'}
                      className="px-2 py-1 bg-gray-500 hover:bg-gray-600 text-white text-xs rounded flex items-center gap-1">
                      
                        <FaPlus className="w-3 h-3" /> 添加
                      </button>
                    </div>
                    
                    {files.length === 0 ?
                  <div className="text-gray-400 text-xs text-center py-2">点击上方按钮添加</div> :

                  <div className="space-y-1.5">
                        {files.map((file) =>
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-2 bg-white rounded border border-gray-200 hover:bg-gray-100 rounded-lg transition-colors">
                      
                            <div className="flex-1 min-w-0">
                              <div className="text-gray-800 text-sm truncate">{file.file_name}</div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {isPreviewable(file.file_name) &&
                        <>
                                  <button
                            onClick={() => handlePreview(file)}
                            className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded"
                            title="预览">
                            
                                    <FaEye className="w-3 h-3" />
                                  </button>
                                  <button
                            onClick={() => handlePrint(file.file_url, file.file_name)}
                            className="p-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded"
                            title="打印">
                            
                                    <FaPrint className="w-3 h-3" />
                                  </button>
                                </>
                        }
                              <button
                          onClick={() => handleDownload(file.file_url, file.file_name)}
                          className="p-1.5 bg-green-600 hover:bg-green-500 text-white rounded"
                          title="下载">
                          
                                <FaDownload className="w-3 h-3" />
                              </button>
                              <button
                          onClick={() => handleDeleteAttachment(file.id, file.file_url)}
                          className="p-1.5 bg-red-600 hover:bg-red-500 text-white rounded"
                          title="删除">
                          
                                <FaTrash className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                    )}
                      </div>
                  }
                  </div>);

            })}
            </div>
          </motion.div>
        }

        {activeTab === 'suppliers' &&
        <motion.div key="suppliers" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div className="text-gray-800 font-medium">本项目乙方单位列表</div>
              <div className="flex gap-2">
                <button onClick={() => setShowAddPartyBModal(true)} className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2 hover:bg-green-700"><FaPlus /> 从乙方单位库添加</button>
                <button onClick={() => {setEditingSupplier(null);setSupplierForm(initialSupplierForm);setShowSupplierModal(true);}} className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700"><FaPlus /> 新增乙方单位</button>
              </div>
            </div>
            {suppliers.length === 0 ? <div className="text-center text-gray-500 py-12"><div className="mb-2">暂无乙方单位</div><div className="text-sm">请先添加项目乙方单位</div></div> :
          <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500 text-sm">
                      <th className="text-left py-3 px-3">乙方单位名称</th>
                      <th className="text-left py-3 px-3">类别</th>
                      <th className="text-right py-3 px-3">合同金额</th>
                      <th className="text-right py-3 px-3">已开票金额</th>
                      <th className="text-right py-3 px-3">已付款金额</th>
                      <th className="text-right py-3 px-3">尚欠金额</th>
                      <th className="text-center py-3 px-3">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map((s) => {
                  const supplierInvoices = incomeInvoices.filter((inv) => archiveStr(inv, 'supplier_id') === s.id);
                  const supplierPayments = paymentRecords.filter((pay) => archiveStr(pay, 'supplier_id') === s.id);
                  const invoicedAmount = supplierInvoices.reduce((sum, inv) => sum + archiveNum(inv, 'invoice_amount'), 0);
                  const paidAmount = supplierPayments.reduce((sum, pay) => sum + archiveNum(pay, 'amount'), 0);
                  const owedAmount = invoicedAmount - paidAmount;
                  return (
                    <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-3 text-gray-800 font-medium">{s.name}</td>
                          <td className="py-3 px-3"><span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">{s.supply_category}</span></td>
                          <td className="py-3 px-3 text-right text-green-600">{s.contract_amount?.toFixed(2) || '0.00'}</td>
                          <td className="py-3 px-3 text-right text-blue-600">{formatMoney(invoicedAmount)}</td>
                          <td className="py-3 px-3 text-right text-purple-600">{formatMoney(paidAmount)}</td>
                          <td className="py-3 px-3 text-right text-yellow-600">{formatMoney(owedAmount)}</td>
                          <td className="py-3 px-3">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => {setViewingSupplier(s);setShowDetailModal(true);}} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded"><FaEye /></button>
                              <button onClick={() => {setEditingSupplier(s);setShowSupplierModal(true);}} className="p-2 text-gray-500 hover:text-yellow-600 hover:bg-gray-100 rounded"><FaEdit /></button>
                              <button onClick={() => handleDeleteSupplier(s.id)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded"><FaTrash /></button>
                            </div>
                          </td>
                        </tr>);

                })}
                  </tbody>
                </table>
              </div>
          }
          </motion.div>
        }

        {activeTab === 'project-archive' &&
        <motion.div key="project-archive" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {archiveLoading ? <div className="text-center text-gray-500 py-12">加载中...</div> :
          <>
                <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-gray-800 font-medium">1. 盖章记录</h3>
                  </div>
                  {sealRecords.length === 0 ? <div className="text-gray-500 text-center py-4">暂无数据</div> :
              <table className="w-full text-sm"><thead><tr className="border-b border-gray-200 text-gray-500"><th className="text-left py-2 px-2">时间</th><th className="text-left py-2 px-2">盖章内容</th><th className="text-left py-2 px-2">份数</th><th className="text-left py-2 px-2">盖章人姓名</th><th className="text-left py-2 px-2">盖章人电话</th></tr></thead><tbody>{sealRecords.map((r, _i) => <tr key={archiveStr(r, 'id') || `seal-${_i}`} className="border-b border-gray-100"><td className="py-2 px-2 text-gray-700">{archiveDateSlice(r, 'created_at')}</td><td className="py-2 px-2 text-blue-600">{archiveDisplay(r, 'usage_reason')}</td><td className="py-2 px-2 text-gray-700">{archiveDisplay(r, 'copies')}</td><td className="py-2 px-2 text-gray-700">{archiveDisplay(r, 'borrower_name')}</td><td className="py-2 px-2 text-gray-700">{archiveDisplay(r, 'borrower_phone')}</td></tr>)}</tbody></table>
              }
                </div>

                <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-gray-800 font-medium">2. 开票记录（收入）</h3>
                  </div>
                  {projectIncome.length === 0 ? <div className="text-gray-500 text-center py-4">暂无数据</div> :
              <><table className="w-full text-sm"><thead><tr className="border-b border-gray-200 text-gray-500"><th className="text-left py-2 px-2">序号</th><th className="text-left py-2 px-2">时间</th><th className="text-right py-2 px-2">开票金额</th><th className="text-left py-2 px-2">开票公司</th><th className="text-left py-2 px-2">收款人</th><th className="text-left py-2 px-2">备注</th></tr></thead><tbody>{projectIncome.map((r, i) => <tr key={archiveStr(r, 'id') || `pi-${i}`} className="border-b border-gray-100"><td className="py-2 px-2 text-gray-700">{i + 1}</td><td className="py-2 px-2 text-gray-700">{archiveDisplay(r, 'invoice_date')}</td><td className="py-2 px-2 text-right text-green-600">{formatMoney(archiveNum(r, 'invoice_amount'))}</td><td className="py-2 px-2 text-gray-700">{archiveDisplay(r, 'invoice_company')}</td><td className="py-2 px-2 text-gray-700">{archiveDisplay(r, 'payee')}</td><td className="py-2 px-2 text-gray-700">{archiveDisplay(r, 'remark')}</td></tr>)}</tbody></table><div className="text-right text-gray-800 mt-2">合计：{formatMoney(incomeTotal)}</div></>
              }
                </div>

                <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-gray-800 font-medium">3. 工程款收入</h3>
                  </div>
                  {incomeInvoices.length === 0 ? <div className="text-gray-500 text-center py-4">暂无数据</div> :
              <><table className="w-full text-sm"><thead><tr className="border-b border-gray-200 text-gray-500"><th className="text-left py-2 px-2">序号</th><th className="text-left py-2 px-2">到账时间</th><th className="text-right py-2 px-2">到账工程款金额</th><th className="text-left py-2 px-2">到账公司</th><th className="text-left py-2 px-2">备注</th></tr></thead><tbody>{incomeInvoices.map((r, i) => <tr key={archiveStr(r, 'id') || `ii-${i}`} className="border-b border-gray-100"><td className="py-2 px-2 text-gray-700">{i + 1}</td><td className="py-2 px-2 text-gray-700">{archiveDisplay(r, 'invoice_date')}</td><td className="py-2 px-2 text-right text-green-600">{formatMoney(archiveNum(r, 'invoice_amount'))}</td><td className="py-2 px-2 text-gray-700">{archiveDisplay(r, 'invoice_company')}</td><td className="py-2 px-2 text-gray-700">{archiveDisplay(r, 'remark')}</td></tr>)}</tbody></table><div className="text-right text-gray-800 mt-2">合计：{formatMoney(incomeTotal)}</div></>
              }
                </div>

                <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-gray-800 font-medium">4. 其他收入</h3>
                    <button onClick={() => {setShowAddModal('otherIncome');setAddForm({ income_date: new Date().toISOString().split('T')[0] });}} className="px-3 py-1 bg-blue-600 text-white text-sm rounded flex items-center gap-1"><FaPlus /> 添加</button>
                  </div>
                  {otherIncome.length === 0 ? <div className="text-gray-500 text-center py-4">暂无数据</div> :
              <><table className="w-full text-sm"><thead><tr className="border-b border-gray-200 text-gray-500"><th className="text-left py-2 px-2">序号</th><th className="text-left py-2 px-2">到账时间</th><th className="text-right py-2 px-2">收入金额</th><th className="text-left py-2 px-2">到账公司</th><th className="text-left py-2 px-2">备注</th></tr></thead><tbody>{otherIncome.map((r, i) => <tr key={archiveStr(r, 'id') || `oi-${i}`} className="border-b border-gray-100"><td className="py-2 px-2 text-gray-700">{i + 1}</td><td className="py-2 px-2 text-gray-700">{archiveDisplay(r, 'income_date')}</td><td className="py-2 px-2 text-right text-green-600">{formatMoney(archiveNum(r, 'income_amount'))}</td><td className="py-2 px-2 text-gray-700">{archiveDisplay(r, 'payer_name')}</td><td className="py-2 px-2 text-gray-700">{archiveDisplay(r, 'remark')}</td></tr>)}</tbody></table><div className="text-right text-gray-800 mt-2">合计：{formatMoney(otherIncomeTotal)}</div></>
              }
                </div>

                <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-gray-800 font-medium">5. 收入合计</h3>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <span className="text-gray-600">总合计：</span>
                    <span className="text-2xl font-bold text-blue-600 ml-2">{formatMoney(totalIncome)}</span>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-gray-800 font-medium">6. 支出发票记录</h3>
                  </div>
                  {expenseInvoices.length === 0 ? <div className="text-gray-500 text-center py-4">暂无数据</div> :
              <><table className="w-full text-sm"><thead><tr className="border-b border-gray-200 text-gray-500"><th className="text-left py-2 px-2">序号</th><th className="text-left py-2 px-2">支出时间</th><th className="text-left py-2 px-2">发票类型</th><th className="text-right py-2 px-2">发票含税金额</th><th className="text-left py-2 px-2">提供人姓名</th></tr></thead><tbody>{expenseInvoices.map((r, i) => <tr key={archiveStr(r, 'id') || `ei-${i}`} className="border-b border-gray-100"><td className="py-2 px-2 text-gray-700">{i + 1}</td><td className="py-2 px-2 text-gray-700">{archiveDisplay(r, 'invoice_date')}</td><td className="py-2 px-2 text-gray-700">{archiveDisplay(r, 'invoice_type')}</td><td className="py-2 px-2 text-right text-red-600">{formatMoney(archiveNum(r, 'invoice_amount'))}</td><td className="py-2 px-2 text-gray-700">{archiveDisplay(r, 'provider_name')}</td></tr>)}</tbody></table><div className="text-right text-gray-800 mt-2">合计：{formatMoney(expenseTotal)}</div></>
              }
                </div>

                <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-gray-800 font-medium">7. 工程款拨付记录</h3>
                  </div>
                  {paymentRecords.length === 0 ? <div className="text-gray-500 text-center py-4">暂无数据</div> :
              <><table className="w-full text-sm"><thead><tr className="border-b border-gray-200 text-gray-500"><th className="text-left py-2 px-2">序号</th><th className="text-left py-2 px-2">支付时间</th><th className="text-left py-2 px-2">类型</th><th className="text-left py-2 px-2">收款单位</th><th className="text-right py-2 px-2">金额</th><th className="text-left py-2 px-2">备注</th></tr></thead><tbody>{paymentRecords.map((r, i) => <tr key={archiveStr(r, 'id') || `pr-${i}`} className="border-b border-gray-100"><td className="py-2 px-2 text-gray-700">{i + 1}</td><td className="py-2 px-2 text-gray-700">{archiveDisplay(r, 'transfer_date')}</td><td className="py-2 px-2 text-gray-700">{archiveDisplay(r, 'payment_type')}</td><td className="py-2 px-2 text-gray-700">{archiveDisplay(r, 'supplier_name')}</td><td className="py-2 px-2 text-right text-red-600">{formatMoney(archiveNum(r, 'amount'))}</td><td className="py-2 px-2 text-gray-700">{archiveDisplay(r, 'remark')}</td></tr>)}</tbody></table><div className="text-right text-gray-800 mt-2">合计：{formatMoney(paymentTotal)}</div></>
              }
                </div>

                <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-gray-800 font-medium">8. 其它金额记录</h3>
                    <button onClick={() => {setShowAddModal('deposit');setAddForm({});}} className="px-3 py-1 bg-blue-600 text-white text-sm rounded flex items-center gap-1"><FaPlus /> 添加</button>
                  </div>
                  {depositRecords.length === 0 ? <div className="text-gray-500 text-center py-4">暂无数据</div> :
              <table className="w-full text-sm"><thead><tr className="border-b border-gray-200 text-gray-500"><th className="text-left py-2 px-2">序号</th><th className="text-right py-2 px-2">项目保证金</th><th className="text-left py-2 px-2">备注</th><th className="text-right py-2 px-2">工程投标保证金</th><th className="text-left py-2 px-2">备注</th><th className="text-right py-2 px-2">质量保证金</th><th className="text-left py-2 px-2">备注</th></tr></thead><tbody>{depositRecords.map((r, i) => <tr key={archiveStr(r, 'id') || `dr-${i}`} className="border-b border-gray-100"><td className="py-2 px-2 text-gray-700">{i + 1}</td><td className="py-2 px-2 text-right text-yellow-600">{archiveNum(r, 'bid_bond') ? formatMoney(archiveNum(r, 'bid_bond')) : '-'}</td><td className="py-2 px-2 text-gray-700">{archiveDisplay(r, 'bid_bond_remark')}</td><td className="py-2 px-2 text-right text-yellow-600">{archiveNum(r, 'performance_bond') ? formatMoney(archiveNum(r, 'performance_bond')) : '-'}</td><td className="py-2 px-2 text-gray-700">{archiveDisplay(r, 'performance_bond_remark')}</td><td className="py-2 px-2 text-right text-yellow-600">{archiveNum(r, 'quality_bond') ? formatMoney(archiveNum(r, 'quality_bond')) : '-'}</td><td className="py-2 px-2 text-gray-700">{archiveDisplay(r, 'quality_bond_remark')}</td></tr>)}</tbody></table>
              }
                </div>

                <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-gray-800 font-medium">9. 其它事项记录</h3>
                    <button onClick={() => {setShowAddModal('matters');setAddForm({});}} className="px-3 py-1 bg-blue-600 text-white text-sm rounded flex items-center gap-1"><FaPlus /> 添加</button>
                  </div>
                  {otherMatters.length === 0 ? <div className="text-gray-500 text-center py-4">暂无数据</div> :
              <div className="space-y-2">{otherMatters.map((r, idx) => <div key={archiveStr(r, 'id') || `om-${idx}`} className="p-3 bg-gray-50 rounded-lg text-gray-700">{archiveDisplay(r, 'content')}</div>)}</div>
              }
                </div>

                <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                  <h3 className="text-gray-800 font-medium mb-3">剩余工程款</h3>
                  <div className={`text-2xl font-bold ${remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>剩余工程款：{formatMoney(remaining)}</div>
                  <div className="text-gray-500 text-sm mt-1">= 工程款收入合计 {formatMoney(incomeTotal)} - 工程款拨付合计 {formatMoney(paymentTotal)}</div>
                </div>
              </>
          }
          </motion.div>
        }
      </AnimatePresence>

      <AnimatePresence>
        {showSupplierModal &&
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && setShowSupplierModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200">
              <div className="flex items-center justify-between mb-6"><h3 className="text-xl font-bold text-gray-800">{editingSupplier ? '编辑乙方单位' : '新增乙方单位'}</h3><button onClick={() => setShowSupplierModal(false)} className="text-gray-500 hover:text-gray-800"><FaTimes /></button></div>
              {editingSupplier ?
            <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm text-gray-500 mb-2">乙方单位名称 *</label><input type="text" value={editingSupplier.name} onChange={(e) => setEditingSupplier({ ...editingSupplier, name: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div><div><label className="block text-sm text-gray-500 mb-2">供应类别 *</label><SegmentedControl value={editingSupplier.supply_category} onChange={(v) => setEditingSupplier({ ...editingSupplier, supply_category: v })} options={[...supplyCategorySegments]} metricsContext="page:project_detail:supplier_edit_category" aria-label="供应类别" /></div></div>
                  <div><label className="block text-sm text-gray-500 mb-2">合同金额(万元) *</label><input type="number" step="0.01" value={editingSupplier.contract_amount || 0} onChange={(e) => setEditingSupplier({ ...editingSupplier, contract_amount: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                  <div className="flex justify-end gap-3 pt-4"><button onClick={() => setShowSupplierModal(false)} className="px-4 py-2 bg-gray-500 text-white rounded-lg">取消</button><button onClick={handleUpdateSupplier} className="px-4 py-2 bg-blue-600 text-white rounded-lg">保存修改</button></div>
                </div> :

            <form onSubmit={(e) => {e.preventDefault();handleAddSupplier();}} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm text-gray-500 mb-2">乙方单位名称 *</label><input type="text" required value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div><div><label className="block text-sm text-gray-500 mb-2">供应类别 *</label><SegmentedControl value={supplierForm.supply_category} onChange={(v) => setSupplierForm({ ...supplierForm, supply_category: v })} options={[...supplyCategorySegments]} metricsContext="page:project_detail:supplier_add_category" aria-label="供应类别" /></div></div>
                  <div><label className="block text-sm text-gray-500 mb-2">合同金额(万元) *</label><input type="number" required step="0.01" min="0" value={supplierForm.contract_amount ?? ''} onChange={(e) => setSupplierForm({ ...supplierForm, contract_amount: parseFloat(e.target.value) || null })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                  <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={() => setShowSupplierModal(false)} className="px-4 py-2 bg-gray-500 text-white rounded-lg">取消</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">新增</button></div>
                </form>
            }
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      <AnimatePresence>
        {showAddPartyBModal &&
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && setShowAddPartyBModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200">
              <div className="flex items-center justify-between mb-6"><h3 className="text-xl font-bold text-gray-800">从乙方单位库添加</h3><button onClick={() => setShowAddPartyBModal(false)} className="text-gray-500 hover:text-gray-800"><FaTimes /></button></div>
              <div className="max-h-64 overflow-y-auto bg-gray-50 border border-slate-600 rounded-lg p-3 space-y-2">
                {partyBList.length === 0 ? <div className="text-gray-500 text-center py-4">暂无乙方单位，请先在基础数据中添加</div> : partyBList.map((p) =>
              <label key={p.id} className="flex items-center gap-3 py-2 text-gray-800 cursor-pointer hover:bg-gray-500 px-2 rounded">
                    <input type="checkbox" checked={selectedPartyBIds.includes(p.id)} onChange={(e) => setSelectedPartyBIds(e.target.checked ? [...selectedPartyBIds, p.id] : selectedPartyBIds.filter((id) => id !== p.id))} className="w-4 h-4" />
                    <span>{p.unit_name}</span>
                    <span className="text-gray-500 text-sm">({p.unit_type})</span>
                  </label>
              )}
              </div>
              <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-gray-200">
                <button onClick={() => setShowAddPartyBModal(false)} className="px-4 py-2 bg-gray-500 text-white rounded-lg">取消</button>
                <button onClick={handleAddSelectedPartyB} disabled={selectedPartyBIds.length === 0} className="px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50">添加选中单位 ({selectedPartyBIds.length})</button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      <AnimatePresence>
        {showDetailModal && viewingSupplier &&
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && setShowDetailModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-xl p-6 w-full max-w-lg border border-gray-200" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6"><h3 className="text-xl font-bold text-gray-800">乙方单位详情</h3><button onClick={() => setShowDetailModal(false)} className="text-gray-500 hover:text-gray-800"><FaTimes /></button></div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 py-2 border-b border-gray-200"><span className="text-gray-500">乙方单位名称</span><span className="text-gray-800">{viewingSupplier.name}</span></div>
                <div className="grid grid-cols-2 gap-4 py-2 border-b border-gray-200"><span className="text-gray-500">合同金额</span><span className="text-green-400">{viewingSupplier.contract_amount?.toFixed(2) || '0.00'}</span></div>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      <AnimatePresence>
        {showAddModal &&
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={(e) => {if (e.target === e.currentTarget) {setShowAddModal(null);setAddForm({});}}}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-xl p-6 w-full max-w-md border border-gray-200" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-800">
                  {(() => {if (showAddModal === 'otherIncome') {return '添加其他收入';} else {if (showAddModal === 'deposit') {return '添加保证金记录';} else {return '添加其他事项';}}})()}
                </h3>
                <button onClick={() => {setShowAddModal(null);setAddForm({});}} className="text-gray-500 hover:text-gray-800"><FaTimes /></button>
              </div>
              {showAddModal === 'otherIncome' &&
            <div className="space-y-4">
                  <div><label className="block text-sm text-gray-500 mb-2">到账时间 *</label><input type="date" value={addForm.income_date || ''} onChange={(e) => setAddForm({ ...addForm, income_date: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                  <div><label className="block text-sm text-gray-500 mb-2">收入金额 *</label><input type="number" step="0.01" value={addForm.income_amount || ''} onChange={(e) => setAddForm({ ...addForm, income_amount: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                  <div><label className="block text-sm text-gray-500 mb-2">到账公司</label><input type="text" value={addForm.payer_name || ''} onChange={(e) => setAddForm({ ...addForm, payer_name: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                  <div><label className="block text-sm text-gray-500 mb-2">备注</label><input type="text" value={addForm.remark || ''} onChange={(e) => setAddForm({ ...addForm, remark: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                </div>
            }
              {showAddModal === 'deposit' &&
            <div className="space-y-4">
                  <div><label className="block text-sm text-gray-500 mb-2">项目保证金</label><input type="number" step="0.01" value={addForm.bid_bond || ''} onChange={(e) => setAddForm({ ...addForm, bid_bond: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                  <div><label className="block text-sm text-gray-500 mb-2">备注</label><input type="text" value={addForm.bid_bond_remark || ''} onChange={(e) => setAddForm({ ...addForm, bid_bond_remark: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                  <div><label className="block text-sm text-gray-500 mb-2">工程投标保证金</label><input type="number" step="0.01" value={addForm.performance_bond || ''} onChange={(e) => setAddForm({ ...addForm, performance_bond: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                  <div><label className="block text-sm text-gray-500 mb-2">备注</label><input type="text" value={addForm.performance_bond_remark || ''} onChange={(e) => setAddForm({ ...addForm, performance_bond_remark: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                  <div><label className="block text-sm text-gray-500 mb-2">质量保证金</label><input type="number" step="0.01" value={addForm.quality_bond || ''} onChange={(e) => setAddForm({ ...addForm, quality_bond: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                  <div><label className="block text-sm text-gray-500 mb-2">备注</label><input type="text" value={addForm.quality_bond_remark || ''} onChange={(e) => setAddForm({ ...addForm, quality_bond_remark: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                </div>
            }
              {showAddModal === 'matters' &&
            <div className="space-y-4">
                  <div><label className="block text-sm text-gray-500 mb-2">内容</label><textarea value={addForm.content || ''} onChange={(e) => setAddForm({ ...addForm, content: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" rows={4} /></div>
                </div>
            }
              <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-gray-200">
                <button onClick={() => {setShowAddModal(null);setAddForm({});}} className="px-4 py-2 bg-gray-500 text-white rounded-lg">取消</button>
                <button onClick={handleAddArchiveRecord} className="px-4 py-2 bg-blue-600 text-white rounded-lg">保存</button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      <AnimatePresence>
        {previewFile &&
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setPreviewFile(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-200" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-800">{previewFile.file_name}</h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => handlePrint(previewFile.file_url, previewFile.file_name)} className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded flex items-center gap-1">
                    <FaPrint className="w-4 h-4" /> 打印
                  </button>
                  <button onClick={() => handleDownload(previewFile.file_url, previewFile.file_name)} className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-sm rounded flex items-center gap-1">
                    <FaDownload className="w-4 h-4" /> 下载
                  </button>
                  <button onClick={() => setPreviewFile(null)} className="px-3 py-1 bg-gray-500 hover:bg-slate-500 text-white text-sm rounded">
                    关闭
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-4 bg-slate-900">
                {previewFile.file_name.toLowerCase().endsWith('.pdf') ?
              <iframe src={previewFile.file_url} className="w-full h-full min-h-[70vh] rounded" title={previewFile.file_name} /> :

              <img src={previewFile.file_url} alt={previewFile.file_name} className="max-w-full max-h-[70vh] mx-auto rounded" />
              }
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      <AnimatePresence>
        {showDeleteConfirm && deleteRelatedData &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDeleteConfirm(false)}>
          
            <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            className="bg-white rounded-xl p-6 w-full max-w-lg border border-gray-200"
            onClick={(e) => e.stopPropagation()}>
            
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <FaExclamationTriangle className="w-5 h-5 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">确认删除项目</h3>
              </div>
              <p className="text-gray-700 mb-4">确定要删除该项目吗？此操作不可恢复。以下关联数据也将被删除：</p>
              <div className="bg-gray-50/50 rounded-lg p-4 mb-6 space-y-2">
                {deleteRelatedData.attachments > 0 &&
              <div className="flex justify-between text-sm">
                    <span className="text-gray-500">项目附件</span>
                    <span className="text-red-400">{deleteRelatedData.attachments} 个</span>
                  </div>
              }
                {deleteRelatedData.suppliers > 0 &&
              <div className="flex justify-between text-sm">
                    <span className="text-gray-500">乙方单位</span>
                    <span className="text-red-400">{deleteRelatedData.suppliers} 个</span>
                  </div>
              }
                {deleteRelatedData.sealRecords > 0 &&
              <div className="flex justify-between text-sm">
                    <span className="text-gray-500">印章使用记录</span>
                    <span className="text-red-400">{deleteRelatedData.sealRecords} 条</span>
                  </div>
              }
                {deleteRelatedData.incomeInvoices > 0 &&
              <div className="flex justify-between text-sm">
                    <span className="text-gray-500">收入发票</span>
                    <span className="text-red-400">{deleteRelatedData.incomeInvoices} 条</span>
                  </div>
              }
                {deleteRelatedData.expenseInvoices > 0 &&
              <div className="flex justify-between text-sm">
                    <span className="text-gray-500">成本发票</span>
                    <span className="text-red-400">{deleteRelatedData.expenseInvoices} 条</span>
                  </div>
              }
                {deleteRelatedData.paymentRecords > 0 &&
              <div className="flex justify-between text-sm">
                    <span className="text-gray-500">付款记录</span>
                    <span className="text-red-400">{deleteRelatedData.paymentRecords} 条</span>
                  </div>
              }
                {deleteRelatedData.depositRecords > 0 &&
              <div className="flex justify-between text-sm">
                    <span className="text-gray-500">保证金记录</span>
                    <span className="text-red-400">{deleteRelatedData.depositRecords} 条</span>
                  </div>
              }
                {deleteRelatedData.otherMatters > 0 &&
              <div className="flex justify-between text-sm">
                    <span className="text-gray-500">其他事项</span>
                    <span className="text-red-400">{deleteRelatedData.otherMatters} 条</span>
                  </div>
              }
                {deleteRelatedData.attachments === 0 && deleteRelatedData.suppliers === 0 &&
              deleteRelatedData.sealRecords === 0 && deleteRelatedData.incomeInvoices === 0 &&
              deleteRelatedData.expenseInvoices === 0 && deleteRelatedData.paymentRecords === 0 &&
              deleteRelatedData.depositRecords === 0 && deleteRelatedData.otherMatters === 0 &&
              <div className="text-gray-500 text-sm text-center">暂无关联数据</div>
              }
              </div>
              <div className="flex justify-end gap-3">
                <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-slate-500">
                
                  取消
                </button>
                <button
                onClick={handleConfirmDeleteProject}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500">
                
                  确认删除
                </button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>
    </div>);

}