export interface MaterialIssue {
  id: string;
  issue_no: string;
  project_id: string;
  project_name?: string;
  warehouse_id: string;
  warehouse_name?: string;
  issue_date: string;
  total_amount: number;
  status: 'draft' | 'confirmed' | 'cancelled';
  cost_center: string | null;
  remark: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaterialIssueItem {
  id: string;
  issue_id: string;
  material_id: string;
  material_name?: string;
  material_code?: string;
  specification: string | null;
  unit: string;
  quantity: number;
  price: number;
  tax_rate: number;
  remark: string | null;
  created_at: string;
}

export interface IssueFormData {
  issue_no: string;
  project_id: string;
  warehouse_id: string;
  issue_date: string;
  cost_center?: string;
  remark?: string;
  items: IssueItemForm[];
}

export interface IssueItemForm {
  id?: string;
  material_id: string;
  material_name?: string;
  specification?: string;
  unit: string;
  quantity: number;
  price: number;
  tax_rate: number;
  remark?: string;
}

export interface IssueFilterParams {
  keyword?: string;
  project_id?: string;
  warehouse_id?: string;
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
