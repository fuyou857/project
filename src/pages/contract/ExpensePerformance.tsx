import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaTimes, FaEdit, FaSearch } from 'react-icons/fa';
import { supabase } from '../../supabase/client';
import ApprovalStatusBadge from '../../components/ApprovalStatusBadge';
import { useContractSideList } from '../../hooks/useContractSideList';
import { CONTRACT_SIDE_TABLES } from '../../utils/contractSideTables';
import {
  alertMissingRequiredFields,
  tryCreateApproval,
  createSuccessMessage,
  contractNameById,
  expenseContractAmountValue,
  filterRowsBySearch,
} from '../../utils/contractSubPage';
import ContractAttachmentManager from '../../components/contract/ContractAttachmentManager';
import { SearchableSelect } from '../../components/ui';
import { contractSelectOptions } from '../../components/ui/options';
import { useContractFormAttachments } from '../../hooks/useContractFormAttachments';

const tables = CONTRACT_SIDE_TABLES.expense;

export default function ExpensePerformance() {
  const { contracts, listData, loading, refreshAll } = useContractSideList(
    tables.contracts,
    tables.performances,
    { contractSelect: 'id, contract_name, contract_code, contract_amount' },
  );
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<any>({});
  const [search, setSearch] = useState('');
  const attach = useContractFormAttachments('expense-performances');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const missing: string[] = [];
    if (!form.contract_id) missing.push('关联合同');
    if (!form.performance_ratio && form.performance_ratio !== 0) missing.push('履约比例');
    if (!form.performance_date) missing.push('履约日期');
    if (alertMissingRequiredFields(missing)) return;
    const attachment_url = await attach.persistForSubmit(form.id);
    const submitData = { ...form, attachment_url };
    if (!form.id) {
      const contract = contracts.find(c => c.id === form.contract_id);
      submitData.cumulative_amount = form.cumulative_amount || (contract ? expenseContractAmountValue(contract) * (form.performance_ratio || 0) / 100 : 0);
    }
    
    if (form.id) {
      const { error } = await supabase.from('expense_performances').update(submitData).eq('id', form.id);
      if (error) { alert('保存失败: ' + error.message); return; }
      alert('更新成功');
    } else {
      const { data, error } = await supabase.from('expense_performances').insert(submitData).select().single();
      if (error) { alert('保存失败: ' + error.message); return; }

      const approvalSubmitted = await tryCreateApproval(
        'expense_performance',
        data.id,
        `履约 ${contractNameById(contracts, data.contract_id)}`,
      );
      alert(createSuccessMessage(approvalSubmitted));
    }
    
    setShowModal(false);
    setForm({});
    attach.reset();
    refreshAll();
  }

  const filteredData = filterRowsBySearch(listData, search, ['performance_content']);

  const getContractName = (id: string) => contractNameById(contracts, id);

  const contractOptions = useMemo(
    () => contractSelectOptions(contracts, '选择合同', 'nameOnly'),
    [contracts],
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-800">合同履约</h3>
        <button onClick={() => { setForm({}); attach.reset(); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-gray-800 rounded-lg">
          <FaPlus /> 新增
        </button>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex gap-4 mb-4">
          <div className="flex-1 relative">
            <FaSearch className="absolute left-3 top-3 text-gray-500" />
            <input type="text" placeholder="搜索履约内容..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" />
          </div>
        </div>

        {loading ? <div className="text-slate-500 text-center py-8">加载中...</div> : filteredData.length === 0 ? (
          <div className="text-slate-500 text-center py-8">暂无数据</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-gray-700">关联合同</th>
                  <th className="px-4 py-3 text-left text-gray-700">履约内容</th>
                  <th className="px-4 py-3 text-left text-gray-700">履约比例</th>
                  <th className="px-4 py-3 text-left text-gray-700">履约日期</th>
                  <th className="px-4 py-3 text-left text-gray-700">累计金额(万元)</th>
                  <th className="px-4 py-3 text-center text-gray-700">审批状态</th>
                  <th className="px-4 py-3 text-center text-gray-700">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((item: any) => (
                  <tr key={item.id} className="border-b border-gray-200/50 hover:bg-gray-50/30">
                    <td className="px-4 py-3 text-gray-800">{getContractName(item.contract_id)}</td>
                    <td className="px-4 py-3 text-gray-700">{item.performance_content || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{item.performance_ratio || 0}%</td>
                    <td className="px-4 py-3 text-gray-700">{item.performance_date || '-'}</td>
                    <td className="px-4 py-3 text-green-400">{item.cumulative_amount || 0}</td>
                    <td className="px-4 py-3 text-center"><ApprovalStatusBadge sourceType="expense_performance" sourceId={item.id} sourceName={`履约 ${getContractName(item.contract_id)}`} /></td>
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
                <h3 className="text-xl font-bold text-gray-800">{form.id ? '编辑' : '新增'}履约记录</h3>
                <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-800"><FaTimes /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="ui-label mb-2 block">关联合同 *</label>
                  <SearchableSelect
                    required
                    allowEmpty={false}
                    value={form.contract_id || ''}
                    onChange={v => {
                      const c = contracts.find(x => x.id === v);
                      setForm({
                        ...form,
                        contract_id: v,
                        cumulative_amount: c ? expenseContractAmountValue(c) * (form.performance_ratio || 0) / 100 : 0,
                      });
                    }}
                    options={contractOptions}
                    placeholder="选择合同"
                    searchPlaceholder="搜索合同…"
                  />
                </div>
                <div><label className="block text-sm text-gray-500 mb-2">履约内容</label>
                  <textarea value={form.performance_content || ''} onChange={e => setForm({ ...form, performance_content: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" rows={2} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm text-gray-500 mb-2">履约比例(%) *</label>
                    <input type="number" min="0" max="100" required value={form.performance_ratio || ''} onChange={e => {
                      const ratio = parseFloat(e.target.value) || 0;
                      const c = contracts.find(x => x.id === form.contract_id);
                      setForm({ ...form, performance_ratio: ratio, cumulative_amount: c ? expenseContractAmountValue(c) * ratio / 100 : 0 });
                    }} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" />
                  </div>
                  <div><label className="block text-sm text-gray-500 mb-2">履约日期 *</label>
                    <input type="date" required value={form.performance_date || ''} onChange={e => setForm({ ...form, performance_date: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" />
                  </div>
                </div>
                <div><label className="block text-sm text-gray-500 mb-2">累计金额(万元)</label>
                  <input type="number" step="0.01" value={form.cumulative_amount || ''} onChange={e => setForm({ ...form, cumulative_amount: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" />
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
