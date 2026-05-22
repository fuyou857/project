-- 成本发票：OCR 扩展字段与多附件（可空，兼容旧数据）
ALTER TABLE public.cost_invoices
  ALTER COLUMN invoice_type TYPE VARCHAR(30);

ALTER TABLE public.cost_invoices ADD COLUMN IF NOT EXISTS invoice_code VARCHAR(32);
ALTER TABLE public.cost_invoices ADD COLUMN IF NOT EXISTS amount_excluding_tax NUMERIC(15, 2);
ALTER TABLE public.cost_invoices ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(8, 6);
ALTER TABLE public.cost_invoices ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(15, 2);
ALTER TABLE public.cost_invoices ADD COLUMN IF NOT EXISTS goods_name TEXT;
ALTER TABLE public.cost_invoices ADD COLUMN IF NOT EXISTS seller_name TEXT;
ALTER TABLE public.cost_invoices ADD COLUMN IF NOT EXISTS seller_tax_id VARCHAR(32);
ALTER TABLE public.cost_invoices ADD COLUMN IF NOT EXISTS remark TEXT;
ALTER TABLE public.cost_invoices ADD COLUMN IF NOT EXISTS ocr_invoice_type_label VARCHAR(100);
ALTER TABLE public.cost_invoices ADD COLUMN IF NOT EXISTS attachment_urls JSONB;
ALTER TABLE public.cost_invoices ADD COLUMN IF NOT EXISTS ocr_status VARCHAR(20);

COMMENT ON COLUMN public.cost_invoices.attachment_urls IS '多附件 [{url,filename?,mime?}]；attachment_url 保留为首图/主文件兼容';
COMMENT ON COLUMN public.cost_invoices.ocr_status IS 'idle|pending|success|partial|failed';
