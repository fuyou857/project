import { useEffect, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';
import { loadContractDocxBufferFromStorage } from '../../utils/contractDocxStorageFetch';

type Props = {
  storagePath: string;
  className?: string;
  minHeight?: number;
};

/** 从 Storage 拉取 .docx 并用 docx-preview 只读渲染（与模板详情预览一致；含 download 失败时的签名 URL 回退） */
export default function DocxStoragePreview({ storagePath, className = '', minHeight = 360 }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(true);

  useEffect(() => {
    const host = hostRef.current;
    let cancelled = false;
    if (!host) return;
    host.innerHTML = '';
    setErr(null);
    setLoading(true);
    setShowPreview(true);

    void (async () => {
      try {
        const { buffer, errorMessage } = await loadContractDocxBufferFromStorage(storagePath.trim());
        if (cancelled) return;
        if (!buffer) {
          setErr(errorMessage || '下载失败');
          setShowPreview(false);
          setLoading(false);
          return;
        }
        await renderAsync(buffer, host, undefined, {
          className: 'docx-preview-template',
          inWrapper: true,
          breakPages: true,
        });
      } catch (e: unknown) {
        if (!cancelled) {
          const errorMsg = (e as Error)?.message || '预览失败';
          // 静默处理一些常见错误
          if (errorMsg.includes('Invalid key') || errorMsg.includes('400') || errorMsg.includes('404')) {
            setErr('文档预览暂时不可用');
          } else {
            setErr(errorMsg);
          }
          setShowPreview(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  return (
    <div
      className={`rounded-xl border border-gray-200 bg-slate-50 overflow-auto relative ${className}`}
      style={{ minHeight }}
    >
      {loading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50/90 text-gray-500 text-sm">
          加载预览中…
        </div>
      ) : null}
      {err && !showPreview ? (
        <div className="p-4">
          <div className="text-sm text-amber-700 mb-3">
            <p className="font-medium mb-1">文档预览不可用</p>
            <p className="text-xs text-gray-600">请使用下载按钮查看文件。</p>
          </div>
        </div>
      ) : err ? (
        <div className="p-4 text-sm text-red-700">{err}</div>
      ) : null}
      {showPreview && <div ref={hostRef} />}
    </div>
  );
}
