import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { resetBodyInteractionLock } from '../../utils/bodyInteractionLock';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useModalInteractionGuard } from '../../hooks/useModalInteractionGuard';

type Props = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  zIndex?: number;
  panelClassName?: string;
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
 * 关闭后保留短暂 exit 动画，且全程 pointer-events-none 于外层，避免全屏假死。
 */
export default function UiModalOverlay({
  open,
  onClose,
  children,
  zIndex = 50,
  panelClassName = 'bg-white rounded-xl w-full max-h-[95vh] overflow-hidden shadow-xl',
  interactionReady: interactionReadyProp,
}: Props) {
  const [exiting, setExiting] = useState(false);
  const visible = open || exiting;
  const internalReady = useModalInteractionGuard(open);
  const interactionReady = interactionReadyProp ?? internalReady;
  const contentInteractive = open && interactionReady && !exiting;

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) setExiting(true);
  }, [open]);

  useEffect(() => {
    if (open) setExiting(false);
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
          className="fixed inset-0 flex items-center justify-center p-4 sm:p-6 pointer-events-none"
          style={{ zIndex }}
        >
          <motion.div
            role="presentation"
            aria-hidden
            className="absolute inset-0 bg-black/50 pointer-events-none"
          />
          {contentInteractive ? (
            <div
              role="presentation"
              className="absolute inset-0 pointer-events-auto"
              onPointerDown={handleBackdropClose}
              onClick={handleBackdropClose}
            />
          ) : null}
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className={`relative z-10 max-h-[95vh] w-full pointer-events-none ${panelClassName}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={contentInteractive ? 'pointer-events-auto h-full' : 'pointer-events-none h-full'}>
              {children}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
