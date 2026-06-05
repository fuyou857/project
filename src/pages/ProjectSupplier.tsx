import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaTrash, FaTimes } from 'react-icons/fa';
import { supabase } from '../supabase/client';
import { alertMissingRequiredFields } from '../utils/contractSubPage';
import { SegmentedControl } from '../components/ui';

interface ProjectSupplier {
  id: string;
  project_id: string;
  supplier_name: string;
  supply_category: string;
  supply_content: string | null;
  contract_amount: number | null;
  contract_file: string | null;
  business_license_file: string | null;
  bank_account: string | null;
  bank_name: string | null;
}

const initialFormData = {
  supplier_name: '',
  supply_category: '人工',
  supply_content: '',
  contract_amount: '',
  contract_file: '',
  business_license_file: '',
  bank_account: '',
  bank_name: '',
};



export default function ProjectSupplier() {
  const { projectId } = useParams<{ projectId: string }>();
  const [suppliers, setSuppliers] = useState<ProjectSupplier[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteFinal, setShowDeleteFinal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formData, setFormData] = useState(initialFormData);

  const fetchSuppliers = useCallback(async () => {
    if (!projectId) return;
    const { data } = await supabase
      .from('project_suppliers')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (data) setSuppliers(data);
  }, [projectId]);

  useEffect(() => {
    if (projectId) fetchSuppliers();
  }, [projectId, fetchSuppliers]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const missing: string[] = [];
    if (!formData.supplier_name?.trim()) missing.push('乙方单位名称');
    if (!formData.supply_category?.trim()) missing.push('供应类别');
    if (!projectId) missing.push('项目ID');
    if (alertMissingRequiredFields(missing)) return

    await supabase.from('project_suppliers').insert({
      project_id: projectId,
      supplier_name: formData.supplier_name,
      supply_category: formData.supply_category,
      supply_content: formData.supply_content || null,
      contract_amount: formData.contract_amount ? parseFloat(formData.contract_amount) : null,
      contract_file: formData.contract_file || null,
      business_license_file: formData.business_license_file || null,
      bank_account: formData.bank_account || null,
      bank_name: formData.bank_name || null,
    });

    setShowModal(false);
    setFormData(initialFormData);
    fetchSuppliers();
  }

  function handleDeleteClick(id: string) {
    setSelectedId(id);
    setShowDeleteConfirm(true);
  }

  async function confirmDelete() {
    if (!selectedId) return;
    await supabase.from('project_suppliers').delete().eq('id', selectedId);
    setShowDeleteConfirm(false);
    setShowDeleteFinal(false);
    setSelectedId(null);
    fetchSuppliers();
  }



  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">项目乙方单位管理</h2>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-gray-800 rounded-lg">
          <FaPlus /> 添加乙方单位
        </button>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-lg p-6">
        {suppliers.length === 0 ? (
          <div className="text-center text-gray-500 py-12">暂无乙方单位，请点击「添加乙方单位」按钮添加</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500 text-sm">
                <th className="text-left py-3 px-4">乙方单位名称</th>
                <th className="text-left py-3 px-4">供应类别</th>
                <th className="text-left py-3 px-4">供应内容</th>
                <th className="text-left py-3 px-4">合同金额(万元)</th>
                <th className="text-center py-3 px-4">操作</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map(s => (
                <tr key={s.id} className="border-b border-gray-200/50 hover:bg-gray-50/30">
                  <td className="py-3 px-4 text-gray-800">{s.supplier_name}</td>
                  <td className="py-3 px-4 text-gray-700">{s.supply_category}</td>
                  <td className="py-3 px-4 text-gray-700">{s.supply_content || '-'}</td>
                  <td className="py-3 px-4 text-gray-700">{s.contract_amount ? s.contract_amount.toFixed(2) : '-'}</td>
                  <td className="py-3 px-4 text-center">
                    <button onClick={() => handleDeleteClick(s.id)} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-gray-800 text-sm rounded flex items-center gap-1 mx-auto">
                      <FaTrash /> 删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800">添加乙方单位</h3>
                <button onClick={(e) => { e.stopPropagation(); }} className="text-gray-500 hover:text-gray-800"><FaTimes /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-500 mb-2">乙方单位名称 *</label>
                    <input type="text" required value={formData.supplier_name} onChange={e => setFormData({ ...formData, supplier_name: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" placeholder="请输入乙方单位名称" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-2">供应类别 *</label>
                    <SegmentedControl
                      value={formData.supply_category as '人工' | '材料' | '机械' | '其他'}
                      onChange={v => setFormData({ ...formData, supply_category: v })}
                      options={[
                        { value: '人工', label: '人工' },
                        { value: '材料', label: '材料' },
                        { value: '机械', label: '机械' },
                        { value: '其他', label: '其他' },
                      ]}
                      aria-label="供应类别"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">供应内容</label>
                  <input type="text" value={formData.supply_content} onChange={e => setFormData({ ...formData, supply_content: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" placeholder="请输入供应内容" />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">合同金额 (万元)</label>
                  <input type="number" step="0.01" value={formData.contract_amount} onChange={e => setFormData({ ...formData, contract_amount: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" placeholder="请输入合同金额" />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">乙方单位合同 (支持 .pdf, .jpg, .png)</label>
                  <input type="text" value={formData.contract_file} onChange={e => setFormData({ ...formData, contract_file: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" placeholder="请输入合同文件URL" />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">营业执照 (支持 .pdf, .jpg, .png)</label>
                  <input type="text" value={formData.business_license_file} onChange={e => setFormData({ ...formData, business_license_file: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" placeholder="请输入营业执照URL" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-500 mb-2">银行账户</label>
                    <input type="text" value={formData.bank_account} onChange={e => setFormData({ ...formData, bank_account: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" placeholder="请输入银行账户" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-2">开户行</label>
                    <input type="text" value={formData.bank_name} onChange={e => setFormData({ ...formData, bank_name: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" placeholder="请输入开户行" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={(e) => { e.stopPropagation(); }} className="px-4 py-2 bg-gray-500 text-gray-800 rounded-lg">取消</button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-gray-800 rounded-lg">保存</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDeleteConfirm(false)}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-white rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-bold text-gray-800 mb-4">确认删除</h3>
              <p className="text-gray-700 mb-6">确定要删除此乙方单位吗？此操作不可恢复。</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 bg-gray-500 text-gray-800 rounded-lg">取消</button>
                <button onClick={() => { setShowDeleteConfirm(false); setShowDeleteFinal(true); }} className="px-4 py-2 bg-red-600 text-gray-800 rounded-lg">确认删除</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDeleteFinal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDeleteFinal(false)}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-white rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-bold text-gray-800 mb-4">二次确认删除</h3>
              <p className="text-gray-700 mb-6">请再次确认：是否确定删除此乙方单位？</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowDeleteFinal(false)} className="px-4 py-2 bg-gray-500 text-gray-800 rounded-lg">取消</button>
                <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-gray-800 rounded-lg">确定删除</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
