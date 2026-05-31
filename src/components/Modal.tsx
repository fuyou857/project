import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes } from 'react-icons/fa';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({ isOpen, onClose, title, children, size = 'md', showCloseButton = true }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // focus-trap: 打开时聚焦面板内可聚焦元素，关闭时归还焦点
  const prevFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      prevFocus.current = document.activeElement as HTMLElement;
      // 延迟到 motion 动画完成后聚焦
      requestAnimationFrame(() => {
        panelRef.current?.focus();
      });
    } else if (prevFocus.current) {
      prevFocus.current.focus();
      prevFocus.current = null;
    }
  }, [isOpen]);

  // Escape 关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`relative bg-slate-800 rounded-xl shadow-2xl w-full ${sizeClasses[size]} max-h-[90vh] overflow-hidden`}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={title || '对话框'}
            tabIndex={-1}
          >
            {(title || showCloseButton) && (
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
                {title && <h3 className="text-xl font-bold text-white">{title}</h3>}
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="text-slate-400 hover:text-white transition-colors"
                    aria-label="关闭"
                  >
                    <FaTimes className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}
            <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
