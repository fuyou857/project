import type { InvoiceAttachmentItem } from '../types';

export type CostInvoiceRow = {
  id: string;
  project_id: string;
  supplier_id: string | null;
  invoice_type: string;
  invoice_number: string;
  invoice_amount: number;
  tax_amount: number | null;
  deductible_tax: number | null;
  invoice_date: string | null;
  paid_amount: number | null;
  remaining_amount: number | null;
  is_paid: boolean | null;
  seller_name: string | null;
  expense_contract_id: string | null;
  created_by: string | null;
  attachment_url: string | null;
  attachment_urls: InvoiceAttachmentItem[] | null;
  invoice_code: string | null;
  amount_excluding_tax: number | null;
  tax_rate: number | null;
  goods_name: string | null;
  seller_tax_id: string | null;
  remark: string | null;
  ocr_invoice_type_label: string | null;
  ocr_status: string | null;
  payment_record_id: string | null;
  association_status: 'unassociated' | 'associated_contract' | 'no_contract_payment' | null;
  no_contract_payment_remark: string | null;
  buyer_name: string | null;
  buyer_tax_id: string | null;
  created_at: string;
};

export type CostInvoiceListFilters = {
  projectKeyword: string;
  projectId: string;
  sellerKeyword: string;
  invoiceType: string;
  invoiceNumber: string;
  expenseContractId: string;
  associationStatus: string;
  createdBy: string;
};

export const emptyCostInvoiceFilters = (): CostInvoiceListFilters => ({
  projectKeyword: '',
  projectId: '',
  sellerKeyword: '',
  invoiceType: '',
  invoiceNumber: '',
  expenseContractId: '',
  associationStatus: '',
  createdBy: '',
});

export type SortField =
  | 'invoice_date'
  | 'invoice_number'
  | 'invoice_amount'
  | 'tax_amount'
  | 'paid_amount'
  | 'remaining_amount'
  | 'association_status'
  | 'created_at'
  | 'project_name'
  | 'seller_name';

export type SortState = { field: SortField | null; direction: 'asc' | 'desc' };

export type PaymentHistoryItem = {
  id: string;
  amount: number;
  transfer_date: string | null;
  payment_type: string | null;
  attachment_url: string | null;
  payment_voucher_url?: string | null;
  status: string;
};

export type EnrichedCostInvoiceRow = CostInvoiceRow & {
  rowIndex: number;
  project_name: string;
  seller_display: string;
  expense_contract_label: string;
  created_by_name: string;
  payments: PaymentHistoryItem[];
};
