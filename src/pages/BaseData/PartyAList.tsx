import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaPlus, FaEdit, FaTrash, FaSearch, FaTimes, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { supabase } from '../../supabase/client';
import { isSuperAdminUser } from '../../utils/sessionUser';
import { PAGE_SIZE, PARTY_A_TYPES } from '../../constants';
import { SegmentedControl } from '../../components/ui';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

interface PartyA {
  id: string;
  name: string;
  unit_type: string;
  credit_code: string;
  bank_name: string;
  legal_person: string;
  bank_account: string;
  phone: string;
  remark: string;
  company_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface PartyARow {
  id: string;
  name: string;
  unit_type: string | null;
  credit_code: string | null;
  bank_name: string | null;
  legal_person: string | null;
  bank_account: string | null;
  phone: string | null;
  remark: string | null;
  company_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

const initialForm: PartyA = {
  id: '',
  name: '',
  unit_type: '建设单位',
  credit_code: '',
  bank_name: '',
  legal_person: '',
  bank_account: '',
  phone: '',
  remark: '',
};

export default function PartyAList() {
  const [list, setList] = useState<PartyARow[]>([]);
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
      .from('party_a')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (debouncedSearch) {
      query = query.ilike('name', `%${debouncedSearch}%`);
    }

    const res = await query;
    if (res.data) {
      const mapped = res.data.map(item => ({
        ...item,
        name: item.name || '',
        unit_type: item.unit_type || '',
        credit_code: item.credit_code || '',
        bank_name: item.bank_name || '',
        legal_person: item.legal_person || '',
        bank_account: item.bank_account || '',
        phone: item.phone || '',
        remark: item.remark || '',
      }));
      setList(mapped as PartyA[]);
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
    setForm(initialForm);
    setEditingId(null);
    setShowModal(true);
  }

  function openEdit(item: PartyARow) {
    setEditingId(item.id);
    setForm({
      ...item,
      unit_type: item.unit_type || '',
      credit_code: item.credit_code || '',
      bank_name: item.bank_name || '',
      legal_person: item.legal_person || '',
      bank_account: item.bank_account || '',
      phone: item.phone || '',
      remark: item.remark || '',
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name?.trim()) {
      alert('请填写甲方单位名称');
      return;
    }

    const data = {
      name: form.name,
      unit_type: form.unit_type,
      credit_code: form.credit_code,
      bank_name: form.bank_name,
      legal_person: form.legal_person,
      bank_account: form.bank_account,
      phone: form.phone,
      remark: form.remark,
    };

    if (editingId) {
      await supabase.from('party_a').update(data).eq('id', editingId);
    } else {
      await supabase.from('party_a').insert(data);
    }

    setShowModal(false);
    fetchData();
    setForm(initialForm);
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    if (confirm('确定删除？')) {
      await supabase.from('party_a').delete().eq('id', id);
      fetchData();
    }
  }

  const filteredList = list.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
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
                <th className="text-left py-3 px-4">单位类别</th>
                <th className="text-left py-3 px-4">统一信用代码</th>
                <th className="text-left py-3 px-4">联系电话</th>
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
                  <td className="py-3 px-4 text-gray-800 font-medium">{item.name}</td>
                  <td className="py-3 px-4 text-gray-700">{item.unit_type}</td>
                  <td className="py-3 px-4 text-gray-700">{item.credit_code || '-'}</td>
                  <td className="py-3 px-4 text-gray-700">{item.phone || '-'}</td>
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
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            className="bg-white rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-gray-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800">
                {editingId ? '编辑甲方单位' : '新增甲方单位'}
              </h3>
              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleClose(); }} className="text-gray-500 hover:text-gray-800">
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-2">甲方单位名称 *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">单位类别</label>
                  <SegmentedControl
                    value={form.unit_type as (typeof PARTY_A_TYPES)[number]}
                    onChange={v => setForm({ ...form, unit_type: v })}
                    options={PARTY_A_TYPES.map(t => ({ value: t, label: t }))}
                    aria-label="单位类别"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-2">统一信用代码</label>
                  <input
                    type="text"
                    value={form.credit_code}
                    onChange={e => setForm({ ...form, credit_code: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">联系电话</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-2">法定代表人</label>
                  <input
                    type="text"
                    value={form.legal_person}
                    onChange={e => setForm({ ...form, legal_person: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">开户银行</label>
                  <input
                    type="text"
                    value={form.bank_name}
                    onChange={e => setForm({ ...form, bank_name: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-2">银行账号</label>
                  <input
                    type="text"
                    value={form.bank_account}
                    onChange={e => setForm({ ...form, bank_account: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-500 mb-2">备注</label>
                <textarea
                  value={form.remark}
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
