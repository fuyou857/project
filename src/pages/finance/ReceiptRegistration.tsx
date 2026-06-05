import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaSearch, FaTimes, FaUpload, FaFile, FaTrash, FaEye, FaEdit, FaFileExcel } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase/client';
import { useCompanyScope } from '../../hooks/useCompanyScope';
import { isSuperAdminUser } from '../../utils/sessionUser';
import { SearchableSelect, SegmentedControl } from '../../components/ui';
import { projectSelectOptions } from '../../components/ui/options';

interface Project {id: string;name: string;}
interface Company {id: string;name: string;parent_id?: string | null;}
interface PartyA {id: string;name: string;credit_code?: string;bank_name?: string;bank_account?: string;phone?: string;}
interface Receipt {
  id: string;
  receipt_no: string;
  title: string;
  project_id: string;
  income_category: string;
  contract_id: string | null;
  bank_account_id: string | null;
  payer_id: string | null;
  payer_name: string;
  payee_company_id: string;
  payment_method: string;
  amount: number;
  handler: string;
  receipt_date: string;
  remark: string;
  images: string;
  status: string;
  created_at: string;
  project_name?: string;
  company_name?: string;
}

const incomeCategories = ['工程款', '材料款', '保证金', '其他'];
const paymentMethods = ['银行转账', '支票', '现金', '承兑汇票', '其他'];
const bankAccounts = [
{ id: '1', name: '基本户-工商银行', account: '6222021234567890' },
{ id: '2', name: '一般户-建设银行', account: '6227001234567890' },
{ id: '3', name: '基本户-农业银行', account: '6228481234567890' },
{ id: '4', name: '一般户-中国银行', account: '6217001234567890' }];


export default function ReceiptRegistration() {
  const navigate = useNavigate();
  const { currentCompany, companies, companyIds } = useCompanyScope();
  const [projects, setProjects] = useState<Project[]>([]);
  const [companyList, setCompanyList] = useState<Company[]>([]);
  const [partyAList, setPartyAList] = useState<PartyA[]>([]);
  const [partyASearch, setPartyASearch] = useState('');
  const [partyASearchResults, setPartyASearchResults] = useState<PartyA[]>([]);
  const [showAddPartyA, setShowAddPartyA] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [detailReceipt, setDetailReceipt] = useState<Receipt | null>(null);
  const [editForm, setEditForm] = useState<Receipt | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [filters, setFilters] = useState({
    projectId: '',
    category: '',
    payer: '',
    startDate: '',
    endDate: '',
    keyword: ''
  });

  const [form, setForm] = useState({
    project_id: '', company_id: '', title: '', income_category: '工程款',
    bank_account_id: '', payer_id: '', payer_name: '', payment_method: '银行转账',
    amount: 0, handler: '张峰', receipt_date: new Date().toISOString().split('T')[0],
    remark: '', images: [] as string[]
  });
  const [newPartyA, setNewPartyA] = useState({ name: '', unit_type: '建设单位' });

  useEffect(() => {fetchData();}, [currentCompany]);
  useEffect(() => {fetchReceipts();}, [page, filters]);

  const receiptProjectFilterOptions = useMemo(() => projectSelectOptions(projects, '全部'), [projects]);
  const receiptCategoryFilterOptions = useMemo(
    () => [{ value: '', label: '全部' }, ...incomeCategories.map((c) => ({ value: c, label: c }))],
    []
  );
  const incomeCategoryFormOptions = useMemo(
    () => incomeCategories.map((c) => ({ value: c, label: c })),
    []
  );
  const paymentMethodFormOptions = useMemo(
    () => paymentMethods.map((m) => ({ value: m, label: m })),
    []
  );
  const bankAccountFormOptions = useMemo(
    () => [{ value: '', label: '选择账户' }, ...bankAccounts.map((b) => ({ value: b.id, label: b.name }))],
    []
  );
  const receiptCompanyFormOptions = useMemo(
    () => [{ value: '', label: '选择公司' }, ...companyList.map((c) => ({ value: c.id, label: c.name }))],
    [companyList]
  );
  const receiptFormProjectOptions = useMemo(
    () => projects.map((p) => ({ value: p.id, label: p.name })),
    [projects]
  );

  async function fetchData() {
    const comps = currentCompany ?
    [currentCompany, ...companies.filter((c: Company) => c.parent_id === currentCompany.id || c.parent_id === '0')] :
    companies;
    setCompanyList(comps as Company[]);
    if (!form.company_id && comps.length > 0) setForm((f) => ({ ...f, company_id: (comps[0] as Company).id }));

    let projQuery = supabase.from('projects').select('id, name').order('created_at', { ascending: false }).limit(50);
    if (currentCompany) {
      const ids = [currentCompany.id];
      const children = companies.filter((c) => c.parent_id === currentCompany.id || c.parent_id === '0');
      children.forEach((c) => ids.push(c.id));
      projQuery = projQuery.in('company_id', ids);
    }
    const { data: projs } = await projQuery;
    if (projs) setProjects(projs);

    const { data: parties } = await supabase.from('party_a').select('id, name, credit_code, bank_name, bank_account, phone').order('created_at', { ascending: false }).limit(20);
    if (parties) {setPartyAList(parties);setPartyASearchResults(parties);}
  }

  async function fetchReceipts() {
    setLoading(true);
    let query = supabase.from('receipt_registration').select('*', { count: 'exact' }).order('created_at', { ascending: false });

    if (companyIds.length > 0) {
      query = query.in('payee_company_id', companyIds);
    }

    if (filters.projectId) query = query.eq('project_id', filters.projectId);
    if (filters.category) query = query.eq('income_category', filters.category);
    if (filters.payer) query = query.ilike('payer_name', `%${filters.payer}%`);
    if (filters.startDate) query = query.gte('receipt_date', filters.startDate);
    if (filters.endDate) query = query.lte('receipt_date', filters.endDate);
    if (filters.keyword) query = query.or(`title.ilike.%${filters.keyword}%,receipt_no.ilike.%${filters.keyword}%`);

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, count } = await query;
    if (data) {
      const projectIds = [...new Set(data.map((d) => d.project_id))];
      const [pRes] = await Promise.all([
      supabase.from('projects').select('id, name').in('id', projectIds)]
      );
      const projectMap = new Map((pRes.data || []).map((p) => [p.id, p.name]));
      setReceipts(data.map((d) => ({ ...d, project_name: projectMap.get(d.project_id) })));
    }
    setTotal(count || 0);
    setLoading(false);
  }

  async function handlePartyASearch(keyword: string) {
    setPartyASearch(keyword);
    if (!keyword) {setPartyASearchResults(partyAList);return;}
    const { data } = await supabase.from('party_a').select('id, name, credit_code, bank_name, bank_account, phone').or(`name.ilike.%${keyword}%,credit_code.ilike.%${keyword}%`).limit(20);
    setPartyASearchResults(data || []);
  }

  function handlePartyASelect(party: PartyA) {
    setForm((f) => ({ ...f, payer_id: party.id, payer_name: party.name }));
    setPartyASearch(party.name);
  }

  async function handleAddPartyA() {
    if (!newPartyA.name) {alert('请输入单位名称');return;}
    const { data, error } = await supabase.from('party_a').insert({ name: newPartyA.name, unit_type: newPartyA.unit_type }).select().maybeSingle();
    if (error) {alert('新增失败: ' + error.message);return;}
    if (data) {
      setPartyAList([data, ...partyAList]);
      setPartyASearchResults([data, ...partyASearchResults]);
      handlePartyASelect(data);
    }
    setShowAddPartyA(false);
    setNewPartyA({ name: '', unit_type: '建设单位' });
  }

  function handleProjectChange(projectId: string) {
    const proj = projects.find((p) => p.id === projectId);
    const dateStr = form.receipt_date.replace(/-/g, '');
    setForm((f) => ({
      ...f, project_id: projectId,
      title: proj ? `${form.receipt_date} ${proj.name} 收款登记单` : f.title
    }));
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
      setForm((f) => ({ ...f, images: [...f.images, ...uploadedPaths] }));
    }
    setUploading(false);
    e.target.value = '';
  }

  function removeImage(index: number) {
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== index) }));
  }

  async function generateReceiptNo() {
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const { count } = await supabase.from('receipt_registration').select('*', { count: 'exact', head: true });
    const seq = String((count || 0) + 1).padStart(4, '0');
    return `RC${dateStr}${seq}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.project_id || !form.company_id || !form.payer_name || !form.amount) {
      alert('请填写必填项');return;
    }
    setLoading(true);
    const receiptNo = await generateReceiptNo();
    const payload = {
      receipt_no: receiptNo,
      title: form.title,
      project_id: form.project_id,
      income_category: form.income_category,
      bank_account_id: form.bank_account_id || null,
      payer_id: form.payer_id || null,
      payer_name: form.payer_name,
      payee_company_id: form.company_id,
      payment_method: form.payment_method,
      amount: form.amount,
      handler: form.handler,
      receipt_date: form.receipt_date,
      remark: form.remark,
      images: form.images.join(','),
      status: '有效'
    };
    const { error } = await supabase.from('receipt_registration').insert(payload);
    setLoading(false);
    if (error) {alert('保存失败: ' + error.message);return;}
    alert('保存成功');
    setShowForm(false);
    setForm({
      project_id: '', company_id: form.company_id, title: '', income_category: '工程款',
      bank_account_id: '', payer_id: '', payer_name: '', payment_method: '银行转账',
      amount: 0, handler: '张峰', receipt_date: new Date().toISOString().split('T')[0],
      remark: '', images: []
    });
    fetchReceipts();
  }

  async function handleDelete(id: string) {
    if (!confirm('确定删除此收款登记？')) return;
    await supabase.from('receipt_registration').delete().eq('id', id);
    fetchReceipts();
  }

  function openDetail(receipt: Receipt) {
    setDetailReceipt(receipt);
    setShowDetail(true);
  }

  function openEdit(receipt: Receipt) {
    setEditForm(receipt);
    setShowEdit(true);
  }

  async function handleEditSave() {
    if (!editForm) return;
    const { error } = await supabase.from('receipt_registration').update({
      title: editForm.title,
      income_category: editForm.income_category,
      bank_account_id: editForm.bank_account_id,
      payer_name: editForm.payer_name,
      payment_method: editForm.payment_method,
      amount: editForm.amount,
      handler: editForm.handler,
      receipt_date: editForm.receipt_date,
      remark: editForm.remark
    }).eq('id', editForm.id);
    if (!error) {
      setShowEdit(false);
      fetchReceipts();
    }
  }

  function handleExport() {
    const headers = ['登记单号', '登记主题', '项目', '收入类别', '付款方', '收款金额', '收款日期', '经办人', '状态'];
    const rows = receipts.map((r) => [
    r.receipt_no, r.title, r.project_name || '', r.income_category || '',
    r.payer_name || '', r.amount, r.receipt_date, r.handler, r.status]
    );
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `收款登记_${filters.startDate || ''}_${filters.endDate || ''}.csv`;
    a.click();
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">收款登记</h1>
        <div className="flex gap-2">
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-gray-800 rounded-lg">
            <FaFileExcel /> 导出
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-gray-800 rounded-lg">
            <FaPlus /> 新增登记
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1">所属项目</label>
            <SearchableSelect
              value={filters.projectId}
              onChange={(v) => {
                setFilters((f) => ({ ...f, projectId: v }));
                setPage(1);
              }}
              options={receiptProjectFilterOptions}
              placeholder="全部"
              emptyLabel="全部"
              searchPlaceholder="搜索项目…"
              metricsContext="page:receipt_registration:filter_project" />
            
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">收入类别</label>
            <SearchableSelect
              value={filters.category}
              onChange={(v) => {
                setFilters((f) => ({ ...f, category: v }));
                setPage(1);
              }}
              options={receiptCategoryFilterOptions}
              placeholder="全部"
              emptyLabel="全部"
              searchThreshold={10}
              metricsContext="page:receipt_registration:filter_category" />
            
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">付款方</label>
            <input type="text" value={filters.payer} onChange={(e) => {setFilters((f) => ({ ...f, payer: e.target.value }));setPage(1);}} placeholder="搜索付款方..." className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">开始日期</label>
            <input type="date" value={filters.startDate} onChange={(e) => {setFilters((f) => ({ ...f, startDate: e.target.value }));setPage(1);}} className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">结束日期</label>
            <input type="date" value={filters.endDate} onChange={(e) => {setFilters((f) => ({ ...f, endDate: e.target.value }));setPage(1);}} className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">搜索</label>
            <input type="text" value={filters.keyword} onChange={(e) => {setFilters((f) => ({ ...f, keyword: e.target.value }));setPage(1);}} placeholder="登记单号/主题..." className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-500 text-sm border-b border-gray-200">
                <th className="pb-3 font-medium">登记单号</th>
                <th className="pb-3 font-medium">登记主题</th>
                <th className="pb-3 font-medium">所属项目</th>
                <th className="pb-3 font-medium">收入类别</th>
                <th className="pb-3 font-medium">付款方</th>
                <th className="pb-3 font-medium">收款金额</th>
                <th className="pb-3 font-medium">收款日期</th>
                <th className="pb-3 font-medium">经办人</th>
                <th className="pb-3 font-medium">状态</th>
                <th className="pb-3 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {(() => {if (loading) {return <tr><td colSpan={10} className="py-8 text-center text-gray-500">加载中...</td></tr>;} else {if (
                  receipts.length === 0) {return <tr><td colSpan={10} className="py-8 text-center text-gray-500">暂无数据</td></tr>;} else {return (
                      receipts.map((r) =>
                      <tr key={r.id} className="border-b border-gray-200/50 hover:bg-gray-50/30">
                      <td className="py-3 text-gray-800">{r.receipt_no}</td>
                      <td className="py-3 text-gray-700">{r.title}</td>
                      <td className="py-3 text-gray-700">{r.project_name || '-'}</td>
                      <td className="py-3 text-gray-700">{r.income_category || '-'}</td>
                      <td className="py-3 text-gray-700">{r.payer_name || '-'}</td>
                      <td className="py-3 text-green-400 font-medium">{r.amount?.toFixed(2)}</td>
                      <td className="py-3 text-gray-700">{r.receipt_date}</td>
                      <td className="py-3 text-gray-700">{r.handler}</td>
                      <td className="py-3"><span className="px-2 py-1 text-xs rounded-full bg-green-500 text-gray-800">{r.status}</span></td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openDetail(r)} className="p-2 text-gray-500 hover:text-blue-400"><FaEye /></button>
                          <button onClick={() => openEdit(r)} className="p-2 text-gray-500 hover:text-yellow-400"><FaEdit /></button>
                          <button onClick={() => handleDelete(r.id)} className="p-2 text-gray-500 hover:text-red-400"><FaTrash /></button>
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
        {showForm &&
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl p-6 w-full max-w-3xl border border-gray-200 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-gray-800">新增收款登记</h3><button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-800"><FaTimes /></button></div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">所属项目 *</label>
                    <SearchableSelect
                    required
                    allowEmpty={false}
                    value={form.project_id}
                    onChange={handleProjectChange}
                    options={receiptFormProjectOptions}
                    placeholder="选择项目"
                    searchPlaceholder="搜索项目…"
                    metricsContext="page:receipt_registration:form_project" />
                  
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">收款方 *</label>
                    <SearchableSelect
                    required
                    value={form.company_id}
                    onChange={(v) => setForm((f) => ({ ...f, company_id: v }))}
                    options={receiptCompanyFormOptions}
                    placeholder="选择公司"
                    emptyLabel="选择公司"
                    searchPlaceholder="搜索公司…"
                    metricsContext="page:receipt_registration:form_company" />
                  
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">收入类别 *</label>
                    <SearchableSelect
                    allowEmpty={false}
                    value={form.income_category}
                    onChange={(v) => setForm((f) => ({ ...f, income_category: v }))}
                    options={incomeCategoryFormOptions}
                    placeholder="收入类别"
                    searchThreshold={10}
                    metricsContext="page:receipt_registration:form_income_category" />
                  
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">资金账户</label>
                    <SearchableSelect
                    value={form.bank_account_id}
                    onChange={(v) => setForm((f) => ({ ...f, bank_account_id: v }))}
                    options={bankAccountFormOptions}
                    placeholder="选择账户"
                    emptyLabel="选择账户"
                    searchPlaceholder="搜索账户…"
                    metricsContext="page:receipt_registration:form_bank" />
                  
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">付款方 *</label>
                    <div className="relative">
                      <input value={partyASearch} onChange={(e) => handlePartyASearch(e.target.value)} placeholder="搜索甲方单位..." className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" />
                      {partyASearchResults.length > 0 && partyASearch &&
                    <div className="absolute z-10 w-full mt-1 bg-gray-50 border border-slate-600 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                          {partyASearchResults.map((p) =>
                      <div key={p.id} onClick={() => handlePartyASelect(p)} className="px-3 py-2 hover:bg-gray-500 cursor-pointer text-gray-800 text-sm">{p.name}</div>
                      )}
                        </div>
                    }
                    </div>
                    <button type="button" onClick={() => setShowAddPartyA(true)} className="text-blue-400 text-sm mt-1 hover:text-blue-300">+ 新增甲方单位</button>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">收款方式</label>
                    <SearchableSelect
                    allowEmpty={false}
                    value={form.payment_method}
                    onChange={(v) => setForm((f) => ({ ...f, payment_method: v }))}
                    options={paymentMethodFormOptions}
                    placeholder="收款方式"
                    searchThreshold={10}
                    metricsContext="page:receipt_registration:form_payment_method" />
                  
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">收款金额 *</label>
                    <input type="number" step="0.01" min="0" value={form.amount || ''} onChange={(e) => setForm((f) => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" required />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">经办人 *</label>
                    <input value={form.handler} onChange={(e) => setForm((f) => ({ ...f, handler: e.target.value }))} className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" required />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">收款日期 *</label>
                    <input type="date" value={form.receipt_date} onChange={(e) => setForm((f) => ({ ...f, receipt_date: e.target.value, title: e.target.value ? `${e.target.value} ${projects.find((p) => p.id === f.project_id)?.name || ''} 收款登记单` : f.title }))} className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" required />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-sm text-gray-500 mb-1">登记主题</label>
                    <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-sm text-gray-500 mb-1">备注</label>
                    <textarea value={form.remark} onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))} rows={2} className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-sm text-gray-500 mb-1">图片</label>
                    <input type="file" ref={imageInputRef} onChange={handleFileUpload} accept=".jpg,.jpeg,.png,.pdf" multiple className="ui-file-input-safe" data-file-upload-field="true" />
                    <div onClick={() => imageInputRef.current?.click()} className="border-2 border-dashed border-slate-600 rounded-lg p-4 text-center cursor-pointer hover:border-blue-500">
                      <FaUpload className="mx-auto text-gray-500 mb-2" />
                      <span className="text-gray-500 text-sm">{uploading ? '上传中...' : '点击上传jpg/png/pdf'}</span>
                    </div>
                    {form.images.length > 0 &&
                  <div className="mt-2 grid grid-cols-4 gap-2">
                        {form.images.map((url, i) =>
                    <div key={i} className="relative group">
                            {url.match(/\.(jpg|jpeg|png)$/i) ?
                      <img src={url} alt="附件" className="w-full h-20 object-cover rounded cursor-pointer" onClick={() => window.open(url)} /> :

                      <div className="w-full h-20 bg-gray-50 rounded flex items-center justify-center cursor-pointer" onClick={() => window.open(url)}>
                                <FaFile className="text-gray-500 text-2xl" />
                              </div>
                      }
                            <button type="button" onClick={() => removeImage(i)} className="absolute -top-2 -right-2 bg-red-500 text-gray-800 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <FaTrash className="text-xs" />
                            </button>
                          </div>
                    )}
                      </div>
                  }
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-500 hover:bg-slate-500 text-gray-800 rounded-lg">取消</button>
                  <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-gray-800 rounded-lg">{loading ? '保存中...' : '保存'}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      <AnimatePresence>
        {showDetail && detailReceipt &&
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDetail(false)}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl p-6 w-full max-w-2xl border border-gray-200 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-gray-800">收款登记详情</h3><button onClick={() => setShowDetail(false)} className="text-gray-500 hover:text-gray-800"><FaTimes /></button></div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">登记单号：</span><span className="text-gray-800">{detailReceipt.receipt_no}</span></div>
                <div><span className="text-gray-500">登记主题：</span><span className="text-gray-800">{detailReceipt.title}</span></div>
                <div><span className="text-gray-500">项目：</span><span className="text-gray-800">{detailReceipt.project_name}</span></div>
                <div><span className="text-gray-500">收入类别：</span><span className="text-gray-800">{detailReceipt.income_category}</span></div>
                <div><span className="text-gray-500">付款方：</span><span className="text-gray-800">{detailReceipt.payer_name}</span></div>
                <div><span className="text-gray-500">收款方式：</span><span className="text-gray-800">{detailReceipt.payment_method}</span></div>
                <div><span className="text-gray-500">收款金额：</span><span className="text-green-400 font-medium">{detailReceipt.amount?.toFixed(2)}</span></div>
                <div><span className="text-gray-500">收款日期：</span><span className="text-gray-800">{detailReceipt.receipt_date}</span></div>
                <div><span className="text-gray-500">经办人：</span><span className="text-gray-800">{detailReceipt.handler}</span></div>
                <div><span className="text-gray-500">状态：</span><span className="text-gray-800">{detailReceipt.status}</span></div>
                <div className="col-span-2"><span className="text-gray-500">备注：</span><span className="text-gray-800">{detailReceipt.remark || '-'}</span></div>
                {detailReceipt.images && detailReceipt.images.split(',').filter(Boolean).length > 0 &&
              <div className="col-span-2">
                    <span className="text-gray-500">附件：</span>
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {detailReceipt.images.split(',').filter(Boolean).map((url, i) =>
                  <div key={i}>
                          {url.match(/\.(jpg|jpeg|png)$/i) ?
                    <img src={url} alt="附件" className="w-full h-20 object-cover rounded cursor-pointer" onClick={() => window.open(url)} /> :

                    <div className="w-full h-20 bg-gray-50 rounded flex items-center justify-center cursor-pointer" onClick={() => window.open(url)}>
                              <span className="text-gray-500 text-xs">PDF</span>
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl p-6 w-full max-w-2xl border border-gray-200 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-gray-800">编辑收款登记</h3><button onClick={() => setShowEdit(false)} className="text-gray-500 hover:text-gray-800"><FaTimes /></button></div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm text-gray-500 mb-1">登记主题</label>
                    <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                  <div><label className="block text-sm text-gray-500 mb-1">收入类别</label>
                    <SearchableSelect
                    allowEmpty={false}
                    value={editForm.income_category}
                    onChange={(v) => setEditForm({ ...editForm, income_category: v })}
                    options={incomeCategoryFormOptions}
                    placeholder="收入类别"
                    searchThreshold={10}
                    metricsContext="page:receipt_registration:edit_income_category" />
                </div>
                  <div><label className="block text-sm text-gray-500 mb-1">付款方</label>
                    <input value={editForm.payer_name} onChange={(e) => setEditForm({ ...editForm, payer_name: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                  <div><label className="block text-sm text-gray-500 mb-1">收款方式</label>
                    <SearchableSelect
                    allowEmpty={false}
                    value={editForm.payment_method}
                    onChange={(v) => setEditForm({ ...editForm, payment_method: v })}
                    options={paymentMethodFormOptions}
                    placeholder="收款方式"
                    searchThreshold={10}
                    metricsContext="page:receipt_registration:edit_payment_method" />
                </div>
                  <div><label className="block text-sm text-gray-500 mb-1">收款金额</label>
                    <input type="number" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: parseFloat(e.target.value) })} className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                  <div><label className="block text-sm text-gray-500 mb-1">收款日期</label>
                    <input type="date" value={editForm.receipt_date} onChange={(e) => setEditForm({ ...editForm, receipt_date: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                  <div><label className="block text-sm text-gray-500 mb-1">经办人</label>
                    <input value={editForm.handler} onChange={(e) => setEditForm({ ...editForm, handler: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
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

      <AnimatePresence>
        {showAddPartyA &&
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={() => setShowAddPartyA(false)}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl p-6 w-full max-w-md border border-gray-200" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-gray-800">新增甲方单位</h3><button onClick={() => setShowAddPartyA(false)} className="text-gray-500 hover:text-gray-800"><FaTimes /></button></div>
              <div className="space-y-3">
                <div><label className="block text-gray-500 text-sm mb-1">单位名称 *</label><input value={newPartyA.name} onChange={(e) => setNewPartyA({ ...newPartyA, name: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                <div><label className="block text-gray-500 text-sm mb-1">单位类别</label>
                  <SegmentedControl
                  value={newPartyA.unit_type}
                  onChange={(v) => setNewPartyA({ ...newPartyA, unit_type: v })}
                  options={[
                  { value: '建设单位', label: '建设单位' },
                  { value: '总包单位', label: '总包单位' },
                  { value: '分包单位', label: '分包单位' }]
                  }
                  metricsContext="page:receipt_registration:new_party_a_unit_type"
                  aria-label="单位类别" />
              </div>
              </div>
              <div className="flex justify-end gap-3 mt-4"><button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowAddPartyA(false); }} className="px-4 py-2 bg-gray-500 text-gray-800 rounded-lg">取消</button><button onClick={handleAddPartyA} className="px-4 py-2 bg-blue-600 text-gray-800 rounded-lg">保存</button></div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>
    </motion.div>);

}