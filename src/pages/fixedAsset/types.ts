export interface FixedAsset {
  id: string;
  asset_no: string;
  name: string;
  specification: string | null;
  model: string | null;
  category_id: string;
  category_name?: string;
  brand: string | null;
  purchase_date: string;
  purchase_price: number;
  depreciation_method: 'straight_line' | 'declining_balance' | 'sum_of_years';
  useful_life: number;
  salvage_value: number;
  location: string | null;
  status: 'in_stock' | 'in_use' | 'scrapped' | 'transferred';
  current_project_id: string | null;
  current_project_name?: string;
  remark: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetCategory {
  id: string;
  name: string;
  code: string;
  parent_id: string | null;
  sort_order: number;
  remark: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetAllocation {
  id: string;
  asset_id: string;
  asset_name?: string;
  project_id: string;
  project_name?: string;
  allocate_date: string;
  return_date: string | null;
  status: 'allocated' | 'returned';
  remark: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetTransfer {
  id: string;
  asset_id: string;
  asset_name?: string;
  from_project_id: string;
  from_project_name?: string;
  to_project_id: string;
  to_project_name?: string;
  transfer_date: string;
  remark: string | null;
  created_at: string;
}

export interface AssetScrap {
  id: string;
  asset_id: string;
  asset_name?: string;
  scrap_date: string;
  reason: string;
  disposal_method: string;
  remark: string | null;
  created_at: string;
}

export interface FixedAssetFormData {
  asset_no: string;
  name: string;
  specification?: string;
  model?: string;
  category_id: string;
  brand?: string;
  purchase_date: string;
  purchase_price: number;
  depreciation_method: 'straight_line' | 'declining_balance' | 'sum_of_years';
  useful_life: number;
  salvage_value: number;
  location?: string;
  remark?: string;
}

export interface AllocationFormData {
  asset_id: string;
  project_id: string;
  allocate_date: string;
  remark?: string;
}

export interface TransferFormData {
  asset_id: string;
  from_project_id: string;
  to_project_id: string;
  transfer_date: string;
  remark?: string;
}

export interface ScrapFormData {
  asset_id: string;
  scrap_date: string;
  reason: string;
  disposal_method: string;
  remark?: string;
}

export interface AssetFilterParams {
  keyword?: string;
  category_id?: string;
  status?: string;
  project_id?: string;
  page?: number;
  page_size?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
}
