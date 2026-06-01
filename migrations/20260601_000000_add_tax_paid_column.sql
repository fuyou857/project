-- ============================================
-- 添加缺失的 tax_paid 列到 income_invoices 表
-- ============================================

ALTER TABLE income_invoices 
ADD COLUMN IF NOT EXISTS tax_paid BOOLEAN DEFAULT false;

ALTER TABLE income_invoices 
ADD COLUMN IF NOT EXISTS tax_paid_at TIMESTAMP DEFAULT NULL;
