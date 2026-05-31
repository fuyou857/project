import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import SingleToastBanner from '../components/ui/SingleToastBanner';

type ToastData = { type: string; message: string } | null;

interface ToastContextValue {
  toast: ToastData;
  showToast: (type: string, message: string) => void;
  dismissToast: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children, durationMs = 3000 }: { children: ReactNode; durationMs?: number }) {
  const [toast, setToast] = useState<ToastData>(null);
  const timerRef = useState<ReturnType<typeof setTimeout> | null>(null);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  const showToast = useCallback(
    (type: string, message: string) => {
      if (timerRef[0]) clearTimeout(timerRef[0]);
      setToast({ type, message });
      const id = setTimeout(() => setToast(null), durationMs);
      timerRef[1](id);
    },
    [durationMs, timerRef],
  );

  return (
    <ToastContext.Provider value={{ toast, showToast, dismissToast }}>
      {children}
      {toast && <SingleToastBanner type={toast.type} message={toast.message} />}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a <ToastProvider>');
  }
  return ctx;
}