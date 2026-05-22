/** 成本发票已付/尚欠（列缺失时按 invoice_amount 与 is_paid 推算） */
export function invoicePaidAmount(inv: { paid_amount?: number | null; is_paid?: boolean | null; invoice_amount?: number | null }): number {
  if (inv.paid_amount != null && !Number.isNaN(Number(inv.paid_amount))) {
    return Number(inv.paid_amount);
  }
  if (inv.is_paid) return Number(inv.invoice_amount) || 0;
  return 0;
}

export function invoiceRemainingAmount(inv: {
  remaining_amount?: number | null;
  paid_amount?: number | null;
  invoice_amount?: number | null;
  is_paid?: boolean | null;
}): number {
  const total = Number(inv.invoice_amount) || 0;
  const paid = invoicePaidAmount(inv);
  const computed = Math.max(0, total - paid);
  if (inv.remaining_amount != null && !Number.isNaN(Number(inv.remaining_amount))) {
    const stored = Number(inv.remaining_amount);
    if (!inv.is_paid && stored === 0 && computed > 0) return computed;
    return stored;
  }
  return computed;
}

/** 写入 cost_invoices 时的付款字段 */
export function costInvoicePaymentWritePayload(
  invoiceAmount: number,
  paidAmount: number,
): { paid_amount: number; remaining_amount: number; is_paid: boolean } {
  const remaining = Math.max(0, invoiceAmount - paidAmount);
  return {
    paid_amount: paidAmount,
    remaining_amount: remaining,
    is_paid: remaining <= 0,
  };
}
