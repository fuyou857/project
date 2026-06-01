import React, { useState, useCallback } from 'react';
import { DrillDownButton } from './DrillDownButton';
import { supabase } from '../supabase/client';

interface PaymentRecord {
  id: string;
  payment_date: string;
  amount: number;
  payer_name?: string;
  payee_name?: string;
  remark?: string;
  payment_type?: string;
}

interface ContractPaymentDrillDownProps {
  contractId: string;
  type: 'income' | 'expense';
  contractName?: string;
}

const TYPE_LABELS = {
  income: { label: '收款', table: 'income_contracts', amountField: 'contract_amount' },
  expense: { label: '付款', table: 'expense_contracts', amountField: 'contract_amount' },
};

export function ContractPaymentDrillDown({ contractId, type, contractName }: ContractPaymentDrillDownProps) {
  const [open, setOpen] = useState(false);
  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalAmount, setTotalAmount] = useState(0);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const { data: payments } = await supabase
        .from('payment_records')
        .select('*')
        .eq('contract_id', contractId)
        .eq('payment_type', type)
        .order('payment_date', { ascending: false });
      setRecords((payments as unknown as PaymentRecord[]) || []);

      const { data: contract } = await supabase
        .from(TYPE_LABELS[type].table)
        .select(TYPE_LABELS[type].amountField)
        .eq('id', contractId)
        .maybeSingle();
      if (contract) {
        setTotalAmount(Number(contract[TYPE_LABELS[type].amountField as keyof typeof contract]) || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [contractId, type]);

  const handleOpen = useCallback(() => {
    setOpen(true);
    fetchRecords();
  }, [fetchRecords]);

  const handleClose = useCallback(() => {
    try {
      setOpen(false);
    } catch (err) {
      console.error('[ContractPaymentDrillDown] handleClose failed', err);
      setOpen(false);
    }
  }, []);

  const formatMoney = (val: number) =>
    new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(val || 0);

  const paidTotal = records.reduce((sum, r) => sum + Number(r.amount || 0), 0);

  return (
    <>
      <DrillDownButton
        count={formatMoney(paidTotal)}
        label={`已${TYPE_LABELS[type].label}`}
        onClick={handleOpen}
      />

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={(e) => { e.stopPropagation(); handleClose(); }}>
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">
                {TYPE_LABELS[type].label}记录 {contractName ? `- ${contractName}` : ''}
              </h3>
              <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleClose(); }} className="p-1 text-slate-400 hover:text-slate-600" aria-label="关闭">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-3 bg-blue-50 rounded-lg text-center">
                  <div className="text-sm text-slate-500">合同金额</div>
                  <div className="text-lg font-bold text-blue-700">{formatMoney(totalAmount)}</div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg text-center">
                  <div className="text-sm text-slate-500">已{TYPE_LABELS[type].label}</div>
                  <div className="text-lg font-bold text-green-700">{formatMoney(paidTotal)}</div>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-8 text-slate-500">加载中...</div>
              ) : records.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  暂无{TYPE_LABELS[type].label}记录
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="text-left py-2 px-2">日期</th>
                      <th className="text-left py-2 px-2">{type === 'income' ? '付款方' : '收款方'}</th>
                      <th className="text-right py-2 px-2">金额</th>
                      <th className="text-left py-2 px-2">备注</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(record => (
                      <tr key={record.id} className="border-b border-slate-100">
                        <td className="py-2 px-2 text-slate-700">{record.payment_date}</td>
                        <td className="py-2 px-2 text-slate-700">
                          {type === 'income' ? (record.payer_name || '-') : (record.payee_name || '-')}
                        </td>
                        <td className="py-2 px-2 text-right text-green-600">{formatMoney(record.amount)}</td>
                        <td className="py-2 px-2 text-slate-500">{record.remark || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}