export interface MaterialInbound {
  id: string;
  inbound_no: string;
  order_id: string | null;
  order_no?: string;
  project_id: string;
  warehouse_id: string;
  warehouse_name?: string;
  supplier_id: string;
  supplier_name?: string;
  inbound_date: string;
  total_amount: number;
  status: 'draft' | 'confirmed' | 'cancelled';
  remark: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaterialInboundItem {
  id: string;
  inbound_id: string;
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

export interface InboundFormData {
  inbound_no: string;
  order_id?: string;
  project_id: string;
  warehouse_id: string;
  supplier_id: string;
  inbound_date: string;
  remark?: string;
  items: InboundItemForm[];
}

export interface InboundItemForm {
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

export interface InboundFilterParams {
  keyword?: string;
  project_id?: string;
  warehouse_id?: string;
  supplier_id?: string;
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
