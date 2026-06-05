import { useCallback, useId, useRef, type ReactNode } from 'react';

export const FILE_UPLOAD_INPUT_ATTR = 'data-file-upload-field';

type Props = {
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  className?: string;
  browseLabel?: string;
  title?: string;
  hint?: ReactNode;
  showBrowseButton?: boolean;
  minHeightClassName?: string;
  onDropFiles?: (files: File[]) => void;
};

/**
 * Edge 安全的上传触发区：label 关联 + 始终挂载的透明 file input + 「浏览文件」兜底按钮。
 * 勿使用 hidden/sr-only 或仅在测量成功后才渲染 input。
 */
export default function FileUploadField({
  accept,
  multiple = false,
  disabled = false,
  onFiles,
  className = '',
  browseLabel = '浏览文件',
  title = '点击或拖拽上传',
  hint,
  showBrowseButton = true,
  minHeightClassName = 'min-h-[150px]',
  onDropFiles,
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const interactive = !disabled;

  const handleFilesSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (list?.length) onFiles(Array.from(list));
    e.target.value = '';
  }, [onFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!interactive) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    if (onDropFiles) {
      onDropFiles(files);
    } else {
      onFiles(files);
    }
  }, [interactive, onDropFiles, onFiles]);

  const handleBrowseClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!interactive) return;
    inputRef.current?.click();
  }, [interactive]);

  return (
    <label
      htmlFor={interactive ? inputId : undefined}
      className={`relative block w-full overflow-visible rounded-2xl border-2 border-dashed transition-all p-6 text-center ${minHeightClassName} ${
        disabled
          ? 'bg-slate-50 border-slate-200 cursor-not-allowed'
          : 'bg-white border-blue-200 hover:border-blue-500 hover:shadow-md cursor-pointer group'
      } ${className}`}
      aria-disabled={disabled || undefined}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        id={inputId}
        data-file-upload-field="true"
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={!interactive}
        onChange={handleFilesSelected}
        className="ui-file-input-overlay"
        aria-hidden
        tabIndex={-1}
      />

      <div className="pointer-events-none flex flex-col items-center justify-center">
        <div className="space-y-1">
          <p className={`text-sm font-bold ${disabled ? 'text-slate-400' : 'text-slate-700'}`}>{title}</p>
          {hint ? (
            <div className="text-[10px] text-slate-400">{hint}</div>
          ) : null}
        </div>

        {interactive && showBrowseButton && (
          <span
            role="button"
            tabIndex={0}
            onClick={handleBrowseClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') handleBrowseClick(e as unknown as React.MouseEvent);
            }}
            className="pointer-events-auto mt-3 px-4 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
          >
            {browseLabel}
          </span>
        )}
      </div>
    </label>
  );
}
