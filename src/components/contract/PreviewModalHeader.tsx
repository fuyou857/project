import { FileText, X } from 'lucide-react';

interface PreviewModalHeaderProps {
  contractNo: string | null;
  onClose: () => void;
}

export default function PreviewModalHeader({ contractNo, onClose }: PreviewModalHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-100">
          <FileText className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">合同预览与编辑</h3>
          <p className="text-xs text-gray-500">{contractNo || '加载中...'}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
        aria-label="关闭预览"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}