import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaSearch, FaTimes, FaUpload, FaFile, FaTrash } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase/client';
import { alertMissingRequiredFields } from '../../utils/contractSubPage';
import { useCompanyScope } from '../../hooks/useCompanyScope';
import PartyASelector, { PartyA } from '../../components/PartyASelector';
import { Company } from '../../stores/appStore';
import { SearchableSelect, SegmentedControl } from '../../components/ui';

interface Project { id: string; name: string; project_code?: string; owner_address?: string; party_a_id?: string; company_id?: string | null; }

const taxRateOptions = [0, 1, 3, 6, 9, 13];
const paymentMethods = ['银行转账', '扫码支付', '现金', '其他'];

const INCOME_INVOICE_ISSUE_VOUCHER_FILE_ID = 'income-invoice-issue-tax-voucher-file';
const INCOME_INVOICE_ISSUE_PHOTO_FILE_ID = 'income-invoice-issue-invoice-photo-file';

export default function IncomeInvoiceIssue() {
  const navigate = useNavigate();
  const { currentCompany, companies, companyIds } = useCompanyScope();
  const [projects, setProjects] = useState<Project[]>([]);
  const [companyList, setCompanyList] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const projectDropdownRef = useRef<HTMLDivElement>(null);
  const [projectSearch, setProjectSearch] = useState('');
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [form, setForm] = useState({
    project_id: '', company_id: '', invoice_type: '普票', tax_rate: 0,
    party_a_id: '', buyer_name: '', buyer_tax_no: '', buyer_bank: '', buyer_account: '',
    buyer_address_phone: '', invoice_amount: 0, tax_amount: 0, remark: '',
    tax_paid: false, tax_payment_method: '', tax_payment_voucher: [] as string[],
    invoice_photo: [] as string[], payment_description: ''
  });
  const [customTaxRate, setCustomTaxRate] = useState('');

  const companyFormOptions = useMemo(
    () => [{ value: '', label: '选择公司' }, ...companyList.map(c => ({ value: c.id, label: c.name }))],
    [companyList],
  );
  const taxRatePresetOptions = useMemo(
    () => taxRateOptions.map(r => ({ value: String(r), label: `${r}%` })),
    [],
  );
  const taxPaymentMethodOptions = useMemo(
    () => [{ value: '', label: '选择方式' }, ...paymentMethods.map(m => ({ value: m, label: m }))],
    [],
  );

  const filteredProjects = () => projects.filter(p => {
    if (!projectSearch) return true;
    const search = projectSearch.toLowerCase();
    return p.name.toLowerCase().includes(search) || 
           (p.project_code && p.project_code.toLowerCase().includes(search));
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(event.target as Node)) {
        setShowProjectDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, field: 'tax_payment_voucher' | 'invoice_photo') {
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
      setForm(f => ({ ...f, [field]: [...f[field], ...uploadedPaths] }));
    }
    setUploading(false);
    e.target.value = '';
  }

  function removeFile(field: 'tax_payment_voucher' | 'invoice_photo', index: number) {
    setForm(f => ({ ...f, [field]: f[field].filter((_, i) => i !== index) }));
  }

  useEffect(() => {
    void fetchData();
  }, [currentCompany, companies]);

  async function fetchData() {
    try {
      const comps = currentCompany
        ? [currentCompany, ...companies.filter((c: Company) => c.parent_id === currentCompany.id || c.parent_id === '0')]
        : companies;
      setCompanyList(comps as Company[]);
      if (!form.company_id && comps.length > 0) setForm(f => ({ ...f, company_id: (comps[0] as Company).id }));

      let query = supabase.from('projects').select('id, name, project_code, owner_address, party_a_id, company_id').order('id', { ascending: false }).limit(50);
      if (companyIds.length > 0) query = query.in('company_id', companyIds);
      const { data: projs, error } = await query;
      if (error) {
        console.error('[IncomeInvoiceIssue] fetchData projects', error);
        return;
      }
      if (projs) setProjects(projs);
    } catch (e) {
      console.error('[IncomeInvoiceIssue] fetchData', e);
    }
  }

  async function handlePartyAChange(partyAId: string) {
    setForm(f => ({ ...f, party_a_id: partyAId }));
    
    if (partyAId) {
      const { data: party } = await supabase
        .from('party_a')
        .select('id, name, credit_code, bank_name, bank_account, phone')
        .eq('id', partyAId)
        .maybeSingle();
      
      if (party) {
        setForm(f => ({
          ...f,
          buyer_name: party.name,
          buyer_tax_no: party.credit_code || '',
          buyer_bank: party.bank_name || '',
          buyer_account: party.bank_account || '',
          buyer_address_phone: party.phone || ''
        }));
      }
    } else {
      setForm(f => ({
        ...f,
        buyer_name: '',
        buyer_tax_no: '',
        buyer_bank: '',
        buyer_account: '',
        buyer_address_phone: ''
      }));
    }
  }

  async function handleProjectSelect(projectId: string) {
    const proj = projects.find(p => p.id === projectId);
    
    if (!proj) {
      setForm(f => ({
        ...f, project_id: projectId, company_id: '',
        remark: '',
        party_a_id: '',
        buyer_name: '',
        buyer_tax_no: '',
        buyer_bank: '',
        buyer_account: '',
        buyer_address_phone: ''
      }));
      setProjectSearch('');
      setShowProjectDropdown(false);
      return;
    }

    setProjectSearch(proj.name);
    setShowProjectDropdown(false);

    // 如果项目关联了甲方单位，自动填充购买方信息
    if (proj.party_a_id) {
      const { data: partyA } = await supabase
        .from('party_a')
        .select('id, name, credit_code, bank_name, bank_account, phone')
        .eq('id', proj.party_a_id)
        .maybeSingle();
      
      if (partyA) {
        setForm(f => ({
          ...f, 
          project_id: projectId,
          company_id: proj.company_id || f.company_id,
          remark: `工程名称：${proj.name}，工程地址：${proj.owner_address || ''}`,
          party_a_id: partyA.id,
          buyer_name: partyA.name || f.buyer_name,
          buyer_tax_no: partyA.credit_code || f.buyer_tax_no,
          buyer_bank: partyA.bank_name || f.buyer_bank,
          buyer_account: partyA.bank_account || f.buyer_account,
          buyer_address_phone: partyA.phone || f.buyer_address_phone
        }));
        return;
      }
    }

    // 如果没有关联甲方单位或查询失败
    setForm(f => ({
      ...f, 
      project_id: projectId,
      company_id: proj.company_id || f.company_id,
      remark: `工程名称：${proj.name}，工程地址：${proj.owner_address || ''}`,
      party_a_id: '',
      buyer_name: '',
      buyer_tax_no: '',
      buyer_bank: '',
      buyer_account: '',
      buyer_address_phone: ''
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    const proj = projects.find(p => p.id === form.project_id);
    const resolvedCompanyId = proj?.company_id || form.company_id;
    const missing: string[] = [];
    if (!form.project_id) missing.push('项目名称');
    if (!resolvedCompanyId) missing.push('公司名称');
    if (!form.buyer_name?.trim()) missing.push('购买方名称');
    if (!form.buyer_tax_no?.trim()) missing.push('购买方税号');
    if (!form.buyer_bank?.trim()) missing.push('购买方开户银行');
    if (!form.buyer_account?.trim()) missing.push('购买方银行账号');
    if (!form.buyer_address_phone?.trim()) missing.push('购买方地址/电话');
    if (!form.invoice_amount || form.invoice_amount <= 0) missing.push('开票金额');
    if (!form.tax_amount || form.tax_amount < 0) missing.push('税金');
    
    if (form.tax_paid) {
      if (!form.tax_payment_method?.trim()) missing.push('税金支付方式');
      if (form.tax_payment_voucher.length === 0) missing.push('支付凭证');
    }
    
    if (alertMissingRequiredFields(missing)) return
    
    setLoading(true);

    try {
      const payload = {
        project_id: form.project_id,
        company_id: resolvedCompanyId,
        buyer_id: form.party_a_id || null,
        invoice_type: form.invoice_type,
        tax_rate: form.tax_rate,
        buyer_name: form.buyer_name,
        buyer_tax_no: form.buyer_tax_no,
        buyer_bank: form.buyer_bank,
        buyer_account: form.buyer_account,
        buyer_address_phone: form.buyer_address_phone,
        invoice_amount: form.invoice_amount,
        tax_amount: form.tax_amount,
        remark: form.remark,
        tax_paid: form.tax_paid,
        tax_payment_method: form.tax_payment_method,
        tax_payment_voucher: form.tax_payment_voucher.join(','),
        invoice_photo: form.invoice_photo.join(','),
        payment_description: form.payment_description,
        status: '待审核'
      };

      const { error: invoiceError } = await supabase.from('income_invoices').insert(payload);
      if (invoiceError) {
        throw new Error('保存发票失败: ' + invoiceError.message);
      }

      if (form.party_a_id) {
        await updatePartyAFromInvoice();
      }

      alert('保存成功');
      navigate('/finance/invoice-list');
    } catch (error) {
      alert((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function updatePartyAFromInvoice() {
    if (!form.party_a_id) return;

    const { data: existingPartyA, error: fetchError } = await supabase
      .from('party_a')
      .select('id, name, credit_code, bank_name, bank_account, phone')
      .eq('id', form.party_a_id)
      .maybeSingle();

    if (fetchError || !existingPartyA) return;

    const updateData: Partial<PartyA> = {};

    if (!existingPartyA.name && form.buyer_name) {
      updateData.name = form.buyer_name;
    }

    if (!existingPartyA.credit_code && form.buyer_tax_no) {
      updateData.credit_code = form.buyer_tax_no;
    }

    if (!existingPartyA.bank_name && form.buyer_bank) {
      updateData.bank_name = form.buyer_bank;
    }

    if (!existingPartyA.bank_account && form.buyer_account) {
      updateData.bank_account = form.buyer_account;
    }

    if (!existingPartyA.phone && form.buyer_address_phone) {
      updateData.phone = form.buyer_address_phone;
    }

    if (Object.keys(updateData).length > 0) {
      await supabase.from('party_a').update(updateData).eq('id', form.party_a_id);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">收入发票开具</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">项目名称 *</label>
            <div className="relative" ref={projectDropdownRef}>
              <input
                type="text"
                value={projectSearch}
                onChange={e => {
                  setProjectSearch(e.target.value);
                  setShowProjectDropdown(true);
                }}
                onFocus={() => setShowProjectDropdown(true)}
                placeholder="输入项目名称或编号搜索..."
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {showProjectDropdown && filteredProjects().length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg max-h-48 overflow-y-auto shadow-lg">
                  {filteredProjects().map(p => (
                    <div
                      key={p.id}
                      onClick={() => handleProjectSelect(p.id)}
                      className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-gray-800 border-b border-gray-100 last:border-0"
                    >
                      <div className="font-medium">{p.name}</div>
                      {p.project_code && <div className="text-xs text-gray-500">编号: {p.project_code}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">公司名称 *</label>
            <SearchableSelect
              required
              value={form.company_id}
              onChange={v => setForm(f => ({ ...f, company_id: v }))}
              options={companyFormOptions}
              placeholder="选择公司"
              emptyLabel="选择公司"
              searchPlaceholder="搜索公司…"
              metricsContext="page:income_invoice_issue:company"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">发票类型 *</label>
            <SegmentedControl
              value={form.invoice_type}
              onChange={v => setForm(f => ({ ...f, invoice_type: v }))}
              options={[
                { value: '普票', label: '普票' },
                { value: '专票', label: '专票' },
              ]}
              metricsContext="page:income_invoice_issue:invoice_type"
              aria-label="发票类型"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">增值税税率(%) *</label>
            <div className="flex gap-2">
              <SearchableSelect
                className="flex-1 min-w-0"
                value={taxRateOptions.includes(form.tax_rate) ? String(form.tax_rate) : ''}
                onChange={v => {
                  setForm(f => ({ ...f, tax_rate: parseFloat(v) }));
                  setCustomTaxRate('');
                }}
                options={taxRatePresetOptions}
                placeholder="预设税率"
                emptyLabel="自定义（右侧填写）"
                searchThreshold={10}
                metricsContext="page:income_invoice_issue:tax_rate_preset"
              />
              <input 
                type="number" 
                step="0.01" 
                min="0" 
                max="100"
                value={customTaxRate}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val >= 0 && val <= 100) {
                    setCustomTaxRate(e.target.value);
                    setForm(f => ({ ...f, tax_rate: val }));
                  }
                }}
                placeholder="自定义"
                className="w-28 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <PartyASelector 
              value={form.party_a_id} 
              onChange={handlePartyAChange} 
              label="购买方名称" 
              placeholder="搜索或输入甲方单位名称..."
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">购买方税号 *</label>
            <input value={form.buyer_tax_no} onChange={e => setForm(f => ({ ...f, buyer_tax_no: e.target.value }))} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">购买方开户银行 *</label>
            <input value={form.buyer_bank} onChange={e => setForm(f => ({ ...f, buyer_bank: e.target.value }))} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">购买方银行账号 *</label>
            <input value={form.buyer_account} onChange={e => setForm(f => ({ ...f, buyer_account: e.target.value }))} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">购买方地址/电话 *</label>
            <input value={form.buyer_address_phone} onChange={e => setForm(f => ({ ...f, buyer_address_phone: e.target.value }))} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">开票金额(不含税) *</label>
            <input type="number" step="0.01" min="0" value={form.invoice_amount || ''} onChange={e => {
              const val = parseFloat(e.target.value) || 0;
              setForm(f => ({ ...f, invoice_amount: val }));
            }} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">税金 *</label>
            <input type="number" step="0.01" min="0" value={form.tax_amount || ''} onChange={e => setForm(f => ({ ...f, tax_amount: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm text-gray-600 mb-1">备注</label>
            <textarea value={form.remark} onChange={e => setForm(f => ({ ...f, remark: e.target.value }))} rows={2} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">税金是否支付 *</label>
            <div className="flex gap-4 mt-2">
              <label className="flex items-center gap-2 text-gray-700"><input type="radio" checked={form.tax_paid} onChange={() => setForm(f => ({ ...f, tax_paid: true }))} /> 是</label>
              <label className="flex items-center gap-2 text-gray-700"><input type="radio" checked={!form.tax_paid} onChange={() => setForm(f => ({ ...f, tax_paid: false }))} /> 否</label>
            </div>
          </div>
          {form.tax_paid && (
            <>
              <div>
                <label className="block text-sm text-gray-600 mb-1">税金支付方式 *</label>
                <SearchableSelect
                  value={form.tax_payment_method}
                  onChange={v => setForm(f => ({ ...f, tax_payment_method: v }))}
                  options={taxPaymentMethodOptions}
                  placeholder="选择方式"
                  emptyLabel="选择方式"
                  searchThreshold={10}
                  metricsContext="page:income_invoice_issue:tax_payment_method"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">上传支付凭证 *</label>
                <input
                  type="file"
                  id={INCOME_INVOICE_ISSUE_VOUCHER_FILE_ID}
                  onChange={e => handleFileUpload(e, 'tax_payment_voucher')}
                  accept=".jpg,.jpeg,.png,.pdf"
                  multiple
                  className="ui-file-input-safe"
                  data-file-upload-field="true"
                />
                <label
                  htmlFor={INCOME_INVOICE_ISSUE_VOUCHER_FILE_ID}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-500 block"
                >
                  <FaUpload className="mx-auto text-gray-400 mb-2" />
                  <span className="text-gray-500 text-sm">{uploading ? '上传中...' : '点击上传jpg/png/pdf'}</span>
                </label>
                {form.tax_payment_voucher.length > 0 && (
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {form.tax_payment_voucher.map((url, i) => (
                      <div key={i} className="relative group">
                        {url.match(/\.(jpg|jpeg|png)$/i) ? (
                          <img src={url} alt="支付凭证" className="w-full h-20 object-cover rounded cursor-pointer" onClick={() => window.open(url)} />
                        ) : (
                          <div className="w-full h-20 bg-gray-100 rounded flex items-center justify-center cursor-pointer" onClick={() => window.open(url)}>
                            <FaFile className="text-gray-400 text-2xl" />
                          </div>
                        )}
                        <button type="button" onClick={() => removeFile('tax_payment_voucher', i)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <FaTrash className="text-xs" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
          <div>
            <label className="block text-sm text-gray-600 mb-1">发票照片</label>
            <input
              type="file"
              id={INCOME_INVOICE_ISSUE_PHOTO_FILE_ID}
              onChange={e => handleFileUpload(e, 'invoice_photo')}
              accept=".jpg,.jpeg,.png,.pdf"
              multiple
              className="ui-file-input-safe"
              data-file-upload-field="true"
            />
            <label
              htmlFor={INCOME_INVOICE_ISSUE_PHOTO_FILE_ID}
              className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-500 block"
            >
              <FaUpload className="mx-auto text-gray-400 mb-2" />
              <span className="text-gray-500 text-sm">{uploading ? '上传中...' : '点击上传发票照片'}</span>
            </label>
            {form.invoice_photo.length > 0 && (
              <div className="mt-2 grid grid-cols-4 gap-2">
                {form.invoice_photo.map((url, i) => (
                  <div key={i} className="relative group">
                    {url.match(/\.(jpg|jpeg|png)$/i) ? (
                      <img src={url} alt="发票照片" className="w-full h-20 object-cover rounded cursor-pointer" onClick={() => window.open(url)} />
                    ) : (
                      <div className="w-full h-20 bg-gray-100 rounded flex items-center justify-center cursor-pointer" onClick={() => window.open(url)}>
                        <FaFile className="text-gray-400 text-2xl" />
                      </div>
                    )}
                    <button type="button" onClick={() => removeFile('invoice_photo', i)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <FaTrash className="text-xs" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm text-gray-600 mb-1">支付说明</label>
            <input value={form.payment_description} onChange={e => setForm(f => ({ ...f, payment_description: e.target.value }))} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={() => navigate('/finance/invoice-list')} className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg">取消</button>
          <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">{loading ? '保存中...' : '保存'}</button>
        </div>
      </form>
    </motion.div>
  );
}
