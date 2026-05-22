import { useEffect, useState } from 'react';
import { supabase } from '../supabase/client';
import { CONTRACT_FILES_STORAGE_BUCKET } from '../utils/contractDocxStorageFetch';

const SIGNED_TTL_SEC = 60 * 60 * 12;

/**
 * 合同模板 / 生成合同等 Storage 路径：优先签名 URL（私有桶可用），失败则回退公网 URL（与 Office 嵌入一致）。
 */
export function useContractStoragePreviewUrl(storagePath: string | null | undefined, enabled: boolean) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !storagePath?.trim()) {
      setPreviewUrl(null);
      setLoading(false);
      return;
    }
    const path = storagePath.trim();
    let cancelled = false;
    setLoading(true);
    setPreviewUrl(null);
    void (async () => {
      try {
        const { data: signData, error: signErr } = await supabase.storage
          .from(CONTRACT_FILES_STORAGE_BUCKET)
          .createSignedUrl(path, SIGNED_TTL_SEC);
        const pub = supabase.storage.from(CONTRACT_FILES_STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
        if (cancelled) return;
        setPreviewUrl(!signErr && signData?.signedUrl ? signData.signedUrl : pub);
      } catch {
        if (!cancelled) {
          setPreviewUrl(supabase.storage.from(CONTRACT_FILES_STORAGE_BUCKET).getPublicUrl(path).data.publicUrl);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storagePath, enabled]);

  return { previewUrl, loading };
}
