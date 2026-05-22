import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaTimes, FaSearch, FaTrash, FaEdit, FaCheckCircle, FaExclamationCircle, FaFileImage, FaEye, FaFileAlt } from 'react-icons/fa';
import { supabase } from '../../supabase/client';
import { useCompanyScope } from '../../hooks/useCompanyScope';
import { isSuperAdminUser } from '../../utils/sessionUser';
import { useSingleToast } from '../../hooks/useSingleToast';
import SingleToastBanner from '../../components/ui/SingleToastBanner';
import { SearchableSelect, SegmentedControl } from '../../components/ui';
import { addLog, logModule, logAction } from '../../services/logService';
import {
  invoicePaidAmount,
  invoiceRemainingAmount,
  costInvoicePaymentWritePayload } from
'../../utils/costInvoiceAmounts';
import MgmtSalaryPaymentFields, {
  linesToMetadata,
  metadataToLines,
  sumSelectedCurrentPay,
  validateMgmtSalaryLines,
  type StaffSalaryLine } from
'./components/MgmtSalaryPaymentFields';

interface PaymentRequest {
  id: string;
  project_id: string;
  supplier_id: string | null;
  payment_type: string;
  amount: number;
  invoice_status: InvoiceStatus;
  invoice_id: string | null;
  invoice_number?: string;
  reason: string;
  attachment_url: string | null;
  status: 'pending' | 'completed';
  paid_amount?: number;
  transfer_date?: string;
  payment_voucher_url?: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
}

interface Invoice {
  id: string;
  project_id: string;
  supplier_id: string;
  invoice_number: string;
  invoice_amount: number;
  paid_amount: number;
  remaining_amount: number;
  is_paid: boolean;
}

interface Project {
  id: string;
  name: string;
  project_code?: string | null;
}

interface Supplier {
  id: string;
  name: string;
  supply_category: string;
  project_id?: string;
}

type InvoiceStatus = '已开票' | '未开票先付款' | '无需开票';

const initialForm = {
  project_id: '',
  supplier_id: '',
  payment_type: '支付材料款',
  invoice_status: '' as InvoiceStatus | '',
  invoice_id: '',
  invoice_amount: '',
  remaining_amount: '',
  amount: '',
  reason: '',
  attachment_url: ''
};

/** 工程款支付申请 / 编辑 — 支付类型（须与库表 payment_type 取值一致） */
const ENGINEERING_PAYMENT_TYPES = [
'支付材料款',
'支付农民工工资',
'支付项目部',
'其他费用',
'管理人员工资'] as
const;

export default function PaymentRegistration() {
  const { currentCompany, companies, companyIds } = useCompanyScope();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState<'apply' | 'confirm' | 'edit' | null>(null);
  const [form, setForm] = useState(initialForm);
  const [searchProject, setSearchProject] = useState('');
  const [searchSupplier, setSearchSupplier] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast, showToast } = useSingleToast();
  const [deleteConfirm, setDeleteConfirm] = useState<{show: boolean;id?: string;name?: string;}>({ show: false });
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);
  const [confirmForm, setConfirmForm] = useState({
    paid_amount: '',
    payment_voucher_url: '',
    transfer_date: new Date().toISOString().split('T')[0],
    remark: ''
  });
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [newSupplierForm, setNewSupplierForm] = useState({
    name: '',
    supply_category: '材料供应商',
    project_id: '',
    supply_content: '',
    contract_amount: '',
    bank_account: '',
    bank_name: ''
  });

  const [staffLines, setStaffLines] = useState<StaffSalaryLine[]>([]);

  useEffect(() => {
    if (location.pathname.includes('/paid')) {
      setActiveTab('completed');
    } else {
      setActiveTab('pending');
    }
  }, [location.pathname]);


  useEffect(() => {
    fetchData();
  }, [currentCompany, companies, activeTab]);

  if (!currentCompany) {
    return <div className="flex items-center justify-center h-32">加载中...</div>;
  }

  async function fetchData() {
    setLoading(true);
    try {

      let projQuery = supabase.from('projects').select('id, name, project_code');
      if (companyIds.length > 0) {
        projQuery = projQuery.in('company_id', companyIds);
      }
      const projRes = await projQuery;
      if (projRes.error) {
        console.error('[PaymentRegistration] projects', projRes.error);
        return;
      }
      const projectIds = (projRes.data ?? []).map((p) => p.id);

      const invResPromise =
      companyIds.length > 0 && projectIds.length === 0 ?
      Promise.resolve({ data: [] as Invoice[] | null, error: null }) :
      (() => {
        let q = supabase.from('cost_invoices').select('*').order('id', { ascending: false }).limit(15);
        if (companyIds.length > 0) q = q.in('project_id', projectIds);
        return q;
      })();

      const payResPromise =
      companyIds.length > 0 && projectIds.length === 0 ?
      Promise.resolve({ data: [] as PaymentRequest[] | null, error: null }) :
      (() => {
        let q = supabase.
        from('payment_records').
        select('*').
        eq('status', activeTab === 'pending' ? 'pending' : 'completed').
        order('id', { ascending: false }).
        limit(15);
        if (companyIds.length > 0) q = q.in('project_id', projectIds);
        return q;
      })();

      const [reqRes, invRes, supRes] = await Promise.all([
      payResPromise,
      invResPromise,
      supabase.from('suppliers').select('id, name, supply_category, project_id')]
      );

      if (reqRes.error) console.error('[PaymentRegistration] payment_records', reqRes.error);
      if (invRes.error) console.error('[PaymentRegistration] cost_invoices', invRes.error);
      if (supRes.error) console.error('[PaymentRegistration] suppliers', supRes.error);

      const requestsData = reqRes.data || [];
      const enrichedRequests = requestsData.map((req) => {
        const invoice = invRes.data?.find((inv: Invoice) => inv.id === req.invoice_id);
        return {
          ...req,
          invoice_number: invoice?.invoice_number
        };
      });

      setRequests(enrichedRequests);
      setInvoices(invRes.data || []);
      setProjects(projRes.data || []);
      setSuppliers(supRes.data || []);
    } catch (e) {
      console.error('[PaymentRegistration] fetchData', e);
    } finally {
      setLoading(false);
    }
  }

  const formatMoney = (amount: number) => `¥${(amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
  const getProjectName = (id: string) => projects.find((p) => p.id === id)?.name || '-';
  const getSupplierName = (id: string | null | undefined) =>
  id ? suppliers.find((s) => s.id === id)?.name || '-' : '-';

  const paymentRecipientLabel = (req: PaymentRequest) => {
    const meta = req.metadata as {mgmt_salary?: boolean;lines?: unknown[];} | undefined;
    if (meta?.mgmt_salary && meta.lines?.length) {
      return `管理人员工资（${meta.lines.length}人）`;
    }
    return getSupplierName(req.supplier_id);
  };

  const getInvoiceInfo = (id: string) => invoices.find((i) => i.id === id);

  const getProjectSuppliers = (projectId: string, paymentType: string) => {
    if (paymentType === '管理人员工资') return [];
    let filtered = suppliers;
    if (projectId) {
      const projectSuppliers = suppliers.filter((s) => s.project_id === projectId);
      if (projectSuppliers.length > 0) {
        filtered = projectSuppliers;
      }
    }
    if (paymentType === '支付材料款') {
      filtered = filtered.filter((s) => s.supply_category === '材料供应商');
    } else if (paymentType === '支付项目部') {
      filtered = filtered.filter((s) => s.supply_category === '专业分包' || s.supply_category === '其他');
    }
    return filtered;
  };

  const filteredProjects = () => {
    if (!projectSearchTerm) return projects;
    const term = projectSearchTerm.toLowerCase();
    return projects.filter((p) =>
    p.name.toLowerCase().includes(term) ||
    p.project_code && p.project_code.toLowerCase().includes(term)
    );
  };

  const filteredSuppliers = () => {
    let result = getProjectSuppliers(form.project_id, form.payment_type);
    if (supplierSearchTerm) {
      result = result.filter((s) => s.name.toLowerCase().includes(supplierSearchTerm.toLowerCase()));
    }
    return result;
  };

  const openAddSupplierModal = () => {
    setNewSupplierForm({
      name: '',
      supply_category: form.payment_type === '支付材料款' ? '材料供应商' : '专业分包',
      project_id: form.project_id,
      supply_content: '',
      contract_amount: '',
      bank_account: '',
      bank_name: ''
    });
    setShowAddSupplierModal(true);
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing: string[] = [];
    if (!newSupplierForm.name?.trim()) missing.push('乙方单位名称');
    if (!newSupplierForm.project_id?.trim()) missing.push('项目');
    if (!newSupplierForm.supply_category?.trim()) missing.push('供应类别');
    if (missing.length > 0) {
      showToast('error', '请填写完整信息，以下必填项未填写：' + missing.join('、'));
      return;
    }

    const { error } = await supabase.from('suppliers').insert({
      name: newSupplierForm.name,
      supply_category: newSupplierForm.supply_category,
      project_id: newSupplierForm.project_id,
      supply_content: newSupplierForm.supply_content || null,
      contract_amount: newSupplierForm.contract_amount ? parseFloat(newSupplierForm.contract_amount) : null,
      bank_account: newSupplierForm.bank_account || null,
      bank_name: newSupplierForm.bank_name || null
    });

    if (error) {
      showToast('error', '新增乙方单位失败：' + error.message);
    } else {
      showToast('success', '乙方单位新增成功');
      setShowAddSupplierModal(false);
      fetchData();
    }
  };

  const availableInvoices = form.project_id && form.supplier_id ?
  invoices.filter(
    (inv) =>
    inv.project_id === form.project_id &&
    inv.supplier_id === form.supplier_id &&
    !inv.is_paid &&
    invoiceRemainingAmount(inv) > 0
  ) :
  [];

  const filteredRequests = requests.filter((req) => {
    if (searchProject && !getProjectName(req.project_id).includes(searchProject)) return false;
    if (searchSupplier && !paymentRecipientLabel(req).includes(searchSupplier)) return false;
    return true;
  });

  const handleInvoiceStatusChange = (status: InvoiceStatus) => {
    setForm({
      ...form,
      invoice_status: status,
      invoice_id: '',
      invoice_amount: '',
      remaining_amount: '',
      amount: ''
    });
  };

  const handleInvoiceSelect = (invoiceId: string) => {
    const invoice = getInvoiceInfo(invoiceId);
    if (invoice) {
      setForm({
        ...form,
        invoice_id: invoiceId,
        invoice_amount: invoice.invoice_amount.toString(),
        amount: invoiceRemainingAmount(invoice).toString(),
        remaining_amount: '0'
      });
    }
  };

  const handleAmountChange = (value: string) => {
    const invoiceAmount = Number(form.invoice_amount) || 0;
    const paymentAmount = Number(value) || 0;
    const remaining = Math.max(0, invoiceAmount - paymentAmount);
    setForm({
      ...form,
      amount: value,
      remaining_amount: remaining.toString()
    });
  };

  const handlePaymentTypeChange = (pt: (typeof ENGINEERING_PAYMENT_TYPES)[number]) => {
    setStaffLines([]);
    if (pt === '管理人员工资') {
      setForm({
        ...form,
        payment_type: pt,
        supplier_id: '',
        invoice_id: '',
        invoice_amount: '',
        remaining_amount: '',
        amount: '',
        invoice_status: '无需开票'
      });
    } else {
      setForm({
        ...form,
        payment_type: pt,
        supplier_id: '',
        invoice_id: '',
        invoice_amount: '',
        remaining_amount: '',
        amount: ''
      });
    }
  };

  async function handleApplySubmit(e: React.FormEvent) {
    e.preventDefault();
    const missing: string[] = [];
    if (!form.project_id?.trim()) missing.push('项目');

    if (form.payment_type === '管理人员工资') {
      const lineErr = validateMgmtSalaryLines(staffLines);
      if (lineErr) {
        showToast('error', lineErr);
        return;
      }
      if (!form.reason?.trim()) missing.push('支付事由');
      if (missing.length > 0) {
        showToast('error', '请填写：' + missing.join('、'));
        return;
      }

      const totalPay = sumSelectedCurrentPay(staffLines);
      setSubmitting(true);
      try {
        const requestData: Record<string, unknown> = {
          project_id: form.project_id,
          supplier_id: null,
          payment_type: form.payment_type,
          amount: totalPay,
          invoice_status: '无需开票',
          reason: form.reason,
          status: 'pending',
          attachment_url: form.attachment_url || null,
          metadata: linesToMetadata(staffLines)
        };

        const { data, error } = await supabase.from('payment_records').insert(requestData).select().maybeSingle();

        if (error || !data) {
          showToast('error', '提交失败：' + (error?.message || '未知错误'));
          setSubmitting(false);
          return;
        }

        await addLog(
          logModule.INVOICE,
          logAction.CREATE,
          `新增管理人员工资申请：${formatMoney(totalPay)}`,
          { project_id: form.project_id, payment_type: form.payment_type, amount: totalPay }
        );

        showToast('success', '申请提交成功，待财务确认支付');
        setShowModal(null);
        setForm(initialForm);
        setStaffLines([]);
        fetchData();
      } catch (err: any) {
        showToast('error', '提交失败：' + (err.message || '未知错误'));
        addLog(logModule.INVOICE, logAction.CREATE, `付款申请失败：${err.message}`, { project_id: form.project_id }, 'failed');
      }
      setSubmitting(false);
      return;
    }

    if (!form.supplier_id?.trim()) missing.push('收款单位');
    if (!form.invoice_status) missing.push('开票状态');
    if (form.invoice_status === '已开票' && !form.invoice_id) missing.push('关联发票');
    if (!form.amount || Number(form.amount) <= 0) missing.push('申请金额');
    if (!form.reason?.trim()) missing.push('支付事由');
    if (missing.length > 0) {
      showToast('error', '请填写：' + missing.join('、'));
      return;
    }

    if (form.invoice_status === '已开票' && Number(form.amount) > Number(form.invoice_amount)) {
      showToast('error', '申请金额不能大于发票金额');
      return;
    }

    setSubmitting(true);

    try {
      const requestData: Record<string, unknown> = {
        project_id: form.project_id,
        supplier_id: form.supplier_id,
        payment_type: form.payment_type,
        amount: Number(form.amount),
        invoice_status: form.invoice_status,
        reason: form.reason,
        status: 'pending',
        attachment_url: form.attachment_url || null
      };

      if (form.invoice_status === '已开票') {
        requestData.invoice_id = form.invoice_id;
      }

      const { data, error } = await supabase.from('payment_records').insert(requestData).select().maybeSingle();

      if (error || !data) {
        showToast('error', '提交失败：' + (error?.message || '未知错误'));
        setSubmitting(false);
        return;
      }

      await addLog(logModule.INVOICE, logAction.CREATE, `新增付款申请：${getSupplierName(form.supplier_id)}，金额：${formatMoney(Number(form.amount))}`, { project_id: form.project_id, supplier_id: form.supplier_id, amount: form.amount });

      showToast('success', '申请提交成功，待财务确认支付');
      setShowModal(null);
      setForm(initialForm);
      setStaffLines([]);
      fetchData();
    } catch (err: any) {
      showToast('error', '提交失败：' + (err.message || '未知错误'));
      addLog(logModule.INVOICE, logAction.CREATE, `付款申请失败：${err.message}`, { project_id: form.project_id }, 'failed');
    }

    setSubmitting(false);
  }

  async function handleConfirmPayment() {
    if (!selectedRequest) return;

    if (!confirmForm.paid_amount || Number(confirmForm.paid_amount) <= 0) {
      showToast('error', '请输入实付金额');
      return;
    }

    if (Number(confirmForm.paid_amount) > selectedRequest.amount) {
      showToast('error', '实付金额不能大于申请金额');
      return;
    }

    setSubmitting(true);

    try {
      await supabase.from('payment_records').update({
        status: 'completed' as const,
        paid_amount: Number(confirmForm.paid_amount),
        transfer_date: confirmForm.transfer_date,
        payment_voucher_url: confirmForm.payment_voucher_url || null
      }).eq('id', selectedRequest.id);

      if (selectedRequest.invoice_status === '已开票' && selectedRequest.invoice_id) {
        const invoice = getInvoiceInfo(selectedRequest.invoice_id);
        if (invoice) {
          const newPaid = invoicePaidAmount(invoice) + Number(confirmForm.paid_amount);
          const payment = costInvoicePaymentWritePayload(invoice.invoice_amount || 0, newPaid);
          await supabase.from('cost_invoices').update(payment).eq('id', selectedRequest.invoice_id);
        }
      }

      await addLog(logModule.INVOICE, logAction.UPDATE, `确认支付：${paymentRecipientLabel(selectedRequest)}，申请金额：${formatMoney(selectedRequest.amount)}，实付金额：${formatMoney(Number(confirmForm.paid_amount))}`, { request_id: selectedRequest.id });

      showToast('success', '支付确认成功');
      setShowModal(null);
      setSelectedRequest(null);
      setConfirmForm({
        paid_amount: '',
        payment_voucher_url: '',
        transfer_date: new Date().toISOString().split('T')[0],
        remark: ''
      });
      fetchData();
    } catch (err: any) {
      showToast('error', '支付失败：' + (err.message || '未知错误'));
    }

    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('payment_records').delete().eq('id', id);
    if (error) {
      showToast('error', '删除失败：' + error.message);
    } else {
      showToast('success', '删除成功');
      fetchData();
    }
    setDeleteConfirm({ show: false });
  }

  const handleEdit = (request: PaymentRequest) => {
    setSelectedRequest(request);
    setForm({
      project_id: request.project_id,
      supplier_id: request.supplier_id || '',
      payment_type: request.payment_type,
      invoice_status: request.invoice_status,
      invoice_id: request.invoice_id || '',
      invoice_amount: request.invoice_id ? getInvoiceInfo(request.invoice_id)?.invoice_amount.toString() || '' : '',
      remaining_amount: '',
      amount: request.amount.toString(),
      reason: request.reason,
      attachment_url: request.attachment_url || ''
    });
    const meta = request.metadata as {mgmt_salary?: boolean;lines?: Array<{staff_id?: string;full_name?: string;}>;} | null;
    if (meta?.mgmt_salary && meta.lines?.length) {
      const nameMap = new Map(meta.lines.map((l) => [String(l.staff_id ?? ''), String(l.full_name ?? '')]));
      setStaffLines(metadataToLines(request.metadata, nameMap));
    } else {
      setStaffLines([]);
    }
    setShowModal('edit');
  };

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRequest) return;

    if (form.payment_type === '管理人员工资') {
      const lineErr = validateMgmtSalaryLines(staffLines);
      if (lineErr) {
        showToast('error', lineErr);
        return;
      }
      if (!form.reason?.trim()) {
        showToast('error', '请填写：支付事由');
        return;
      }
      const totalPay = sumSelectedCurrentPay(staffLines);
      setSubmitting(true);
      try {
        const updateData: Record<string, unknown> = {
          project_id: form.project_id,
          supplier_id: null,
          payment_type: form.payment_type,
          amount: totalPay,
          invoice_status: '无需开票',
          reason: form.reason,
          attachment_url: form.attachment_url || null,
          metadata: linesToMetadata(staffLines),
          invoice_id: null
        };
        const { error } = await supabase.from('payment_records').update(updateData).eq('id', selectedRequest.id);
        if (error) {
          showToast('error', '修改失败：' + error.message);
          setSubmitting(false);
          return;
        }
        await addLog(logModule.INVOICE, logAction.UPDATE, `修改管理人员工资申请：${formatMoney(totalPay)}`, { request_id: selectedRequest.id });
        showToast('success', '修改成功');
        setShowModal(null);
        setSelectedRequest(null);
        setForm(initialForm);
        setStaffLines([]);
        fetchData();
      } catch (err: any) {
        showToast('error', '修改失败：' + (err.message || '未知错误'));
      }
      setSubmitting(false);
      return;
    }

    const missing: string[] = [];
    if (!form.project_id?.trim()) missing.push('项目');
    if (!form.supplier_id?.trim()) missing.push('收款单位');
    if (!form.invoice_status) missing.push('开票状态');
    if (form.invoice_status === '已开票' && !form.invoice_id) missing.push('关联发票');
    if (!form.amount || Number(form.amount) <= 0) missing.push('申请金额');
    if (!form.reason?.trim()) missing.push('支付事由');
    if (missing.length > 0) {
      showToast('error', '请填写：' + missing.join('、'));
      return;
    }

    setSubmitting(true);

    try {
      const updateData: Record<string, unknown> = {
        project_id: form.project_id,
        supplier_id: form.supplier_id,
        payment_type: form.payment_type,
        amount: Number(form.amount),
        invoice_status: form.invoice_status,
        reason: form.reason,
        attachment_url: form.attachment_url || null,
        metadata: null
      };

      if (form.invoice_status === '已开票') {
        updateData.invoice_id = form.invoice_id;
      } else {
        updateData.invoice_id = null;
      }

      const { error } = await supabase.from('payment_records').update(updateData).eq('id', selectedRequest.id);

      if (error) {
        showToast('error', '修改失败：' + error.message);
        setSubmitting(false);
        return;
      }

      await addLog(logModule.INVOICE, logAction.UPDATE, `修改付款申请：${getSupplierName(form.supplier_id)}`, { request_id: selectedRequest.id });

      showToast('success', '修改成功');
      setShowModal(null);
      setSelectedRequest(null);
      setForm(initialForm);
      setStaffLines([]);
      fetchData();
    } catch (err: any) {
      showToast('error', '修改失败：' + (err.message || '未知错误'));
    }

    setSubmitting(false);
  }

  const openConfirmModal = (request: PaymentRequest) => {
    setSelectedRequest(request);
    setConfirmForm({
      paid_amount: request.amount.toString(),
      payment_voucher_url: '',
      transfer_date: new Date().toISOString().split('T')[0],
      remark: ''
    });
    setShowModal('confirm');
  };

  const getInvoiceStatusLabel = (status: string) => {
    switch (status) {
      case '已开票':return '已开票';
      case '未开票先付款':return '未开票先付款';
      case '无需开票':return '无需开票';
      default:return status;
    }
  };

  const getInvoiceStatusClass = (status: string) => {
    switch (status) {
      case '已开票':return 'bg-green-500/20 text-green-600';
      case '未开票先付款':return 'bg-yellow-500/20 text-yellow-600';
      case '无需开票':return 'bg-gray-500/20 text-gray-600';
      default:return 'bg-gray-500/20 text-gray-600';
    }
  };

  const paymentApplyProjectOptions = useMemo(() => {
    const list = filteredProjects();
    return [
    { value: '', label: '选择项目' },
    ...list.map((p) => ({
      value: p.id,
      label: p.project_code ? `${p.project_code} - ${p.name}` : p.name
    }))];

  }, [projects, projectSearchTerm]);

  const paymentApplySupplierOptions = useMemo(() => {
    const list = filteredSuppliers();
    return [{ value: '', label: '选择乙方单位' }, ...list.map((s) => ({ value: s.id, label: s.name }))];
  }, [form.project_id, form.payment_type, supplierSearchTerm, suppliers]);

  const paymentInvoiceOptions = useMemo(
    () => [
    { value: '', label: '选择发票' },
    ...availableInvoices.map((inv) => ({
      value: inv.id,
      label: `${inv.invoice_number} - 发票金额：${formatMoney(inv.invoice_amount)} - 尚欠：${formatMoney(invoiceRemainingAmount(inv))}`
    }))],

    [availableInvoices]
  );

  const newSupplierCategorySegments = useMemo(
    () =>
    [
    { value: '材料供应商', label: '材料供应商' },
    { value: '专业分包', label: '专业分包' },
    { value: '劳务分包', label: '劳务分包' },
    { value: '其他', label: '其他' }] as
    const,
    []
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-800">工程款支付登记</h3>
        {activeTab === 'pending' &&
        <button onClick={() => {setForm(initialForm);setStaffLines([]);setShowModal('apply');}} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors min-h-[44px]">
            <FaPlus /> 新增申请
          </button>
        }
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => {setActiveTab('pending');}}
          className={`px-4 py-2 rounded-lg font-medium transition-colors min-h-[44px] ${activeTab === 'pending' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
          
          待付列表
        </button>
        <button
          onClick={() => {setActiveTab('completed');}}
          className={`px-4 py-2 rounded-lg font-medium transition-colors min-h-[44px] ${activeTab === 'completed' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
          
          已付款明细
        </button>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex gap-4 mb-4">
          <div className="flex-1 relative">
            <FaSearch className="absolute left-3 top-3 text-gray-500" />
            <input
              type="text"
              placeholder="搜索项目"
              value={searchProject}
              onChange={(e) => setSearchProject(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:border-blue-500 focus:outline-none" />
            
          </div>
          <div className="flex-1 relative">
            <FaSearch className="absolute left-3 top-3 text-gray-500" />
            <input
              type="text"
              placeholder="搜索收款单位"
              value={searchSupplier}
              onChange={(e) => setSearchSupplier(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:border-blue-500 focus:outline-none" />
            
          </div>
        </div>

        {(() => {if (loading) {return <div className="text-gray-500 text-center py-8">加载中...</div>;} else {if (filteredRequests.length === 0) {return (
                <div className="text-gray-500 text-center py-12">
            <p>{activeTab === 'pending' ? '暂无待付申请' : '暂无已付款记录'}</p>
          </div>);} else {return (

                <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-gray-700">申请编号</th>
                  <th className="px-4 py-3 text-left text-gray-700">项目名称</th>
                  <th className="px-4 py-3 text-left text-gray-700">收款单位</th>
                  <th className="px-4 py-3 text-left text-gray-700">申请金额</th>
                  {activeTab === 'completed' && <th className="px-4 py-3 text-left text-gray-700">实付金额</th>}
                  <th className="px-4 py-3 text-left text-gray-700">开票状态</th>
                  <th className="px-4 py-3 text-left text-gray-700">关联发票号</th>
                  <th className="px-4 py-3 text-left text-gray-700">{activeTab === 'pending' ? '申请时间' : '支付时间'}</th>
                  {activeTab === 'completed' && <th className="px-4 py-3 text-left text-gray-700">支付凭证</th>}
                  <th className="px-4 py-3 text-center text-gray-700">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((req) =>
                      <tr key={req.id} className="border-b border-gray-200/50 hover:bg-gray-50/30">
                    <td className="px-4 py-3 text-gray-800 font-medium">{req.id}</td>
                    <td className="px-4 py-3 text-gray-700">{getProjectName(req.project_id)}</td>
                    <td className="px-4 py-3 text-gray-700">{paymentRecipientLabel(req)}</td>
                    <td className="px-4 py-3 text-red-400">{formatMoney(req.amount)}</td>
                    {activeTab === 'completed' && <td className="px-4 py-3 text-green-600">{formatMoney(req.paid_amount || 0)}</td>}
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${getInvoiceStatusClass(req.invoice_status)}`}>
                        {getInvoiceStatusLabel(req.invoice_status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{req.invoice_number || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {activeTab === 'pending' ? req.created_at?.slice(0, 10) : req.transfer_date?.slice(0, 10)}
                    </td>
                    {activeTab === 'completed' &&
                        <td className="px-4 py-3">
                        {req.payment_voucher_url ?
                          <a href={req.payment_voucher_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:text-blue-700">
                            <FaEye className="w-4 h-4" />
                            <span className="text-sm">查看</span>
                          </a> :

                          '-'
                          }
                      </td>
                        }
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {activeTab === 'pending' &&
                            <>
                            <button
                                onClick={() => openConfirmModal(req)}
                                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded min-h-[44px] flex items-center">
                                
                              <FaCheckCircle className="w-4 h-4 mr-1" />
                              确认支付
                            </button>
                            <button
                                onClick={() => handleEdit(req)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg min-h-[44px] flex items-center">
                                
                              <FaEdit className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setDeleteConfirm({ show: true, id: req.id, name: paymentRecipientLabel(req) })}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg min-h-[44px] flex items-center">
                                
                              <FaTrash className="w-4 h-4" />
                            </button>
                          </>
                            }
                        {activeTab === 'completed' &&
                            <button
                              onClick={() => setSelectedRequest(req)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded min-h-[44px] flex items-center">
                              
                            <FaEye className="w-4 h-4 mr-1" />
                            查看详情
                          </button>
                            }
                      </div>
                    </td>
                  </tr>
                      )}
              </tbody>
            </table>
          </div>);}}})()
        }
      </div>

      <AnimatePresence>
        {(showModal === 'apply' || showModal === 'edit') &&
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => {setShowModal(null);setSelectedRequest(null);setStaffLines([]);}}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800">{showModal === 'apply' ? '工程款支付申请' : '编辑付款申请'}</h3>
                <button onClick={() => {setShowModal(null);setSelectedRequest(null);setStaffLines([]);}} className="text-gray-500 hover:text-gray-800 transition-colors"><FaTimes className="w-5 h-5" /></button>
              </div>
              <form onSubmit={showModal === 'apply' ? handleApplySubmit : handleEditSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-500 mb-2">项目 *</label>
                    <div className="relative mb-2">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FaSearch className="w-4 h-4 text-gray-400" />
                      </div>
                      <input
                      type="text"
                      placeholder="搜索项目编码或名称..."
                      value={projectSearchTerm}
                      onChange={(e) => setProjectSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:border-green-500 focus:outline-none" />
                    
                    </div>
                    <SearchableSelect
                    required
                    value={form.project_id}
                    onChange={(v) => {
                      setProjectSearchTerm('');
                      setStaffLines([]);
                      setForm({
                        ...form,
                        project_id: v,
                        supplier_id: '',
                        invoice_id: '',
                        invoice_amount: '',
                        remaining_amount: '',
                        amount: ''
                      });
                    }}
                    options={paymentApplyProjectOptions}
                    placeholder="选择项目"
                    emptyLabel="选择项目"
                    searchPlaceholder="在列表中筛选…"
                    metricsContext="page:payment_registration:form_project" />
                  
                  </div>
                  <div>
                    <span className="block text-sm text-gray-500 mb-2">支付类型 *</span>
                    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="支付类型">
                      {ENGINEERING_PAYMENT_TYPES.map((pt) =>
                    <label
                      key={pt}
                      className={pt === '管理人员工资' ? 'col-span-2 cursor-pointer' : 'cursor-pointer'}>
                      
                          <input
                        type="radio"
                        name="engineering_payment_type"
                        className="sr-only"
                        checked={form.payment_type === pt}
                        onChange={() => handlePaymentTypeChange(pt)} />
                      
                          <div
                        className={`px-3 py-2.5 rounded-lg border-2 text-center text-sm transition-colors ${
                        form.payment_type === pt ?
                        'border-green-500 bg-green-50 text-green-800 font-medium shadow-sm' :
                        'border-gray-300 text-gray-700 hover:border-gray-400'}`
                        }>
                        
                            {pt}
                          </div>
                        </label>
                    )}
                    </div>
                  </div>
                </div>
                {form.payment_type === '管理人员工资' ?
              <div className="border border-green-200 rounded-lg p-4 bg-emerald-50/50">
                    <label className="block text-sm font-medium text-gray-700 mb-3">管理人员工资明细（来源：基础数据 → 项目部管理人员）</label>
                    <MgmtSalaryPaymentFields projectId={form.project_id} lines={staffLines} setLines={setStaffLines} />
                    <p className="text-right text-gray-800 mt-3 text-sm">
                      本次发放合计：<span className="text-red-600 font-semibold text-lg">{formatMoney(sumSelectedCurrentPay(staffLines))}</span>
                    </p>
                  </div> :

              <div>
                  <label className="block text-sm text-gray-500 mb-2">收款单位 *</label>
                  <div className="relative mb-2">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FaSearch className="w-4 h-4 text-gray-400" />
                    </div>
                    <input
                    type="text"
                    placeholder="搜索乙方单位..."
                    value={supplierSearchTerm}
                    onChange={(e) => setSupplierSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:border-green-500 focus:outline-none" />
                  
                  </div>
                  <SearchableSelect
                  required
                  value={form.supplier_id}
                  onChange={(v) =>
                  setForm({
                    ...form,
                    supplier_id: v,
                    invoice_id: '',
                    invoice_amount: '',
                    remaining_amount: '',
                    amount: ''
                  })
                  }
                  options={paymentApplySupplierOptions}
                  placeholder="选择乙方单位"
                  emptyLabel="选择乙方单位"
                  searchPlaceholder="在列表中筛选…"
                  metricsContext="page:payment_registration:form_supplier"
                  className="mb-2" />
                
                  <button
                  type="button"
                  onClick={openAddSupplierModal}
                  className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-green-500 hover:text-green-500 transition-colors flex items-center justify-center gap-2">
                  
                    <FaPlus className="w-4 h-4" />
                    新增乙方单位
                  </button>
                </div>
              }

                {form.payment_type !== '管理人员工资' &&
              <>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">开票状态 *</label>
                  <div className="flex gap-4">
                    <label className={`flex-1 cursor-pointer`}>
                      <input type="radio" name="invoice_status" value="已开票" checked={form.invoice_status === '已开票'} onChange={() => handleInvoiceStatusChange('已开票')} className="hidden peer" />
                      <div className={`px-4 py-3 rounded-lg border-2 text-center transition-colors ${form.invoice_status === '已开票' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-300 hover:border-gray-400'}`}>
                        已开票
                      </div>
                    </label>
                    <label className={`flex-1 cursor-pointer`}>
                      <input type="radio" name="invoice_status" value="未开票先付款" checked={form.invoice_status === '未开票先付款'} onChange={() => handleInvoiceStatusChange('未开票先付款')} className="hidden peer" />
                      <div className={`px-4 py-3 rounded-lg border-2 text-center transition-colors ${form.invoice_status === '未开票先付款' ? 'border-yellow-500 bg-yellow-50 text-yellow-700' : 'border-gray-300 hover:border-gray-400'}`}>
                        未开票先付款
                      </div>
                    </label>
                    <label className={`flex-1 cursor-pointer`}>
                      <input type="radio" name="invoice_status" value="无需开票" checked={form.invoice_status === '无需开票'} onChange={() => handleInvoiceStatusChange('无需开票')} className="hidden peer" />
                      <div className={`px-4 py-3 rounded-lg border-2 text-center transition-colors ${form.invoice_status === '无需开票' ? 'border-gray-500 bg-gray-50 text-gray-700' : 'border-gray-300 hover:border-gray-400'}`}>
                        无需开票
                      </div>
                    </label>
                  </div>
                </div>

                {form.invoice_status === '已开票' &&
                <>
                    <div>
                      <label className="block text-sm text-gray-500 mb-2">关联发票 *</label>
                      <SearchableSelect
                      required
                      value={form.invoice_id}
                      onChange={(v) => handleInvoiceSelect(v)}
                      options={paymentInvoiceOptions}
                      placeholder="选择发票"
                      emptyLabel="选择发票"
                      searchPlaceholder="搜索发票…"
                      metricsContext="page:payment_registration:form_invoice" />
                    
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-500 mb-2">发票金额</label>
                        <input type="text" readOnly value={form.invoice_amount ? formatMoney(Number(form.invoice_amount)) : '-'} className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600" />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-500 mb-2">申请金额 *</label>
                        <input type="number" step="0.01" required value={form.amount} onChange={(e) => handleAmountChange(e.target.value)} className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:border-green-500 focus:outline-none" />
                      </div>
                    </div>
                  </>
                }

                {form.invoice_status === '未开票先付款' &&
                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="flex items-center gap-2 text-yellow-700 mb-2">
                      <FaExclamationCircle />
                      <span className="font-medium">未开票先付款提示</span>
                    </div>
                    <p className="text-sm text-yellow-600">此付款申请将自动归集到「已付款缺票统计」表中，待后续补充发票。</p>
                  </div>
                }

                {form.invoice_status !== '已开票' &&
                <div>
                    <label className="block text-sm text-gray-500 mb-2">申请金额 *</label>
                    <input type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:border-green-500 focus:outline-none" />
                  </div>
                }

                </>
              }

                <div>
                  <label className="block text-sm text-gray-500 mb-2">支付事由 *</label>
                  <textarea required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:border-green-500 focus:outline-none resize-none" rows={3} placeholder="请填写支付事由" />
                </div>

                <div>
                  <label className="block text-sm text-gray-500 mb-2">附件（可选）</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer" onClick={() => document.getElementById('attachment-input')?.click()}>
                    <FaFileAlt className="mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">点击或拖拽上传附件</p>
                    <input id="attachment-input" type="file" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setForm({ ...form, attachment_url: file.name });
                    }
                  }} />
                  </div>
                  {form.attachment_url &&
                <p className="text-sm text-green-600 mt-2">已选择: {form.attachment_url}</p>
                }
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => {setShowModal(null);setSelectedRequest(null);setStaffLines([]);}} className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors min-h-[44px]">取消</button>
                  <button type="submit" disabled={submitting} className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white rounded-lg flex items-center gap-2 transition-colors min-h-[44px]">
                    {submitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                    {showModal === 'apply' ? '提交申请' : '保存修改'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      <AnimatePresence>
        {showModal === 'confirm' && selectedRequest &&
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => {setShowModal(null);setSelectedRequest(null);setStaffLines([]);}}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800">确认支付</h3>
                <button onClick={() => {setShowModal(null);setSelectedRequest(null);setStaffLines([]);}} className="text-gray-500 hover:text-gray-800 transition-colors"><FaTimes className="w-5 h-5" /></button>
              </div>

              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">申请编号</span>
                  <span className="font-medium text-gray-800">{selectedRequest.id}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">项目名称</span>
                  <span className="text-gray-800">{getProjectName(selectedRequest.project_id)}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">收款单位</span>
                  <span className="text-gray-800">{paymentRecipientLabel(selectedRequest)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">申请金额</span>
                  <span className="text-red-400 font-medium">{formatMoney(selectedRequest.amount)}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-2">申请金额（只读）</label>
                  <input type="text" readOnly value={formatMoney(selectedRequest.amount)} className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600" />
                </div>

                <div>
                  <label className="block text-sm text-gray-500 mb-2">实付金额 *</label>
                  <input type="number" step="0.01" required value={confirmForm.paid_amount} onChange={(e) => setConfirmForm({ ...confirmForm, paid_amount: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:border-green-500 focus:outline-none" />
                </div>

                <div>
                  <label className="block text-sm text-gray-500 mb-2">支付凭证 *</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer" onClick={() => document.getElementById('voucher-input')?.click()}>
                    <FaFileImage className="mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">点击或拖拽上传支付凭证（支持图片/PDF）</p>
                    <input id="voucher-input" type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setConfirmForm({ ...confirmForm, payment_voucher_url: file.name });
                    }
                  }} />
                  </div>
                  {confirmForm.payment_voucher_url &&
                <p className="text-sm text-green-600 mt-2">已选择: {confirmForm.payment_voucher_url}</p>
                }
                </div>

                <div>
                  <label className="block text-sm text-gray-500 mb-2">支付时间 *</label>
                  <input type="date" required value={confirmForm.transfer_date} onChange={(e) => setConfirmForm({ ...confirmForm, transfer_date: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:border-green-500 focus:outline-none" />
                </div>

                <div>
                  <label className="block text-sm text-gray-500 mb-2">备注（可选）</label>
                  <textarea value={confirmForm.remark} onChange={(e) => setConfirmForm({ ...confirmForm, remark: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:border-green-500 focus:outline-none resize-none" rows={2} placeholder="请填写备注" />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => {setShowModal(null);setSelectedRequest(null);setStaffLines([]);}} className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors min-h-[44px]">取消</button>
                  <button type="button" onClick={handleConfirmPayment} disabled={submitting} className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white rounded-lg flex items-center gap-2 transition-colors min-h-[44px]">
                    {submitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                    确认支付
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      <AnimatePresence>
        {selectedRequest && activeTab === 'completed' && showModal !== 'confirm' && !showModal &&
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedRequest(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800">付款详情</h3>
                <button onClick={() => setSelectedRequest(null)} className="text-gray-500 hover:text-gray-800 transition-colors"><FaTimes className="w-5 h-5" /></button>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">申请编号</span>
                  <span className="font-medium text-gray-800">{selectedRequest.id}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">项目名称</span>
                  <span className="text-gray-800">{getProjectName(selectedRequest.project_id)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">收款单位</span>
                  <span className="text-gray-800">{paymentRecipientLabel(selectedRequest)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">申请金额</span>
                  <span className="text-red-400 font-medium">{formatMoney(selectedRequest.amount)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">实付金额</span>
                  <span className="text-green-600 font-medium">{formatMoney(selectedRequest.paid_amount || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">支付时间</span>
                  <span className="text-gray-800">{selectedRequest.transfer_date}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">开票状态</span>
                  <span className={`px-2 py-1 rounded text-xs ${getInvoiceStatusClass(selectedRequest.invoice_status)}`}>
                    {getInvoiceStatusLabel(selectedRequest.invoice_status)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">关联发票</span>
                  <span className="text-gray-800">{selectedRequest.invoice_number || '-'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">支付事由</span>
                  <span className="text-gray-800">{selectedRequest.reason}</span>
                </div>
                {selectedRequest.payment_voucher_url &&
              <div>
                    <span className="text-gray-600">支付凭证</span>
                    <a href={selectedRequest.payment_voucher_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:text-blue-700 mt-2">
                      <FaEye className="w-4 h-4" />
                      查看凭证
                    </a>
                  </div>
              }
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button onClick={() => setSelectedRequest(null)} className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors min-h-[44px]">关闭</button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      <AnimatePresence>
        {deleteConfirm.show &&
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-xl p-6 w-full max-w-md border border-gray-200">
              <h3 className="text-xl font-bold text-gray-800 mb-4">确认删除</h3>
              <p className="text-gray-700 mb-6">确定要删除付款申请「{deleteConfirm.name}」吗？此操作不可撤销。</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeleteConfirm({ show: false })} className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors min-h-[44px]">取消</button>
                <button onClick={() => deleteConfirm.id && handleDelete(deleteConfirm.id)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors min-h-[44px]">删除</button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      <AnimatePresence>
        {showAddSupplierModal &&
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddSupplierModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800">新增乙方单位</h3>
                <button onClick={() => setShowAddSupplierModal(false)} className="text-gray-500 hover:text-gray-800 transition-colors"><FaTimes className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleAddSupplier} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-500 mb-2">乙方单位名称 *</label>
                    <input
                    type="text"
                    required
                    value={newSupplierForm.name}
                    onChange={(e) => setNewSupplierForm({ ...newSupplierForm, name: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:border-green-500 focus:outline-none"
                    placeholder="请输入乙方单位名称" />
                  
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-2">供应类别 *</label>
                    <SegmentedControl
                    value={newSupplierForm.supply_category}
                    onChange={(v) => setNewSupplierForm({ ...newSupplierForm, supply_category: v })}
                    options={[...newSupplierCategorySegments]}
                    metricsContext="page:payment_registration:new_supplier_category"
                    aria-label="供应类别" />
                  
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">供应内容</label>
                  <textarea
                  value={newSupplierForm.supply_content}
                  onChange={(e) => setNewSupplierForm({ ...newSupplierForm, supply_content: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:border-green-500 focus:outline-none"
                  placeholder="请输入供应内容"
                  rows={3} />
                
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-500 mb-2">合同金额</label>
                    <input
                    type="number"
                    value={newSupplierForm.contract_amount}
                    onChange={(e) => setNewSupplierForm({ ...newSupplierForm, contract_amount: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:border-green-500 focus:outline-none"
                    placeholder="请输入合同金额" />
                  
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-2">开户银行</label>
                    <input
                    type="text"
                    value={newSupplierForm.bank_name}
                    onChange={(e) => setNewSupplierForm({ ...newSupplierForm, bank_name: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:border-green-500 focus:outline-none"
                    placeholder="请输入开户银行" />
                  
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">银行账号</label>
                  <input
                  type="text"
                  value={newSupplierForm.bank_account}
                  onChange={(e) => setNewSupplierForm({ ...newSupplierForm, bank_account: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:border-green-500 focus:outline-none"
                  placeholder="请输入银行账号" />
                
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setShowAddSupplierModal(false)} className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors min-h-[44px]">取消</button>
                  <button type="submit" className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors min-h-[44px]">保存</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {toast && <SingleToastBanner type={toast.type} message={toast.message} />}
    </motion.div>);

}