import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaSearch, FaMoneyBillWave, FaTimes } from 'react-icons/fa';
import { useSingleToast } from '../../hooks/useSingleToast';
import SingleToastBanner from '../../components/ui/SingleToastBanner';
import { supabase } from '../../supabase/client';
import { useCompanyScope } from '../../hooks/useCompanyScope';
import { isSuperAdminUser } from '../../utils/sessionUser';
import { addLog, logModule, logAction } from '../../services/logService';
import { invoicePaidAmount, invoiceRemainingAmount } from '../../utils/costInvoiceAmounts';

interface Invoice {
  id: string;
  project_id: string;
  supplier_id: string;
  invoice_number: string;
  invoice_amount: number;
  paid_amount: number;
  remaining_amount: number;
  is_paid: boolean;
  invoice_date?: string;
  invoice_type?: string;
}

interface Project {
  id: string;
  name: string;
}

interface Supplier {
  id: string;
  name: string;
}

const PAGE_SIZE = 15;

export default function UnpaidInvoices() {
  const navigate = useNavigate();
  const { currentCompany, companies, companyIds } = useCompanyScope();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [searchProject, setSearchProject] = useState('');
  const [searchSupplier, setSearchSupplier] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
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
        console.error('[UnpaidInvoices] projects', projRes.error);
        return;
      }
      const projectIds = (projRes.data ?? []).map((p) => p.id);

      const invRes =
      companyIds.length > 0 && projectIds.length === 0 ?
      { data: [] as Invoice[], error: null } :
      await (() => {
        let q = supabase.
        from('cost_invoices').
        select('*').
        eq('is_paid', false).
        gt('remaining_amount', 0).
        order('id', { ascending: false }).
        limit(1000);
        if (companyIds.length > 0) q = q.in('project_id', projectIds);
        return q;
      })();

      if (invRes.error) console.error('[UnpaidInvoices] cost_invoices', invRes.error);else
      if (invRes.data) {
        setInvoices(
          invRes.data.filter((inv) => invoiceRemainingAmount(inv) > 0)
        );
      }
      if (projRes.data) setProjects(projRes.data);
      const supRes = await supabase.from('suppliers').select('*');
      if (supRes.error) console.error('[UnpaidInvoices] suppliers', supRes.error);else
      if (supRes.data) setSuppliers(supRes.data);
    } catch (e) {
      console.error('[UnpaidInvoices] fetchData', e);
    } finally {
      setLoading(false);
    }
  }

  const formatMoney = (amount: number) => `¥${(amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
  const getProjectName = (id: string) => projects.find((p) => p.id === id)?.name || '-';
  const getSupplierName = (id: string) => suppliers.find((s) => s.id === id)?.name || '-';

  const filteredInvoices = invoices.filter((inv) => {
    if (searchProject && !getProjectName(inv.project_id).includes(searchProject)) return false;
    if (searchSupplier && !getSupplierName(inv.supplier_id).includes(searchSupplier)) return false;
    if (dateRange.start && inv.invoice_date && inv.invoice_date < dateRange.start) return false;
    if (dateRange.end && inv.invoice_date && inv.invoice_date > dateRange.end) return false;
    return true;
  });

  const paginatedInvoices = filteredInvoices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filteredInvoices.length / PAGE_SIZE);

  const totalInvoiceAmount = filteredInvoices.reduce((sum, inv) => sum + (inv.invoice_amount || 0), 0);
  const totalPaidAmount = filteredInvoices.reduce((sum, inv) => sum + invoicePaidAmount(inv), 0);
  const totalRemaining = filteredInvoices.reduce((sum, inv) => sum + invoiceRemainingAmount(inv), 0);

  const handlePay = (invoice: Invoice) => {
    const remaining = invoiceRemainingAmount(invoice);
    addLog(logModule.INVOICE, logAction.VIEW, `查看发票付款信息：${invoice.invoice_number}，尚欠金额：${formatMoney(remaining)}`, { invoice_id: invoice.id });
    navigate(`/finance/payment?projectId=${invoice.project_id}&supplierId=${invoice.supplier_id}&invoiceId=${invoice.id}&amount=${remaining}`);
  };

  const clearFilters = () => {
    setSearchProject('');
    setSearchSupplier('');
    setDateRange({ start: '', end: '' });
    setPage(1);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-800">已开票未付款统计</h3>
        <div className="text-yellow-400 font-medium">
          共 {filteredInvoices.length} 条记录
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
              placeholder="搜索乙方单位"
              value={searchSupplier}
              onChange={(e) => {setSearchSupplier(e.target.value);setPage(1);}}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:border-green-500 focus:outline-none" />
            
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => {setDateRange({ ...dateRange, start: e.target.value });setPage(1);}}
              className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:border-green-500 focus:outline-none"
              placeholder="开始日期" />
            
            <span className="text-gray-500">至</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => {setDateRange({ ...dateRange, end: e.target.value });setPage(1);}}
              className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:border-green-500 focus:outline-none"
              placeholder="结束日期" />
            
          </div>
          <button
            onClick={clearFilters}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors min-h-[44px]">
            
            清除筛选
          </button>
        </div>

        {(() => {if (loading) {return (
              <div className="text-gray-500 text-center py-8">加载中...</div>);} else {if (
            paginatedInvoices.length === 0) {return (
                <div className="text-gray-500 text-center py-12">
            <p>暂无未付款发票</p>
          </div>);} else {return (

                <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-gray-700">项目</th>
                    <th className="px-4 py-3 text-left text-gray-700">乙方单位</th>
                    <th className="px-4 py-3 text-left text-gray-700">发票编号</th>
                    <th className="px-4 py-3 text-left text-gray-700">发票类型</th>
                    <th className="px-4 py-3 text-left text-gray-700">开票日期</th>
                    <th className="px-4 py-3 text-right text-gray-700">开票金额</th>
                    <th className="px-4 py-3 text-right text-gray-700">已付金额</th>
                    <th className="px-4 py-3 text-right text-gray-700">尚欠金额</th>
                    <th className="px-4 py-3 text-center text-gray-700">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedInvoices.map((inv) =>
                        <tr key={inv.id} className="border-b border-gray-200/50 hover:bg-gray-50/30">
                      <td className="px-4 py-3 text-gray-800">{getProjectName(inv.project_id)}</td>
                      <td className="px-4 py-3 text-gray-700">{getSupplierName(inv.supplier_id)}</td>
                      <td className="px-4 py-3 text-gray-700">{inv.invoice_number || '-'}</td>
                      <td className="px-4 py-3 text-gray-700">{inv.invoice_type || '普票'}</td>
                      <td className="px-4 py-3 text-gray-700">{inv.invoice_date || '-'}</td>
                      <td className="px-4 py-3 text-right text-green-400">{formatMoney(inv.invoice_amount)}</td>
                      <td className="px-4 py-3 text-right text-blue-400">{formatMoney(invoicePaidAmount(inv))}</td>
                      <td className="px-4 py-3 text-right text-yellow-400">{formatMoney(invoiceRemainingAmount(inv))}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                              onClick={() => handlePay(inv)}
                              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded flex items-center gap-1 mx-auto min-h-[44px]">
                              
                          <FaMoneyBillWave className="w-4 h-4" />
                          付款
                        </button>
                      </td>
                    </tr>
                        )}
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

        {filteredInvoices.length > 0 &&
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-center flex-wrap gap-4">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-gray-600 text-sm">合计开票金额：</span>
                  <span className="text-green-500 font-medium ml-2">{formatMoney(totalInvoiceAmount)}</span>
                </div>
                <div>
                  <span className="text-gray-600 text-sm">合计已付金额：</span>
                  <span className="text-blue-500 font-medium ml-2">{formatMoney(totalPaidAmount)}</span>
                </div>
              </div>
              <div>
                <span className="text-gray-700">合计尚欠金额：</span>
                <span className="text-2xl font-bold text-yellow-400 ml-2">{formatMoney(totalRemaining)}</span>
              </div>
            </div>
          </div>
        }
      </div>

      <AnimatePresence>
        {toast &&
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white`}>
          
            {toast.type === 'success' ? <FaMoneyBillWave /> : <FaTimes />}
            <span>{toast.message}</span>
          </motion.div>
        }
      </AnimatePresence>
    </motion.div>);

}