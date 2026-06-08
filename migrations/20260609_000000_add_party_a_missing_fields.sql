-- 2026-06-09: Add missing fields to party_a table
ALTER TABLE public.party_a
ADD COLUMN IF NOT EXISTS legal_person VARCHAR(100),
ADD COLUMN IF NOT EXISTS remark TEXT,
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- Update updated_at column automatically
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_party_a_updated_at
BEFORE UPDATE ON public.party_a
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
