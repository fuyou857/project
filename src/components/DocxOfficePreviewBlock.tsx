import { Download } from 'lucide-react';
import { useContractStoragePreviewUrl } from '../hooks/useContractStoragePreviewUrl';

type Props = {
  storagePath: string;
  title?: string;
  minHeight?: number;
  className?: string;
  /** 在预览下方显示「下载 Word」（使用与预览相同的签名 URL，避免私有桶直链无效） */
  withDownload?: boolean;
  /** 下载链接 `title` 提示（另存为时参考） */
  downloadFileName?: string;
};

/** Word 在线预览：签名 URL + Office Web Viewer */
export default function DocxOfficePreviewBlock({
  storagePath,
  title = 'Word 预览',
  minHeight = 420,
  className = '',
  withDownload = false,
  downloadFileName = 'document.docx',
}: Props) {
  const { previewUrl, loading } = useContractStoragePreviewUrl(storagePath, true);

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center text-gray-500 text-sm bg-gray-50 rounded-lg border border-gray-200 ${className}`}
        style={{ minHeight }}
      >
        正在准备预览链接…
      </div>
    );
  }
  if (!previewUrl) {
    return (
      <div
        className={`flex items-center justify-center text-red-600 text-sm bg-red-50/50 rounded-lg border border-red-100 ${className}`}
        style={{ minHeight }}
      >
        无法生成预览链接
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
        <iframe
          title={title}
          className="w-full border-0 bg-white"
          style={{ minHeight }}
          src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl)}`}
        />
      </div>
      {withDownload && previewUrl ? (
        <a
          href={previewUrl}
          target="_blank"
          rel="noreferrer"
          title={downloadFileName}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm bg-white hover:bg-gray-50 text-gray-800"
        >
          <Download className="w-4 h-4" /> 下载 Word
        </a>
      ) : null}
    </div>
  );
}
