import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaTimes, FaEdit, FaSearch, FaFile } from 'react-icons/fa';
import { supabase } from '../../supabase/client';
import ApprovalStatusBadge from '../../components/ApprovalStatusBadge';
import { useContractSideList } from '../../hooks/useContractSideList';
import { CONTRACT_SIDE_TABLES } from '../../utils/contractSideTables';
import {
  alertMissingRequiredFields,
  tryCreateApproval,
  createSuccessMessage,
  contractNameById,
  filterRowsBySearch,
} from '../../utils/contractSubPage';
import ContractAttachmentManager from '../../components/contract/ContractAttachmentManager';
import { SearchableSelect } from '../../components/ui';
import { contractSelectOptions } from '../../components/ui/options';
import { useContractFormAttachments } from '../../hooks/useContractFormAttachments';

const PAGE_SIZE = 15;
const tables = CONTRACT_SIDE_TABLES.income;

export default function IncomeDeduction() {
  const { contracts, listData, loading, refreshAll } = useContractSideList(
    tables.contracts,
    tables.deductions,
    { listLimit: PAGE_SIZE },
  );
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<any>({});
  const [search, setSearch] = useState('');
  const attach = useContractFormAttachments('income-deductions');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const missing: string[] = [];
    if (!form.contract_id) missing.push('关联主合同');
    if (!form.deduction_reason?.trim()) missing.push('扣款事由');
    if (!form.deduction_amount && form.deduction_amount !== 0) missing.push('扣款金额');
    if (!form.deduction_date) missing.push('扣款日期');
    if (alertMissingRequiredFields(missing)) return;
    const attachment_url = await attach.persistForSubmit(form.id);
    const code = form.deduction_code || ('DED-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + String(listData.length + 1).padStart(4, '0'));
    const submitData = { ...form, deduction_code: code, attachment_url };
    
    if (form.id) {
      const { error } = await supabase.from('income_deductions').update(submitData).eq('id', form.id);
      if (error) { alert('保存失败: ' + error.message); return; }
      alert('更新成功');
    } else {
      const { data, error } = await supabase.from('income_deductions').insert(submitData).select().single();
      if (error) { alert('保存失败: ' + error.message); return; }

      const approvalSubmitted = await tryCreateApproval('income_deduction', data.id, `扣款 ${data.deduction_code}`);
      alert(createSuccessMessage(approvalSubmitted));
    }
    
    setShowModal(false);
    setForm({});
    attach.reset();
    refreshAll();
  }

  const filteredData = filterRowsBySearch(listData, search, ['deduction_code', 'deduction_reason']);

  const getContractName = (id: string) => contractNameById(contracts, id);

  const contractOptions = useMemo(
    () => contractSelectOptions(contracts, '选择合同', 'nameCode'),
    [contracts],
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-800">收入合同扣款登记</h3>
        <button onClick={() => { setForm({}); attach.reset(); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-gray-800 rounded-lg">
          <FaPlus /> 新增
        </button>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex gap-4 mb-4">
          <div className="flex-1 relative">
            <FaSearch className="absolute left-3 top-3 text-gray-500" />
            <input type="text" placeholder="搜索扣款编号或事由..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" />
          </div>
        </div>

        {loading ? <div className="text-slate-500 text-center py-8">加载中...</div> : filteredData.length === 0 ? (
          <div className="text-slate-500 text-center py-8">暂无数据</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-gray-700">扣款编号</th>
                  <th className="px-4 py-3 text-left text-gray-700">关联合同</th>
                  <th className="px-4 py-3 text-left text-gray-700">扣款事由</th>
                  <th className="px-4 py-3 text-left text-gray-700">扣款金额(万元)</th>
                  <th className="px-4 py-3 text-left text-gray-700">扣款日期</th>
                  <th className="px-4 py-3 text-center text-gray-700">审批状态</th>
                  <th className="px-4 py-3 text-center text-gray-700">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((item: any) => (
                  <tr key={item.id} className="border-b border-gray-200/50 hover:bg-gray-50/30">
                    <td className="px-4 py-3 text-gray-800">{item.deduction_code || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{getContractName(item.contract_id)}</td>
                    <td className="px-4 py-3 text-gray-700">{item.deduction_reason || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{item.deduction_amount || 0}</td>
                    <td className="px-4 py-3 text-gray-700">{item.deduction_date || '-'}</td>
                    <td className="px-4 py-3 text-center"><ApprovalStatusBadge sourceType="income_deduction" sourceId={item.id} sourceName={`扣款 ${item.deduction_code}`} /></td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => { setForm(item); attach.loadFromField(item.attachment_url); setShowModal(true); }} className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg"><FaEdit /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800">{form.id ? '编辑' : '新增'}扣款登记</h3>
                <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-800"><FaTimes /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="ui-label mb-2 block">关联主合同 *</label>
                  <SearchableSelect
                    required
                    allowEmpty={false}
                    value={form.contract_id || ''}
                    onChange={v => setForm({ ...form, contract_id: v })}
                    options={contractOptions}
                    placeholder="选择合同"
                    searchPlaceholder="搜索合同…"
                  />
                </div>
                <div><label className="block text-sm text-gray-500 mb-2">扣款事由 *</label>
                  <input required value={form.deduction_reason || ''} onChange={e => setForm({ ...form, deduction_reason: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm text-gray-500 mb-2">扣款金额(万元) *</label>
                    <input type="number" step="0.01" required value={form.deduction_amount || ''} onChange={e => setForm({ ...form, deduction_amount: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" />
                  </div>
                  <div><label className="block text-sm text-gray-500 mb-2">扣款日期 *</label>
                    <input type="date" required value={form.deduction_date || ''} onChange={e => setForm({ ...form, deduction_date: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" />
                  </div>
                </div>
                <ContractAttachmentManager
                  attachments={attach.attachments}
                  onAttachmentsChange={attach.setAttachments}
                  onNotifyError={(msg) => alert(msg)}
                />
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-500 text-gray-800 rounded-lg">取消</button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-gray-800 rounded-lg">保存</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
