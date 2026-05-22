import { supabase } from '../supabase/client';

export type SupplementContractSide = 'income' | 'expense';

const CONTRACT_TABLE: Record<SupplementContractSide, string> = {
  income: 'income_contracts',
  expense: 'expense_contracts',
};

async function adjustMainContractAmount(
  side: SupplementContractSide,
  contractId: string,
  delta: number,
): Promise<void> {
  if (!contractId || !delta) return;
  const table = CONTRACT_TABLE[side];
  const { data } = await supabase.from(table).select('contract_amount').eq('id', contractId).maybeSingle();
  if (!data) return;
  const next = Number(data.contract_amount || 0) + delta;
  await supabase.from(table).update({ contract_amount: next }).eq('id', contractId);
}

/** 补充协议新建/编辑时同步主合同金额（与既有「新建累加」逻辑一致，并修复编辑未回调） */
export async function applySupplementAmountChange(
  side: SupplementContractSide,
  opts: {
    isCreate: boolean;
    mainContractId: string;
    supplementAmount: number;
    prevMainContractId?: string;
    prevSupplementAmount?: number;
  },
): Promise<void> {
  const { isCreate, mainContractId, supplementAmount } = opts;
  const amount = Number(supplementAmount) || 0;
  if (!amount) return;

  if (isCreate) {
    if (mainContractId) await adjustMainContractAmount(side, mainContractId, amount);
    return;
  }

  const prevMain = opts.prevMainContractId ?? mainContractId;
  const prevAmt = Number(opts.prevSupplementAmount) || 0;

  if (prevMain === mainContractId) {
    const delta = amount - prevAmt;
    if (delta !== 0 && mainContractId) await adjustMainContractAmount(side, mainContractId, delta);
    return;
  }

  if (prevMain && prevAmt) await adjustMainContractAmount(side, prevMain, -prevAmt);
  if (mainContractId) await adjustMainContractAmount(side, mainContractId, amount);
}

export function supplementFormSnapshot(item: {
  main_contract_id?: string;
  supplement_amount?: number;
}): { _prev_main_contract_id: string; _prev_supplement_amount: number } {
  return {
    _prev_main_contract_id: item.main_contract_id || '',
    _prev_supplement_amount: Number(item.supplement_amount) || 0,
  };
}

export function stripSupplementFormMeta<T extends Record<string, unknown>>(form: T): Omit<T, '_prev_main_contract_id' | '_prev_supplement_amount'> {
  const { _prev_main_contract_id: _a, _prev_supplement_amount: _b, ...rest } = form;
  return rest;
}
