import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaPlus, FaEdit, FaTrash, FaSearch, FaTimes, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { supabase } from '../../supabase/client';
import { alertMissingRequiredFields } from '../../utils/contractSubPage';
import { isSuperAdminUser } from '../../utils/sessionUser';
import { PAGE_SIZE } from '../../constants';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

interface Signatory {
  id: string;
  unit_name: string;
  unit_code: string;
  credit_code: string;
  contact_person: string;
  contact_phone: string;
  office_address: string;
  invoice_title: string;
  tax_number: string;
  bank_name: string;
  bank_account: string;
  address?: string | null;
  remark?: string;
  company_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface SignatoryRow {
  id: string;
  unit_name: string | null;
  unit_code: string | null;
  credit_code: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  office_address: string | null;
  invoice_title: string | null;
  tax_number: string | null;
  bank_name: string | null;
  bank_account: string | null;
  address?: string | null;
  remark?: string | null;
  company_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

const initialForm: Signatory = {
  id: '',
  unit_name: '',
  unit_code: '',
  credit_code: '',
  contact_person: '',
  contact_phone: '',
  office_address: '',
  invoice_title: '',
  tax_number: '',
  bank_name: '',
  bank_account: '',
  address: '',
};

export default function SignatoryList() {
  const [list, setList] = useState<SignatoryRow[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchData();
  }, [page, debouncedSearch]);

  async function fetchData() {
    const offset = (page - 1) * PAGE_SIZE;
    let query = supabase
      .from('signatory_units')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (debouncedSearch) {
      query = query.ilike('unit_name', `%${debouncedSearch}%`);
    }

    const res = await query;
    if (res.data) {
      const mapped = res.data.map(item => ({
        ...item,
        unit_name: item.unit_name || '',
        unit_code: item.unit_code || '',
        credit_code: item.credit_code || '',
        contact_person: item.contact_person || '',
        contact_phone: item.contact_phone || '',
        office_address: item.office_address || '',
        invoice_title: item.invoice_title || '',
        tax_number: item.tax_number || '',
        bank_name: item.bank_name || '',
        bank_account: item.bank_account || '',
        address: item.address || '',
      }));
      setList(mapped as Signatory[]);
    }
    if (res.count !== undefined && res.count !== null) setTotal(res.count);
  }

  function handleClose() {
    if (confirm('确定要关闭吗？')) {
      setShowModal(false);
      setForm(initialForm);
      setEditingId(null);
    }
  }

  function openAdd() {
    const date = new Date();
    setForm({
      ...initialForm,
      unit_code: 'SIGN' + date.toISOString().slice(0, 10).replace(/-/g, '') + Math.floor(1000 + Math.random() * 9000),
    });
    setEditingId(null);
    setShowModal(true);
  }

  function openEdit(item: SignatoryRow) {
    setEditingId(item.id);
    setForm({
      ...item,
      unit_name: item.unit_name || '',
      unit_code: item.unit_code || '',
      credit_code: item.credit_code || '',
      contact_person: item.contact_person || '',
      contact_phone: item.contact_phone || '',
      office_address: item.office_address || '',
      invoice_title: item.invoice_title || '',
      tax_number: item.tax_number || '',
      bank_name: item.bank_name || '',
      bank_account: item.bank_account || '',
      remark: item.remark || '',
    });
    setShowModal(true);
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

    const data = {
      unit_name: form.unit_name,
      unit_code: form.unit_code,
      credit_code: form.credit_code,
      contact_person: form.contact_person,
      contact_phone: form.contact_phone,
      office_address: form.office_address,
      invoice_title: form.invoice_title,
      tax_number: form.tax_number,
      bank_name: form.bank_name,
      bank_account: form.bank_account,
      address: form.address,
    };

    if (editingId) {
      await supabase.from('signatory_units').update(data).eq('id', editingId);
    } else {
      await supabase.from('signatory_units').insert(data);
    }

    setShowModal(false);
    fetchData();
    setForm(initialForm);
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    if (confirm('确定删除？')) {
      await supabase.from('signatory_units').delete().eq('id', id);
      fetchData();
    }
  }

  const filteredList = list.filter(i => i.unit_name?.toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="搜索单位名称"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
          />
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-gray-800 rounded-lg ml-4"
        >
          <FaPlus /> 新增
        </button>
      </div>

      {filteredList.length === 0 ? (
        <div className="text-center text-gray-500 py-12">暂无数据</div>
      ) : (
        <div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500 text-sm">
                <th className="text-left py-3 px-4">单位名称</th>
                <th className="text-left py-3 px-4">单位编码</th>
                <th className="text-left py-3 px-4">联系人</th>
                <th className="text-left py-3 px-4">联系电话</th>
                <th className="text-left py-3 px-4">税号</th>
                <th className="text-center py-3 px-4">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map(item => (
                <motion.tr
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border-b border-gray-200/50 hover:bg-gray-50/30"
                >
                  <td className="py-3 px-4 text-gray-800 font-medium">{item.unit_name}</td>
                  <td className="py-3 px-4 text-gray-700">{item.unit_code}</td>
                  <td className="py-3 px-4 text-gray-700">{item.contact_person || '-'}</td>
                  <td className="py-3 px-4 text-gray-700">{item.contact_phone || '-'}</td>
                  <td className="py-3 px-4 text-gray-700">{item.tax_number || '-'}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openEdit(item)}
                        className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg"
                      >
                        <FaEdit />
                      </button>
                      {isSuperAdminUser() && (
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                        >
                          <FaTrash />
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>

          {total > PAGE_SIZE && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="p-2 bg-gray-50 rounded disabled:opacity-50"
              >
                <FaChevronLeft className="w-3 h-3 text-gray-800" />
              </button>
              <span className="text-gray-500 text-sm">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                className="p-2 bg-gray-50 rounded disabled:opacity-50"
              >
                <FaChevronRight className="w-3 h-3 text-gray-800" />
              </button>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="bg-white rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-gray-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800">
                {editingId ? '编辑签约单位' : '新增签约单位'}
              </h3>
              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleClose(); }} className="text-gray-500 hover:text-gray-800">
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-2">签约单位名称 *</label>
                  <input
                    type="text"
                    required
                    value={form.unit_name}
                    onChange={e => setForm({ ...form, unit_name: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">单位编码</label>
                  <input
                    type="text"
                    value={form.unit_code}
                    onChange={e => setForm({ ...form, unit_code: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-2">社会信用代码 *</label>
                  <input
                    type="text"
                    required
                    value={form.credit_code}
                    onChange={e => setForm({ ...form, credit_code: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">联系人 *</label>
                  <input
                    type="text"
                    required
                    value={form.contact_person}
                    onChange={e => setForm({ ...form, contact_person: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-2">联系电话 *</label>
                  <input
                    type="text"
                    required
                    value={form.contact_phone}
                    onChange={e => setForm({ ...form, contact_phone: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">办公地址</label>
                  <input
                    type="text"
                    value={form.office_address}
                    onChange={e => setForm({ ...form, office_address: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-2">发票抬头 *</label>
                  <input
                    type="text"
                    required
                    value={form.invoice_title}
                    onChange={e => setForm({ ...form, invoice_title: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">税号 *</label>
                  <input
                    type="text"
                    required
                    value={form.tax_number}
                    onChange={e => setForm({ ...form, tax_number: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-2">开户银行 *</label>
                  <input
                    type="text"
                    required
                    value={form.bank_name}
                    onChange={e => setForm({ ...form, bank_name: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">开户账号 *</label>
                  <input
                    type="text"
                    required
                    value={form.bank_account}
                    onChange={e => setForm({ ...form, bank_account: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-500 mb-2">备注</label>
                <textarea
                  value={form.remark || ''}
                  onChange={e => setForm({ ...form, remark: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleClose(); }}
                  className="px-4 py-2 bg-gray-500 text-gray-800 rounded-lg"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-gray-800 rounded-lg"
                >
                  确定
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
