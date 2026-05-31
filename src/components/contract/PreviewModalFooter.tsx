import { Download } from 'lucide-react';
import { publicUrlForStoragePath, resolveContractStorageAccessUrl } from '../../utils/contractDocxStorageFetch';
import type { GeneratedContract } from '../../services/contractGenerationService';

function SignedDownloadButton({ path, label }: { path: string; label: string }) {
  const onClick = async () => {
    const { url } = await resolveContractStorageAccessUrl(path, 60 * 60 * 4);
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
    >
      <Download className="w-4 h-4" /> {label}
    </button>
  );
}

interface PreviewModalFooterProps {
  contract: GeneratedContract | null;
  pdfBusy: boolean;
  onConvertPdf: () => void;
  onClose: () => void;
}

export default function PreviewModalFooter({ contract, pdfBusy, onConvertPdf, onClose }: PreviewModalFooterProps) {
  return (
    <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {contract?.generated_docx_storage_path ? (
          <SignedDownloadButton path={contract.generated_docx_storage_path} label="下载Word" />
        ) : null}
        {contract?.merged_pdf_storage_path ? (
          <a
            href={publicUrlForStoragePath(contract.merged_pdf_storage_path)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" /> 下载PDF
          </a>
        ) : (
          <button
            type="button"
            onClick={onConvertPdf}
            disabled={pdfBusy || !contract?.generated_docx_storage_path}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-busy={pdfBusy}
          >
            {pdfBusy ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                生成PDF中...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" /> 生成PDF
              </>
            )}
          </button>
        )}
      </div>
      <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">
        关闭
      </button>
    </div>
  );
}