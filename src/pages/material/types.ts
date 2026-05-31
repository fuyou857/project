export interface MaterialCategory {
  id: string;
  code: string | null;
  name: string;
  parent_id: string | null;
  sort_order: number;
  created_at: string;
  children?: MaterialCategory[];
}

export interface Material {
  id: string;
  code: string;
  name: string;
  specification: string | null;
  unit: string;
  category_id: string | null;
  category_name?: string;
  default_price: number | null;
  min_stock: number;
  current_stock: number;
  status: 'active' | 'inactive' | 'discontinued';
  remark: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaterialFormData {
  code: string;
  name: string;
  specification?: string;
  unit: string;
  category_id?: string;
  default_price?: number;
  min_stock?: number;
  status?: 'active' | 'inactive' | 'discontinued';
  remark?: string;
}

export interface Warehouse {
  id: string;
  project_id: string | null;
  code: string | null;
  name: string;
  location: string | null;
  manager_id: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface MaterialStock {
  id: string;
  project_id: string;
  warehouse_id: string | null;
  material_id: string;
  material_name?: string;
  material_code?: string;
  stock_quantity: number;
  avg_price: number;
  total_amount: number;
  last_in_date: string | null;
  last_out_date: string | null;
  updated_at: string;
}

export interface MaterialStockSummary {
  total_variety: number;
  total_quantity: number;
  total_amount: number;
  low_stock_count: number;
}

export interface MaterialFilterParams {
  keyword?: string;
  category_id?: string;
  status?: string;
  page?: number;
  page_size?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
}
