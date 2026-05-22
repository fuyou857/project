import { supabase } from '../supabase/client';

/** 合同模板 / 生成合同 / Edge `fill_docx` 写回使用的 Storage 桶，须与控制台与 Edge 默认 bucket 一致 */
export const CONTRACT_FILES_STORAGE_BUCKET = 'files';

/**
 * 获取存储路径的公开URL
 */
export function publicUrlForStoragePath(path: string): string {
  const { data } = supabase.storage.from(CONTRACT_FILES_STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * 获取存储路径的签名URL
 */
export async function signedUrlForContractStoragePath(storagePath: string, expiry = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(CONTRACT_FILES_STORAGE_BUCKET).createSignedUrl(storagePath, expiry);
  if (error || !data?.signedUrl) {
    throw error ?? new Error(`无法为路径生成签名 URL：${storagePath}`);
  }
  return data.signedUrl;
}

/**
 * 合同 Storage 访问 URL：优先签名，失败回退公开链（ONLYOFFICE / 在线预览共用）
 */
export async function resolveContractStorageAccessUrl(
  storagePath: string,
  expirySeconds = 3600,
): Promise<{ url: string; hint: string | null }> {
  const { data, error } = await supabase.storage
    .from(CONTRACT_FILES_STORAGE_BUCKET)
    .createSignedUrl(storagePath, expirySeconds);
  if (!error && data?.signedUrl) {
    return { url: data.signedUrl, hint: null };
  }
  return {
    url: publicUrlForStoragePath(storagePath),
    hint:
      error?.message ||
      '未能创建签名 URL，已回退到 Storage 公开链接；若桶为私有，ONLYOFFICE 可能无法拉取文档。',
  };
}

/** 优先签名 URL，失败则回退公开链接（OnlyOffice / 在线预览共用） */
export async function preferSignedStorageUrl(storagePath: string, expiry = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(CONTRACT_FILES_STORAGE_BUCKET).createSignedUrl(
    storagePath,
    expiry,
  );
  if (!error && data?.signedUrl) return data.signedUrl;
  return publicUrlForStoragePath(storagePath);
}

export type SignedStorageUrlResult = { url: string; hint: string | null };

/** 同 preferSignedStorageUrl，并返回回退原因（供 ONLYOFFICE 提示） */
export async function preferSignedStorageUrlWithHint(
  storagePath: string,
  expiry = 3600,
): Promise<SignedStorageUrlResult> {
  try {
    const { data, error } = await supabase.storage.from(CONTRACT_FILES_STORAGE_BUCKET).createSignedUrl(
      storagePath,
      expiry,
    );
    if (!error && data?.signedUrl) {
      return { url: data.signedUrl, hint: null };
    }
    return {
      url: publicUrlForStoragePath(storagePath),
      hint:
        error?.message ||
        '未能创建签名 URL，已回退到 Storage 公开链接；若桶为私有，ONLYOFFICE 可能无法拉取文档。',
    };
  } catch (e: unknown) {
    return {
      url: publicUrlForStoragePath(storagePath),
      hint: (e instanceof Error ? e.message : null) || '创建签名 URL 异常，已回退到公开链接',
    };
  }
}

/** .docx 为 ZIP，应以 PK（0x50 0x4b）开头 */
export function isDocxZipBuffer(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 2) return false;
  const u = new Uint8Array(buf, 0, 2);
  return u[0] === 0x50 && u[1] === 0x4b;
}

const FETCH_DOCX_MS = 25_000;

async function abortableFetch(input: string, timeoutMs: number): Promise<Response> {
  const AnySignal = AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal };
  if (typeof AbortSignal !== 'undefined' && typeof AnySignal.timeout === 'function') {
    return fetch(input, { cache: 'no-store', signal: AnySignal.timeout(timeoutMs) });
  }
  const ac = new AbortController();
  const id = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(input, { cache: 'no-store', signal: ac.signal });
  } finally {
    clearTimeout(id);
  }
}

/**
 * 合同模板 / 生成合同：优先 SDK download；失败或空时用签名/公开 URL + fetch（与模板预览、生成预览一致）。
 */
export async function loadContractDocxBufferFromStorage(
  storagePath: string,
): Promise<{ buffer: ArrayBuffer | null; errorMessage: string | null }> {
  let downloadErr: string | null = null;
  try {
    const down = await supabase.storage.from(CONTRACT_FILES_STORAGE_BUCKET).download(storagePath);
    if (!down.error && down.data) {
      try {
        const buf = await down.data.arrayBuffer();
        if (buf.byteLength > 0) {
          if (!isDocxZipBuffer(buf)) {
            return { buffer: null, errorMessage: '文件不是有效的 .docx（ZIP）格式。' };
          }
          return { buffer: buf, errorMessage: null };
        }
      } catch (e) {
        downloadErr = (e as Error).message;
      }
    } else {
      downloadErr = down.error?.message ?? null;
    }
  } catch (e) {
    downloadErr = (e as Error).message;
  }

  let url: string;
  let signErr: Error | null = null;
  try {
    // 优先使用签名URL，失败则回退到公开URL
    const signResult = await preferSignedStorageUrlWithHint(storagePath);
    url = signResult.url;
    if (signResult.hint) {
      signErr = new Error(signResult.hint);
    }
  } catch (e) {
    // 如果签名URL生成失败，直接使用公开URL
    url = publicUrlForStoragePath(storagePath);
  }
  
  try {
    const res = await abortableFetch(url, FETCH_DOCX_MS);
    if (!res.ok) {
      // 如果是400或404错误，提供更友好的提示
      if (res.status === 400 || res.status === 404) {
        return {
          buffer: null,
          errorMessage: '文档文件暂时不可用',
        };
      }
      return {
        buffer: null,
        errorMessage: downloadErr || signErr?.message || `读取文件失败（HTTP ${res.status}）`,
      };
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0) return { buffer: null, errorMessage: '文件大小为 0' };
    if (!isDocxZipBuffer(buf)) {
      return { buffer: null, errorMessage: '文件不是有效的 .docx（ZIP）格式。' };
    }
    return { buffer: buf, errorMessage: null };
  } catch (e) {
    const name = (e as Error)?.name;
    const aborted = name === 'AbortError';
    const errorMsg = (e as Error)?.message || '';
    
    // 对常见错误提供友好提示
    if (errorMsg.includes('Invalid key') || errorMsg.includes('400') || errorMsg.includes('404')) {
      return {
        buffer: null,
        errorMessage: '文档文件暂时不可用',
      };
    }
    
    return {
      buffer: null,
      errorMessage:
        downloadErr ||
        (aborted ? `下载 Word 超时（${FETCH_DOCX_MS / 1000}s），请检查网络或 Storage 策略` : errorMsg) ||
        '网络读取失败',
    };
  }
}
