import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaTimes, FaSave, FaExclamationCircle } from 'react-icons/fa';
import { supabase } from '../../../../supabase/client';
import { useAuth } from '../../../../hooks/useAuth';
import type { EnrichedCostInvoiceRow } from './types';
import SearchableSelect from '../../../../components/ui/SearchableSelect';
import { formatAmount, formatDateDisplay } from './formatters';
import UiModalOverlay from '../../../../components/ui/UiModalOverlay';

type Props = {
  invoice: EnrichedCostInvoiceRow | null;
  onClose: () => void;
  onSuccess: () => void;
};

type ContractOption = {
  id: string;
  name: string;
  code: string | null;
  party_b_name: string;
  amount: number;
  received_amount: number;
};

export default function AssociateBusinessDialog({ invoice, onClose, onSuccess }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contracts, setContracts] = useState<ContractOption[]>([]);
  
  const [status, setStatus] = useState<'unassociated' | 'associated_contract' | 'no_contract_payment'>('unassociated');
  const [contractId, setContractId] = useState<string>('');
  const [remark, setRemark] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (invoice) {
      setStatus(invoice.association_status || 'unassociated');
      setContractId(invoice.expense_contract_id || '');
      setRemark(invoice.no_contract_payment_remark || '');
      setError(null);
      fetchContracts();
    }
  }, [invoice]);

  const fetchContracts = async () => {
    if (!invoice?.project_id) return;
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('expense_contracts')
        .select(`
          id, 
          contract_name, 
          contract_code, 
          contract_amount,
          received_invoice_amount,
          party_b:party_b_id(unit_name)
        `)
        .eq('project_id', invoice.project_id)
        .order('created_at', { ascending: false });

      if (err) throw err;
      
      setContracts((data || []).map(c => ({
        id: c.id,
        name: c.contract_name,
        code: c.contract_code,
        party_b_name: (c.party_b as any)?.unit_name || '-',
        amount: Number(c.contract_amount || 0),
        received_amount: Number(c.received_invoice_amount || 0)
      })));
    } catch (e) {
      console.error('Fetch contracts error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!invoice || !user) return;
    setError(null);

    // 校验
    if (status === 'associated_contract' && !contractId) {
      setError('请选择支出合同');
      return;
    }
    if (status === 'no_contract_payment' && !remark.trim()) {
      setError('请填写付款事由备注');
      return;
    }

    if (status === 'no_contract_payment') {
      if (!confirm('该发票将标记为无合同付款，后续无法自动匹配合同成本，请确认事由填写无误')) {
        return;
      }
    }

    setSaving(true);
    try {
      const oldStatus = invoice.association_status;
      const oldContractId = invoice.expense_contract_id;
      const newContractId = status === 'associated_contract' ? contractId : null;

      // 1. 更新发票
      const { error: updateErr } = await supabase
        .from('cost_invoices')
        .update({
          association_status: status,
          expense_contract_id: newContractId,
          no_contract_payment_remark: status === 'no_contract_payment' ? remark : null,
        })
        .eq('id', invoice.id);

      if (updateErr) throw updateErr;

      // 2. 记录日志
      await supabase.from('invoice_association_logs').insert({
        invoice_id: invoice.id,
        operator_id: user.id,
        old_status: oldStatus,
        new_status: status,
        old_contract_id: oldContractId,
        new_contract_id: newContractId,
        remark: status === 'no_contract_payment' ? remark : null
      });

      // 3. 同步合同统计金额 (这里需要比较严谨的处理)
      // 如果旧的关联了合同，减去金额
      if (oldContractId) {
        const { data: oldC } = await supabase.from('expense_contracts').select('received_invoice_amount').eq('id', oldContractId).single();
        if (oldC) {
          const nextAmt = Math.max(0, Number(oldC.received_invoice_amount || 0) - Number(invoice.invoice_amount));
          await supabase.from('expense_contracts').update({ received_invoice_amount: nextAmt }).eq('id', oldContractId);
        }
      }
      // 如果新的关联了合同，增加金额
      if (newContractId) {
        const { data: newC } = await supabase.from('expense_contracts').select('received_invoice_amount').eq('id', newContractId).single();
        if (newC) {
          const nextAmt = Number(newC.received_invoice_amount || 0) + Number(invoice.invoice_amount);
          await supabase.from('expense_contracts').update({ received_invoice_amount: nextAmt }).eq('id', newContractId);
        }
      }

      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  if (!invoice) return null;

  return (
    <UiModalOverlay
      open={!!invoice}
      onClose={onClose}
      panelClassName="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-6 py-4">
        <h3 className="text-lg font-bold text-gray-900">关联单据</h3>
        <button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
          <FaTimes className="h-5 w-5" />
        </button>
      </div>

      <div className="p-6">
        {/* Invoice Info Card */}
        <div className="mb-6 rounded-xl bg-gray-50 p-4 border border-gray-100">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div className="flex flex-col gap-1">
              <span className="text-gray-500">票号</span>
              <span className="font-mono font-medium text-gray-900">{invoice.invoice_number || '-'}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-gray-500">价税合计</span>
              <span className="ui-numeric font-bold text-blue-700">{formatAmount(invoice.invoice_amount)} 元</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-gray-500">销售方名称</span>
              <span className="text-gray-900 truncate" title={invoice.seller_display}>{invoice.seller_display}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-gray-500">开票日期</span>
              <span className="text-gray-900">{formatDateDisplay(invoice.invoice_date)}</span>
            </div>
            <div className="flex flex-col gap-1 col-span-2">
              <span className="text-gray-500">收票方名称</span>
              <span className="text-gray-900 truncate" title={invoice.buyer_name || ''}>{invoice.buyer_name || '-'}</span>
            </div>
          </div>
        </div>

        {/* Form Area */}
        <div className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              关联业务 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'unassociated', label: '未关联' },
                { id: 'associated_contract', label: '关联合同' },
                { id: 'no_contract_payment', label: '无合同付款' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setStatus(opt.id as any)}
                  className={`flex h-11 items-center justify-center rounded-lg border text-sm font-medium transition-all ${
                    status === opt.id
                      ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-100'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {status === 'associated_contract' && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                支出合同 <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={contractId}
                onChange={setContractId}
                placeholder={loading ? '加载合同中...' : '搜索合同名称、编号、供应商...'}
                options={contracts.map(c => ({
                  value: c.id,
                  label: `${c.name}${c.code ? ` (${c.code})` : ''}`,
                  description: `供应商: ${c.party_b_name} | 金额: ${formatAmount(c.amount)} | 已收发票: ${formatAmount(c.received_amount)}`
                }))}
                className="w-full"
              />
            </motion.div>
          )}

          {status === 'no_contract_payment' && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                付款事由备注 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value.slice(0, 200))}
                placeholder="请填写无合同付款的具体事由..."
                className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all min-h-[100px]"
              />
              <div className="mt-1 flex justify-end">
                <span className={`text-xs ${remark.length >= 200 ? 'text-red-500' : 'text-gray-400'}`}>
                  {remark.length} / 200
                </span>
              </div>
            </motion.div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <FaExclamationCircle className="shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50/50 px-6 py-4">
        <button
          onClick={onClose}
          disabled={saving}
          className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-6 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          取消
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-[0.98]"
        >
          {saving ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              保存中...
            </>
          ) : (
            <>
              <FaSave className="h-4 w-4" />
              保存关联
            </>
          )}
        </button>
      </div>
    </UiModalOverlay>
  ); 
}
