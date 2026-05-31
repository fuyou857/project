import { supabase } from '../supabase/client';
import { APPROVAL_SOURCE_TYPE_LABELS, APPROVER_ROLE_TO_ROLE_CODES } from '../constants/approvalRoles';
import { resolveApprovalSteps } from './approvalStepResolve';
import type { ApprovalFlowStep } from './approvalWorkflowLogic';

export type ApprovalUserOption = {
  userId: string;
  name: string;
  isDefault?: boolean;
};

export type ApprovalStepPlanRow = {
  stepOrder: number;
  stepName: string;
  role: string;
  approverId: string;
  approverName: string;
  isFixed: boolean;
  candidates: ApprovalUserOption[];
};

export type SubmitApprovalPlan = {
  sourceType: string;
  sourceName: string;
  steps: ApprovalStepPlanRow[];
};

export type SubmitApprovalOpenConfig = {
  sourceType: string;
  sourceId: string;
  sourceName: string;
  projectId?: string | null;
  summaryRows?: { label: string; value: string }[];
};

type UserRow = {
  id: string;
  real_name?: string | null;
  username?: string | null;
  role_ids?: string[] | null;
};

function displayName(u: UserRow): string {
  return (u.real_name || u.username || u.id).trim();
}

async function loadUsersByRoleCode(approverRole: string): Promise<UserRow[]> {
  const codes = APPROVER_ROLE_TO_ROLE_CODES[approverRole] || [approverRole];
  const { data: roles } = await supabase.from('roles').select('id, code').in('code', codes);
  const roleIds = (roles || []).map((r) => r.id);
  if (roleIds.length === 0) {
    const { data: legacy } = await supabase
      .from('users')
      .select('id, real_name, username, role_ids')
      .eq('role', approverRole);
    return legacy || [];
  }
  const { data: users } = await supabase.from('users').select('id, real_name, username, role_ids');
  return (users || []).filter((u) => (u.role_ids || []).some((rid: string) => roleIds.includes(rid)));
}

async function loadProjectManagerName(projectId?: string | null): Promise<string | null> {
  if (!projectId) return null;
  const { data } = await supabase
    .from('projects')
    .select('project_manager')
    .eq('id', projectId)
    .maybeSingle();
  const name = (data?.project_manager as string | undefined)?.trim();
  return name || null;
}

function pickByName(pool: UserRow[], name: string | null, excludeId?: string): UserRow | null {
  if (!name) return null;
  const n = name.trim();
  const hit = pool.find(
    (u) =>
      u.id !== excludeId &&
      (displayName(u) === n || (u.username && u.username === n)),
  );
  return hit || null;
}

function pickFirst(pool: UserRow[], excludeId?: string): UserRow | null {
  const list = pool.filter((u) => u.id !== excludeId);
  return list[0] || null;
}

async function defaultUserForRole(
  approverRole: string,
  projectId: string | null | undefined,
  initiatorId: string,
): Promise<UserRow | null> {
  if (approverRole === 'initiator') {
    const { data } = await supabase
      .from('users')
      .select('id, real_name, username, role_ids')
      .eq('id', initiatorId)
      .maybeSingle();
    return data || null;
  }

  const pool = await loadUsersByRoleCode(approverRole);
  if (pool.length === 0) return null;

  if (approverRole === 'manager') {
    const pmName = await loadProjectManagerName(projectId);
    const byProject = pickByName(pool, pmName, initiatorId);
    if (byProject) return byProject;
  }

  return pickFirst(pool, initiatorId);
}

/** 获取发起审批计划（默认审批人 + 各步候选人） */
export async function buildSubmitApprovalPlan(
  sourceType: string,
  sourceId: string,
  sourceName: string,
  initiatorId: string,
  projectId?: string | null,
): Promise<SubmitApprovalPlan | null> {
  const steps = await resolveApprovalSteps(sourceType, sourceId);
  if (steps.length === 0) return null;

  const rows: ApprovalStepPlanRow[] = [];
  for (const step of steps) {
    const isFixed = step.approver_role === 'initiator';
    const pool = isFixed
      ? [
          (await supabase
            .from('users')
            .select('id, real_name, username')
            .eq('id', initiatorId)
            .single()).data,
        ].filter(Boolean) as UserRow[]
      : await loadUsersByRoleCode(step.approver_role);

    const defaultUser =
      (isFixed ? pool[0] : await defaultUserForRole(step.approver_role, projectId, initiatorId)) ||
      pickFirst(pool, initiatorId);

    if (!defaultUser) {
      throw new Error(`未找到「${step.step_name}」的可用审批人，请先在用户管理中分配对应角色`);
    }

    const candidates: ApprovalUserOption[] = pool.map((u) => ({
      userId: u.id,
      name: displayName(u),
      isDefault: u.id === defaultUser.id,
    }));

    rows.push({
      stepOrder: step.step_order,
      stepName: step.step_name,
      role: step.approver_role,
      approverId: defaultUser.id,
      approverName: displayName(defaultUser),
      isFixed,
      candidates,
    });
  }

  return {
    sourceType,
    sourceName,
    steps: rows,
  };
}

/** 按角色获取可选审批人（下拉） */
export async function listUsersForApproverRole(
  approverRole: string,
  projectId?: string | null,
  initiatorId?: string,
): Promise<ApprovalUserOption[]> {
  const pool = await loadUsersByRoleCode(approverRole);
  const pmName = approverRole === 'manager' ? await loadProjectManagerName(projectId) : null;
  const defaultUser = await defaultUserForRole(approverRole, projectId, initiatorId || '');
  return pool.map((u) => ({
    userId: u.id,
    name: displayName(u),
    isDefault:
      u.id === defaultUser?.id ||
      (pmName ? displayName(u) === pmName : false),
  }));
}

export function getApprovalSourceLabel(sourceType: string): string {
  return APPROVAL_SOURCE_TYPE_LABELS[sourceType] || sourceType;
}

/** 从业务表解析 project_id（供发起审批用） */
export async function resolveProjectIdForApprovalSource(
  sourceType: string,
  sourceId: string,
): Promise<string | null> {
  const map: Record<string, { table: string; projectCol: string; viaMain?: string }> = {
    income_contract: { table: 'income_contracts', projectCol: 'project_id' },
    expense_contract: { table: 'expense_contracts', projectCol: 'project_id' },
    income_variation: { table: 'income_variations', projectCol: 'main_contract_id', viaMain: 'income_contracts' },
    expense_variation: { table: 'expense_variations', projectCol: 'main_contract_id', viaMain: 'expense_contracts' },
    income_supplement: { table: 'income_supplements', projectCol: 'main_contract_id', viaMain: 'income_contracts' },
    expense_supplement: { table: 'expense_supplements', projectCol: 'main_contract_id', viaMain: 'expense_contracts' },
    income_deduction: { table: 'income_deductions', projectCol: 'main_contract_id', viaMain: 'income_contracts' },
    expense_deduction: { table: 'expense_deductions', projectCol: 'main_contract_id', viaMain: 'expense_contracts' },
    income_output: { table: 'income_output_confirmations', projectCol: 'main_contract_id', viaMain: 'income_contracts' },
    income_settlement: { table: 'income_settlements', projectCol: 'main_contract_id', viaMain: 'income_contracts' },
    expense_settlement: { table: 'expense_settlements', projectCol: 'main_contract_id', viaMain: 'expense_contracts' },
    expense_performance: { table: 'expense_performances', projectCol: 'main_contract_id', viaMain: 'expense_contracts' },
    machine_shift: { table: 'machine_shift_records', projectCol: 'project_id' },
  };
  const cfg = map[sourceType];
  if (!cfg) return null;

  const { data: row } = await supabase.from(cfg.table).select(cfg.projectCol).eq('id', sourceId).maybeSingle();
  if (!row) return null;
  const fk = row[cfg.projectCol as keyof typeof row] as string | null | undefined;
  if (!fk) return null;
  if (!cfg.viaMain) return fk;

  const mainCol = cfg.projectCol === 'main_contract_id' ? 'project_id' : cfg.projectCol;
  const { data: main } = await supabase.from(cfg.viaMain).select(mainCol).eq('id', fk).maybeSingle();
  return (main?.[mainCol as keyof typeof main] as string | undefined) || null;
}

