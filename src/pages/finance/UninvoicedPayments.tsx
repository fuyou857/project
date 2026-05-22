import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaSearch, FaBell, FaPlus, FaTimes, FaCalendarAlt, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import { useSingleToast } from '../../hooks/useSingleToast';
import SingleToastBanner from '../../components/ui/SingleToastBanner';
import { supabase } from '../../supabase/client';
import { useCompanyScope } from '../../hooks/useCompanyScope';
import { isSuperAdminUser } from '../../utils/sessionUser';
import { addLog, logModule, logAction } from '../../services/logService';
import { SegmentedControl } from '../../components/ui';
import { costInvoicePaymentWritePayload } from '../../utils/costInvoiceAmounts';

interface UninvoicedPayment {
  id: string;
  project_id: string;
  supplier_id: string;
  payment_type: string;
  amount: number;
  paid_amount?: number;
  transfer_date: string;
  invoice_id?: string | null;
  created_at?: string;
}

interface Project {
  id: string;
  name: string;
}

interface Supplier {
  id: string;
  name: string;
}

interface ReminderRecord {
  id: string;
  payment_record_id: string;
  remind_date: string;
  status: string;
}

const PAGE_SIZE = 15;

export default function UninvoicedPayments() {
  const navigate = useNavigate();
  const { currentCompany, companies, companyIds } = useCompanyScope();
  const [payments, setPayments] = useState<UninvoicedPayment[]>([]);
  const [reminders, setReminders] = useState<ReminderRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [searchProject, setSearchProject] = useState('');
  const [searchSupplier, setSearchSupplier] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showRemindModal, setShowRemindModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<UninvoicedPayment | null>(null);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showReminderDateModal, setShowReminderDateModal] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [recordForm, setRecordForm] = useState({
    invoice_number: '',
    invoice_amount: null as number | null,
    invoice_type: '普票',
    invoice_date: new Date().toISOString().split('T')[0]
  });
  const { toast, showToast } = useSingleToast();

  useEffect(() => {
    void fetchData();
  }, [currentCompany, companies]);

  async function fetchData() {
    setLoading(true);
    try {

      let projQuery = supabase.from('projects').select('id, name');
      if (companyIds.length > 0) {
        projQuery = projQuery.in('company_id', companyIds);
      }
      const projRes = await projQuery;
      if (projRes.error) {
        console.error('[UninvoicedPayments] projects', projRes.error);
        return;
      }
      const projectIds = (projRes.data ?? []).map((p) => p.id);

      let payQuery = supabase.
      from('payment_records').
      select('*').
      eq('status', 'completed').
      or('invoice_id.is.null,invoice_id.eq.recorded').
      order('id', { ascending: false }).
      limit(1000);

      if (companyIds.length > 0) {
        if (projectIds.length === 0) {
          setPayments([]);
          if (projRes.data) setProjects(projRes.data);
          const [supRes, remRes] = await Promise.all([
          supabase.from('suppliers').select('*'),
          supabase.from('payment_reminders').select('*')]
          );
          if (supRes.error) console.error('[UninvoicedPayments] suppliers', supRes.error);else
          if (supRes.data) setSuppliers(supRes.data);
          if (remRes.error) console.error('[UninvoicedPayments] reminders', remRes.error);else
          if (remRes.data) setReminders(remRes.data);
          return;
        }
        payQuery = payQuery.in('project_id', projectIds);
      }

      const [payRes, supRes, remRes] = await Promise.all([
      payQuery,
      supabase.from('suppliers').select('*'),
      supabase.from('payment_reminders').select('*')]
      );

      if (payRes.error) console.error('[UninvoicedPayments] payment_records', payRes.error);else
      if (payRes.data) setPayments(payRes.data);
      if (projRes.data) setProjects(projRes.data);
      if (supRes.error) console.error('[UninvoicedPayments] suppliers', supRes.error);else
      if (supRes.data) setSuppliers(supRes.data);
      if (remRes.error) console.error('[UninvoicedPayments] reminders', remRes.error);else
      if (remRes.data) setReminders(remRes.data);
    } catch (e) {
      console.error('[UninvoicedPayments] fetchData', e);
    } finally {
      setLoading(false);
    }
  }

  const formatMoney = (amount: number) => `¥${(amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
  const getProjectName = (id: string) => projects.find((p) => p.id === id)?.name || '-';
  const getSupplierName = (id: string) => suppliers.find((s) => s.id === id)?.name || '-';

  const getReminder = (paymentId: string) => {
    return reminders.find((r) => r.payment_record_id === paymentId);
  };

  const filteredPayments = payments.filter((pay) => {
    if (searchProject && !getProjectName(pay.project_id).includes(searchProject)) return false;
    if (searchSupplier && !getSupplierName(pay.supplier_id).includes(searchSupplier)) return false;
    if (dateRange.start && pay.transfer_date && pay.transfer_date < dateRange.start) return false;
    if (dateRange.end && pay.transfer_date && pay.transfer_date > dateRange.end) return false;
    return true;
  });

  const paginatedPayments = filteredPayments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filteredPayments.length / PAGE_SIZE);
  const totalAmount = filteredPayments.reduce((sum, p) => sum + (p.paid_amount || p.amount || 0), 0);

  const clearFilters = () => {
    setSearchProject('');
    setSearchSupplier('');
    setDateRange({ start: '', end: '' });
    setPage(1);
  };

  async function handleRemind(pay: UninvoicedPayment) {
    setSelectedPayment(pay);
    setShowRemindModal(true);
  }

  async function handleConfirmRemind() {
    if (!selectedPayment) return;

    try {
      await supabase.from('warnings').insert({
        warning_type: '缺票提醒',
        content: `【催票提醒】项目【${getProjectName(selectedPayment.project_id)}】付款${formatMoney(selectedPayment.paid_amount || selectedPayment.amount)}，已超过30天仍未收到发票`,
        project_id: selectedPayment.project_id,
        status: 'pending'
      });

      await addLog(logModule.INVOICE, logAction.CREATE, `生成催票预警：${getProjectName(selectedPayment.project_id)}，金额：${formatMoney(selectedPayment.paid_amount || selectedPayment.amount)}`, { payment_id: selectedPayment.id });

      setShowRemindModal(false);
      showToast('success', '已生成催票预警通知');
    } catch (err: any) {
      showToast('error', '操作失败：' + err.message);
    }
  }

  function handleRecordInvoice(pay: UninvoicedPayment) {
    setSelectedPayment(pay);
    setRecordForm({
      invoice_number: '',
      invoice_amount: pay.paid_amount || pay.amount,
      invoice_type: '普票',
      invoice_date: new Date().toISOString().split('T')[0]
    });
    setShowRecordModal(true);
  }

  async function handleRecordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPayment || !recordForm.invoice_number) {
      showToast('error', '请填写发票编号');
      return;
    }

    try {
      const { data: newInvoice, error: invoiceError } = await supabase.from('cost_invoices').insert({
        project_id: selectedPayment.project_id,
        supplier_id: selectedPayment.supplier_id,
        invoice_type: recordForm.invoice_type,
        invoice_number: recordForm.invoice_number,
        invoice_amount: recordForm.invoice_amount,
        invoice_date: recordForm.invoice_date,
        ...costInvoicePaymentWritePayload(recordForm.invoice_amount, 0)
      }).select().maybeSingle();

      if (invoiceError) {
        throw new Error(invoiceError.message);
      }

      await supabase.from('payment_records').update({ invoice_id: newInvoice?.id }).eq('id', selectedPayment.id);

      const existingReminder = getReminder(selectedPayment.id);
      if (existingReminder) {
        await supabase.from('payment_reminders').delete().eq('id', existingReminder.id);
      }

      await addLog(logModule.INVOICE, logAction.CREATE, `补录发票：${recordForm.invoice_number}，金额：${formatMoney(recordForm.invoice_amount || 0)}`, { payment_id: selectedPayment.id, invoice_id: newInvoice?.id });

      setShowRecordModal(false);
      showToast('success', '发票补录成功');
      fetchData();
    } catch (err: any) {
      showToast('error', '补录失败：' + err.message);
    }
  }

  function handleSetReminder(pay: UninvoicedPayment) {
    setSelectedPayment(pay);
    const existingReminder = getReminder(pay.id);
    setReminderDate(existingReminder?.remind_date || '');
    setShowReminderDateModal(true);
  }

  async function handleSaveReminder() {
    if (!selectedPayment || !reminderDate) {
      showToast('error', '请选择提醒日期');
      return;
    }

    try {
      const existingReminder = getReminder(selectedPayment.id);

      if (existingReminder) {
        await supabase.from('payment_reminders').update({
          remind_date: reminderDate,
          status: 'pending'
        }).eq('id', existingReminder.id);
      } else {
        await supabase.from('payment_reminders').insert({
          payment_record_id: selectedPayment.id,
          remind_date: reminderDate,
          status: 'pending'
        });
      }

      await addLog(logModule.INVOICE, logAction.CREATE, `设置缺票提醒日期：${reminderDate}`, { payment_id: selectedPayment.id });

      setShowReminderDateModal(false);
      showToast('success', '提醒日期设置成功');
      fetchData();
    } catch (err: any) {
      showToast('error', '设置失败：' + err.message);
    }
  }

  async function handleDeleteReminder(paymentId: string) {
    try {
      const reminder = getReminder(paymentId);
      if (reminder) {
        await supabase.from('payment_reminders').delete().eq('id', reminder.id);
      }
      showToast('success', '已取消提醒');
      fetchData();
    } catch (err: any) {
      showToast('error', '操作失败：' + err.message);
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-800">已付款缺票统计</h3>
        <div className="text-yellow-400 font-medium">
          共 {filteredPayments.length} 条记录，缺票总金额：{formatMoney(totalAmount)}
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex gap-4 mb-4 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <FaSearch className="absolute left-3 top-3 text-gray-500" />
            <input
              type="text"
              placeholder="搜索项目"
              value={searchProject}
              onChange={(e) => {setSearchProject(e.target.value);setPage(1);}}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:border-green-500 focus:outline-none" />
            
          </div>
          <div className="flex-1 min-w-[200px] relative">
            <FaSearch className="absolute left-3 top-3 text-gray-500" />
            <input
              type="text"
              placeholder="搜索收款单位"
              value={searchSupplier}
              onChange={(e) => {setSearchSupplier(e.target.value);setPage(1);}}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:border-green-500 focus:outline-none" />
            
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => {setDateRange({ ...dateRange, start: e.target.value });setPage(1);}}
              className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:border-green-500 focus:outline-none" />
            
            <span className="text-gray-500">至</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => {setDateRange({ ...dateRange, end: e.target.value });setPage(1);}}
              className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:border-green-500 focus:outline-none" />
            
          </div>
          <button
            onClick={clearFilters}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors min-h-[44px]">
            
            清除筛选
          </button>
        </div>

        {(() => {if (loading) {return (
              <div className="text-gray-500 text-center py-8">加载中...</div>);} else {if (
            paginatedPayments.length === 0) {return (
                <div className="text-gray-500 text-center py-12">
            <p>暂无缺票记录</p>
          </div>);} else {return (

                <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-gray-700">项目</th>
                    <th className="px-4 py-3 text-left text-gray-700">收款单位</th>
                    <th className="px-4 py-3 text-left text-gray-700">付款类型</th>
                    <th className="px-4 py-3 text-right text-gray-700">付款金额</th>
                    <th className="px-4 py-3 text-left text-gray-700">付款日期</th>
                    <th className="px-4 py-3 text-left text-gray-700">提醒日期</th>
                    <th className="px-4 py-3 text-center text-gray-700">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPayments.map((pay) => {
                          const reminder = getReminder(pay.id);
                          return (
                            <tr key={pay.id} className="border-b border-gray-200/50 hover:bg-gray-50/30">
                        <td className="px-4 py-3 text-gray-800">{getProjectName(pay.project_id)}</td>
                        <td className="px-4 py-3 text-gray-700">{getSupplierName(pay.supplier_id)}</td>
                        <td className="px-4 py-3 text-gray-700">{pay.payment_type}</td>
                        <td className="px-4 py-3 text-right text-red-400">{formatMoney(pay.paid_amount || pay.amount)}</td>
                        <td className="px-4 py-3 text-gray-700">{pay.transfer_date || '-'}</td>
                        <td className="px-4 py-3">
                          {reminder ?
                                <span className="text-blue-600 text-sm">
                              <FaCalendarAlt className="inline mr-1" />
                              {reminder.remind_date}
                              {reminder.status === 'triggered' && <span className="ml-1 text-yellow-500">(已触发)</span>}
                            </span> :

                                <span className="text-gray-400 text-sm">未设置</span>
                                }
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            <button
                                    onClick={() => handleRecordInvoice(pay)}
                                    className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded min-h-[36px] flex items-center">
                                    
                              <FaPlus className="w-3 h-3 mr-1" />
                              补录发票
                            </button>
                            <button
                                    onClick={() => handleSetReminder(pay)}
                                    className={`px-2 py-1 text-sm rounded min-h-[36px] flex items-center ${reminder ? 'bg-blue-100 hover:bg-blue-200 text-blue-600' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                                    
                              <FaBell className="w-3 h-3 mr-1" />
                              {reminder ? '改提醒' : '延后提醒'}
                            </button>
                            {reminder &&
                                  <button
                                    onClick={() => handleDeleteReminder(pay.id)}
                                    className="p-1 text-gray-400 hover:text-gray-600 min-h-[36px] flex items-center"
                                    title="取消提醒">
                                    
                                <FaTimes className="w-4 h-4" />
                              </button>
                                  }
                          </div>
                        </td>
                      </tr>);

                        })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 &&
                  <div className="flex justify-center items-center gap-2 mt-4">
                <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1 bg-gray-50 text-gray-800 rounded disabled:opacity-50 min-h-[44px]">
                      
                  上一页
                </button>
                <span className="text-gray-500 px-4">{page} / {totalPages}</span>
                <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-3 py-1 bg-gray-50 text-gray-800 rounded disabled:opacity-50 min-h-[44px]">
                      
                  下一页
                </button>
              </div>
                  }
          </>);}}})()
        }

        {filteredPayments.length > 0 &&
        <div className="mt-4 p-4 bg-gray-50 rounded-lg flex justify-between items-center">
            <span className="text-gray-700">合计缺票金额：</span>
            <span className="text-2xl font-bold text-yellow-400">{formatMoney(totalAmount)}</span>
          </div>
        }
      </div>

      <AnimatePresence>
        {showRemindModal && selectedPayment &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => e.target === e.currentTarget && setShowRemindModal(false)}>
          
            <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            className="bg-white rounded-xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}>
            
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800">催票提醒</h3>
                <button onClick={() => setShowRemindModal(false)} className="text-gray-500 hover:text-gray-800">
                  <FaTimes />
                </button>
              </div>
              <div className="mb-6">
                <p className="text-gray-700 mb-2">
                  项目：<span className="text-gray-800">{getProjectName(selectedPayment.project_id)}</span>
                </p>
                <p className="text-gray-700 mb-2">
                  收款单位：<span className="text-gray-800">{getSupplierName(selectedPayment.supplier_id)}</span>
                </p>
                <p className="text-gray-700 mb-2">
                  付款金额：<span className="text-red-400">{formatMoney(selectedPayment.paid_amount || selectedPayment.amount)}</span>
                </p>
                <p className="text-yellow-400 mt-4">确认生成催票预警通知？</p>
              </div>
              <div className="flex justify-end gap-3">
                <button
                onClick={() => setShowRemindModal(false)}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg min-h-[44px]">
                
                  取消
                </button>
                <button
                onClick={handleConfirmRemind}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg min-h-[44px]">
                
                  确认
                </button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      <AnimatePresence>
        {showRecordModal && selectedPayment &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => e.target === e.currentTarget && setShowRecordModal(false)}>
          
            <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            className="bg-white rounded-xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}>
            
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800">补录发票</h3>
                <button onClick={() => setShowRecordModal(false)} className="text-gray-500 hover:text-gray-800">
                  <FaTimes />
                </button>
              </div>
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500">付款信息</div>
                <div className="text-gray-800">
                  {getProjectName(selectedPayment.project_id)} - {getSupplierName(selectedPayment.supplier_id)}
                </div>
                <div className="text-red-400">{formatMoney(selectedPayment.paid_amount || selectedPayment.amount)}</div>
              </div>
              <form onSubmit={handleRecordSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-2">发票编号 *</label>
                  <input
                  type="text"
                  required
                  value={recordForm.invoice_number}
                  onChange={(e) => setRecordForm({ ...recordForm, invoice_number: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:border-green-500 focus:outline-none"
                  placeholder="请输入发票编号" />
                
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="ui-label mb-2 block">发票类型 *</label>
                    <SegmentedControl
                    value={(recordForm.invoice_type || '普票') as '普票' | '专票'}
                    onChange={(v) => setRecordForm({ ...recordForm, invoice_type: v })}
                    options={[
                    { value: '普票', label: '普票' },
                    { value: '专票', label: '专票' }]
                    } />
                  
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-2">发票金额 *</label>
                    <input
                    type="number"
                    step="0.01"
                    required
                    value={recordForm.invoice_amount || ''}
                    onChange={(e) => setRecordForm({ ...recordForm, invoice_amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:border-green-500 focus:outline-none" />
                  
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">开票日期</label>
                  <input
                  type="date"
                  value={recordForm.invoice_date}
                  onChange={(e) => setRecordForm({ ...recordForm, invoice_date: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:border-green-500 focus:outline-none" />
                
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                  type="button"
                  onClick={() => setShowRecordModal(false)}
                  className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg min-h-[44px]">
                  
                    取消
                  </button>
                  <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg min-h-[44px]">
                  
                    确认补录
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      <AnimatePresence>
        {showReminderDateModal && selectedPayment &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => e.target === e.currentTarget && setShowReminderDateModal(false)}>
          
            <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            className="bg-white rounded-xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}>
            
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800">设置提醒日期</h3>
                <button onClick={() => setShowReminderDateModal(false)} className="text-gray-500 hover:text-gray-800">
                  <FaTimes />
                </button>
              </div>
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500">付款信息</div>
                <div className="text-gray-800">
                  {getProjectName(selectedPayment.project_id)} - {getSupplierName(selectedPayment.supplier_id)}
                </div>
                <div className="text-red-400">{formatMoney(selectedPayment.paid_amount || selectedPayment.amount)}</div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-2">提醒日期</label>
                  <input
                  type="date"
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:border-green-500 focus:outline-none" />
                
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                  onClick={() => setShowReminderDateModal(false)}
                  className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg min-h-[44px]">
                  
                    取消
                  </button>
                  <button
                  onClick={handleSaveReminder}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg min-h-[44px]">
                  
                    保存提醒
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      <AnimatePresence>
        {toast &&
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white`}>
          
            {toast.type === 'success' ? <FaCheckCircle /> : <FaExclamationCircle />}
            <span>{toast.message}</span>
          </motion.div>
        }
      </AnimatePresence>
    </motion.div>);

}