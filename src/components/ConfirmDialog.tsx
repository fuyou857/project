import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaExclamationTriangle } from 'react-icons/fa';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

const typeStyles = {
  danger: {
    icon: 'bg-red-600',
    button: 'bg-red-600 hover:bg-red-700',
  },
  warning: {
    icon: 'bg-yellow-600',
    button: 'bg-yellow-600 hover:bg-yellow-700',
  },
  info: {
    icon: 'bg-blue-600',
    button: 'bg-blue-600 hover:bg-blue-700',
  },
};

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = '确认操作',
  message,
  confirmText = '确认',
  cancelText = '取消',
  type = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  const styles = typeStyles[type];
  const containerRef = useFocusTrap(isOpen, onClose);
  const confirmRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      confirmRef.current?.focus();
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          ref={containerRef}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-message"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative bg-slate-800 rounded-xl shadow-2xl w-full max-w-md p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 ${styles.icon} rounded-full flex items-center justify-center flex-shrink-0`}>
                <FaExclamationTriangle className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 id="confirm-dialog-title" className="text-xl font-bold text-white mb-2">{title}</h3>
                <p id="confirm-dialog-message" className="text-slate-300 mb-6">{message}</p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose();
                    }}
                    disabled={loading}
                    className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
                  >
                    {cancelText}
                  </button>
                  <button
                    ref={confirmRef}
                    onClick={(e) => {
                      e.stopPropagation();
                      onConfirm();
                    }}
                    disabled={loading}
                    className={`px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 ${styles.button}`}
                    aria-busy={loading}
                  >
                    {loading ? '处理中...' : confirmText}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}