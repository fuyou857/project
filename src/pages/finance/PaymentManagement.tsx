import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaTimes, FaSearch, FaTrash, FaCheckCircle, FaExclamationCircle, FaInbox } from 'react-icons/fa';
import { supabase } from '../../supabase/client';
import { useSingleToast } from '../../hooks/useSingleToast';
import SingleToastBanner from '../../components/ui/SingleToastBanner';
import { useCompanyScope } from '../../hooks/useCompanyScope';
import { isSuperAdminUser } from '../../utils/sessionUser';
import { addLog, logModule, logAction } from '../../services/logService';
import { SearchableSelect, SegmentedControl } from '../../components/ui';
import { optionsFromTuples, projectSelectOptions } from '../../components/ui/options';
import {
  invoicePaidAmount,
  invoiceRemainingAmount,
  costInvoicePaymentWritePayload } from
'../../utils/costInvoiceAmounts';

interface Payment {
  id: string;
  project_id: string;
  supplier_id: string | null;
  payment_type: string;
  amount: number;
  transfer_date: string;
  invoice_id: string | null;
  status: string;
  attachment_url: string | null;
  expense_contract_id?: string | null;
  has_invoice?: boolean;
  need_invoice?: boolean;
  invoice_status?: string;
  metadata?: Record<string, unknown> | null;
}
interface Invoice {id: string;project_id: string;supplier_id: string;invoice_number: string;invoice_amount: number;paid_amount: number;remaining_amount: number;is_paid: boolean;invoice_unit?: string;}
interface Project {id: string;name: string;}
interface Supplier {id: string;name: string;supply_category: string;project_id?: string;}
interface ExpenseContract {
  id: string;
  contract_name: string;
  contract_code: string;
  contract_amount?: number | null;
  amount?: number | null;
  project_id?: string | null;
}

type InvoiceStatus = '已开票' | '未开票先付款' | '无需开票';

const initialForm = {
  project_id: '',
  supplier_id: '',
  payment_type: '支付材料款',
  invoice_status: '' as InvoiceStatus | '',
  invoice_id: '',
  invoice_amount: '',
  amount: '',
  remaining_amount: '',
  transfer_date: new Date().toISOString().split('T')[0],
  attachment_url: '',
  selectedInvoices: [] as string[],
  expense_contract_id: '',
  expense_contract_search: ''
};

const PAGE_SIZE = 15;

export default function PaymentManagement() {
  const { currentCompany, companies, companyIds } = useCompanyScope();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [expenseContracts, setExpenseContracts] = useState<ExpenseContract[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [page, setPage] = useState(1);
  const [searchProject, setSearchProject] = useState('');
  const [searchSupplier, setSearchSupplier] = useState('');
  const [searchType, setSearchType] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast, showToast } = useSingleToast();
  const [deleteConfirm, setDeleteConfirm] = useState<{show: boolean;id?: string;name?: string;}>({ show: false });

  useEffect(() => {fetchData();}, [currentCompany, companies]);

  async function fetchData() {
    setLoading(true);
    try {
      let projQuery = supabase.from('projects').select('id, name');
      if (companyIds.length > 0) {
        projQuery = projQuery.in('company_id', companyIds);
      }
      const projRes = await projQuery;
      if (projRes.error) {
        console.error('[PaymentManagement] projects', projRes.error);
        return;
      }
      const projectIds = (projRes.data ?? []).map((p) => p.id);

      let contractQuery = supabase.from('expense_contracts').select('id, contract_name, contract_code, contract_amount, project_id');
      if (companyIds.length > 0) {
        contractQuery = contractQuery.in('company_id', companyIds);
      }
      const contractRes = await contractQuery;
      if (contractRes.error) console.error('[PaymentManagement] expense_contracts', contractRes.error);

      const invResPromise =
      companyIds.length > 0 && projectIds.length === 0 ?
      Promise.resolve({ data: [] as Invoice[] | null, error: null }) :
      (() => {
        let q = supabase.from('cost_invoices').select('*').order('id', { ascending: false }).limit(PAGE_SIZE);
        if (companyIds.length > 0) q = q.in('project_id', projectIds);
        return q;
      })();

      const payResPromise =
      companyIds.length > 0 && projectIds.length === 0 ?
      Promise.resolve({ data: [] as Payment[] | null, error: null }) :
      (() => {
        let q = supabase.
        from('payment_records').
        select('*').
        order('id', { ascending: false }).
        range(0, PAGE_SIZE - 1);
        if (companyIds.length > 0) q = q.in('project_id', projectIds);
        return q;
      })();

      const [payRes, invRes, supRes] = await Promise.all([
      payResPromise,
      invResPromise,
      supabase.from('suppliers').select('*')]
      );
      if (payRes.error) console.error('[PaymentManagement] payment_records', payRes.error);
      if (invRes.error) console.error('[PaymentManagement] cost_invoices', invRes.error);
      if (supRes.error) console.error('[PaymentManagement] suppliers', supRes.error);
      if (payRes.data) setPayments(payRes.data);
      if (invRes.data) setInvoices(invRes.data);
      if (projRes.data) setProjects(projRes.data);
      if (supRes.data) setSuppliers(supRes.data);
      if (contractRes.data) setExpenseContracts(contractRes.data);
    } catch (e) {
      console.error('[PaymentManagement] fetchData', e);
    } finally {
      setLoading(false);
    }
  }

  const formatMoney = (amount: number) => `¥${(amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
  const getProjectName = (id: string) => projects.find((p) => p.id === id)?.name || '-';
  const getSupplierName = (id: string | null | undefined) =>
  id ? suppliers.find((s) => s.id === id)?.name || '-' : '-';

  const paymentRecipientLabel = (pay: Payment) => {
    const meta = pay.metadata as {mgmt_salary?: boolean;lines?: unknown[];} | undefined;
    if (meta?.mgmt_salary && meta.lines?.length) {
      return `管理人员工资（${meta.lines.length}人）`;
    }
    return getSupplierName(pay.supplier_id);
  };

  const getInvoiceInfo = (id: string) => invoices.find((i) => i.id === id);

  const getProjectSuppliers = (projectId: string, paymentType: string) => {
    let filtered = suppliers.filter((s) => s.project_id === projectId);
    if (paymentType === '支付材料款') {
      filtered = filtered.filter((s) => s.supply_category === '材料供应商');
    } else if (paymentType === '支付项目部') {
      filtered = filtered.filter((s) => s.supply_category === '专业分包' || s.supply_category === '其他');
    }
    return filtered;
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

  const searchTypeFilterOptions = useMemo(
    () =>
    optionsFromTuples([
    { value: '', label: '全部类型' },
    { value: '支付材料款', label: '支付材料款' },
    { value: '支付农民工工资', label: '支付农民工工资' },
    { value: '支付项目部', label: '支付项目部' },
    { value: '其他费用', label: '其他费用' },
    { value: '管理人员工资', label: '管理人员工资' }]
    ),
    []
  );

  const paymentModalProjectOptions = useMemo(() => projectSelectOptions(projects), [projects]);

  const paymentModalSupplierOptions = useMemo(() => {
    const list = getProjectSuppliers(form.project_id, form.payment_type);
    return [{ value: '', label: '选择乙方单位' }, ...list.map((s) => ({ value: s.id, label: s.name }))];
  }, [form.project_id, form.payment_type, suppliers]);

  const expenseContractSelectOptions = useMemo(() => {
    const list = expenseContracts.
    filter((c) => !form.project_id || c.project_id === form.project_id).
    filter(
      (c) =>
      !form.expense_contract_search ||
      c.contract_name.includes(form.expense_contract_search) ||
      c.contract_code.includes(form.expense_contract_search)
    );
    return [
    { value: '', label: '选择支出合同（可选）' },
    ...list.map((c) => ({
      value: c.id,
      label: `${c.contract_name} (${c.contract_code}) - ¥${(c.contract_amount ?? c.amount ?? 0).toLocaleString()}`
    }))];

  }, [expenseContracts, form.project_id, form.expense_contract_search]);

  const paymentInvoiceSelectOptions = useMemo(() => {
    const list =
    form.project_id && form.supplier_id ?
    invoices.filter(
      (inv) =>
      inv.project_id === form.project_id &&
      inv.supplier_id === form.supplier_id &&
      !inv.is_paid &&
      invoiceRemainingAmount(inv) > 0
    ) :
    [];
    return [
    { value: '', label: '选择发票' },
    ...list.map((inv) => ({
      value: inv.id,
      label: `${inv.invoice_number} - 发票金额：${formatMoney(inv.invoice_amount)} - 尚欠：${formatMoney(invoiceRemainingAmount(inv))}`
    }))];

  }, [form.project_id, form.supplier_id, invoices]);

  const totalRemaining = availableInvoices.
  filter((inv) => form.selectedInvoices.includes(inv.id)).
  reduce((sum, inv) => sum + invoiceRemainingAmount(inv), 0);

  const filteredPayments = payments.filter((pay) => {
    if (searchProject && !getProjectName(pay.project_id).includes(searchProject)) return false;
    if (searchSupplier && !paymentRecipientLabel(pay).includes(searchSupplier)) return false;
    if (searchType && pay.payment_type !== searchType) return false;
    return true;
  });

  const handleInvoiceStatusChange = (status: InvoiceStatus) => {
    setForm({
      ...form,
      invoice_status: status,
      invoice_id: '',
      invoice_amount: '',
      remaining_amount: '',
      amount: '',
      selectedInvoices: []
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
        remaining_amount: '0',
        selectedInvoices: [invoiceId]
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const missing: string[] = [];
    if (!form.project_id?.trim()) missing.push('项目');
    if (form.payment_type === '管理人员工资') {
      showToast(
        'error',
        '「管理人员工资」请在「财务管理 → 工程款支付登记」中发起申请单并完成审批流程。',
      );
      return;
    }
    if (!form.supplier_id?.trim()) missing.push('收款单位');
    if (!form.invoice_status) missing.push('开票状态');
    if (form.invoice_status === '已开票' && !form.invoice_id) missing.push('关联发票');
    if (!form.amount || Number(form.amount) <= 0) missing.push('付款金额');
    if (!form.transfer_date?.trim()) missing.push('支付时间');
    if (missing.length > 0) {
      showToast('error', '请填写：' + missing.join('、'));
      return;
    }

    if (form.invoice_status === '已开票' && Number(form.amount) > Number(form.invoice_amount)) {
      showToast('error', '付款金额不能大于发票金额');
      return;
    }

    setSubmitting(true);

    try {
      const paymentData: any = {
        project_id: form.project_id,
        supplier_id: form.supplier_id,
        payment_type: form.payment_type,
        amount: Number(form.amount),
        transfer_date: form.transfer_date,
        status: 'completed',
        expense_contract_id: form.expense_contract_id || null,
        has_invoice: form.invoice_status === '已开票' ? true : false,
        need_invoice: form.invoice_status === '无需开票' ? false : true,
        invoice_status: form.invoice_status
      };

      if (form.invoice_status === '已开票') {
        paymentData.invoice_id = form.invoice_id;
      }

      const { data: newPayment, error } = await supabase.from('payment_records').insert(paymentData).select().maybeSingle();

      if (error || !newPayment) {
        showToast('error', '付款失败：' + (error?.message || '未知错误'));
        setSubmitting(false);
        return;
      }

      if (form.invoice_status === '已开票' && form.invoice_id) {
        const invoice = getInvoiceInfo(form.invoice_id);
        if (invoice) {
          const newPaid = invoicePaidAmount(invoice) + Number(form.amount);
          const payment = costInvoicePaymentWritePayload(invoice.invoice_amount || 0, newPaid);
          await supabase.from('cost_invoices').update({
            ...payment,
            payment_record_id: newPayment.id
          }).eq('id', form.invoice_id);
        }
      }

      if (form.invoice_status === '未开票先付款') {
        await supabase.from('payment_missing_invoice_stats').insert({
          project_id: form.project_id,
          supplier_id: form.supplier_id,
          payment_record_id: newPayment.id,
          payment_amount: Number(form.amount),
          payment_date: form.transfer_date,
          status: 'pending'
        });
      }

      await addLog(logModule.INVOICE, logAction.CREATE, `新增工程款支付：${getSupplierName(form.supplier_id)}，金额：${formatMoney(Number(form.amount))}，开票状态：${form.invoice_status}`, { project_id: form.project_id, supplier_id: form.supplier_id, amount: form.amount, invoice_status: form.invoice_status });

      showToast('success', '付款成功');
      setShowModal(false);
      setForm(initialForm);
      fetchData();
    } catch (err: any) {
      showToast('error', '付款失败：' + (err.message || '未知错误'));
      addLog(logModule.INVOICE, logAction.CREATE, `新增工程款支付失败：${err.message}`, { project_id: form.project_id }, 'failed');
    }

    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    const payment = payments.find((p) => p.id === id);
    const { error } = await supabase.from('payment_records').delete().eq('id', id);
    if (error) {
      showToast('error', '删除失败：' + error.message);
    } else {
      if (payment?.invoice_status === '未开票先付款') {
        await supabase.from('payment_missing_invoice_stats').delete().eq('payment_record_id', id);
      }
      showToast('success', '删除成功');
      fetchData();
    }
    setDeleteConfirm({ show: false });
  }

  const getInvoiceStatusLabel = (status: string) => {
    switch (status) {
      case '已开票':return '已开票';
      case '未开票先付款':return '未开票先付款';
      case '无需开票':return '无需开票';
      default:return status;
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-800">工程款支付管理</h3>
        <button onClick={() => {setForm(initialForm);setShowModal(true);}} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">
          <FaPlus /> 新增付款
        </button>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex gap-4 mb-4">
          <div className="flex-1 relative">
            <FaSearch className="absolute left-3 top-3 text-gray-500" />
            <input type="text" placeholder="搜索项目" value={searchProject} onChange={(e) => setSearchProject(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:border-green-500 focus:outline-none" />
          </div>
          <div className="flex-1 relative">
            <FaSearch className="absolute left-3 top-3 text-gray-500" />
            <input type="text" placeholder="搜索收款单位" value={searchSupplier} onChange={(e) => setSearchSupplier(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:border-green-500 focus:outline-none" />
          </div>
          <div className="min-w-[10rem] max-w-[14rem]">
            <SearchableSelect
              value={searchType}
              onChange={(v) => setSearchType(v)}
              options={searchTypeFilterOptions}
              placeholder="全部类型"
              searchThreshold={99} />
            
          </div>
        </div>

        {(() => {if (loading) {return <div className="text-gray-500 text-center py-8">加载中...</div>;} else {if (filteredPayments.length === 0) {return (
                <div className="text-gray-500 text-center py-12">
            <FaInbox className="mx-auto text-4xl mb-3 opacity-50" />
            <p>暂无付款记录</p>
          </div>);} else {return (

                <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr><th className="px-4 py-3 text-left text-gray-700">项目</th><th className="px-4 py-3 text-left text-gray-700">收款单位</th><th className="px-4 py-3 text-left text-gray-700">类型</th><th className="px-4 py-3 text-left text-gray-700">开票状态</th><th className="px-4 py-3 text-right text-gray-700">金额</th><th className="px-4 py-3 text-left text-gray-700">日期</th><th className="px-4 py-3 text-left text-gray-700">状态</th><th className="px-4 py-3 text-center text-gray-700">操作</th></tr>
              </thead>
              <tbody>
                {filteredPayments.map((pay) =>
                      <motion.tr key={pay.id} whileHover={{ backgroundColor: 'rgba(51, 65, 85, 0.5)' }} className="border-b border-gray-200/50 transition-colors">
                    <td className="px-4 py-3 text-gray-800">{getProjectName(pay.project_id)}</td>
                    <td className="px-4 py-3 text-gray-700">{paymentRecipientLabel(pay)}</td>
                    <td className="px-4 py-3 text-gray-700">{pay.payment_type}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${(() => {if (
                            pay.invoice_status === '已开票') {return 'bg-green-500/20 text-green-600';} else {if (
                              pay.invoice_status === '未开票先付款') {return 'bg-yellow-500/20 text-yellow-600';} else {return (
                                  'bg-gray-500/20 text-gray-600');}}})()}`
                          }>
                        {getInvoiceStatusLabel(pay.invoice_status || '')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-red-400">{formatMoney(pay.amount)}</td>
                    <td className="px-4 py-3 text-gray-700">{pay.transfer_date || '-'}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs ${pay.status === 'completed' ? 'bg-green-500/20 text-green-600' : 'bg-yellow-500/20 text-yellow-400'}`}>{pay.status === 'completed' ? '已完成' : '待处理'}</span></td>
                    <td className="px-4 py-3 text-center">
                      {isSuperAdminUser() && <button onClick={() => setDeleteConfirm({ show: true, id: pay.id, name: paymentRecipientLabel(pay) })} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"><FaTrash /></button>}
                    </td>
                  </motion.tr>
                      )}
              </tbody>
            </table>
          </div>);}}})()
        }
      </div>

      <AnimatePresence>
        {showModal &&
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800">工程款支付</h3>
                <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-800 transition-colors"><FaTimes /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="ui-label mb-2 block">项目 *</label>
                    <SearchableSelect
                    required
                    allowEmpty={false}
                    value={form.project_id}
                    onChange={(v) =>
                    setForm({
                      ...form,
                      project_id: v,
                      supplier_id: '',
                      invoice_id: '',
                      invoice_amount: '',
                      remaining_amount: '',
                      amount: '',
                      selectedInvoices: []
                    })
                    }
                    options={paymentModalProjectOptions}
                    placeholder="选择项目"
                    searchPlaceholder="搜索项目…" />
                  
                  </div>
                  <div>
                    <label className="ui-label mb-2 block">支付类型 *</label>
                    <SegmentedControl
                    value={
                    form.payment_type as
                    '支付材料款' |
                    '支付农民工工资' |
                    '支付项目部' |
                    '其他费用' |
                    '管理人员工资'
                    }
                    onChange={(v) =>
                    setForm({
                      ...form,
                      payment_type: v,
                      supplier_id: '',
                      selectedInvoices: [],
                      expense_contract_id: '',
                      expense_contract_search: ''
                    })
                    }
                    options={[
                    { value: '支付材料款', label: '支付材料款' },
                    { value: '支付农民工工资', label: '支付农民工工资' },
                    { value: '支付项目部', label: '支付项目部' },
                    { value: '其他费用', label: '其他费用' },
                    { value: '管理人员工资', label: '管理人员工资' }]
                    }
                    className="flex-wrap"
                    aria-label="支付类型" />
                  
                  </div>
                  {form.payment_type !== '管理人员工资' &&
                <div>
                    <label className="block text-sm text-gray-500 mb-2">关联支出合同</label>
                    <input type="text" placeholder="搜索支出合同..." value={form.expense_contract_search} onChange={(e) => setForm({ ...form, expense_contract_search: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 mb-2" />
                    <SearchableSelect
                    value={form.expense_contract_id}
                    onChange={(v) => setForm({ ...form, expense_contract_id: v })}
                    options={expenseContractSelectOptions}
                    placeholder="选择支出合同（可选）"
                    searchPlaceholder="搜索合同…" />
                  
                  </div>
                }
                </div>
                {form.payment_type === '管理人员工资' ?
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-sm leading-relaxed">
                    <p className="font-medium mb-2">管理人员工资无法在本页直接付款</p>
                    <p>请前往「财务管理 → 工程款支付登记」发起申请，选择当前项目、支付类型为「管理人员工资」，勾选项目部管理人员并填写工资明细；审批通过并完成支付后，记录将出现在本列表。</p>
                  </div> :

              <>
                <div>
                  <label className="ui-label mb-2 block">收款单位 *</label>
                  <SearchableSelect
                    required
                    allowEmpty={false}
                    value={form.supplier_id}
                    onChange={(v) =>
                    setForm({
                      ...form,
                      supplier_id: v,
                      invoice_id: '',
                      invoice_amount: '',
                      remaining_amount: '',
                      amount: '',
                      selectedInvoices: []
                    })
                    }
                    options={paymentModalSupplierOptions}
                    placeholder="选择乙方单位"
                    searchPlaceholder="搜索乙方单位…" />
                  
                </div>

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
                      <label className="ui-label mb-2 block">关联发票 *</label>
                      <SearchableSelect
                      required
                      allowEmpty={false}
                      value={form.invoice_id}
                      onChange={(v) => handleInvoiceSelect(v)}
                      options={paymentInvoiceSelectOptions}
                      placeholder="选择发票"
                      searchPlaceholder="搜索发票…" />
                    
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-gray-500 mb-2">发票金额</label>
                        <input type="text" readOnly value={form.invoice_amount ? formatMoney(Number(form.invoice_amount)) : '-'} className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600" />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-500 mb-2">付款金额 *</label>
                        <input type="number" step="0.01" required value={form.amount} onChange={(e) => handleAmountChange(e.target.value)} className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:border-green-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-500 mb-2">还欠金额</label>
                        <input type="text" readOnly value={form.remaining_amount ? formatMoney(Number(form.remaining_amount)) : '-'} className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600" />
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
                    <p className="text-sm text-yellow-600">此付款记录将自动归集到「已付款缺票统计」表中，待后续补充发票。</p>
                  </div>
                }

                {form.invoice_status === '无需开票' &&
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-600">此付款记录不需要关联发票，也不进入缺票统计。</p>
                  </div>
                }

                {form.invoice_status !== '已开票' &&
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm text-gray-500 mb-2">付款金额 *</label><input type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:border-green-500 focus:outline-none" /></div>
                    <div><label className="block text-sm text-gray-500 mb-2">支付时间 *</label><input type="date" required value={form.transfer_date} onChange={(e) => setForm({ ...form, transfer_date: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:border-green-500 focus:outline-none" /></div>
                  </div>
                }

                {form.invoice_status === '已开票' &&
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm text-gray-500 mb-2">支付时间 *</label><input type="date" required value={form.transfer_date} onChange={(e) => setForm({ ...form, transfer_date: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:border-green-500 focus:outline-none" /></div>
                  </div>
                }
                  </>
              }

                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors">取消</button>
                  {form.payment_type !== '管理人员工资' &&
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white rounded-lg flex items-center gap-2 transition-colors">{submitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}确认付款</button>
                }
                </div>
              </form>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      <AnimatePresence>
        {deleteConfirm.show &&
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-white rounded-xl p-6 w-full max-w-md border border-gray-200">
              <h3 className="text-xl font-bold text-gray-800 mb-4">确认删除</h3>
              <p className="text-gray-700 mb-6">确定要删除付款记录「{deleteConfirm.name}」吗？此操作不可撤销。</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeleteConfirm({ show: false })} className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors">取消</button>
                <button onClick={() => deleteConfirm.id && handleDelete(deleteConfirm.id)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">删除</button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {toast && <SingleToastBanner type={toast.type} message={toast.message} />}
    </motion.div>);

}