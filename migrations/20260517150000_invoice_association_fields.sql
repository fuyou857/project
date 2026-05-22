-- 成本发票关联业务扩展与收票方信息
ALTER TABLE public.cost_invoices ADD COLUMN IF NOT EXISTS association_status VARCHAR(30) DEFAULT 'unassociated';
ALTER TABLE public.cost_invoices ADD COLUMN IF NOT EXISTS no_contract_payment_remark TEXT;
ALTER TABLE public.cost_invoices ADD COLUMN IF NOT EXISTS buyer_name TEXT;
ALTER TABLE public.cost_invoices ADD COLUMN IF NOT EXISTS buyer_tax_id VARCHAR(32);

COMMENT ON COLUMN public.cost_invoices.association_status IS '关联业务状态：unassociated, associated_contract, no_contract_payment';
COMMENT ON COLUMN public.cost_invoices.no_contract_payment_remark IS '无合同付款备注';
COMMENT ON COLUMN public.cost_invoices.buyer_name IS '收票方（购买方）名称';
COMMENT ON COLUMN public.cost_invoices.buyer_tax_id IS '收票方（购买方）纳税人识别号';

-- 支出合同统计扩展
ALTER TABLE public.expense_contracts ADD COLUMN IF NOT EXISTS received_invoice_amount NUMERIC(15, 2) DEFAULT 0;
COMMENT ON COLUMN public.expense_contracts.received_invoice_amount IS '已收发票累计金额';

-- 记录关联操作记录（简易版日志）
CREATE TABLE IF NOT EXISTS public.invoice_association_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES public.cost_invoices(id) ON DELETE CASCADE,
    operator_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    old_status VARCHAR(30),
    new_status VARCHAR(30),
    old_contract_id UUID,
    new_contract_id UUID,
    remark TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.invoice_association_logs IS '发票关联业务操作记录日志';
