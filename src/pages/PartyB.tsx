import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaEdit, FaTrash, FaTimes, FaSearch, FaUpload, FaFile, FaImage, FaTrashAlt, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import { supabase } from '../supabase/client';
import { SearchableSelect, SegmentedControl } from '../components/ui';

interface PartyB {
  id: string;
  unit_name: string;
  unit_type: string;
  taxpayer_type: string;
  fax: string;
  is_certified: boolean;
  credit_code: string;
  bank_name: string;
  bank_account: string;
  legal_representative: string;
  phone: string;
  business_license_file: string;
  account_license_file: string;
  remark?: string;
  created_at?: string;
}

const initialForm = {
  unit_name: '',
  unit_type: '材料供应商',
  taxpayer_type: '小规模纳税人',
  fax: '',
  is_certified: false,
  credit_code: '',
  bank_name: '',
  bank_account: '',
  legal_representative: '',
  phone: '',
  business_license_file: '',
  account_license_file: '',
  remark: ''
};

const currentUserRole = 'super_admin';
const canDelete = currentUserRole === 'super_admin';

export default function PartyB() {
  const [data, setData] = useState<PartyB[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<PartyB | null>(null);
  const [form, setForm] = useState(initialForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState({ business: false, account: false });
  const [toast, setToast] = useState<{type: string;message: string;} | null>(null);


  function showToast(type: string, message: string) {setToast({ type, message });setTimeout(() => setToast(null), 3000);}
  const businessInputRef = useRef<HTMLInputElement>(null);
  const accountInputRef = useRef<HTMLInputElement>(null);

  const categoryFilterOptions = useMemo(
    () => [
    { value: '', label: '全部类别' },
    { value: '劳务供应商', label: '劳务供应商' },
    { value: '材料供应商', label: '材料供应商' },
    { value: '专业分包供应商', label: '专业分包供应商' },
    { value: '其他', label: '其他' }],

    []
  );

  const fetchData = useCallback(async () => {
    const offset = (page - 1) * pageSize;
    let query = supabase.from('party_b').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(offset, offset + pageSize - 1);
    if (search) query = query.ilike('unit_name', `%${search}%`);
    if (filterCategory) query = query.eq('unit_type', filterCategory);
    const { data: res, count } = await query;
    if (res) setData(res);
    setTotal(count || 0);
  }, [page, pageSize, search, filterCategory]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function validateForm() {
    const errors: Record<string, string> = {};
    if (!form.unit_name.trim()) errors.unit_name = '请输入乙方单位名称';
    if (form.credit_code && !/^[0-9A-Z]{18}$/i.test(form.credit_code)) errors.credit_code = '社会信用代码格式不正确';
    if (form.phone && !/^\d{11}$/.test(form.phone)) errors.phone = '联系电话格式不正确';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const missing: string[] = [];
    if (!form.unit_name?.trim()) missing.push('单位名称');
    if (!form.legal_representative?.trim()) missing.push('联系人');
    if (!form.phone?.trim()) missing.push('联系电话');
    if (missing.length > 0) {
      showToast('error', '请填写完整信息');
      return;
    }
    if (!validateForm()) return;
    const payload = { ...form, unit_type: form.unit_type || '其他', taxpayer_type: form.taxpayer_type || '其他' };
    const { error } = editing ? await supabase.from('party_b').update(payload).eq('id', editing.id) : await supabase.from('party_b').insert(payload);
    if (error) {showToast('error', '保存失败');return;}
    showToast('success', editing ? '更新成功' : '创建成功');
    setShowModal(false);
    setForm(initialForm);
    setEditing(null);
    fetchData();
  }

  function confirmDelete(id: string) {
    setDeleteId(id);
    setShowDeleteConfirm(true);
  }

  async function handleDelete() {
    if (!deleteId) return;
    await supabase.from('party_b').delete().eq('id', deleteId);
    setShowDeleteConfirm(false);
    setDeleteId(null);
    fetchData();
  }

  function openEdit(item: PartyB) {
    setEditing(item);
    const f = { ...item, remark: item.remark ?? '' };
    setForm(f);
    setFormErrors({});
    setShowModal(true);
  }

  function openAdd() {
    setEditing(null);
    setForm(initialForm);
    setFormErrors({});
    setShowModal(true);
  }

  function handleClose() {
    setShowModal(false);
    setForm(initialForm);
    setEditing(null);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, field: 'business_license_file' | 'account_license_file') {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {alert('文件大小不能超过10MB');return;}
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {alert('仅支持 jpg, jpeg, png, pdf 格式');return;}
    setUploading((prev) => ({ ...prev, [field === 'business_license_file' ? 'business' : 'account']: true }));
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const ext = file.name.split('.').pop();
        const path = `party_b/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
        const { error } = await supabase.storage.from('files').upload(path, Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)), { contentType: file.type });
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('files').getPublicUrl(path);
        setForm((prev) => ({ ...prev, [field]: publicUrl }));
        setUploading((prev) => ({ ...prev, [field === 'business_license_file' ? 'business' : 'account']: false }));
      };
    } catch {alert('上传失败');setUploading((prev) => ({ ...prev, [field === 'business_license_file' ? 'business' : 'account']: false }));}
  }

  function removeFile(field: 'business_license_file' | 'account_license_file') {
    setForm((prev) => ({ ...prev, [field]: '' }));
  }

  function isImage(url: string) {
    const ext = url?.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
  }

  function getFileName(url: string) {
    return url?.split('/').pop() || url;
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">乙方单位管理</h2>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-gray-800 rounded-lg">
          <FaPlus /> 新增乙方单位
        </button>
      </div>

      <div className="flex gap-4 items-center bg-white p-4 rounded-lg">
        <div className="relative flex-1">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input type="text" placeholder="搜索乙方单位名称..." value={search} onChange={(e) => {setSearch(e.target.value);setPage(1);}}
          className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" />
        </div>
        <div className="min-w-[10rem] max-w-xs">
          <SearchableSelect
            value={filterCategory}
            onChange={(v) => {
              setFilterCategory(v);
              setPage(1);
            }}
            options={categoryFilterOptions}
            placeholder="全部类别"
            searchPlaceholder="搜索类别…" />
          
        </div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-gray-700" style={{ width: '200px' }}>单位名称</th>
              <th className="px-4 py-3 text-left text-gray-700" style={{ width: '120px' }}>单位类别</th>
              <th className="px-4 py-3 text-left text-gray-700" style={{ width: '120px' }}>纳税人</th>
              <th className="px-4 py-3 text-left text-gray-700" style={{ width: '180px' }}>社会信用代码</th>
              <th className="px-4 py-3 text-left text-gray-700" style={{ width: '130px' }}>联系电话</th>
              <th className="px-4 py-3 text-center text-gray-700" style={{ width: '100px' }}>认证</th>
              <th className="px-4 py-3 text-left text-gray-700" style={{ width: '160px' }}>创建时间</th>
              <th className="px-4 py-3 text-center text-gray-700" style={{ width: '150px' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">暂无数据</td></tr> :
            data.map((item) =>
            <tr key={item.id} className="border-t border-gray-200 hover:bg-slate-750">
                <td className="px-4 py-3 text-gray-800 font-medium">{item.unit_name}</td>
                <td className="px-4 py-3 text-gray-700">{item.unit_type}</td>
                <td className="px-4 py-3 text-gray-700">{item.taxpayer_type}</td>
                <td className="px-4 py-3 text-gray-500 text-sm">{(() => {if (item.credit_code) {if (item.credit_code.length > 10) {return item.credit_code.slice(0, 6) + '...' + item.credit_code.slice(-4);} else {return item.credit_code;}} else {return '-';}})()}</td>
                <td className="px-4 py-3 text-gray-700">{item.phone || '-'}</td>
                <td className="px-4 py-3 text-center"><span className={`px-2 py-1 rounded text-xs ${item.is_certified ? 'bg-green-500/20 text-green-400' : 'bg-gray-500 text-gray-500'}`}>{item.is_certified ? '已认证' : '未认证'}</span></td>
                <td className="px-4 py-3 text-gray-500 text-sm">{item.created_at ? item.created_at.slice(0, 19).replace('T', ' ') : '-'}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => openEdit(item)} className="text-blue-400 hover:text-blue-300 mr-3"><FaEdit /></button>
                  {canDelete && <button onClick={() => confirmDelete(item.id)} className="text-red-400 hover:text-red-300"><FaTrash /></button>}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </motion.div>

      {total > 0 &&
      <div className="flex items-center justify-between">
          <div className="text-gray-500 text-sm flex flex-wrap items-center gap-2">
            共 {total} 条记录，每页{' '}
            <SegmentedControl
            value={String(pageSize) as '10' | '20' | '50'}
            onChange={(v) => {
              setPageSize(Number(v));
              setPage(1);
            }}
            options={[
            { value: '10', label: '10' },
            { value: '20', label: '20' },
            { value: '50', label: '50' }]
            }
            className="inline-flex w-auto"
            aria-label="每页条数" />
          {' '}
            条
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 bg-gray-50 rounded text-gray-800 disabled:opacity-50">上一页</button>
            <span className="text-gray-500">{page} / {totalPages || 1}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1 bg-gray-50 rounded text-gray-800 disabled:opacity-50">下一页</button>
          </div>
        </div>
      }

      <AnimatePresence>
        {showModal &&
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleClose}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800">{editing ? '编辑乙方单位' : '新增乙方单位'}</h3>
                <button onClick={handleClose} className="text-gray-500 hover:text-gray-800"><FaTimes /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-500 mb-2">乙方单位名称 *</label>
                    <input type="text" value={form.unit_name} onChange={(e) => setForm({ ...form, unit_name: e.target.value })} className={`w-full px-4 py-2 bg-gray-50 border rounded-lg text-gray-800 ${formErrors.unit_name ? 'border-red-500' : 'border-slate-600'}`} />
                    {formErrors.unit_name && <p className="text-red-400 text-xs mt-1">{formErrors.unit_name}</p>}
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-2">单位类别 *</label>
                    <SegmentedControl
                    value={
                    form.unit_type as '劳务供应商' | '材料供应商' | '专业分包供应商' | '其他'
                    }
                    onChange={(v) => setForm({ ...form, unit_type: v })}
                    options={[
                    { value: '劳务供应商', label: '劳务供应商' },
                    { value: '材料供应商', label: '材料供应商' },
                    { value: '专业分包供应商', label: '专业分包供应商' },
                    { value: '其他', label: '其他' }]
                    }
                    aria-label="单位类别" />
                  
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-500 mb-2">纳税人类别 *</label>
                    <SegmentedControl
                    value={form.taxpayer_type as '一般纳税人' | '小规模纳税人' | '其他'}
                    onChange={(v) => setForm({ ...form, taxpayer_type: v })}
                    options={[
                    { value: '一般纳税人', label: '一般纳税人' },
                    { value: '小规模纳税人', label: '小规模纳税人' },
                    { value: '其他', label: '其他' }]
                    }
                    aria-label="纳税人类别" />
                  
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-2">是否认证 *</label>
                    <div className="flex items-center gap-4 mt-2">
                      <label className="flex items-center gap-2 text-gray-800 cursor-pointer">
                        <input type="radio" checked={!form.is_certified} onChange={() => setForm({ ...form, is_certified: false })} /> 未认证
                      </label>
                      <label className="flex items-center gap-2 text-gray-800 cursor-pointer">
                        <input type="radio" checked={form.is_certified} onChange={() => setForm({ ...form, is_certified: true })} /> 已认证
                      </label>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-500 mb-2">社会信用代码</label>
                    <input type="text" value={form.credit_code} onChange={(e) => setForm({ ...form, credit_code: e.target.value })} className={`w-full px-4 py-2 bg-gray-50 border rounded-lg text-gray-800 ${formErrors.credit_code ? 'border-red-500' : 'border-slate-600'}`} />
                    {formErrors.credit_code && <p className="text-red-400 text-xs mt-1">{formErrors.credit_code}</p>}
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-2">法人代表</label>
                    <input type="text" value={form.legal_representative} onChange={(e) => setForm({ ...form, legal_representative: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-500 mb-2">联系电话</label>
                    <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={`w-full px-4 py-2 bg-gray-50 border rounded-lg text-gray-800 ${formErrors.phone ? 'border-red-500' : 'border-slate-600'}`} />
                    {formErrors.phone && <p className="text-red-400 text-xs mt-1">{formErrors.phone}</p>}
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-2">传真</label>
                    <input type="text" value={form.fax} onChange={(e) => setForm({ ...form, fax: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-500 mb-2">开户行</label>
                    <input type="text" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-2">开户账号</label>
                    <input type="text" value={form.bank_account} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-500 mb-2">营业执照</label>
                    <input type="file" ref={businessInputRef} accept="image/jpeg,image/jpg,image/png,application/pdf" onChange={(e) => handleFileUpload(e, 'business_license_file')} className="hidden" />
                    {form.business_license_file ?
                  <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
                        {isImage(form.business_license_file) ? <FaImage className="text-blue-400" /> : <FaFile className="text-yellow-400" />}
                        <a href={form.business_license_file} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm flex-1 truncate">{getFileName(form.business_license_file)}</a>
                        <button type="button" onClick={() => removeFile('business_license_file')} className="text-red-400 hover:text-red-300"><FaTrashAlt className="w-4 h-4" /></button>
                      </div> :

                  <button type="button" onClick={() => businessInputRef.current?.click()} disabled={uploading.business} className="w-full px-4 py-2 bg-gray-500 hover:bg-slate-500 text-gray-800 rounded-lg flex items-center justify-center gap-2">
                        {uploading.business ? '上传中...' : <><FaUpload /> 上传营业执照</>}
                      </button>
                  }
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-2">开户许可证</label>
                    <input type="file" ref={accountInputRef} accept="image/jpeg,image/jpg,image/png,application/pdf" onChange={(e) => handleFileUpload(e, 'account_license_file')} className="hidden" />
                    {form.account_license_file ?
                  <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
                        {isImage(form.account_license_file) ? <FaImage className="text-blue-400" /> : <FaFile className="text-yellow-400" />}
                        <a href={form.account_license_file} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm flex-1 truncate">{getFileName(form.account_license_file)}</a>
                        <button type="button" onClick={() => removeFile('account_license_file')} className="text-red-400 hover:text-red-300"><FaTrashAlt className="w-4 h-4" /></button>
                      </div> :

                  <button type="button" onClick={() => accountInputRef.current?.click()} disabled={uploading.account} className="w-full px-4 py-2 bg-gray-500 hover:bg-slate-500 text-gray-800 rounded-lg flex items-center justify-center gap-2">
                        {uploading.account ? '上传中...' : <><FaUpload /> 上传开户许可证</>}
                      </button>
                  }
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">备注</label>
                  <textarea value={form.remark || ''} onChange={(e) => setForm({ ...form, remark: e.target.value.slice(0, 200) })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" rows={2} placeholder="最多200字" />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={handleClose} className="px-4 py-2 bg-gray-500 text-gray-800 rounded-lg">取消</button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-gray-800 rounded-lg">确定</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      <AnimatePresence>
        {showDeleteConfirm &&
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDeleteConfirm(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-bold text-gray-800 mb-4">确认删除</h3>
              <p className="text-gray-700 mb-6">确定删除该乙方单位吗？删除后关联数据将无法引用，请谨慎操作。</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 bg-gray-500 text-gray-800 rounded-lg">取消</button>
                <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-gray-800 rounded-lg">确认删除</button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>
      <AnimatePresence>
        {toast &&
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
        className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'} text-gray-800`}>
            {toast.type === 'success' ? <FaCheckCircle /> : <FaExclamationCircle />}<span>{toast.message}</span>
          </motion.div>
        }
      </AnimatePresence>
    </div>);

}