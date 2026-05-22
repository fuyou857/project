import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaEdit, FaTrash, FaTimes, FaBuilding, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import { supabase } from '../../supabase/client';
import ResponsiveTable from '../../components/ResponsiveTable';
import { addLog, logModule, logAction } from '../../services/logService';
import { SearchableSelect, SegmentedControl } from '../../components/ui';

interface Company {id: string;name: string;company_type: string;parent_id: string | null;credit_code: string;contact_person: string;contact_phone: string;status: string;remark: string;created_at: string;children?: Company[];}

const initialForm = { name: '', company_type: '总公司', parent_id: '', credit_code: '', contact_person: '', contact_phone: '', status: '启用', remark: '' };

export default function CompanyManagement() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const isSuperAdmin = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.role === 'super_admin' || user.role_ids?.includes('super_admin');
  };

  const parentCompanyOptions = useMemo(
    () => [
    { value: '', label: '选择总公司' },
    ...companies.filter((c) => c.company_type === '总公司').map((c) => ({ value: c.id, label: c.name }))],

    [companies]
  );

  useEffect(() => {fetchCompanies();}, []);

  async function fetchCompanies() {
    setLoading(true);
    const { data } = await supabase.from('companies').select('*').order('created_at', { ascending: false });
    if (data) {
      const tree = buildTree(data);
      setCompanies(tree);
    }
    setLoading(false);
  }

  function buildTree(list: Company[]): Company[] {
    const map: Record<string, Company> = {};
    const roots: Company[] = [];
    list.forEach((c) => {map[c.id] = { ...c, children: [] };});
    list.forEach((c) => {
      if (c.parent_id && map[c.parent_id]) map[c.parent_id].children!.push(map[c.id]);else
      roots.push(map[c.id]);
    });
    return roots;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.log('handleSubmit 被调用');
    if (!form.name?.trim()) {alert('请输入公司名称');return;}
    if (form.company_type === '分公司' && !form.parent_id) {alert('请选择上级公司');return;}
    const payload = { name: form.name, company_type: form.company_type, parent_id: form.company_type === '分公司' ? form.parent_id : null, credit_code: form.credit_code || null, contact_person: form.contact_person || null, contact_phone: form.contact_phone || null, status: form.status, remark: form.remark || null };
    console.log('准备提交的 payload:', payload);
    if (editingId) {
      console.log('更新公司，id:', editingId);
      const { data, error } = await supabase.from('companies').update(payload).eq('id', editingId).select();
      console.log('更新响应 data:', data);
      console.log('更新响应 error:', error);
      if (error) {alert('更新失败: ' + JSON.stringify(error, null, 2));return;}
    } else {
      console.log('添加新公司');
      const { data, error } = await supabase.from('companies').insert(payload).select();
      console.log('添加响应 data:', data);
      console.log('添加响应 error:', error);
      if (error) {alert('添加失败: ' + JSON.stringify(error, null, 2));return;}
    }
    console.log('操作成功，关闭模态框');
    setShowModal(false);setForm(initialForm);setEditingId(null);fetchCompanies();
  }

  async function handleDelete(id: string) {
    const { data: children } = await supabase.from('companies').select('id').eq('parent_id', id);
    if (children && children.length > 0) {alert('该公司下有分公司，无法删除');return;}
    const { data: projects } = await supabase.from('projects').select('id').eq('company_id', id).limit(1);
    if (projects && projects.length > 0) {alert('该公司下有项目，无法删除');return;}
    const { data: allCompanies } = await supabase.from('companies').select('id, company_type');
    const headquarterCount = allCompanies?.filter((c) => c.company_type === '总公司').length || 0;
    if (headquarterCount <= 1) {alert('至少保留一个总公司');return;}
    if (!confirm('确定删除该公司？')) return;
    const { error } = await supabase.from('companies').delete().eq('id', id);
    if (error) {
      alert('删除失败');
      return;
    }
    await addLog(logModule.BASE_DATA, logAction.DELETE, `删除公司`, { company_id: id });
    fetchCompanies();
  }

  function openEdit(c: Company) {
    setEditingId(c.id);
    setForm({ name: c.name, company_type: c.company_type, parent_id: c.parent_id || '', credit_code: c.credit_code || '', contact_person: c.contact_person || '', contact_phone: c.contact_phone || '', status: c.status, remark: c.remark || '' });
    setShowModal(true);
  }

  function toggleExpand(id: string) {
    const newSet = new Set(expandedIds);
    if (newSet.has(id)) newSet.delete(id);else
    newSet.add(id);
    setExpandedIds(newSet);
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">公司管理</h2>
        <button onClick={() => {setForm(initialForm);setEditingId(null);setShowModal(true);}} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-gray-800 rounded-lg">
          <FaPlus /> 新增公司
        </button>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200">
        {(() => {if (loading) {return <div className="text-slate-500 text-center py-8">加载中...</div>;} else {if (companies.length === 0) {return (
                <div className="text-slate-500 text-center py-8">暂无公司，请点击「新增公司」添加</div>);} else {return (

                <ResponsiveTable
                  columns={[
                  { key: 'name', label: '公司名称', render: (val, row) => {
                      const company = row as Company;
                      return (
                        <div className="flex items-center gap-2">
                  {company.children && company.children.length > 0 ?
                          <button
                            type="button"
                            onClick={() => toggleExpand(company.id)}
                            className="text-gray-500 hover:text-gray-800">
                            
                      {expandedIds.has(company.id) ? <FaChevronDown className="w-4 h-4" /> : <FaChevronRight className="w-4 h-4" />}
                    </button> :
                          <span className="w-5" />}
                  <span className="text-gray-800 font-medium">{String(val ?? '')}</span>
                </div>);
                    } },
                  { key: 'company_type', label: '类型' },
                  { key: 'credit_code', label: '信用代码', hiddenOnMobile: true },
                  { key: 'contact_person', label: '联系人', hiddenOnMobile: true },
                  { key: 'contact_phone', label: '电话', hiddenOnMobile: true },
                  { key: 'status', label: '状态', render: (val) =>
                    <span className={`px-2 py-1 rounded text-xs ${val === '启用' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {String(val ?? '')}
                </span>
                  },
                  { key: 'created_at', label: '创建时间', render: (val) => typeof val === 'string' ? val.slice(0, 10) : '-', hiddenOnMobile: true }]
                  }
                  data={companies}
                  keyField="id"
                  actionColumn={(c) => {
                    const company = c as Company;
                    return (
                      <div className="flex items-center justify-center gap-1">
                <button type="button" onClick={() => openEdit(company)} className="p-2.5 text-gray-500 hover:text-yellow-400 hover:bg-yellow-50 rounded-lg">
                  <FaEdit className="w-4 h-4" />
                </button>
                {isSuperAdmin() &&
                        <button type="button" onClick={() => handleDelete(company.id)} className="p-2.5 text-gray-500 hover:text-red-400 hover:bg-red-50 rounded-lg">
                    <FaTrash className="w-4 h-4" />
                  </button>
                        }
              </div>);
                  }} />);}}})()

        }
      </div>

      <AnimatePresence>
        {showModal &&
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => {setShowModal(false);setForm(initialForm);setEditingId(null);}}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800">{editingId ? '编辑公司' : '新增公司'}</h3>
                <button onClick={() => {setShowModal(false);setForm(initialForm);setEditingId(null);}} className="text-gray-500 hover:text-gray-800"><FaTimes /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="block text-sm text-gray-500 mb-2">公司名称 *</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="ui-label mb-2 block">公司类型 *</label>
                    <SegmentedControl
                    value={form.company_type as '总公司' | '分公司'}
                    onChange={(v) => setForm({ ...form, company_type: v, parent_id: v === '总公司' ? '' : form.parent_id })}
                    options={[
                    { value: '总公司', label: '总公司' },
                    { value: '分公司', label: '分公司' }]
                    }
                    aria-label="公司类型" />
                  
                  </div>
                  {form.company_type === '分公司' &&
                <div>
                      <label className="ui-label mb-2 block">上级公司 *</label>
                      <SearchableSelect
                    required
                    allowEmpty={false}
                    value={form.parent_id}
                    onChange={(v) => setForm({ ...form, parent_id: v })}
                    options={parentCompanyOptions}
                    placeholder="选择总公司"
                    searchPlaceholder="搜索总公司…" />
                  
                    </div>
                }
                </div>
                <div><label className="block text-sm text-gray-500 mb-2">统一社会信用代码</label><input value={form.credit_code} onChange={(e) => setForm({ ...form, credit_code: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm text-gray-500 mb-2">联系人</label><input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                  <div><label className="block text-sm text-gray-500 mb-2">联系电话</label><input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                </div>
                <div>
                  <label className="ui-label mb-2 block">状态</label>
                  <SegmentedControl
                  value={form.status as '启用' | '禁用'}
                  onChange={(v) => setForm({ ...form, status: v })}
                  options={[
                  { value: '启用', label: '启用' },
                  { value: '禁用', label: '禁用' }]
                  }
                  aria-label="状态" />
                
                </div>
                <div><label className="block text-sm text-gray-500 mb-2">备注</label><textarea value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" rows={2} /></div>
                <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={() => {setShowModal(false);setForm(initialForm);setEditingId(null);}} className="px-4 py-2 bg-gray-500 text-gray-800 rounded-lg">取消</button><button type="submit" className="px-4 py-2 bg-blue-600 text-gray-800 rounded-lg">保存</button></div>
              </form>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>
    </motion.div>);

}