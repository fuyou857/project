import type { GeneratedRevision } from '../../services/contractGenerationService';

interface PreviewHistoryPanelProps {
  revisions: GeneratedRevision[];
  loading: boolean;
  onPreviewRevision: (rev: GeneratedRevision) => void;
}

export default function PreviewHistoryPanel({ revisions, loading, onPreviewRevision }: PreviewHistoryPanelProps) {
  if (loading) {
    return (
      <div className="space-y-3" role="status" aria-live="polite">
        <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="font-medium text-gray-900">修订历史记录</h4>
      {revisions.length === 0 ? (
        <p className="text-sm text-gray-500">暂无修订记录</p>
      ) : (
        <div className="space-y-2">
          {revisions.map((rev) => (
            <div
              key={rev.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
              onClick={() => onPreviewRevision(rev)}
            >
              <div>
                <span className="font-medium">第 {rev.revision} 版</span>
                <span className="ml-2 text-sm text-gray-500">
                  {new Date(rev.created_at).toLocaleString('zh-CN')}
                </span>
              </div>
              <button
                type="button"
                className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                载入编辑器
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}