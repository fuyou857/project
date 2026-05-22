export interface BaseEntity {
  id: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface Company extends BaseEntity {
  name: string;
  company_type: string;
  parent_id: string | null;
  credit_code?: string | null;
  contact_person?: string | null;
  contact_phone?: string | null;
  status?: string | null;
  remark?: string | null;
}

export interface Project extends BaseEntity {
  name: string;
  code?: string | null;
  company_id?: string | null;
  party_a_id?: string | null;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  total_amount?: number | null;
  paid_amount?: number | null;
  remark?: string | null;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface QueryFilters {
  [key: string]: string | number | boolean | string[] | undefined | null;
}

export interface ApiResponse<T> {
  data?: T;
  error?: unknown;
  count?: number;
}

export interface SelectOption {
  label: string;
  value: string | number;
}

export interface DateRange {
  startDate?: string;
  endDate?: string;
}

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

export type ReminderType = 'contract_expiry' | 'payment_due' | 'milestone';

/** 与 DB `reminder_status` 枚举及 contractReminderService 一致 */
export type ReminderStatus = 'pending' | 'processed' | 'resolved';

export type ReminderChannel = 'system' | 'wechat_work';

export type ReminderLevel = 'low' | 'medium' | 'high' | 'urgent';

export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export type MilestoneStatus = 'pending' | 'completed' | 'overdue';

export interface ContractReminderRule extends BaseEntity {
  contract_id: string;
  contract_type: 'income' | 'expense';
  reminder_type: ReminderType;
  related_node_id?: string | null;
  enabled: boolean;
  days_before: number;
  level: ReminderLevel;
  channels: ReminderChannel[];
  title_template?: string | null;
  content_template?: string | null;
  user_ids?: string[] | null;
}

export interface ContractPaymentNode extends BaseEntity {
  contract_id: string;
  contract_type: 'income' | 'expense';
  node_name: string;
  due_date: string;
  amount: number;
  paid_amount: number;
  status: PaymentStatus;
  reminder_days_before: number;
  reminder_level: ReminderLevel;
}

export interface ContractMilestone extends BaseEntity {
  contract_id: string;
  contract_type: 'income' | 'expense';
  milestone_type: string;
  description?: string | null;
  target_date: string;
  status: MilestoneStatus;
  reminder_days_before: number;
  reminder_level: ReminderLevel;
}

export interface ContractReminder extends BaseEntity {
  rule_id?: string | null;
  contract_id: string;
  contract_type: 'income' | 'expense';
  contract_name?: string | null;
  contract_code?: string | null;
  reminder_type: ReminderType;
  title: string;
  content?: string | null;
  related_node_id?: string | null;
  related_node_name?: string | null;
  target_date: string;
  days_remaining?: number | null;
  amount?: number | null;
  paid_amount?: number | null;
  status: ReminderStatus;
  notified_channels: ReminderChannel[];
  failed_channels: ReminderChannel[];
  user_ids: string[];
  processed_at?: string | null;
  resolved_at?: string | null;
}

export interface ReminderQueryParams extends PaginationParams {
  contractId?: string;
  contractType?: 'income' | 'expense';
  status?: ReminderStatus;
  reminderType?: ReminderType;
}
