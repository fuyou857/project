import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCloudUploadAlt, FaChevronLeft, FaChevronRight, FaFilePdf, FaImage, FaFileAlt } from 'react-icons/fa';
import { useSafeFileInput } from '../../../hooks/useSafeFileInput';
import { COST_INVOICE_ACCEPT, type OcrUiStatus, type InvoiceAttachmentItem } from '../costInvoice/types';
import { isInvoiceImageMime, isInvoicePdfMime } from '../costInvoice/invoiceFileUtils';

type Props = {
  attachments: InvoiceAttachmentItem[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onFiles: (files: File[]) => void;
  ocrStatus: OcrUiStatus;
  progress: number;
  progressLabel: string;
  disabled: boolean;
};

export default function InvoicePreviewPanel_v2({
  attachments,
  activeIndex,
  onActiveIndexChange,
  onFiles,
  ocrStatus,
  progress,
  progressLabel,
  disabled
}: Props) {
  const { inputRef, inputId, triggerRef, openPicker, onInputChange } = useSafeFileInput({
    disabled,
    accept: COST_INVOICE_ACCEPT,
    multiple: true,
    onFiles
  });

  const current = attachments[activeIndex];

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onFiles(files);
  }, [disabled, onFiles]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (disabled) return;

    e.preventDefault();
    e.stopPropagation();

    try {
      openPicker(e);
    } catch (err) {
      console.error('[InvoiceUpload] openPicker failed:', err);
    }

    // 直接回退：无论 openPicker 是否成功，都尝试直接点击 input
    const input = inputRef.current;
    if (input && !input.disabled) {
      try {
        input.click();
      } catch (fallbackErr) {
        console.error('[InvoiceUpload] fallback input.click() also failed:', fallbackErr);
      }
    }
  }, [disabled, openPicker, inputRef]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      e.stopPropagation();

      try {
        openPicker();
      } catch (err) {
        console.error('[InvoiceUpload] openPicker (keyboard) failed:', err);

        const input = inputRef.current;
        if (input && !input.disabled) {
          input.click();
        }
      }
    }
  }, [disabled, openPicker, inputRef]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onInputChange(e);
  }, [onInputChange]);

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Upload Area */}
      <motion.div
        ref={triggerRef}
        className={`relative rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-6 text-center ${
          disabled ? 'bg-slate-50 border-slate-200 cursor-not-allowed' : 'bg-white border-blue-200 hover:border-blue-500 hover:shadow-md cursor-pointer group'
        }`}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={disabled ? undefined : '点击或拖拽上传发票文件'}
        aria-disabled={disabled || undefined}
        onDragOver={(e: React.DragEvent) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors ${
          disabled ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'
        }`}>
          <FaCloudUploadAlt size={24} />
        </div>
        
        <div className="space-y-1">
          <p className={`text-sm font-bold ${disabled ? 'text-slate-400' : 'text-slate-700'}`}>
            点击或拖拽上传发票
          </p>
          <p className="text-[10px] text-slate-400">
            支持 JPG, PNG, PDF, OFD (最大 12MB)
          </p>
        </div>

        {/* Progress Overlay */}
        <AnimatePresence>
          {(ocrStatus === 'pending' || progress > 0) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-white/90 rounded-2xl flex flex-col items-center justify-center p-6"
            >
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
                <motion.div
                  className="h-full bg-blue-600"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs font-bold text-blue-700">{progressLabel || '正在识别...'}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hidden file input - must be rendered in DOM for the picker to work */}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={COST_INVOICE_ACCEPT}
          multiple
          disabled={disabled}
          onChange={handleInputChange}
          className="hidden"
          tabIndex={-1}
        />
      </motion.div>

      {/* Preview Area */}
      <div className="flex-1 bg-slate-900 rounded-2xl overflow-hidden relative border border-slate-800 shadow-inner">
        {current ? (
          <div className="w-full h-full flex flex-col">
            <div className="flex-1 min-h-0">
              {isInvoiceImageMime(current.mime, current.url) ? (
                <img src={current.url} alt="预览" className="w-full h-full object-contain" />
              ) : isInvoicePdfMime(current.mime, current.url) ? (
                <iframe src={current.url} className="w-full h-full border-0 bg-white" title="PDF预览" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-3">
                  <FaFileAlt size={48} />
                  <p className="text-sm">此格式不支持预览</p>
                  <a href={current.url} target="_blank" rel="noreferrer" className="text-blue-400 text-xs hover:underline">
                    在新窗口打开
                  </a>
                </div>
              )}
            </div>
            
            {/* Attachment Nav */}
            {attachments.length > 1 && (
              <div className="bg-slate-800/80 backdrop-blur-sm px-4 py-2 flex items-center justify-between text-white text-xs">
                <button
                  type="button"
                  onClick={() => onActiveIndexChange(Math.max(0, activeIndex - 1))}
                  disabled={activeIndex === 0}
                  className="p-1 hover:bg-white/10 rounded disabled:opacity-30"
                >
                  <FaChevronLeft />
                </button>
                <span className="font-mono">
                  {activeIndex + 1} / {attachments.length}
                </span>
                <button
                  type="button"
                  onClick={() => onActiveIndexChange(Math.min(attachments.length - 1, activeIndex + 1))}
                  disabled={activeIndex === attachments.length - 1}
                  className="p-1 hover:bg-white/10 rounded disabled:opacity-30"
                >
                  <FaChevronRight />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 gap-3">
            <div className="flex gap-4 opacity-20">
              <FaImage size={32} />
              <FaFilePdf size={32} />
            </div>
            <p className="text-xs font-medium uppercase tracking-widest">暂无预览内容</p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            ocrStatus === 'success' ? 'bg-emerald-500 animate-pulse' : 
            ocrStatus === 'failed' ? 'bg-red-500' : 'bg-slate-300'
          }`} />
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
            System Ready
          </span>
        </div>
        <p className="text-[10px] text-slate-400">
          Local OCR Engine v2.0
        </p>
      </div>
    </div>
  );
}
