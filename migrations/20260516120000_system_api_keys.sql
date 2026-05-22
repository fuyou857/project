-- 系统 API 密钥中心：仅服务端（Edge Function + Service Role）读写密文；前端经 api-key-ops 脱敏访问。

CREATE TABLE IF NOT EXISTS public.system_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_code text NOT NULL UNIQUE,
  name text NOT NULL,
  api_url text,
  secret_key_encrypted text NOT NULL,
  secret_key_hint text,
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expiring_soon', 'expired', 'disabled')),
  usage_scene text,
  allowed_ips text[] DEFAULT '{}',
  rate_limit_per_minute integer,
  fallback_secret_encrypted text,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_system_api_keys_key_code ON public.system_api_keys (key_code);
CREATE INDEX IF NOT EXISTS idx_system_api_keys_expires_at ON public.system_api_keys (expires_at);
CREATE INDEX IF NOT EXISTS idx_system_api_keys_status ON public.system_api_keys (status);

COMMENT ON TABLE public.system_api_keys IS '第三方 API 密钥配置（密文存储，仅超管经 Edge 管理）';
COMMENT ON COLUMN public.system_api_keys.key_code IS '程序调用唯一标识，如 invoice_ocr_upstream';
COMMENT ON COLUMN public.system_api_keys.secret_key_encrypted IS 'AES-GCM 密文（base64）';
COMMENT ON COLUMN public.system_api_keys.fallback_secret_encrypted IS '上一版可用密钥密文，网络异常时兜底';

CREATE TABLE IF NOT EXISTS public.system_api_key_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_code text,
  action text NOT NULL,
  operator_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  operator_email text,
  ip_address text,
  detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_api_key_logs_created ON public.system_api_key_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_api_key_logs_key_code ON public.system_api_key_logs (key_code);

COMMENT ON TABLE public.system_api_key_logs IS 'API 密钥操作审计（脱敏，不存完整明文）';

-- 本地配置双备份（JSON 密文快照，由 Edge 写入 system_settings）
CREATE TABLE IF NOT EXISTS public.system_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_api_key_logs ENABLE ROW LEVEL SECURITY;

-- 禁止客户端直接读取密钥表（全部走 api-key-ops Edge Function）
DROP POLICY IF EXISTS system_api_keys_deny_all ON public.system_api_keys;
CREATE POLICY system_api_keys_deny_all ON public.system_api_keys
  FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS system_api_key_logs_deny_all ON public.system_api_key_logs;
CREATE POLICY system_api_key_logs_deny_all ON public.system_api_key_logs
  FOR ALL USING (false) WITH CHECK (false);

-- 仅 super_admin（roles.code），不含 admin 别名
CREATE OR REPLACE FUNCTION public.is_strict_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_super boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  SELECT bool_or(r.code = 'super_admin')
  INTO is_super
  FROM public.roles r
  INNER JOIN public.users u ON u.id = auth.uid()
  WHERE r.id = ANY (u.role_ids);
  RETURN COALESCE(is_super, false);
END;
$$;
