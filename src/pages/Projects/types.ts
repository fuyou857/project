export interface Project {
  id?: string;
  code?: string | null;
  name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string;
  created_at?: string | null;
  party_a_id?: string | null;
  signatory_id?: string | null;
  company_id?: string | null;
  remark?: string | null;
}

export interface PartyA {
  id: string;
  name: string;
}

export interface Signatory {
  id: string;
  unit_name: string;
}

export interface ProjectFormData {
  id?: string;
  project_code: string | null;
  name: string | null;
  start_date: string | null;
  end_date: string | null;
  party_a_id: string | null;
  status: string | null;
  /** 项目成员（系统用户 id） */
  member_user_ids: string[];
}

export interface ProjectErrors {
  project_code?: string;
  name?: string;
  start_date?: string;
  end_date?: string;
  party_a_id?: string;
}

export const PROJECT_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  PAUSED: 'paused',
} as const;

export function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

export function getInitialForm(): ProjectFormData {
  return {
    project_code: null,
    name: null,
    start_date: getToday(),
    end_date: null,
    party_a_id: null,
    status: 'active',
    member_user_ids: [],
  };
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case PROJECT_STATUS.ACTIVE:
      return '进行中';
    case PROJECT_STATUS.COMPLETED:
      return '已完工';
    case PROJECT_STATUS.PAUSED:
      return '已暂停';
    default:
      return status;
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case PROJECT_STATUS.ACTIVE:
      return 'bg-blue-500/20 text-blue-400';
    case PROJECT_STATUS.COMPLETED:
      return 'bg-green-500/20 text-green-400';
    case PROJECT_STATUS.PAUSED:
      return 'bg-yellow-500/20 text-yellow-400';
    default:
      return 'bg-slate-500/20 text-slate-400';
  }
}
