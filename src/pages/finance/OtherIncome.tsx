import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaSearch, FaEdit, FaTrash, FaTimes, FaFileExcel, FaImage, FaEye, FaUpload } from 'react-icons/fa';
import { useSingleToast } from '../../hooks/useSingleToast';
import SingleToastBanner from '../../components/ui/SingleToastBanner';
import { supabase } from '../../supabase/client';
import { useCompanyScope } from '../../hooks/useCompanyScope';
import { isSuperAdminUser } from '../../utils/sessionUser';
import { projectIdsForCompanies } from '../../utils/companyProjectScope';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { SearchableSelect } from '../../components/ui';
import { projectSelectOptions } from '../../components/ui/options';

interface OtherIncome {
  id: string;
  project_id: string;
  company_id?: string | null;
  income_amount: number;
  remark: string;
  source: string;
  voucher_images: string;
  income_date: string;
  created_at: string;
}

interface Project {id: string;name: string;}

const initialForm = {
  project_id: '',
  income_amount: '',
  remark: '',
  source: '',
  voucher_images: [] as string[],
  income_date: new Date().toISOString().split('T')[0]
};

export default function OtherIncome() {
  const { currentCompany, companies, companyIds } = useCompanyScope();
  const [data, setData] = useState<OtherIncome[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showPreview, setShowPreview] = useState<string[]>([]);
  const [editing, setEditing] = useState<OtherIncome | null>(null);
  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState('');
  const [searchProject, setSearchProject] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast, showToast } = useSingleToast();
  const [deleteConfirm, setDeleteConfirm] = useState<{show: boolean;id?: string;}>({ show: false });
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const { data: projRes, error: pErr } = await projQuery;
      if (pErr) console.error('[OtherIncome] projects', pErr);else
      if (projRes) setProjects(projRes);

      const projectIds = companyIds.length > 0 ? await projectIdsForCompanies(companyIds) : null;

      let query = supabase.from('other_incomes').select('*').order('id', { ascending: false }).limit(15);
      if (projectIds !== null) {
        if (projectIds.length === 0) {
          setData([]);
          return;
        }
        query = query.in('project_id', projectIds);
      }
      const { data: res, error } = await query;
      if (error) {
        console.error('[OtherIncome] list', error);
        setData([]);
        return;
      }
      if (res) setData(res);
    } catch (e) {
      console.error('[OtherIncome] fetchData', e);
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  const getProjectName = (id: string) => projects.find((p) => p.id === id)?.name || '-';
  const formatMoney = (amount: number) => `¥${(amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

  const filteredData = data.filter((item) => {
    if (search && !getProjectName(item.project_id).includes(search) && !item.source?.includes(search)) return false;
    if (searchProject && item.project_id !== searchProject) return false;
    if (dateStart && item.income_date < dateStart) return false;
    if (dateEnd && item.income_date > dateEnd) return false;
    return true;
  });

  const totalAmount = filteredData.reduce((sum, item) => sum + (item.income_amount || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.project_id || !form.income_amount) {
      showToast('error', '请填写项目名称和收入金额');
      return;
    }
    setSaving(true);

    const payload = {
      project_id: form.project_id,
      income_amount: Number(form.income_amount),
      remark: form.remark || null,
      source: form.source || null,
      voucher_images: form.voucher_images.join(',') || null,
      income_date: form.income_date || null
    };

    let error = null;
    if (editing) {
      const result = await supabase.from('other_incomes').update(payload).eq('id', editing.id);
      error = result.error;
    } else {
      const result = await supabase.from('other_incomes').insert(payload);
      error = result.error;
    }

    setSaving(false);
    if (error) {
      showToast('error', '保存失败：' + error.message);
      return;
    }
    showToast('success', editing ? '更新成功' : '新增成功');
    setShowModal(false);
    setForm(initialForm);
    setEditing(null);
    fetchData();
  }

  async function handleDelete(id: string) {
    await supabase.from('other_incomes').delete().eq('id', id);
    showToast('success', '删除成功');
    setDeleteConfirm({ show: false });
    fetchData();
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    const uploaded: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });
      const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${file.name}`;
      const { data, error } = await supabase.storage.from('vouchers').upload(fileName, Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)), { contentType: file.type });
      if (data) {
        const { data: urlData } = supabase.storage.from('vouchers').getPublicUrl(fileName);
        uploaded.push(urlData.publicUrl);
      }
    }
    setForm({ ...form, voucher_images: [...form.voucher_images, ...uploaded] });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleExport() {
    const rows = filteredData.map((item) => ({
      项目名称: getProjectName(item.project_id),
      收入金额: item.income_amount,
      收入来源: item.source,
      备注: item.remark,
      到账时间: item.income_date
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '其他收入');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), '其他收入.xlsx');
    showToast('success', '导出成功');
  }

  function openEdit(item: OtherIncome) {
    setEditing(item);
    setForm({
      project_id: item.project_id,
      income_amount: String(item.income_amount),
      remark: item.remark || '',
      source: item.source || '',
      voucher_images: item.voucher_images ? item.voucher_images.split(',').filter(Boolean) : [],
      income_date: item.income_date || ''
    });
    setShowModal(true);
  }

  const filterProjectOptions = useMemo(() => projectSelectOptions(projects, '全部项目'), [projects]);
  const formProjectOptions = useMemo(() => projectSelectOptions(projects, '选择项目'), [projects]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {toast && <SingleToastBanner type={toast.type} message={toast.message} />}

      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-800">其他收入</h3>
        <motion.div className="flex gap-2">
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-gray-800 rounded-lg">
            <FaFileExcel /> 导出
          </button>
          <button
            onClick={() => {
              setEditing(null);
              setForm(initialForm);
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-gray-800 rounded-lg">
            <FaPlus /> 新增
          </button>
        </motion.div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex-1 relative min-w-[200px]">
            <FaSearch className="absolute left-3 top-3 text-gray-500" />
            <input
              type="text"
              placeholder="搜索项目/来源"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800"
            />
          </div>
          <div className="min-w-[10rem]">
            <SearchableSelect
              value={searchProject}
              onChange={setSearchProject}
              options={filterProjectOptions}
              placeholder="全部项目"
              searchPlaceholder="搜索项目…"
            />
          </div>
          <input
            type="date"
            value={dateStart}
            onChange={(e) => setDateStart(e.target.value)}
            className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800"
          />
          <input
            type="date"
            value={dateEnd}
            onChange={(e) => setDateEnd(e.target.value)}
            className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800"
          />
        </div>

        {filteredData.length > 0 &&
        <div className="mb-4 p-3 bg-gray-50 rounded-lg flex justify-between items-center">
            <span className="text-gray-600">共 {filteredData.length} 条</span>
            <span className="text-gray-800 font-medium">合计：{formatMoney(totalAmount)}</span>
          </div>
        }

        {(() => {if (loading) {return <div className="text-gray-500 text-center py-8">加载中...</div>;} else {if (
            filteredData.length === 0) {return <div className="text-gray-500 text-center py-12">暂无数据</div>;} else {return (
                <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-gray-700">项目</th>
                  <th className="px-4 py-3 text-right text-gray-700">收入金额</th>
                  <th className="px-4 py-3 text-left text-gray-700">收入来源</th>
                  <th className="px-4 py-3 text-left text-gray-700">到账时间</th>
                  <th className="px-4 py-3 text-center text-gray-700">凭证</th>
                  <th className="px-4 py-3 text-left text-gray-700">备注</th>
                  <th className="px-4 py-3 text-center text-gray-700">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((item) => {
                  const vouchers = item.voucher_images ? item.voucher_images.split(',').filter(Boolean) : [];
                  return (
                    <tr key={item.id} className="border-b border-gray-200/50 hover:bg-gray-50/30">
                      <td className="px-4 py-3 text-gray-800">{getProjectName(item.project_id)}</td>
                      <td className="px-4 py-3 text-right text-green-600">{formatMoney(item.income_amount)}</td>
                      <td className="px-4 py-3 text-gray-700">{item.source || '-'}</td>
                      <td className="px-4 py-3 text-gray-700">{item.income_date || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        {vouchers.length > 0 ?
                        <div className="flex justify-center gap-2">
                            <button type="button" onClick={() => setShowPreview(vouchers)} className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg"><FaEye /></button>
                            <span className="text-xs text-gray-500 flex items-center gap-1"><FaImage /> {vouchers.length}</span>
                          </div> :
                        <span className="text-gray-400">-</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{item.remark || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => openEdit(item)} className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg"><FaEdit /></button>
                          <button onClick={() => setDeleteConfirm({ show: true, id: item.id })} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"><FaTrash /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>);}}})()
        }
      </div>

      <AnimatePresence>
        {showModal &&
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800">{editing ? '编辑其他收入' : '新增其他收入'}</h3>
                <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-800"><FaTimes /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="ui-label mb-2 block">项目名称 *</label>
                  <SearchableSelect
                  required
                  allowEmpty={false}
                  value={form.project_id}
                  onChange={(v) => setForm({ ...form, project_id: v })}
                  options={formProjectOptions}
                  placeholder="选择项目"
                  searchPlaceholder="搜索项目…" />
                
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">收入金额 *</label>
                  <input type="number" step="0.01" required value={form.income_amount} onChange={(e) => setForm({ ...form, income_amount: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">收入来源</label>
                  <input type="text" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" placeholder="如：垫款回收、保证金退回" />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">备注</label>
                  <textarea value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" rows={3} />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">到账时间</label>
                  <input type="date" value={form.income_date} onChange={(e) => setForm({ ...form, income_date: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">进账凭证</label>
                  <input type="file" ref={fileInputRef} multiple accept="image/*" onChange={handleUpload} className="hidden" />
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-gray-800 rounded-lg mb-2"><FaUpload /> 上传凭证</button>
                  {form.voucher_images.length > 0 &&
                <div className="flex flex-wrap gap-2">
                      {form.voucher_images.map((url, idx) =>
                  <div key={idx} className="relative">
                          <img src={url} alt="" className="w-16 h-16 object-cover rounded border border-slate-600" />
                          <button type="button" onClick={() => setForm({ ...form, voucher_images: form.voucher_images.filter((_, i) => i !== idx) })} className="absolute -top-2 -right-2 bg-red-500 text-gray-800 rounded-full w-5 h-5 flex items-center justify-center text-xs"><FaTimes /></button>
                        </div>
                  )}
                    </div>
                }
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-500 text-gray-800 rounded-lg">取消</button>
                  <button type="submit" disabled={saving} className="px-4 py-2 bg-green-600 text-gray-800 rounded-lg disabled:opacity-50">{saving ? '保存中...' : '确定'}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      <AnimatePresence>
        {deleteConfirm.show &&
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-xl p-6 w-full max-w-sm">
              <h3 className="text-xl font-bold text-gray-800 mb-4">确认删除</h3>
              <p className="text-gray-700 mb-6">确定要删除该记录吗？</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeleteConfirm({ show: false })} className="px-4 py-2 bg-gray-500 text-gray-800 rounded-lg">取消</button>
                <button onClick={() => deleteConfirm.id && handleDelete(deleteConfirm.id)} className="px-4 py-2 bg-red-600 text-gray-800 rounded-lg">删除</button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      <AnimatePresence>
        {showPreview.length > 0 &&
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowPreview([])}>
            <div className="max-w-4xl max-h-[90vh] overflow-auto p-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex flex-wrap gap-4 justify-center">
                {showPreview.map((url, idx) =>
              <img key={idx} src={url} alt="" className="max-w-xs max-h-64 object-contain rounded" />
              )}
              </div>
            </div>
          </motion.div>
        }
      </AnimatePresence>
    </motion.div>);

}