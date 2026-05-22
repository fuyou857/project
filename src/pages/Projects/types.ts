export interface Project {
  id?: string;
  project_code?: string | null;
  name?: string | null;
  bid_amount?: number | null;
  duration?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  project_manager?: string | null;
  phone?: string | null;
  status?: string;
  created_at?: string | null;
  party_a_id?: string | null;
  signatory_id?: string | null;
  company_id?: string | null;
  tender_method?: string | null;
  management_fee_rate?: number | null;
  cost_ticket_rate?: number | null;
  management_fee_amount?: number | null;
  tax_rate?: number | null;
  manager_phone?: string | null;
  manager_id_card_url?: string | null;
  party_a_contact?: string | null;
  stamp_person?: string | null;
  stamp_person_phone?: string | null;
  stamp_authorization_url?: string | null;
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
  bid_amount: number | null | undefined;
  duration: number | null;
  start_date: string | null;
  end_date: string | null;
  tender_method: string | null;
  management_fee_rate: number | null | undefined;
  cost_ticket_rate: number | null | undefined;
  management_fee_amount: number | null | undefined;
  tax_rate: number | null | undefined;
  project_manager: string | null;
  manager_phone: string | null;
  manager_id_card_url: string | null;
  party_a_id: string | null;
  party_a_contact: string | null;
  stamp_person: string | null;
  stamp_person_phone: string | null;
  stamp_authorization_url: string | null;
  status: string | null;
  /** 项目成员（系统用户 id） */
  member_user_ids: string[];
}

export interface ProjectErrors {
  project_code?: string;
  name?: string;
  bid_amount?: string;
  duration?: string;
  start_date?: string;
  end_date?: string;
  tender_method?: string;
  tax_rate?: string;
  project_manager?: string;
  manager_phone?: string;
  manager_id_card_url?: string;
  party_a_id?: string;
  stamp_person?: string;
  stamp_person_phone?: string;
  stamp_authorization_url?: string;
}

export const PROJECT_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
} as const;

export const TENDER_METHOD = {
  PUBLIC_TENDER: 'public_tender',
  DIRECT_CONTRACT: 'direct_contract',
} as const;

export function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

export function calcEndDate(start: string, days: number): string {
  if (!start || !days) return '';
  const d = new Date(start);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function calcManagementFee(bidAmount: number, feeRate: number): number {
  if (!bidAmount || !feeRate) return 0;
  return bidAmount * feeRate / 100;
}

export function getInitialForm(): ProjectFormData {
  return {
    project_code: null,
    name: null,
    bid_amount: undefined,
    duration: null,
    start_date: getToday(),
    end_date: null,
    tender_method: 'public_tender',
    management_fee_rate: undefined,
    cost_ticket_rate: undefined,
    management_fee_amount: undefined,
    tax_rate: undefined,
    project_manager: null,
    manager_phone: null,
    manager_id_card_url: null,
    party_a_id: null,
    party_a_contact: null,
    stamp_person: null,
    stamp_person_phone: null,
    stamp_authorization_url: null,
    status: 'not_started',
    member_user_ids: [],
  };
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case PROJECT_STATUS.NOT_STARTED:
      return '未开工';
    case PROJECT_STATUS.IN_PROGRESS:
      return '进行中';
    case PROJECT_STATUS.COMPLETED:
      return '已完工';
    default:
      return status;
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case PROJECT_STATUS.NOT_STARTED:
      return 'bg-yellow-500/20 text-yellow-400';
    case PROJECT_STATUS.IN_PROGRESS:
      return 'bg-blue-500/20 text-blue-400';
    case PROJECT_STATUS.COMPLETED:
      return 'bg-green-500/20 text-green-400';
    default:
      return 'bg-slate-500/20 text-slate-400';
  }
}
