export interface PurchaseOrder {
  id: string;
  order_no: string;
  contract_id: string | null;
  project_id: string;
  supplier_id: string;
  supplier_name?: string;
  order_date: string;
  total_amount: number;
  paid_amount: number;
  status: 'draft' | 'submitted' | 'approved' | 'partially_received' | 'received' | 'cancelled';
  delivery_date: string | null;
  payment_terms: string | null;
  remark: string | null;
  created_by: string | null;
  approval_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItem {
  id: string;
  order_id: string;
  material_id: string;
  material_name?: string;
  material_code?: string;
  specification?: string;
  quantity: number;
  unit: string;
  price: number;
  tax_rate: number;
  amount: number;
  total_amount: number;
  received_quantity: number;
  delivered_quantity: number;
  remark: string | null;
  created_at: string;
}

export interface PurchaseOrderFormData {
  order_no: string;
  contract_id?: string;
  project_id: string;
  supplier_id: string;
  order_date: string;
  delivery_date?: string;
  payment_terms?: string;
  remark?: string;
  items: PurchaseOrderItemForm[];
}

export interface PurchaseOrderItemForm {
  id?: string;
  material_id: string;
  material_name?: string;
  specification?: string;
  quantity: number;
  unit: string;
  price: number;
  tax_rate: number;
  remark?: string;
}

export interface PurchaseOrderFilterParams {
  keyword?: string;
  project_id?: string;
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
