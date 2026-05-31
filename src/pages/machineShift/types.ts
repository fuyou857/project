/**
 * 机械台班记录类型定义
 */

export interface MachineShiftRecord {
  id: string;
  project_id: string;
  machine_id: string;
  rental_contract_id?: string;
  record_date: string;
  shift_count: number;
  start_time?: string;
  end_time?: string;
  cost_per_shift?: number;
  total_cost: number;  // 改为必填
  operator?: string;
  remark?: string;
  images: string[];
  status: 'draft' | 'pending' | 'confirmed' | 'rejected';
  approval_id?: string;
  is_settled: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  
  // 关联数据
  machines?: {
    name: string;
    code: string;
    unit: string;
  };
  projects?: {
    name: string;
  };
  expense_contracts?: {
    contract_no: string;
    shift_price: number;
  };
}

export interface MachineShiftFormData {
  project_id: string;
  machine_id: string;
  rental_contract_id?: string;
  record_date: string;
  shift_count: number;
  start_time?: string;
  end_time?: string;
  cost_per_shift?: number;
  operator?: string;
  remark?: string;
  images: string[];
}

export interface MachineShiftFilter {
  projectId?: string;
  machineId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface MachineShiftStatistics {
  month: {
    total_shifts: number;
    total_cost: number;
  };
  total: {
    total_shifts: number;
    total_cost: number;
  };
  byMachine?: Array<{
    machine_id: string;
    machines: {
      name: string;
      code: string;
      unit: string;
    };
    total_shifts: number;
    total_cost: number;
  }>;
}

export interface MachineStatistics {
  summary: {
    total_shifts: number;
    total_cost: number;
    record_count: number;
  };
  byProject: Array<{
    project_id: string;
    projects: {
      name: string;
    };
    total_shifts: number;
    total_cost: number;
  }>;
}

export interface TimeStatistics {
  details: Array<{
    record_date: string;
    project_id: string;
    projects: {
      name: string;
    };
    total_shifts: number;
    total_cost: number;
    record_count: number;
  }>;
  summary: {
    total_shifts: number;
    total_cost: number;
    total_records: number;
  };
}

export interface RentalContract {
  id: string;
  contract_no: string;
  contract_name: string;
  shift_price?: number;
  total_budget_shifts?: number;
  used_shifts: number;
  used_amount: number;
  status: string;
}

export interface DrillDownRecord {
  id: string;
  project_name?: string;
  machine_name?: string;
  machine_code?: string;
  record_date: string;
  shift_count: number;
  cost_per_shift?: number;
  total_cost: number;
  status: string;
  operator?: string;
}
