
export interface Machine {
  id: string;
  code: string;
  name: string;
  specification: string | null;
  category_id: string;
  category_name?: string;
  model: string | null;
  brand: string | null;
  purchase_date: string;
  purchase_price: number;
  rental_mode: 'own' | 'rental';
  unit: string;
  status: 'available' | 'in_use' | 'maintenance' | 'out_of_service';
  location: string | null;
  current_project_id: string | null;
  current_project_name?: string;
  remark: string | null;
  created_at: string;
  updated_at: string;
}

export interface MachineCategory {
  id: string;
  name: string;
  code: string;
  parent_id: string | null;
  sort_order: number;
  remark: string | null;
  created_at: string;
  updated_at: string;
}

export interface MachineShift {
  id: string;
  project_id: string;
  project_name?: string;
  machine_id: string;
  machine_name?: string;
  machine_code?: string;
  rental_contract_id: string | null;
  rental_contract_no?: string;
  record_date: string;
  shift_count: number;
  start_time: string | null;
  end_time: string | null;
  cost_per_shift: number | null;
  total_cost: number;
  operator: string | null;
  work_content: string | null;
  images: string[];
  status: 'draft' | 'pending' | 'confirmed' | 'rejected';
  approval_id: string | null;
  is_settled: boolean;
  remark: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MachineFormData {
  code: string;
  name: string;
  specification?: string;
  category_id: string;
  model?: string;
  brand?: string;
  purchase_date: string;
  purchase_price: number;
  rental_mode: 'own' | 'rental';
  unit: string;
  location?: string;
  remark?: string;
}

export interface ShiftFormData {
  project_id: string;
  machine_id: string;
  rental_contract_id?: string;
  record_date: string;
  shift_count: number;
  start_time?: string;
  end_time?: string;
  cost_per_shift?: number;
  operator?: string;
  work_content?: string;
  images: string[];
  remark?: string;
}

export interface MachineFilterParams {
  keyword?: string;
  category_id?: string;
  status?: string;
  project_id?: string;
  page?: number;
  page_size?: number;
}

export interface ShiftFilterParams {
  keyword?: string;
  project_id?: string;
  machine_id?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface MachineStatistics {
  summary: {
    total_shifts: number;
    total_cost: number;
    machine_count: number;
  };
  by_machine?: Array<{
    machine_id: string;
    machine_name?: string;
    machine_code?: string;
    total_shifts: number;
    total_cost: number;
  }>;
  by_project?: Array<{
    project_id: string;
    project_name?: string;
    total_shifts: number;
    total_cost: number;
  }>;
  by_date?: Array<{
    record_date: string;
    total_shifts: number;
    total_cost: number;
  }>;
}

export interface RentalContract {
  id: string;
  contract_no: string;
  project_id: string;
  machine_id: string;
  shift_price: number;
  total_budget_shifts: number;
  used_shifts: number;
  used_amount: number;
  status: 'active' | 'completed' | 'terminated';
  start_date: string;
  end_date: string | null;
}
