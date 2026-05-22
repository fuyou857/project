import { supabase } from '../supabase/client';
import { clearSlaCache } from './approvalPhase4Service';
import type { AmountConditionRule } from './approvalConditionLogic';

export type ApprovalStepRow = {
  id: string;
  source_type: string;
  step_order: number;
  step_name: string;
  approver_role: string;
  sign_type: string | null;
};

export type ApprovalConditionRow = AmountConditionRule & {
  id: string;
  description?: string | null;
};

export type ApprovalSlaRow = {
  id: string;
  source_type: string;
  step_order: number;
  sla_hours: number;
  remind_before_hours: number;
};

export async function listAllApprovalSteps(): Promise<ApprovalStepRow[]> {
  const { data, error } = await supabase
    .from('approval_steps')
    .select('id, source_type, step_order, step_name, approver_role, sign_type')
    .order('source_type')
    .order('step_order', { ascending: true });
  if (error) throw error;
  return (data || []) as ApprovalStepRow[];
}

export async function updateApprovalStepSignType(
  stepId: string,
  signType: 'normal' | 'orsign' | 'countersign',
) {
  const { error } = await supabase
    .from('approval_steps')
    .update({ sign_type: signType })
    .eq('id', stepId);
  if (error) throw error;
}

export async function listApprovalConditions(): Promise<ApprovalConditionRow[]> {
  const { data, error } = await supabase
    .from('approval_conditions')
    .select('*')
    .order('source_type')
    .order('threshold_value', { ascending: true });
  if (error) throw error;
  return (data || []) as ApprovalConditionRow[];
}

export async function saveApprovalCondition(input: {
  id?: string;
  source_type: string;
  field_name: string;
  operator: 'lt' | 'lte' | 'gte' | 'gt';
  threshold_value: number;
  max_step_order: number;
  description?: string;
  is_active?: boolean;
}) {
  const row = {
    source_type: input.source_type,
    field_name: input.field_name,
    operator: input.operator,
    threshold_value: input.threshold_value,
    max_step_order: input.max_step_order,
    description: input.description || null,
    is_active: input.is_active ?? true,
  };
  if (input.id) {
    const { error } = await supabase.from('approval_conditions').update(row).eq('id', input.id);
    if (error) throw error;
    return input.id;
  }
  const { data, error } = await supabase
    .from('approval_conditions')
    .insert(row)
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteApprovalCondition(id: string) {
  const { error } = await supabase.from('approval_conditions').delete().eq('id', id);
  if (error) throw error;
}

export async function listApprovalSlaConfig(): Promise<ApprovalSlaRow[]> {
  const { data, error } = await supabase
    .from('approval_sla_config')
    .select('*')
    .order('source_type')
    .order('step_order', { ascending: true });
  if (error) throw error;
  return (data || []) as ApprovalSlaRow[];
}

export async function updateApprovalSla(
  id: string,
  slaHours: number,
  remindBeforeHours: number,
) {
  const { error } = await supabase
    .from('approval_sla_config')
    .update({ sla_hours: slaHours, remind_before_hours: remindBeforeHours })
    .eq('id', id);
  if (error) throw error;
  clearSlaCache();
}
