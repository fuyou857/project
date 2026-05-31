import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaSearch, FaCheck, FaEye, FaTimes, FaUpload, FaFile, FaTrash, FaFileExcel } from 'react-icons/fa';
import { supabase } from '../../supabase/client';
import { useCompanyScope } from '../../hooks/useCompanyScope';
import { isSuperAdminUser } from '../../utils/sessionUser';
import { projectIdsForInvoiceScope } from '../../utils/companyProjectScope';
import { SearchableSelect } from '../../components/ui';
import { projectSelectOptions } from '../../components/ui/options';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

interface TaxDebtInvoice {
  id: string;
  project_id: string;
  company_id?: string | null;
  invoice_type: string;
  tax_rate: number;
  buyer_name: string;
  invoice_amount: number;
  tax_amount: number;
  tax_paid: boolean;
  tax_payment_method: string;
  tax_payment_voucher: string;
  tax_payment_description: string;
  tax_paid_at: string;
  created_at: string;
  project_name?: string;
  company_name?: string;
}

const paymentMethods = ['银行转账', '扫码支付', '现金', '其他'];

export default function TaxDebtList() {
  const { currentCompany, companies, companyIds } = useCompanyScope();
  const [invoices, setInvoices] = useState<TaxDebtInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [total, setTotal] = useState(0);
  const [showPaid, setShowPaid] = useState(false);

  const [companyFilter, setCompanyFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebouncedValue(keyword, 300);

  const [projects, setProjects] = useState<{id: string;name: string;}[]>([]);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<TaxDebtInvoice | null>(null);
  const [uploading, setUploading] = useState(false);
  const voucherInputRef = useRef<HTMLInputElement>(null);

  const [payForm, setPayForm] = useState({
    tax_payment_method: '',
    tax_payment_voucher: [] as string[],
    tax_payment_description: ''
  });

  useEffect(() => {
    void fetchProjects();
  }, [currentCompany, companies]);

  useEffect(() => {
    void fetchInvoices();
  }, [page, companyFilter, projectFilter, debouncedKeyword, showPaid, currentCompany, companies]);

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
        console.error('[TaxDebtList] fetchProjects', error);
        return;
      }
      if (data) setProjects(data);
    } catch (e) {
      console.error('[TaxDebtList] fetchProjects', e);
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

      query = showPaid ? query.eq('tax_paid', true) : query.eq('tax_paid', false);

      if (scopedProjectIds !== null) {
        if (scopedProjectIds.length === 0) {
          setInvoices([]);
          setTotal(0);
          return;
        }
        query = query.in('project_id', scopedProjectIds);
      }
      if (projectFilter) query = query.eq('project_id', projectFilter);
      if (debouncedKeyword) {
        const safe = debouncedKeyword.replace(/[%(),]/g, '').trim();
        if (safe) query = query.or(`buyer_name.ilike.%${safe}%,remark.ilike.%${safe}%`);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) {
        console.error('[TaxDebtList] fetchInvoices', error);
        setInvoices([]);
        setTotal(0);
        return;
      }
      if (data) {
        const projectIds = [...new Set(data.map((d) => d.project_id))];

        const { data: projRows, error: pErr } = await supabase.from('projects').select('id, name, company_id').in('id', projectIds);
        if (pErr) console.error('[TaxDebtList] projects', pErr);
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
      console.error('[TaxDebtList] fetchInvoices', e);
      setInvoices([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    const uploadedPaths: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['jpg', 'jpeg', 'png', 'pdf'].includes(ext || '')) {
        alert('仅支持jpg、png、pdf格式');
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert('单个文件不能超过10MB');
        continue;
      }
      const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
      const arrayBuffer = await file.arrayBuffer();
      const { data, error } = await supabase.storage.from('files').upload(fileName, arrayBuffer, { contentType: file.type });
      if (error) {
        alert('上传失败: ' + error.message);
      } else if (data) {
        const { data: urlData } = supabase.storage.from('files').getPublicUrl(fileName);
        uploadedPaths.push(urlData.publicUrl);
      }
    }
    if (uploadedPaths.length > 0) {
      setPayForm((f) => ({ ...f, tax_payment_voucher: [...f.tax_payment_voucher, ...uploadedPaths] }));
    }
    setUploading(false);
    e.target.value = '';
  }

  function removeVoucher(index: number) {
    setPayForm((f) => ({ ...f, tax_payment_voucher: f.tax_payment_voucher.filter((_, i) => i !== index) }));
  }

  async function handlePay() {
    if (!selectedInvoice) return;
    if (!payForm.tax_payment_method) {alert('请选择支付方式');return;}
    if (payForm.tax_payment_voucher.length === 0) {alert('请上传支付凭证');return;}

    const { error } = await supabase.from('income_invoices').update({
      tax_paid: true,
      tax_payment_method: payForm.tax_payment_method,
      tax_payment_voucher: payForm.tax_payment_voucher.join(','),
      tax_payment_description: payForm.tax_payment_description,
      tax_paid_at: new Date().toISOString()
    }).eq('id', selectedInvoice.id);

    if (error) {alert('保存失败: ' + error.message);return;}
    alert('操作成功');
    setShowPayModal(false);
    setPayForm({ tax_payment_method: '', tax_payment_voucher: [], tax_payment_description: '' });
    fetchInvoices();
  }

  function openPayModal(invoice: TaxDebtInvoice) {
    setSelectedInvoice(invoice);
    setPayForm({ tax_payment_method: '', tax_payment_voucher: [], tax_payment_description: '' });
    setShowPayModal(true);
  }

  function openViewModal(invoice: TaxDebtInvoice) {
    setSelectedInvoice(invoice);
    setShowViewModal(true);
  }

  function handleExport() {
    const headers = ['ID', '项目', '公司', '购买方', '所欠税金金额', '添加时间', '状态'];
    const rows = invoices.map((inv, idx) => [
    idx + 1,
    inv.project_name || '',
    inv.company_name || '',
    inv.buyer_name,
    inv.tax_amount,
    inv.created_at?.split('T')[0] || '',
    inv.tax_paid ? '已支付' : '未支付']
    );

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `欠税列表_${new Date().toISOString().split('T')[0]}.csv`;
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
  const paymentMethodOptions = useMemo(
    () => [{ value: '', label: '选择方式' }, ...paymentMethods.map((m) => ({ value: m, label: m }))],
    []
  );

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">欠税列表</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-gray-800 cursor-pointer">
            <input type="checkbox" checked={showPaid} onChange={(e) => {setShowPaid(e.target.checked);setPage(1);}} className="w-4 h-4" />
            显示已支付
          </label>
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-gray-800 rounded-lg">
            <FaFileExcel /> 导出
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1">公司</label>
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
              metricsContext="page:tax_debt_list:filter_company" />
            
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">项目</label>
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
              metricsContext="page:tax_debt_list:filter_project" />
            
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-500 mb-1">搜索</label>
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input type="text" placeholder="搜索项目/购买方..." value={keyword} onChange={(e) => {setKeyword(e.target.value);setPage(1);}} className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" />
            </div>
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
                <th className="pb-3 font-medium">所欠税金金额</th>
                <th className="pb-3 font-medium">添加时间</th>
                <th className="pb-3 font-medium">状态</th>
                <th className="pb-3 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {(() => {if (loading) {return <tr><td colSpan={8} className="py-8 text-center text-gray-500">加载中...</td></tr>;} else {if (
                  invoices.length === 0) {return <tr><td colSpan={8} className="py-8 text-center text-gray-500">暂无数据</td></tr>;} else {return (
                      invoices.map((inv, idx) =>
                      <tr key={inv.id} className="border-b border-gray-200/50 hover:bg-gray-50/30">
                      <td className="py-3 text-gray-700">{idx + 1}</td>
                      <td className="py-3 text-gray-800">{inv.project_name || '-'}</td>
                      <td className="py-3 text-gray-700">{inv.company_name || '-'}</td>
                      <td className="py-3 text-gray-700">{inv.buyer_name}</td>
                      <td className="py-3 text-yellow-400 font-medium">{inv.tax_amount?.toFixed(2)}</td>
                      <td className="py-3 text-gray-700">{inv.created_at?.split('T')[0]}</td>
                      <td className="py-3"><span className={`px-2 py-1 text-xs rounded-full ${inv.tax_paid ? 'bg-green-500' : 'bg-red-500'} text-gray-800`}>{inv.tax_paid ? '已支付' : '未支付'}</span></td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {inv.tax_paid ?
                            <button onClick={() => openViewModal(inv)} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-gray-800 rounded text-sm">查看凭证</button> :

                            <button onClick={() => openPayModal(inv)} className="px-3 py-1 bg-green-600 hover:bg-green-700 text-gray-800 rounded text-sm">已支付</button>
                            }
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
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 bg-gray-50 rounded text-gray-800 disabled:opacity-50">上一页</button>
              <span className="text-gray-500">{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1 bg-gray-50 rounded text-gray-800 disabled:opacity-50">下一页</button>
            </div>
          </div>
        }
      </div>

      <AnimatePresence>
        {showPayModal && selectedInvoice &&
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowPayModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white rounded-xl p-6 w-full max-w-lg border border-gray-200" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800">税金支付</h3>
                <button onClick={() => setShowPayModal(false)} className="text-gray-500 hover:text-gray-800"><FaTimes /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-1">税金支付方式 *</label>
                  <SearchableSelect
                  value={payForm.tax_payment_method}
                  onChange={(v) => setPayForm((f) => ({ ...f, tax_payment_method: v }))}
                  options={paymentMethodOptions}
                  placeholder="选择方式"
                  emptyLabel="选择方式"
                  searchThreshold={10}
                  metricsContext="page:tax_debt_list:pay_method" />
                
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">上传支付凭证 *</label>
                  <input type="file" ref={voucherInputRef} onChange={handleFileUpload} accept=".jpg,.jpeg,.png,.pdf" multiple className="hidden" />
                  <div onClick={() => voucherInputRef.current?.click()} className="border-2 border-dashed border-slate-600 rounded-lg p-4 text-center cursor-pointer hover:border-blue-500">
                    <FaUpload className="mx-auto text-gray-500 mb-2" />
                    <span className="text-gray-500 text-sm">{uploading ? '上传中...' : '点击上传jpg/png/pdf'}</span>
                  </div>
                  {payForm.tax_payment_voucher.length > 0 &&
                <div className="mt-2 grid grid-cols-4 gap-2">
                      {payForm.tax_payment_voucher.map((url, i) =>
                  <div key={i} className="relative group">
                          {url.match(/\.(jpg|jpeg|png)$/i) ?
                    <img src={url} alt="支付凭证" className="w-full h-20 object-cover rounded cursor-pointer" onClick={() => window.open(url)} /> :

                    <div className="w-full h-20 bg-gray-50 rounded flex items-center justify-center cursor-pointer" onClick={() => window.open(url)}>
                              <FaFile className="text-gray-500 text-2xl" />
                            </div>
                    }
                          <button type="button" onClick={() => removeVoucher(i)} className="absolute -top-2 -right-2 bg-red-500 text-gray-800 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <FaTrash className="text-xs" />
                          </button>
                        </div>
                  )}
                    </div>
                }
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">支付说明</label>
                  <textarea value={payForm.tax_payment_description} onChange={(e) => setPayForm((f) => ({ ...f, tax_payment_description: e.target.value }))} rows={3} className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button onClick={() => setShowPayModal(false)} className="px-4 py-2 bg-gray-500 text-gray-800 rounded-lg">取消</button>
                  <button onClick={handlePay} className="px-4 py-2 bg-green-600 text-gray-800 rounded-lg">确认支付</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      <AnimatePresence>
        {showViewModal && selectedInvoice &&
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowViewModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white rounded-xl p-6 w-full max-w-lg border border-gray-200 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800">支付凭证</h3>
                <button onClick={() => setShowViewModal(false)} className="text-gray-500 hover:text-gray-800"><FaTimes /></button>
              </div>
              <div className="space-y-4 text-sm">
                <div><span className="text-gray-500">支付方式：</span><span className="text-gray-800">{selectedInvoice.tax_payment_method || '-'}</span></div>
                <div><span className="text-gray-500">支付时间：</span><span className="text-gray-800">{selectedInvoice.tax_paid_at?.split('T')[0] || '-'}</span></div>
                <div><span className="text-gray-500">支付说明：</span><span className="text-gray-800">{selectedInvoice.tax_payment_description || '-'}</span></div>
                {selectedInvoice.tax_payment_voucher && selectedInvoice.tax_payment_voucher.split(',').filter(Boolean).length > 0 &&
              <div>
                    <span className="text-gray-500">支付凭证：</span>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {selectedInvoice.tax_payment_voucher.split(',').filter(Boolean).map((url, i) =>
                  <div key={i} className="relative group">
                          {url.match(/\.(jpg|jpeg|png)$/i) ?
                    <img src={url} alt="支付凭证" className="w-full h-24 object-cover rounded cursor-pointer" onClick={() => window.open(url)} /> :

                    <div className="w-full h-24 bg-gray-50 rounded flex items-center justify-center cursor-pointer" onClick={() => window.open(url)}>
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
    </motion.div>);

}