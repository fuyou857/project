import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaEdit, FaTrash, FaTimes, FaSearch, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import { supabase } from '../supabase/client';
import { SegmentedControl } from '../components/ui';
import EmptyState from '../components/ui/EmptyState';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

interface PartyA { id: string; name: string; unit_type: string; credit_code: string; phone: string; address: string; created_at: string; }
const PAGE_SIZE = 15;

const initialForm = { name: '', unit_type: '房地产', credit_code: '', phone: '', address: '' };

export default function PartyA() {
  const [data, setData] = useState<PartyA[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [showModal, setShowModal] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<PartyA | null>(null);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{type: string, message: string} | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    const offset = (page - 1) * PAGE_SIZE;
    let query = supabase.from('party_a').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(offset, offset + PAGE_SIZE - 1);
    if (debouncedSearch) query = query.ilike('name', `%${debouncedSearch}%`);
    const { data: res, count } = await query;
    if (res) setData(res);
    setTotal(count || 0);
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.name?.trim()) errs.name = '请输入单位名称';
    if (form.phone && !/^\d{11}$/.test(form.phone)) errs.phone = '手机号格式不正确';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    const { error } = editing ? await supabase.from('party_a').update(form).eq('id', editing.id) : await supabase.from('party_a').insert(form);
    setSaving(false);
    if (error) { showToast('error', '保存失败'); return; }
    showToast('success', editing ? '更新成功' : '创建成功');
    setShowModal(false); setForm(initialForm); setEditing(null); fetchData();
  }

  function showToast(type: string, message: string) { setToast({ type, message }); setTimeout(() => setToast(null), 3000); }

  function openEdit(item: PartyA) { setEditing(item); setForm({ name: item.name, unit_type: item.unit_type, credit_code: item.credit_code, phone: item.phone, address: item.address }); setErrors({}); setShowModal(true); }
  function openAdd() { setEditing(null); setForm(initialForm); setErrors({}); setShowModal(true); }
  function handleCloseModal() { setShowModal(false); setForm(initialForm); setEditing(null); setErrors({}); }
  function confirmDelete(id: string) { setDeleteId(id); setShowDelete(true); }
  async function handleDelete() {
    if (!deleteId) return;
    await supabase.from('party_a').delete().eq('id', deleteId);
    showToast('success', '删除成功');
    setShowDelete(false); setDeleteId(null); fetchData();
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const unitTypeOptions = useMemo(
    () =>
      [
        { value: '房地产', label: '房地产' },
        { value: '政府', label: '政府' },
        { value: '企业', label: '企业' },
        { value: '其他', label: '其他' },
      ] as const,
    [],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="ui-page-title">甲方单位管理</h2>
        <button onClick={openAdd} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <FaPlus /> 新增甲方单位
        </button>
      </div>
      <div className="ui-card flex gap-4 items-center">
        <div className="relative flex-1"><FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" /><input type="text" placeholder="搜索甲方单位..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
      </div>
      <div className="ui-table-wrap overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full border-collapse">
          <thead className="bg-gray-50"><tr className="text-gray-700 text-sm"><th className="text-left py-3 px-4">单位名称</th><th className="text-left py-3 px-4">单位类型</th><th className="text-left py-3 px-4">社会信用代码</th><th className="text-left py-3 px-4">联系电话</th><th className="text-left py-3 px-4">创建时间</th><th className="text-center py-3 px-4">操作</th></tr></thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState title="暂无甲方单位" description="可点击右上角新增甲方单位" />
                </td>
              </tr>
            ) : (
              data.map(item => (
                <tr key={item.id} className="border-t border-gray-200 hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-800">{item.name}</td>
                  <td className="py-3 px-4 text-gray-700">{item.unit_type || '-'}</td>
                  <td className="py-3 px-4 text-sm text-gray-500">{item.credit_code || '-'}</td>
                  <td className="py-3 px-4 text-gray-700">{item.phone || '-'}</td>
                  <td className="py-3 px-4 text-sm text-gray-500">{item.created_at?.slice(0, 10) || '-'}</td>
                  <td className="py-3 px-4 text-center">
                    <button type="button" onClick={() => openEdit(item)} className="mr-3 text-blue-600 hover:text-blue-800">
                      <FaEdit />
                    </button>
                    <button type="button" onClick={() => confirmDelete(item.id)} className="text-red-600 hover:text-red-800">
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {total > 0 && <div className="flex items-center justify-between"><div className="text-gray-500 text-sm">共 {total} 条</div><div className="flex items-center gap-2"><button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 bg-gray-50 rounded text-gray-800 disabled:opacity-50">上一页</button><span className="text-gray-500">{page} / {totalPages || 1}</span><button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1 bg-gray-50 rounded text-gray-800 disabled:opacity-50">下一页</button></div></div>}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleCloseModal}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-white rounded-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-gray-800">{editing ? '编辑甲方单位' : '新增甲方单位'}</h3><button onClick={handleCloseModal} className="text-gray-500 hover:text-gray-800"><FaTimes /></button></div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="block text-sm text-gray-500 mb-2">单位名称 *</label><input type="text" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} className={`w-full px-4 py-2 bg-gray-50 border rounded-lg text-gray-800 ${errors.name ? 'border-red-500' : 'border-slate-600'}`} />{errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}</div>
                <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="ui-label mb-2 block">单位类型</label>
                  <SegmentedControl
                    value={(form.unit_type || '房地产') as '房地产' | '政府' | '企业' | '其他'}
                    onChange={v => setForm({ ...form, unit_type: v })}
                    options={[...unitTypeOptions]}
                  />
                </div>
                <div><label className="block text-sm text-gray-500 mb-2">社会信用代码</label><input type="text" value={form.credit_code || ''} onChange={e => setForm({ ...form, credit_code: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm text-gray-500 mb-2">联系电话</label><input type="text" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} className={`w-full px-4 py-2 bg-gray-50 border rounded-lg text-gray-800 ${errors.phone ? 'border-red-500' : 'border-slate-600'}`} />{errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}</div>
              </div>
              <div><label className="block text-sm text-gray-500 mb-2">地址</label><input type="text" value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={handleCloseModal} className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-300">
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? '保存中...' : '保存'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDelete(false)}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-bold text-gray-800 mb-4">确认删除</h3>
              <p className="text-gray-700 mb-6">确定要删除此甲方单位吗？</p>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowDelete(false)} className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-300">
                  取消
                </button>
                <button type="button" onClick={handleDelete} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
                  删除
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-white ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
            {toast.type === 'success' ? <FaCheckCircle /> : <FaExclamationCircle />}<span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
