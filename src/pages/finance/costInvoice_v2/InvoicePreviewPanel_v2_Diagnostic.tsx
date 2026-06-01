import { useState, useCallback, useRef, useEffect } from 'react';
import { useSafeFileInput } from '../../../hooks/useSafeFileInput';
import { COST_INVOICE_ACCEPT, type OcrUiStatus, type InvoiceAttachmentItem } from '../costInvoice/types';
import { isInvoiceImageMime, isInvoicePdfMime } from '../costInvoice/invoiceFileUtils';
import { FaCloudUploadAlt } from 'react-icons/fa';

type Props = {
  attachments: InvoiceAttachmentItem[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onFiles: (files: File[]) => void;
  ocrStatus: OcrUiStatus;
  progress: number;
  progressLabel: string;
  disabled: boolean;
  debug?: boolean; // 启用调试模式
};

export default function InvoicePreviewPanel_v2_Diagnostic({
  attachments,
  activeIndex,
  onActiveIndexChange,
  onFiles,
  ocrStatus,
  progress,
  progressLabel,
  disabled,
  debug = false
}: Props) {
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const logsRef = useRef<string[]>([]);

  const addLog = (msg: string) => {
    if (!debug) return;
    const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    const logMsg = `[${timestamp}] ${msg}`;
    logsRef.current.push(logMsg);
    setDebugLogs([...logsRef.current.slice(-50)]); // 只保留最近 50 条
    console.log(`[InvoiceUpload] ${msg}`);
  };

  // 使用原始的 useSafeFileInput hook
  const { inputRef, inputId, openPicker, onInputChange, isPickerSuppressed } = useSafeFileInput({
    disabled,
    accept: COST_INVOICE_ACCEPT,
    multiple: true,
    onFiles: (files) => {
      addLog(`onFiles callback triggered with ${files.length} files`);
      onFiles(files);
    }
  });

  const current = attachments[activeIndex];

  const handleDrop = useCallback((e: React.DragEvent) => {
    addLog('handleDrop triggered');
    e.preventDefault();
    if (disabled) {
      addLog('handleDrop: blocked - disabled=true');
      return;
    }
    const files = Array.from(e.dataTransfer.files);
    addLog(`handleDrop: ${files.length} files dropped`);
    if (files.length > 0) onFiles(files);
  }, [disabled, onFiles, addLog]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    addLog(`handleClick triggered, disabled=${disabled}`);
    addLog(`  event.target.tagName=${(e.target as HTMLElement).tagName}`);
    addLog(`  event.currentTarget.tagName=${(e.currentTarget as HTMLElement).tagName}`);

    if (!disabled) {
      e.preventDefault();
      e.stopPropagation();
      addLog('calling openPicker...');
      addLog(`  isPickerSuppressed=${isPickerSuppressed()}`);
      addLog(`  inputRef.current exists=${!!inputRef.current}`);
      if (inputRef.current) {
        addLog(`  input.disabled=${inputRef.current.disabled}`);
        addLog(`  input.type=${inputRef.current.type}`);
      }
      openPicker(e);
      addLog('openPicker called');
    } else {
      addLog('handleClick: blocked - disabled=true');
    }
  }, [disabled, openPicker, addLog, isPickerSuppressed, inputRef]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    addLog(`handleKeyDown triggered, key=${e.key}, disabled=${disabled}`);
    if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      e.stopPropagation();
      addLog('calling openPicker from keyboard');
      openPicker();
    }
  }, [disabled, openPicker, addLog]);

  // 添加全局点击监控（仅在调试模式）
  useEffect(() => {
    if (!debug) return;

    const logGlobalClick = (e: MouseEvent) => {
      addLog(`Global click: target=${(e.target as HTMLElement)?.tagName?.toLowerCase() || 'unknown'}, className=${(e.target as HTMLElement)?.className?.toString()?.slice(0, 50) || 'none'}`);
    };

    document.addEventListener('click', logGlobalClick, true); // 捕获阶段
    return () => document.removeEventListener('click', logGlobalClick, true);
  }, [debug, addLog]);

  return (
    <div className="flex flex-col h-full space-y-4 relative">
      {/* Upload Area */}
      <div
        className={`relative rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-6 text-center ${
          disabled ? 'bg-slate-50 border-slate-200 cursor-not-allowed' : 'bg-white border-blue-200 hover:border-blue-500 hover:shadow-md cursor-pointer group'
        }`}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={disabled ? undefined : '点击或拖拽上传发票文件'}
        aria-disabled={disabled || undefined}
        onDragOver={(e: React.DragEvent) => {
          addLog('onDragOver triggered');
          e.preventDefault();
        }}
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
            点击或拖拽上传发票{debug ? ' (调试模式)' : ''}
          </p>
          <p className="text-[10px] text-slate-400">
            支持 JPG, PNG, PDF, OFD (最大 12MB)
          </p>
        </div>

        {/* Hidden file input */}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={COST_INVOICE_ACCEPT}
          multiple
          disabled={disabled}
          onChange={(e) => {
            addLog('input onChange triggered');
            onInputChange(e);
          }}
          className="hidden"
          tabIndex={-1}
        />

        {/* Debug Panel */}
        {debug && (
          <div className="absolute top-2 right-2 bg-black/90 text-green-400 p-2 rounded text-xs font-mono max-w-xs max-h-40 overflow-y-auto z-50">
            <div className="font-bold mb-1 text-yellow-400">调试日志</div>
            {debugLogs.map((log, i) => (
              <div key={i} className="text-[10px] leading-tight">{log}</div>
            ))}
          </div>
        )}
      </div>

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
                  ←
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
                  →
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 gap-3">
            <p className="text-xs font-medium uppercase tracking-widest">暂无预览内容</p>
          </div>
        )}
      </div>
    </div>
  );
}