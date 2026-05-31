import { AlertTriangle, Info, RefreshCw } from 'lucide-react';
import OnlyOfficeEditorLazy from './OnlyOfficeEditorLazy';
import { PreviewSkeleton } from '../Skeleton';
import type { GeneratedContract } from '../../services/contractGenerationService';

interface PreviewOnlyOfficePanelProps {
  contract: GeneratedContract;
  syncDraftToWordBusy: boolean;
  hasVisibleDraft: boolean;
  draftLikelyNewerThanDocx: boolean;
  latestRevisionSavedAt: string | null;
  docxStorageUpdatedAt: string | null;
  onlyOfficeUrlBusy: boolean;
  onlyOfficeDocUrl: string | null;
  onlyOfficeUrlHint: string | null;
  onlyOfficeUrlNonce: number;
  onSyncDraftToWord: () => void;
}

function SyncNewerBanner({
  latestRevisionSavedAt,
  docxStorageUpdatedAt,
  syncDraftToWordBusy,
  hasVisibleDraft,
  onSyncDraftToWord,
}: {
  latestRevisionSavedAt: string | null;
  docxStorageUpdatedAt: string | null;
  syncDraftToWordBusy: boolean;
  hasVisibleDraft: boolean;
  onSyncDraftToWord: () => void;
}) {
  return (
    <div className="rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 shadow-sm">
      <div className="flex gap-3 min-w-0 flex-1">
        <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden />
        <div className="min-w-0 text-sm">
          <p className="font-semibold text-amber-950">正文修订可能新于当前 Word 文件</p>
          <p className="text-amber-900/90 mt-1 text-xs leading-relaxed">
            最近保存的正文修订时间为{' '}
            <span className="font-mono">
              {latestRevisionSavedAt ? new Date(latestRevisionSavedAt).toLocaleString('zh-CN') : '—'}
            </span>
            ，晚于 Storage 中当前 .docx 的更新时间{' '}
            <span className="font-mono">
              {docxStorageUpdatedAt ? new Date(docxStorageUpdatedAt).toLocaleString('zh-CN') : '—'}
            </span>
            。ONLYOFFICE 仍打开的是旧 Word；请点击右侧按钮把当前正文草稿写入 Word 后再查看。
          </p>
        </div>
      </div>
      <button
        type="button"
        disabled={syncDraftToWordBusy || !hasVisibleDraft}
        onClick={onSyncDraftToWord}
        className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-700 text-white text-sm font-medium hover:bg-amber-800 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        aria-busy={syncDraftToWordBusy}
      >
        <RefreshCw className={`w-4 h-4 ${syncDraftToWordBusy ? 'animate-spin' : ''}`} />
        {syncDraftToWordBusy ? '正在同步…' : '将正文同步到 Word'}
      </button>
    </div>
  );
}

function SyncInfoBanner({
  syncDraftToWordBusy,
  hasVisibleDraft,
  onSyncDraftToWord,
}: {
  syncDraftToWordBusy: boolean;
  hasVisibleDraft: boolean;
  onSyncDraftToWord: () => void;
}) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex gap-3 min-w-0 flex-1">
        <Info className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" aria-hidden />
        <div className="min-w-0 text-sm text-blue-950">
          <p className="font-medium">HTML 预览与 ONLYOFFICE 数据源不同</p>
          <p className="text-blue-900/85 mt-1 text-xs leading-relaxed">
            HTML 预览优先展示正文草稿；ONLYOFFICE 始终打开 Storage 中的 .docx。若曾在「正文与编辑」中改过字句，建议点右侧按钮同步后再用 ONLYOFFICE 校对。
          </p>
        </div>
      </div>
      <button
        type="button"
        disabled={syncDraftToWordBusy}
        onClick={onSyncDraftToWord}
        className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-medium hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap"
        aria-busy={syncDraftToWordBusy}
      >
        <RefreshCw className={`w-4 h-4 ${syncDraftToWordBusy ? 'animate-spin' : ''}`} />
        {syncDraftToWordBusy ? '正在同步…' : '将正文同步到 Word'}
      </button>
    </div>
  );
}

function SyncNoDraftBanner() {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-xs text-gray-600 flex flex-wrap items-center justify-between gap-2">
      <span>
        当前无正文草稿；ONLYOFFICE 显示的是模板填充或上传的 Word。若 HTML 预览仅来自模板变量替换，请使用「重试从模板填充 Word」更新 .docx。
      </span>
    </div>
  );
}

export default function PreviewOnlyOfficePanel({
  contract,
  syncDraftToWordBusy,
  hasVisibleDraft,
  draftLikelyNewerThanDocx,
  latestRevisionSavedAt,
  docxStorageUpdatedAt,
  onlyOfficeUrlBusy,
  onlyOfficeDocUrl,
  onlyOfficeUrlHint,
  onlyOfficeUrlNonce,
  onSyncDraftToWord,
}: PreviewOnlyOfficePanelProps) {
  if (!contract.generated_docx_storage_path) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 space-y-2 px-4 text-center text-sm">
        <p>暂无已生成的 Word 文件。</p>
        <p className="text-xs text-gray-400 max-w-md">
          请先使用「正文与编辑」保存表单并生成文档，或点击下方「重试从模板填充 Word」。HTML
          预览基于模板实时渲染；ONLYOFFICE 打开的是已写入 Storage 的 .docx，两者在未生成 Word 前不一致属预期。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {draftLikelyNewerThanDocx ? (
        <SyncNewerBanner
          latestRevisionSavedAt={latestRevisionSavedAt}
          docxStorageUpdatedAt={docxStorageUpdatedAt}
          syncDraftToWordBusy={syncDraftToWordBusy}
          hasVisibleDraft={hasVisibleDraft}
          onSyncDraftToWord={onSyncDraftToWord}
        />
      ) : hasVisibleDraft ? (
        <SyncInfoBanner
          syncDraftToWordBusy={syncDraftToWordBusy}
          hasVisibleDraft={hasVisibleDraft}
          onSyncDraftToWord={onSyncDraftToWord}
        />
      ) : (
        <SyncNoDraftBanner />
      )}

      {onlyOfficeUrlBusy ? (
        <PreviewSkeleton height="400px" />
      ) : onlyOfficeDocUrl ? (
        <>
          {onlyOfficeUrlHint && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {onlyOfficeUrlHint}
            </div>
          )}
          <div role="region" aria-label="ONLYOFFICE 文档编辑器" aria-live="polite">
            <OnlyOfficeEditorLazy
              key={`${onlyOfficeDocUrl}-${onlyOfficeUrlNonce}`}
              documentUrl={onlyOfficeDocUrl}
              documentTitle={`${contract.contract_no || '合同'}.docx`}
              documentKey={`${contract.id}-${onlyOfficeUrlNonce}`}
              height="600px"
              forceViewMode
            />
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-64 text-gray-500">
          无法生成文档访问链接
        </div>
      )}
    </div>
  );
}