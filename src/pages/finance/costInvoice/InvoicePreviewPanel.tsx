import { useCallback, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FaCloudUploadAlt,
  FaChevronLeft,
  FaChevronRight,
  FaRedo,
  FaSearchMinus,
  FaSearchPlus,
  FaSync,
  FaUndo,
  FaMagic,
} from 'react-icons/fa';
import { useSafeFileInput } from '../../../hooks/useSafeFileInput';
import type { InvoiceAttachmentItem } from './types';
import { COST_INVOICE_ACCEPT, type OcrUiStatus } from './types';
import {
  isInvoiceImageMime,
  isInvoiceOfdMime,
  isInvoicePdfMime,
} from './invoiceFileUtils';
import { canvasToBlob, loadImageFromUrl, renderImageToCanvas, validateInvoiceImageFile } from './invoiceImageUtils';

type Props = {
  attachments: InvoiceAttachmentItem[];
  activeIndex: number;
  onActiveIndexChange: (i: number) => void;
  uploading: boolean;
  ocrStatus: OcrUiStatus;
  progress: number;
  progressLabel: string;
  disabled: boolean;
  /** 弹窗点击穿透保护结束后再允许唤起文件框 */
  fileUploadEnabled?: boolean;
  onFiles: (files: File[]) => void;
  onOptimizedFile?: (file: File) => void;
};

export default function InvoicePreviewPanel({
  attachments,
  activeIndex,
  onActiveIndexChange,
  uploading,
  ocrStatus,
  progress,
  progressLabel,
  disabled,
  fileUploadEnabled = true,
  onFiles,
  onOptimizedFile,
}: Props) {
  const uploadBlocked = disabled || !fileUploadEnabled;

  const { triggerRef, openPicker } = useSafeFileInput({
    disabled: uploadBlocked,
    accept: COST_INVOICE_ACCEPT,
    multiple: true,
    onFiles,
  });

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const [enhancing, setEnhancing] = useState(false);

  const current = attachments[activeIndex];

  const resetView = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setRotation(0);
  };

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (uploadBlocked) return;
      const list = Array.from(e.dataTransfer.files);
      if (list.length) onFiles(list);
    },
    [uploadBlocked, onFiles],
  );

  const runEnhance = async () => {
    if (!current || !isInvoiceImageMime(current.mime, current.url) || !onOptimizedFile) return;
    setEnhancing(true);
    try {
      const img = await loadImageFromUrl(current.url);
      const canvas = renderImageToCanvas(img, { rotation, brightness: 1.06, contrast: 1.12, sharpen: true });
      const blob = await canvasToBlob(canvas);
      const file = new File([blob], current.filename.replace(/\.\w+$/, '') + '_enhanced.jpg', {
        type: 'image/jpeg',
      });
      const err = validateInvoiceImageFile(file);
      if (err) throw new Error(err);
      onOptimizedFile(file);
    } catch (e) {
      alert(e instanceof Error ? e.message : '画质优化失败');
    } finally {
      setEnhancing(false);
    }
  };

  const statusBadge = () => {
    if (uploading) return { text: '上传中', cls: 'bg-blue-100 text-blue-800' };
    if (ocrStatus === 'pending') return { text: '智能识别中', cls: 'bg-blue-100 text-blue-800' };
    if (ocrStatus === 'success') return { text: '识别完成', cls: 'bg-emerald-100 text-emerald-800' };
    if (ocrStatus === 'partial') return { text: '字段缺失', cls: 'bg-amber-100 text-amber-800' };
    if (ocrStatus === 'failed') return { text: '识别失败', cls: 'bg-red-100 text-red-700' };
    return { text: '待上传识别', cls: 'bg-slate-100 text-slate-600' };
  };
  const badge = statusBadge();

  return (
    <motion.div
      layout
      className="cost-invoice-preview flex flex-col h-full min-h-[420px] rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50/40 shadow-sm overflow-hidden"
    >
      <motion.div
        className={`m-3 rounded-lg border-2 border-dashed transition-colors ${
          uploadBlocked ? 'border-slate-200 opacity-60' : 'border-blue-300/80 hover:border-blue-500'
        }`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <button
          ref={triggerRef}
          type="button"
          disabled={uploadBlocked}
          onClick={openPicker}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          className={`flex w-full flex-col items-center justify-center border-0 bg-transparent py-8 px-4 ${
            uploadBlocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-blue-50/50'
          }`}
        >
          <FaCloudUploadAlt className="text-4xl text-blue-500 mb-2" />
          <p className="text-sm font-medium text-slate-700">点击或拖拽上传发票文件</p>
          <p className="text-xs text-slate-500 mt-1">支持 JPG / PNG / PDF / OFD，单文件最大 12MB · 上传后自动识别</p>
        </button>
      </motion.div>

      {(ocrStatus === 'pending' || uploading) && (
        <motion.div className="px-4 pb-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <motion.div className="h-2 rounded-full bg-slate-200 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-400"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.35 }}
            />
          </motion.div>
          <p className="text-xs text-slate-600 mt-1">{progressLabel}</p>
        </motion.div>
      )}

      <motion.div layout className="px-3 flex items-center justify-between gap-2 flex-wrap">
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${badge.cls}`}>{badge.text}</span>
        {attachments.length > 1 && (
          <motion.div className="flex items-center gap-1" layout>
            <button
              type="button"
              disabled={activeIndex <= 0 || disabled}
              onClick={() => onActiveIndexChange(activeIndex - 1)}
              className="p-1.5 rounded-lg hover:bg-white/80 disabled:opacity-40"
            >
              <FaChevronLeft />
            </button>
            <span className="text-xs text-slate-600 tabular-nums">
              {activeIndex + 1} / {attachments.length}
            </span>
            <button
              type="button"
              disabled={activeIndex >= attachments.length - 1 || disabled}
              onClick={() => onActiveIndexChange(activeIndex + 1)}
              className="p-1.5 rounded-lg hover:bg-white/80 disabled:opacity-40"
            >
              <FaChevronRight />
            </button>
          </motion.div>
        )}
      </motion.div>

      <motion.div className="flex-1 relative mx-3 mb-2 rounded-lg bg-slate-900/5 border border-slate-200 overflow-hidden min-h-[240px]">
        {(() => {
          if (current && isInvoiceImageMime(current.mime, current.url)) {
            return (
              <motion.div
                className="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
                onMouseDown={(e) => {
                  setDragging(true);
                  dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
                }}
                onMouseMove={(e) => {
                  if (!dragging) return;
                  setOffset({
                    x: dragStart.current.ox + (e.clientX - dragStart.current.x),
                    y: dragStart.current.oy + (e.clientY - dragStart.current.y),
                  });
                }}
                onMouseUp={() => setDragging(false)}
                onMouseLeave={() => setDragging(false)}
              >
                <img
                  src={current.url}
                  alt=""
                  draggable={false}
                  className="max-w-none select-none transition-transform duration-200"
                  style={{
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale}) rotate(${rotation}deg)`,
                  }}
                />
              </motion.div>
            );
          }
          if (current && isInvoicePdfMime(current.mime, current.url)) {
            return (
              <iframe
                src={current.url}
                title={current.filename || '发票 PDF'}
                className="w-full h-full min-h-[280px] border-0 bg-white"
              />
            );
          }
          if (current) {
            return (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm p-4 text-center">
                {isInvoiceOfdMime(current.mime, current.url) ? (
                  <p>OFD 格式暂不支持内嵌预览，可新窗口打开查看；识别将照常进行</p>
                ) : (
                  <p>当前附件格式无法内嵌预览</p>
                )}
                <a
                  href={current.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 mt-2 text-xs"
                >
                  新窗口打开 {current.filename}
                </a>
              </div>
            );
          }
          return (
            <motion.div className="flex items-center justify-center h-full text-slate-400 text-sm">
              暂无预览
            </motion.div>
          );
        })()}
      </motion.div>

      <div className="px-3 pb-3 flex flex-wrap gap-1.5">
        {[
          { icon: FaSearchMinus, fn: () => setScale((s) => Math.max(0.4, s - 0.15)), label: '缩小' },
          { icon: FaSearchPlus, fn: () => setScale((s) => Math.min(3, s + 0.15)), label: '放大' },
          { icon: FaUndo, fn: resetView, label: '还原' },
          { icon: FaRedo, fn: () => setRotation((r) => r + 90), label: '旋转' },
          { icon: FaMagic, fn: runEnhance, label: '优化', loading: enhancing },
          { icon: FaSync, fn: resetView, label: '居中' },
        ].map(({ icon: Icon, fn, label, loading }) => (
          <button
            key={label}
            type="button"
            disabled={
              disabled ||
              !current ||
              loading ||
              (label === '优化' && (!current || !isInvoiceImageMime(current.mime, current.url)))
            }
            title={label}
            onClick={fn}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-white border border-slate-200 text-slate-700 hover:border-blue-400 hover:text-blue-700 disabled:opacity-40 transition-colors"
          >
            <Icon className={loading ? 'animate-spin' : ''} /> {label}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
