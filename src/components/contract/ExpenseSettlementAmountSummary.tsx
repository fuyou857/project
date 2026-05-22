import { useState, useEffect } from 'react';
import { supabase } from '../../supabase/client';
import { CONTRACT_SIDE_TABLES } from '../../utils/contractSideTables';

type Summary = {
  mainAmount: number;
  supplementTotal: number;
  variationNet: number;
  deductionTotal: number;
  performanceTotal: number;
  settlementAmount: number;
};

/** 支出合同结算弹窗内的金额汇总（与原 ExpenseSettlement 内联逻辑一致） */
export default function ExpenseSettlementAmountSummary({ contractId }: { contractId: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const tables = CONTRACT_SIDE_TABLES.expense;

  useEffect(() => {
    async function load() {
      const [contractRes, supRes, varRes, dedRes, perfRes] = await Promise.all([
        supabase.from(tables.contracts).select('contract_amount').eq('id', contractId).maybeSingle(),
        supabase.from(tables.supplements).select('supplement_amount').eq('main_contract_id', contractId),
        supabase.from(tables.variations).select('variation_amount').eq('contract_id', contractId),
        supabase.from(tables.deductions).select('deduction_amount').eq('contract_id', contractId),
        supabase.from(tables.performances).select('cumulative_amount').eq('contract_id', contractId),
      ]);
      const mainAmount = contractRes.data?.contract_amount ?? 0;
      const supplementTotal = supRes.data?.reduce((sum, s) => sum + (s.supplement_amount || 0), 0) || 0;
      const variationNet = varRes.data?.reduce((sum, v) => sum + (v.variation_amount || 0), 0) || 0;
      const deductionTotal = dedRes.data?.reduce((sum, d) => sum + (d.deduction_amount || 0), 0) || 0;
      const performanceTotal = perfRes.data?.reduce((sum, p) => sum + (p.cumulative_amount || 0), 0) || 0;
      setSummary({
        mainAmount,
        supplementTotal,
        variationNet,
        deductionTotal,
        performanceTotal,
        settlementAmount: mainAmount + supplementTotal + variationNet - deductionTotal,
      });
    }
    if (contractId) void load();
  }, [contractId, tables.contracts, tables.deductions, tables.performances, tables.supplements, tables.variations]);

  if (!summary) return null;

  return (
    <div className="bg-gray-50/50 rounded-lg p-4 space-y-2">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="text-gray-500">
          主合同金额: <span className="text-gray-800">{summary.mainAmount}万元</span>
        </div>
        <div className="text-gray-500">
          补充协议总额: <span className="text-gray-800">{summary.supplementTotal}万元</span>
        </div>
        <div className="text-gray-500">
          变更签证净额: <span className="text-gray-800">{summary.variationNet}万元</span>
        </div>
        <div className="text-gray-500">
          扣款总额: <span className="text-red-400">{summary.deductionTotal}万元</span>
        </div>
        <div className="text-gray-500">
          已履约金额: <span className="text-gray-800">{summary.performanceTotal}万元</span>
        </div>
        <div className="text-gray-500 font-bold">
          结算金额: <span className="text-green-400">{summary.settlementAmount}万元</span>
        </div>
      </div>
    </div>
  );
}
