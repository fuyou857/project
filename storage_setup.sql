-- ============================================
-- Supabase Storage 设置脚本
-- ============================================

-- ============================================
-- 1. 创建 files bucket (公共文件存储)
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('files', 'files', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. 创建 vouchers bucket (凭证存储)
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('vouchers', 'vouchers', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 3. 创建 Storage RLS 策略
-- ============================================

-- 允许所有用户访问 storage.objects (公开访问)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'allow_all_storage_access') THEN
        CREATE POLICY "allow_all_storage_access" ON storage.objects FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 允许公开读取
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = '允许公开读取') THEN
        CREATE POLICY "允许公开读取" ON storage.objects FOR SELECT USING (true);
    END IF;
END $$;

-- 允许公开插入
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = '允许公开插入') THEN
        CREATE POLICY "允许公开插入" ON storage.objects FOR INSERT WITH CHECK (true);
    END IF;
END $$;

-- 允许公开删除
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = '允许公开删除') THEN
        CREATE POLICY "允许公开删除" ON storage.objects FOR DELETE USING (true);
    END IF;
END $$;

-- ============================================
-- 完成！
-- ============================================
