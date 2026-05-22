-- cost_invoices 付款跟踪字段（与 migrations/20260425_060330_extend_finance_tables.sql 一致，可重复执行）
ALTER TABLE public.cost_invoices ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.cost_invoices ADD COLUMN IF NOT EXISTS remaining_amount NUMERIC(15, 2) DEFAULT 0;

COMMENT ON COLUMN public.cost_invoices.paid_amount IS '已付金额';
COMMENT ON COLUMN public.cost_invoices.remaining_amount IS '尚欠金额（可与 invoice_amount - paid_amount 同步）';

-- 回填历史数据
UPDATE public.cost_invoices
SET
  paid_amount = COALESCE(paid_amount, CASE WHEN is_paid THEN invoice_amount ELSE 0 END),
  remaining_amount = COALESCE(
    remaining_amount,
    GREATEST(0, COALESCE(invoice_amount, 0) - CASE WHEN is_paid THEN COALESCE(invoice_amount, 0) ELSE 0 END)
  )
WHERE paid_amount IS NULL OR remaining_amount IS NULL;
