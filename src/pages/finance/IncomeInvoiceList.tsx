import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaSearch, FaEye, FaEdit, FaTrash, FaTimes, FaDownload, FaFileExcel, FaCheckCircle, FaExclamationCircle, FaPlus } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase/client';
import { useCompanyScope } from '../../hooks/useCompanyScope';
import { isSuperAdminUser } from '../../utils/sessionUser';
import { useSingleToast } from '../../hooks/useSingleToast';
import SingleToastBanner from '../../components/ui/SingleToastBanner';
import { projectIdsForInvoiceScope } from '../../utils/companyProjectScope';
import { SearchableSelect, SegmentedControl } from '../../components/ui';
import { projectSelectOptions } from '../../components/ui/options';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

interface Invoice {
  id: string;
  project_id: string;
  company_id?: string | null;
  party_a_id: string;
  buyer_name: string;
  buyer_tax_no: string;
  buyer_bank: string;
  buyer_account: string;
  buyer_address_phone: string;
  invoice_amount: number;
  tax_amount: number;
  remark: string;
  tax_paid: boolean;
  tax_payment_method: string;
  tax_payment_voucher: string;
  invoice_photo: string;
  payment_description: string;
  status: string;
  invoice_date: string;
  created_at: string;
  project_name?: string;
  company_name?: string;
  invoice_type?: string;
  tax_rate?: number;
}

export default function IncomeInvoiceList() {
  const navigate = useNavigate();
  const { currentCompany, companies, companyIds } = useCompanyScope();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [total, setTotal] = useState(0);

  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  const targetYear = currentMonth < 11 ? currentYear - 1 : currentYear;
  const targetMonth = currentMonth < 11 ? currentMonth - 11 + 12 : currentMonth - 10;
  const defaultStartDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
  const [companyFilter, setCompanyFilter] = useState('');
  const { toast, showToast } = useSingleToast();
  const [showDelete, setShowDelete] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebouncedValue(keyword, 300);

  const [projects, setProjects] = useState<{id: string;name: string;}[]>([]);
  const [showDetail, setShowDetail] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [editForm, setEditForm] = useState<Invoice | null>(null);

  useEffect(() => {
    void fetchProjects();
  }, [currentCompany, companies]);

  useEffect(() => {
    void fetchInvoices();
  }, [page, startDate, endDate, companyFilter, projectFilter, statusFilter, debouncedKeyword, currentCompany, companies]);

  async function fetchProjects() {
    try {
      let query = supabase.from('projects').select('id, name');
      if (currentCompany) {
        const ids = [currentCompany.id];
        const children = companies.filter((c) => c.parent_id === currentCompany.id || c.parent_id === '0');
        children.forEach((c) => ids.push(c.id));
        query = query.in('company_id', ids);
      }
      const { data, error } = await query;
      if (error) {
        console.error('[IncomeInvoiceList] fetchProjects', error);
        return;
      }
      if (data) setProjects(data);
    } catch (e) {
      console.error('[IncomeInvoiceList] fetchProjects', e);
    }
  }

  async function fetchInvoices() {
    setLoading(true);
    try {
      const scopedProjectIds = await projectIdsForInvoiceScope(companyIds, companyFilter);

      let query = supabase.
      from('income_invoices').
      select('*', { count: 'exact' }).
      order('id', { ascending: false });

      if (scopedProjectIds !== null) {
        if (scopedProjectIds.length === 0) {
          setInvoices([]);
          setTotal(0);
          return;
        }
        query = query.in('project_id', scopedProjectIds);
      }
      if (startDate) query = query.gte('invoice_date', startDate + 'T00:00:00');
      if (endDate) query = query.lte('invoice_date', endDate + 'T23:59:59');
      if (projectFilter) query = query.eq('project_id', projectFilter);
      if (statusFilter) query = query.eq('status', statusFilter);
      if (debouncedKeyword) {
        const safe = debouncedKeyword.replace(/[%(),]/g, '').trim();
        if (safe) query = query.or(`buyer_name.ilike.%${safe}%,remark.ilike.%${safe}%`);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) {
        console.error('[IncomeInvoiceList] fetchInvoices', error);
        setInvoices([]);
        setTotal(0);
        return;
      }
      if (data) {
        const projectIds = [...new Set(data.map((d) => d.project_id))];

        const { data: projRows, error: pErr } = await supabase.from('projects').select('id, name, company_id').in('id', projectIds);
        if (pErr) console.error('[IncomeInvoiceList] projects join', pErr);
        const projectMap = new Map((projRows || []).map((p) => [p.id, p.name]));
        const compIds = [...new Set((projRows || []).map((p) => p.company_id).filter(Boolean))] as string[];
        const { data: compRows } =
        compIds.length > 0 ?
        await supabase.from('companies').select('id, name').in('id', compIds) :
        { data: [] as {id: string;name: string;}[] };
        const companyMap = new Map((compRows || []).map((c) => [c.id, c.name]));
        const projectCompany = new Map((projRows || []).map((p) => [p.id, p.company_id]));

        setInvoices(
          data.map((d) => ({
            ...d,
            company_id: d.company_id ?? projectCompany.get(d.project_id) as string | undefined ?? null,
            project_name: projectMap.get(d.project_id),
            company_name: companyMap.get(projectCompany.get(d.project_id) || '') || undefined
          }))
        );
      }
      setTotal(count || 0);
    } catch (e) {
      console.error('[IncomeInvoiceList] fetchInvoices', e);
      setInvoices([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('确定删除此发票记录？')) return;
    await supabase.from('income_invoices').delete().eq('id', id);
    fetchInvoices();
  }

  function openDetail(invoice: Invoice) {
    setDetailInvoice(invoice);
    setShowDetail(true);
  }

  function openEdit(invoice: Invoice) {
    setEditForm(invoice);
    setShowEdit(true);
  }

  async function handleEditSave() {
    if (!editForm) return;
    const { error } = await supabase.from('income_invoices').update({
      invoice_type: editForm.invoice_type,
      tax_rate: editForm.tax_rate,
      buyer_name: editForm.buyer_name,
      buyer_tax_no: editForm.buyer_tax_no,
      buyer_bank: editForm.buyer_bank,
      buyer_account: editForm.buyer_account,
      buyer_address_phone: editForm.buyer_address_phone,
      invoice_amount: editForm.invoice_amount,
      tax_amount: editForm.tax_amount,
      remark: editForm.remark,
      tax_paid: editForm.tax_paid,
      tax_payment_method: editForm.tax_payment_method,
      payment_description: editForm.payment_description,
      status: editForm.status
    }).eq('id', editForm.id);

    if (!error) {
      setShowEdit(false);
      fetchInvoices();
    }
  }

  function handleExport() {
    const headers = ['ID', '项目', '公司', '购买方', '发票类型', '税率', '开票金额', '税金', '状态', '开票时间'];
    const rows = invoices.map((inv, idx) => [
    idx + 1,
    inv.project_name || '',
    inv.company_name || '',
    inv.buyer_name,
    inv.invoice_type,
    inv.tax_rate + '%',
    inv.invoice_amount,
    inv.tax_amount,
    inv.status,
    inv.invoice_date?.split('T')[0] || '']
    );

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `收入发票_${startDate}_${endDate}.csv`;
    a.click();
  }

  const totalPages = Math.ceil(total / pageSize);
  const companyOptions = currentCompany ?
  [currentCompany, ...companies.filter((c) => c.parent_id === currentCompany.id || c.parent_id === '0')] :
  companies;

  const companyFilterOptions = useMemo(
    () => [{ value: '', label: '全部' }, ...companyOptions.map((c) => ({ value: c.id, label: c.name }))],
    [companyOptions]
  );
  const projectFilterOptions = useMemo(() => projectSelectOptions(projects, '全部'), [projects]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {toast && <SingleToastBanner type={toast.type} message={toast.message} />}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">收入发票列表</h1>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/finance/invoice')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
            <FaPlus /> 新增收入发票
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg">
            <FaFileExcel /> 导出
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 space-y-4 shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">开始日期</label>
            <input type="date" value={startDate} onChange={(e) => {setStartDate(e.target.value);setPage(1);}} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">结束日期</label>
            <input type="date" value={endDate} onChange={(e) => {setEndDate(e.target.value);setPage(1);}} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">公司</label>
            <SearchableSelect
              value={companyFilter}
              onChange={(v) => {
                setCompanyFilter(v);
                setPage(1);
              }}
              options={companyFilterOptions}
              placeholder="全部"
              emptyLabel="全部"
              searchPlaceholder="搜索公司…"
              metricsContext="page:income_invoice_list:filter_company" />
            
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">项目</label>
            <SearchableSelect
              value={projectFilter}
              onChange={(v) => {
                setProjectFilter(v);
                setPage(1);
              }}
              options={projectFilterOptions}
              placeholder="全部"
              emptyLabel="全部"
              searchPlaceholder="搜索项目…"
              metricsContext="page:income_invoice_list:filter_project" />
            
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">状态</label>
            <SearchableSelect
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
              options={[
              { value: '', label: '全部' },
              { value: 'pending', label: '待审核' },
              { value: '已审核', label: '已审核' }]
              }
              placeholder="全部"
              emptyLabel="全部"
              searchThreshold={10}
              metricsContext="page:income_invoice_list:filter_status" />
            
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="搜索项目/购买方/备注..." value={keyword} onChange={(e) => {setKeyword(e.target.value);setPage(1);}} className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-500 text-sm border-b border-gray-200">
                <th className="pb-3 font-medium">ID</th>
                <th className="pb-3 font-medium">项目</th>
                <th className="pb-3 font-medium">公司</th>
                <th className="pb-3 font-medium">购买方</th>
                <th className="pb-3 font-medium">类型</th>
                <th className="pb-3 font-medium">税率</th>
                <th className="pb-3 font-medium">开票金额</th>
                <th className="pb-3 font-medium">税金</th>
                <th className="pb-3 font-medium">状态</th>
                <th className="pb-3 font-medium">开票时间</th>
                <th className="pb-3 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {(() => {if (loading) {return <tr><td colSpan={11} className="py-8 text-center text-gray-500">加载中...</td></tr>;} else {if (
                  invoices.length === 0) {return <tr><td colSpan={11} className="py-8 text-center text-gray-500">暂无数据</td></tr>;} else {return (
                      invoices.map((inv, idx) =>
                      <tr key={inv.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 text-gray-600">{idx + 1}</td>
                      <td className="py-3 text-gray-800 font-medium">{inv.project_name || '-'}</td>
                      <td className="py-3 text-gray-600">{inv.company_name || '-'}</td>
                      <td className="py-3 text-gray-600">{inv.buyer_name}</td>
                      <td className="py-3 text-gray-600">{inv.invoice_type}</td>
                      <td className="py-3 text-gray-600">{inv.tax_rate}%</td>
                      <td className="py-3 text-gray-600">{inv.invoice_amount?.toFixed(2)}</td>
                      <td className="py-3 text-gray-600">{inv.tax_amount?.toFixed(2)}</td>
                      <td className="py-3"><span className={`px-2 py-1 text-xs rounded-full ${inv.status === '已审核' ? 'bg-green-100 text-green-700' : inv.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`}>{inv.status === 'pending' ? '待审核' : inv.status}</span></td>
                      <td className="py-3 text-gray-600">{inv.invoice_date?.split('T')[0]}</td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openDetail(inv)} className="p-2 text-gray-500 hover:text-blue-600"><FaEye /></button>
                          <button onClick={() => openEdit(inv)} className="p-2 text-gray-500 hover:text-yellow-600"><FaEdit /></button>
                          <button onClick={() => handleDelete(inv.id)} className="p-2 text-gray-500 hover:text-red-600"><FaTrash /></button>
                        </div>
                      </td>
                    </tr>
                      ));}}})()}
            </tbody>
          </table>
        </div>

        {totalPages > 1 &&
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <span className="text-gray-500 text-sm">共 {total} 条</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 bg-gray-100 rounded text-gray-700 disabled:opacity-50">上一页</button>
              <span className="text-gray-500">{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1 bg-gray-100 rounded text-gray-700 disabled:opacity-50">下一页</button>
            </div>
          </div>
        }
      </div>

      <AnimatePresence>
        {showDetail && detailInvoice &&
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDetail(false)}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl p-6 w-full max-w-2xl border border-gray-200 max-h-[90vh] overflow-y-auto shadow-lg" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-gray-800">发票详情</h3><button onClick={() => setShowDetail(false)} className="text-gray-400 hover:text-gray-600"><FaTimes /></button></div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">项目：</span><span className="text-gray-800">{detailInvoice.project_name}</span></div>
                <div><span className="text-gray-500">公司：</span><span className="text-gray-800">{detailInvoice.company_name}</span></div>
                <div><span className="text-gray-500">发票类型：</span><span className="text-gray-800">{detailInvoice.invoice_type}</span></div>
                <div><span className="text-gray-500">税率：</span><span className="text-gray-800">{detailInvoice.tax_rate}%</span></div>
                <div><span className="text-gray-500">购买方：</span><span className="text-gray-800">{detailInvoice.buyer_name}</span></div>
                <div><span className="text-gray-500">税号：</span><span className="text-gray-800">{detailInvoice.buyer_tax_no}</span></div>
                <div><span className="text-gray-500">开户银行：</span><span className="text-gray-800">{detailInvoice.buyer_bank || '-'}</span></div>
                <div><span className="text-gray-500">银行账号：</span><span className="text-gray-800">{detailInvoice.buyer_account || '-'}</span></div>
                <div><span className="text-gray-500">地址电话：</span><span className="text-gray-800">{detailInvoice.buyer_address_phone || '-'}</span></div>
                <div><span className="text-gray-500">开票金额：</span><span className="text-gray-800">{detailInvoice.invoice_amount?.toFixed(2)}</span></div>
                <div><span className="text-gray-500">税金：</span><span className="text-gray-800">{detailInvoice.tax_amount?.toFixed(2)}</span></div>
                <div><span className="text-gray-500">税金支付：</span><span className="text-gray-800">{detailInvoice.tax_paid ? '是' : '否'}</span></div>
                <div><span className="text-gray-500">支付方式：</span><span className="text-gray-800">{detailInvoice.tax_payment_method || '-'}</span></div>
                <div><span className="text-gray-500">状态：</span><span className="text-gray-800">{detailInvoice.status}</span></div>
                <div><span className="text-gray-500">开票时间：</span><span className="text-gray-800">{detailInvoice.invoice_date?.split('T')[0]}</span></div>
                <div className="col-span-2"><span className="text-gray-500">备注：</span><span className="text-gray-800">{detailInvoice.remark || '-'}</span></div>
                {detailInvoice.tax_payment_voucher && detailInvoice.tax_payment_voucher.split(',').filter(Boolean).length > 0 &&
              <div className="col-span-2">
                    <span className="text-gray-500">支付凭证：</span>
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {detailInvoice.tax_payment_voucher.split(',').filter(Boolean).map((url, i) =>
                  <div key={i} className="relative group">
                          {url.match(/\.(jpg|jpeg|png)$/i) ?
                    <img src={url} alt="支付凭证" className="w-full h-20 object-cover rounded cursor-pointer" onClick={() => window.open(url)} /> :

                    <div className="w-full h-20 bg-gray-100 rounded flex items-center justify-center cursor-pointer" onClick={() => window.open(url)}>
                              <span className="text-gray-500 text-xs">PDF文件</span>
                            </div>
                    }
                        </div>
                  )}
                    </div>
                  </div>
              }
                {detailInvoice.invoice_photo && detailInvoice.invoice_photo.split(',').filter(Boolean).length > 0 &&
              <div className="col-span-2">
                    <span className="text-gray-500">发票照片：</span>
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {detailInvoice.invoice_photo.split(',').filter(Boolean).map((url, i) =>
                  <div key={i} className="relative group">
                          {url.match(/\.(jpg|jpeg|png)$/i) ?
                    <img src={url} alt="发票照片" className="w-full h-20 object-cover rounded cursor-pointer" onClick={() => window.open(url)} /> :

                    <div className="w-full h-20 bg-gray-100 rounded flex items-center justify-center cursor-pointer" onClick={() => window.open(url)}>
                              <span className="text-gray-500 text-xs">PDF文件</span>
                            </div>
                    }
                        </div>
                  )}
                    </div>
                  </div>
              }
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      <AnimatePresence>
        {showEdit && editForm &&
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowEdit(false)}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl p-6 w-full max-w-2xl border border-gray-200 max-h-[90vh] overflow-y-auto shadow-lg" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-gray-800">编辑发票</h3><button onClick={() => setShowEdit(false)} className="text-gray-400 hover:text-gray-600"><FaTimes /></button></div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm text-gray-600 mb-1">发票类型</label>
                    <SegmentedControl
                    value={editForm.invoice_type || '普票'}
                    onChange={(v) => setEditForm({ ...editForm, invoice_type: v })}
                    options={[
                    { value: '普票', label: '普票' },
                    { value: '专票', label: '专票' }]
                    }
                    metricsContext="page:income_invoice_list:edit_invoice_type"
                    aria-label="发票类型" />
                </div>
                  <div><label className="block text-sm text-gray-600 mb-1">税率(%)</label>
                    <input type="number" value={editForm.tax_rate} onChange={(e) => setEditForm({ ...editForm, tax_rate: parseFloat(e.target.value) })} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800" /></div>
                  <div><label className="block text-sm text-gray-600 mb-1">开票金额</label>
                    <input type="number" value={editForm.invoice_amount} onChange={(e) => setEditForm({ ...editForm, invoice_amount: parseFloat(e.target.value) })} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800" /></div>
                  <div><label className="block text-sm text-gray-600 mb-1">税金</label>
                    <input type="number" value={editForm.tax_amount} onChange={(e) => setEditForm({ ...editForm, tax_amount: parseFloat(e.target.value) })} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800" /></div>
                  <div><label className="block text-sm text-gray-600 mb-1">状态</label>
                    <SegmentedControl
                    value={editForm.status || 'pending'}
                    onChange={(v) => setEditForm({ ...editForm, status: v })}
                    options={[
                    { value: 'pending', label: '待审核' },
                    { value: '已审核', label: '已审核' }]
                    }
                    metricsContext="page:income_invoice_list:edit_status"
                    aria-label="审核状态" />
                </div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button onClick={() => setShowEdit(false)} className="px-4 py-2 bg-gray-500 text-gray-800 rounded-lg">取消</button>
                  <button onClick={handleEditSave} className="px-4 py-2 bg-blue-600 text-gray-800 rounded-lg">保存</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>
    </motion.div>);

}