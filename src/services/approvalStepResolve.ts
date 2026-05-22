import { supabase } from '../supabase/client';
import type { ApprovalFlowStep } from './approvalWorkflowLogic';
import {
  filterStepsByAmountRules,
  type AmountConditionRule,
} from './approvalConditionLogic';

export type ResolvedApprovalStep = ApprovalFlowStep & {
  sign_type?: string | null;
};

const SOURCE_AMOUNT_FIELD: Record<
  string,
  { table: string; columns: string[] }
> = {
  income_variation: { table: 'income_variations', columns: ['variation_amount', 'change_amount'] },
  expense_variation: { table: 'expense_variations', columns: ['variation_amount', 'change_amount'] },
};

export async function loadRawApprovalSteps(sourceType: string): Promise<ResolvedApprovalStep[]> {
  const { data, error } = await supabase
    .from('approval_steps')
    .select('step_order, step_name, approver_role, approver_id, sign_type')
    .eq('source_type', sourceType)
    .order('step_order', { ascending: true });
  if (error) throw error;
  return (data || []) as ResolvedApprovalStep[];
}

export async function loadAmountConditionRules(sourceType: string): Promise<AmountConditionRule[]> {
  const { data, error } = await supabase
    .from('approval_conditions')
    .select('source_type, field_name, operator, threshold_value, max_step_order, is_active')
    .eq('source_type', sourceType)
    .eq('is_active', true);
  if (error) {
    console.warn('[approval_conditions]', error.message);
    return [];
  }
  return (data || []) as AmountConditionRule[];
}

export async function fetchSourceAmount(
  sourceType: string,
  sourceId: string,
): Promise<number | null> {
  const cfg = SOURCE_AMOUNT_FIELD[sourceType];
  if (!cfg) return null;
  const { data, error } = await supabase
    .from(cfg.table)
    .select(cfg.columns.join(','))
    .eq('id', sourceId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  for (const col of cfg.columns) {
    const v = row[col];
    if (v != null && v !== '') return Number(v);
  }
  return null;
}

/** 按业务单金额等条件解析后的有效审批步骤 */
export async function resolveApprovalSteps(
  sourceType: string,
  sourceId: string,
): Promise<ResolvedApprovalStep[]> {
  const raw = await loadRawApprovalSteps(sourceType);
  if (raw.length === 0) return [];
  const rules = await loadAmountConditionRules(sourceType);
  if (rules.length === 0) return raw;
  const amount = await fetchSourceAmount(sourceType, sourceId);
  return filterStepsByAmountRules(raw, amount, rules, sourceType) as ResolvedApprovalStep[];
}

export function signTypeLabel(signType?: string | null): string {
  if (signType === 'countersign') return '会签';
  if (signType === 'orsign') return '或签';
  return '';
}
