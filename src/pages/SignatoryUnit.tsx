import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaEdit, FaTrash, FaSearch, FaTimes } from 'react-icons/fa';
import { supabase } from '../supabase/client';
import { alertMissingRequiredFields } from '../utils/contractSubPage';
import { SegmentedControl } from '../components/ui';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

interface SignatoryUnit {
  id: string;
  unit_name: string;
  unit_code: string;
  credit_code: string;
  contact_person: string;
  contact_phone: string;
  office_address: string;
  invoice_title: string;
  tax_number: string;
  tax_disk_no: string;
  bank_name: string;
  bank_account: string;
  address: string;
  email: string;
  tax_province: string;
  remark: string;
}

const initialForm = {
  unit_name: '',
  unit_code: '',
  credit_code: '',
  contact_person: '',
  contact_phone: '',
  office_address: '',
  invoice_title: '',
  tax_number: '',
  tax_disk_no: '',
  bank_name: '',
  bank_account: '',
  address: '',
  email: '',
  tax_province: '',
  remark: '',
};

export default function SignatoryUnit() {
  const [units, setUnits] = useState<SignatoryUnit[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [originalForm, setOriginalForm] = useState(initialForm);

  const fetchUnits = useCallback(async () => {
    const offset = (page - 1) * pageSize;
    let query = supabase.from('signatory_units').select('*', { count: 'exact' });
    if (debouncedSearch) query = query.ilike('unit_name', `%${debouncedSearch}%`);
    const { data, count } = await query.order('created_at', { ascending: false }).range(offset, offset + pageSize - 1);
    if (data) setUnits(data);
    setTotal(count || 0);
  }, [page, pageSize, debouncedSearch]);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  function generateCode() {
    const date = new Date();
    const prefix = 'SIGN' + date.toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = Math.floor(1000 + Math.random() * 9000).toString();
    return prefix + suffix;
  }

  function openModal(unit?: SignatoryUnit) {
    if (unit) {
      setEditingId(unit.id);
      setForm(unit);
      setOriginalForm(unit);
    } else {
      setEditingId(null);
      const newCode = generateCode();
      setForm({ ...initialForm, unit_code: newCode });
      setOriginalForm({ ...initialForm, unit_code: newCode });
    }
    setShowModal(true);
  }

  function hasFormChanged() {
    return JSON.stringify(form) !== JSON.stringify(originalForm);
  }

  function handleClose() {
    if (hasFormChanged()) {
      if (confirm('您填写的内容尚未保存，确定要放弃吗？')) {
        setShowModal(false);
      }
    } else {
      setShowModal(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const missing: string[] = [];
    if (!form.unit_name?.trim()) missing.push('签约单位名称');
    if (!form.credit_code?.trim()) missing.push('社会信用代码');
    if (!form.contact_phone?.trim()) missing.push('联系电话');
    if (!form.contact_person?.trim()) missing.push('联系人');
    if (!form.invoice_title?.trim()) missing.push('发票抬头');
    if (!form.tax_number?.trim()) missing.push('税号');
    if (!form.bank_name?.trim()) missing.push('开户银行');
    if (!form.bank_account?.trim()) missing.push('开户账号');
    if (alertMissingRequiredFields(missing)) return

    const data = { ...form };
    if (editingId) {
      await supabase.from('signatory_units').update(data).eq('id', editingId);
    } else {
      await supabase.from('signatory_units').insert(data);
    }
    setShowModal(false);
    fetchUnits();
  }

  async function handleDelete(id: string) {
    if (confirm('确定要删除该签约单位吗？')) {
      await supabase.from('signatory_units').delete().eq('id', id);
      fetchUnits();
    }
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">签约单位管理</h2>
        <button onClick={() => openModal()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-gray-800 rounded-lg">
          <FaPlus /> 新增签约单位
        </button>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="mb-4">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input type="text" placeholder="搜索签约单位名称" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" />
          </div>
        </div>

        {units.length === 0 ? (
          <div className="text-center text-gray-500 py-12">暂无签约单位数据</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-gray-500">签约单位名称</th>
                  <th className="text-left py-3 px-4 text-gray-500">单位编码</th>
                  <th className="text-left py-3 px-4 text-gray-500">联系人</th>
                  <th className="text-left py-3 px-4 text-gray-500">联系电话</th>
                  <th className="text-left py-3 px-4 text-gray-500">税号</th>
                  <th className="text-center py-3 px-4 text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody>
                {units.map((unit, idx) => (
                  <motion.tr key={unit.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} className="border-b border-gray-200/50 hover:bg-gray-50/30">
                    <td className="py-3 px-4 text-gray-800 font-medium">{unit.unit_name}</td>
                    <td className="py-3 px-4 text-gray-700">{unit.unit_code}</td>
                    <td className="py-3 px-4 text-gray-700">{unit.contact_person || '-'}</td>
                    <td className="py-3 px-4 text-gray-700">{unit.contact_phone || '-'}</td>
                    <td className="py-3 px-4 text-gray-700">{unit.tax_number || '-'}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openModal(unit)} className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg"><FaEdit /></button>
                        <button onClick={() => handleDelete(unit.id)} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"><FaTrash /></button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-gray-500 text-sm flex flex-wrap items-center gap-2">
              共 {total} 条记录，每页{' '}
              <SegmentedControl
                value={String(pageSize) as '10' | '20' | '50'}
                onChange={v => {
                  setPageSize(Number(v));
                  setPage(1);
                }}
                options={[
                  { value: '10', label: '10' },
                  { value: '20', label: '20' },
                  { value: '50', label: '50' },
                ]}
                className="inline-flex w-auto"
                aria-label="每页条数"
              />{' '}
              条
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 bg-gray-50 rounded text-gray-800 disabled:opacity-50">上一页</button>
              <span className="text-gray-500">{page} / {totalPages || 1}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1 bg-gray-50 rounded text-gray-800 disabled:opacity-50">下一页</button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleClose}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-gray-200">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800">{editingId ? '编辑签约单位' : '新增签约单位'}</h3>
                <button onClick={handleClose} className="text-gray-500 hover:text-gray-800"><FaTimes /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div><label className="block text-sm text-gray-500 mb-2">单位编码</label><input type="text" value={form.unit_code} disabled className="w-full px-4 py-2 bg-gray-500 border border-slate-500 rounded-lg text-gray-700" /></div>
                
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="text-gray-800 font-medium mb-4">企业信息</h4>
                  <div className="space-y-4">
                    <div><label className="block text-sm text-gray-500 mb-2">签约单位名称 *</label><input type="text" required value={form.unit_name} onChange={e => setForm({ ...form, unit_name: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-sm text-gray-500 mb-2">社会信用代码 *</label><input type="text" value={form.credit_code} onChange={e => setForm({ ...form, credit_code: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                      <div><label className="block text-sm text-gray-500 mb-2">联系电话 *</label><input type="text" value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                    </div>
                    <div><label className="block text-sm text-gray-500 mb-2">备注</label><textarea value={form.remark} onChange={e => setForm({ ...form, remark: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" rows={2} /></div>
                  </div>
                </div>
                
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="text-gray-800 font-medium mb-4">联系人信息</h4>
                  <div className="space-y-4">
                    <div><label className="block text-sm text-gray-500 mb-2">联系人 *</label><input type="text" value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                    <div><label className="block text-sm text-gray-500 mb-2">办公地址</label><input type="text" value={form.office_address} onChange={e => setForm({ ...form, office_address: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                  </div>
                </div>
                
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="text-gray-800 font-medium mb-4">发票信息</h4>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-sm text-gray-500 mb-2">发票抬头 *</label><input type="text" value={form.invoice_title} onChange={e => setForm({ ...form, invoice_title: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                      <div><label className="block text-sm text-gray-500 mb-2">税号 *</label><input type="text" value={form.tax_number} onChange={e => setForm({ ...form, tax_number: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-sm text-gray-500 mb-2">开户银行 *</label><input type="text" value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                      <div><label className="block text-sm text-gray-500 mb-2">开户账号 *</label><input type="text" value={form.bank_account} onChange={e => setForm({ ...form, bank_account: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                    </div>
                    <div><label className="block text-sm text-gray-500 mb-2">地址</label><input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={handleClose} className="px-4 py-2 bg-gray-500 text-gray-800 rounded-lg">取消</button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-gray-800 rounded-lg">{editingId ? '保存' : '新增'}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
