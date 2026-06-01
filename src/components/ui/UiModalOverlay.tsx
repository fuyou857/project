import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes } from 'react-icons/fa';
import { resetBodyInteractionLock } from '../../utils/bodyInteractionLock';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useModalInteractionGuard } from '../../hooks/useModalInteractionGuard';

type Props = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  zIndex?: number;
  panelClassName?: string;
  showCloseButton?: boolean;
  /** 由父级传入时可与上传区等共用同一「点击穿透」保护窗口 */
  interactionReady?: boolean;
};

function safeInvokeClose(onClose: () => void): void {
  try {
    onClose();
  } catch (err) {
    console.error('[UiModalOverlay] onClose failed', err);
  } finally {
    resetBodyInteractionLock();
  }
}

/**
 * Modal shell with portal + click-through guard + ESC to close.
 *
 * 事件分层设计：
 * - 最外层 wrapper: pointer-events-none（仅用于布局和动画容器）
 * - 遮罩层: 480ms 保护期内不可点击（防止穿透）
 * - 面板层: pointer-events-none（防止动画期间误触）
 * - 内容层: 始终 pointer-events-auto（关闭按钮始终可响应）
 * - 关闭按钮: 独立 absolute 定位，z-index 高于面板，始终可交互
 */
export default function UiModalOverlay({
  open,
  onClose,
  children,
  zIndex = 50,
  panelClassName = 'bg-white rounded-xl w-full max-h-[95vh] overflow-hidden shadow-xl',
  showCloseButton = true,
  interactionReady: interactionReadyProp,
}: Props) {
  const [exiting, setExiting] = useState(false);
  const visible = open || exiting;
  const internalReady = useModalInteractionGuard(open);
  const interactionReady = interactionReadyProp ?? internalReady;
  const contentInteractive = open && interactionReady && !exiting;

  useBodyScrollLock(open);

  useEffect(() => {
    if (open) {
      setExiting(false);
    } else {
      setExiting(true);
    }
  }, [open]);

  const requestClose = useCallback(() => {
    setExiting(true);
    safeInvokeClose(onClose);
  }, [onClose]);

  const handleBackdropClose = useCallback(
    (e: React.MouseEvent | React.PointerEvent) => {
      if (!contentInteractive) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      requestClose();
    },
    [contentInteractive, requestClose],
  );

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      requestClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, requestClose]);

  const handleExitComplete = useCallback(() => {
    setExiting(false);
    resetBodyInteractionLock();
  }, []);

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <AnimatePresence initial={false} onExitComplete={handleExitComplete}>
      {visible ? (
        <motion.div
          key="ui-modal-overlay"
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 flex items-center justify-center p-4 sm:p-6"
          style={{ zIndex }}
        >
          <motion.div
            role="presentation"
            aria-hidden
            className="absolute inset-0 bg-black/50 cursor-pointer"
            onPointerDown={handleBackdropClose}
            onClick={handleBackdropClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className={`relative z-10 max-h-[95vh] w-full cursor-default ${panelClassName}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>

          {showCloseButton && (
            <button
              type="button"
              onClick={requestClose}
              className="absolute top-2 right-2 z-20 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              style={{ zIndex: zIndex + 10 }}
              aria-label="关闭"
            >
              <FaTimes className="w-5 h-5" />
            </button>
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
