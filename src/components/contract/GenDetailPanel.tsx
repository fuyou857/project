import { FaArrowLeft, FaRecycle, FaUndo, FaInfoCircle, FaDownload, FaSave } from 'react-icons/fa';
import GeneratedContractRichWorkspace from './GeneratedContractRichWorkspace';
import type { GeneratedContract } from '../../services/contractGenerationService';
import type { GeneratedRevision } from '../../services/contractGenerationService';

interface WordFillFailure {
  id: string;
  message: string;
}

export interface GenDetailPanelProps {
  row: GeneratedContract;
  genDetailFromTrash: boolean;
  trashActionBusy: boolean;
  revisions: GeneratedRevision[];
  wordFillFailure: WordFillFailure | null;
  retryFillBusy: boolean;
  userId: string | null;
  isSuperAdmin: boolean;
  genDocxBusy: boolean;
  genPdfBusy: boolean;
  statusBadgeClass: (status: string) => string;
  formatStatusLabel: (status: string) => string;
  buildPublicUrl: (storagePath: string) => string;
  onNavigateBack: () => void;
  onNavigateToHub: () => void;
  onRestore: () => void;
  onPermanentDelete: () => void;
  onRetryFill: () => void;
  onPreview: () => void;
  onSaveFinal: () => void;
  onGeneratePdf: () => void;
  onStartApproval: () => void;
  onApplySeal: () => void;
  onSaveRevision: (html: string) => Promise<void>;
  onUploadDocx: (file: File) => Promise<void>;
}

export default function GenDetailPanel({
  row: r,
  genDetailFromTrash,
  trashActionBusy,
  revisions,
  wordFillFailure,
  retryFillBusy,
  userId,
  isSuperAdmin,
  genDocxBusy,
  genPdfBusy,
  statusBadgeClass,
  formatStatusLabel,
  buildPublicUrl,
  onNavigateBack,
  onNavigateToHub,
  onRestore,
  onPermanentDelete,
  onRetryFill,
  onPreview,
  onSaveFinal,
  onGeneratePdf,
  onStartApproval,
  onApplySeal,
  onSaveRevision,
  onUploadDocx,
}: GenDetailPanelProps) {
  const isDeleted = Boolean(r.deleted_at);
  const hasDocx = Boolean(r.generated_docx_storage_path);

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          type="button"
          className="text-sm text-blue-700 inline-flex items-center gap-1"
          onClick={onNavigateBack}
          aria-label={genDetailFromTrash ? '返回回收站' : '返回我生成的合同'}>
          <FaArrowLeft /> {genDetailFromTrash ? '回收站' : '我生成的合同'}
        </button>
        <button
          type="button"
          className="text-sm text-gray-600 inline-flex items-center gap-1"
          onClick={onNavigateToHub}
          aria-label="模板总览">
          模板总览
        </button>
      </div>

      <h2 className="text-xl font-semibold text-gray-900">{r.contract_no}</h2>
      <p className="text-sm text-gray-500 mb-2">
        状态：
        <span className={`inline-flex ml-1 px-2 py-0.5 rounded text-xs ${statusBadgeClass(r.status)}`}>
          {r.status === 'contract_final'
            ? '已保存为合同（Word 定稿）'
            : formatStatusLabel(r.status)}
        </span>
      </p>
      <p className="text-xs text-gray-500 mb-4">
        创建：{new Date(r.created_at).toLocaleString('zh-CN')}
      </p>

      {isDeleted ? (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm space-y-2">
          <p className="font-semibold flex flex-wrap items-center gap-2">
            <FaRecycle className="shrink-0" aria-hidden />
            本合同在回收站中（删除时间：{new Date(r.deleted_at!).toLocaleString('zh-CN')}）
          </p>
          {r.delete_reason?.trim() ? (
            <p className="text-xs">
              <span className="font-medium">删除说明：</span>
              {r.delete_reason}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={trashActionBusy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
              onClick={onRestore}
              aria-label="恢复至主列表">
              <FaUndo className="text-xs" /> 恢复至主列表
            </button>
            {isSuperAdmin ? (
              <button
                type="button"
                disabled={trashActionBusy}
                className="btn-action-danger disabled:opacity-50"
                onClick={onPermanentDelete}
                aria-label="彻底删除">
                彻底删除
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {!isDeleted && !hasDocx ? (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm">
          <p className="font-semibold text-amber-900">尚未生成填充后的 Word 文件</p>
          <p className="mt-1 text-xs text-amber-900/90 leading-relaxed">
            数据库中已有合同编号与变量快照，但 generated_docx_storage_path 仍为空，通常表示 fill_docx 未成功。请查看页面顶部红色错误区，或点击下方重试。
          </p>
          {wordFillFailure?.id === r.id ? (
            <pre className="mt-2 max-h-32 overflow-auto rounded bg-white/70 border border-amber-200/80 p-2 text-[11px] text-amber-950 whitespace-pre-wrap break-words font-sans">
              {wordFillFailure.message}
            </pre>
          ) : null}
          <button
            type="button"
            disabled={retryFillBusy}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-700 text-white text-sm hover:bg-amber-800 disabled:opacity-50"
            onClick={onRetryFill}
            aria-label={retryFillBusy ? '正在重试填充…' : '重新执行 Word 填充'}>
            {retryFillBusy ? '正在重试填充…' : '重新执行 Word 填充'}
          </button>
        </div>
      ) : null}

      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/40 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800 flex items-center gap-2">
            <FaInfoCircle className="text-blue-600 shrink-0" aria-hidden />
            生成结果预览
          </p>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            在浮层中查看 Word 填充效果、修订与 PDF；与下方工作台数据一致。
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 shadow-sm"
            onClick={onPreview}
            aria-label="打开预览浮层">
            打开预览浮层
          </button>
          {r.generated_docx_storage_path ? (
            <a
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 hover:bg-slate-50"
              href={buildPublicUrl(r.generated_docx_storage_path)}
              target="_blank"
              rel="noreferrer"
              aria-label="下载 Word">
              <FaDownload className="text-xs" /> 下载 Word
            </a>
          ) : null}
        </div>
      </div>

      {!isDeleted ? (
        <>
          <GeneratedContractRichWorkspace
            key={r.id + (r.updated_at || '')}
            row={r}
            userId={userId}
            genDocxBusy={genDocxBusy}
            onSaveRevision={onSaveRevision}
            onUploadDocx={onUploadDocx}
          />

          <div className="flex flex-wrap gap-2 mt-4 mb-4 items-center">
            <button
              type="button"
              onClick={onSaveFinal}
              className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-800"
              aria-label="保存为合同定稿">
              <FaSave className="inline mr-1" />
              保存为合同（定稿）
            </button>
            <button
              type="button"
              disabled={genPdfBusy}
              onClick={onGeneratePdf}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
              aria-label={genPdfBusy ? '正在生成 PDF…' : '生成 / 更新 PDF'}>
              {genPdfBusy ? '正在生成 PDF…' : '生成 / 更新 PDF'}
            </button>
            {r.merged_pdf_storage_path ? (
              <a
                className="px-4 py-2 rounded-lg border border-blue-200 text-blue-800 text-sm hover:bg-blue-50 inline-flex items-center gap-2"
                href={buildPublicUrl(r.merged_pdf_storage_path)}
                target="_blank"
                rel="noreferrer"
                aria-label="下载 PDF">
                <FaDownload /> 下载 PDF
              </a>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <button
              type="button"
              onClick={onStartApproval}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm"
              aria-label="发起审批">
              发起审批
            </button>
            <button
              type="button"
              onClick={onApplySeal}
              className="px-4 py-2 rounded-lg border text-sm"
              aria-label="模拟签章">
              模拟签章（写入审批人+时间）
            </button>
          </div>
        </>
      ) : (
        <p className="my-4 text-sm text-gray-600 border border-gray-200 rounded-lg px-4 py-3 bg-gray-50">
          回收站中不可在线编辑、定稿或发起审批；请先使用上方「恢复至主列表」。
        </p>
      )}

      {r.seal_annotation ? (
        <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded px-3 py-2 mb-4">
          签章信息：{r.seal_annotation}
        </p>
      ) : null}

      <h3 className="font-medium text-gray-800 mt-2 mb-2">修订历史</h3>
      <ul className="text-sm text-gray-600 space-y-1">
        {revisions.map((rv) => (
          <li key={rv.id}>
            第 {rv.revision} 版 · {new Date(rv.created_at).toLocaleString('zh-CN')}
          </li>
        ))}
      </ul>
    </div>
  );
}