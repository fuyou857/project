import { useCallback, useEffect, useId, useRef } from 'react';

/** 关闭原生文件框后抑制再次唤起，避免 focus/click 回弹导致循环弹窗 */
export const FILE_PICKER_SUPPRESS_MS = 1200;

type Options = {
  disabled?: boolean;
  accept?: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
};

/**
 * 安全封装 <input type="file">：仅在用户明确点击触发区时同步打开；
 * 用户取消系统文件框后抑制重复 click()，并 blur 焦点以防页面锁死。
 */
export function useSafeFileInput({ disabled = false, accept, multiple = false, onFiles }: Options) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const pickerSessionRef = useRef(false);
  const suppressUntilRef = useRef(0);
  const disabledRef = useRef(disabled);

  disabledRef.current = disabled;

  const releasePickerSession = useCallback(() => {
    pickerSessionRef.current = false;
    suppressUntilRef.current = Date.now() + FILE_PICKER_SUPPRESS_MS;
    inputRef.current?.blur();
    triggerRef.current?.blur();
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body) {
      active.blur();
    }
  }, []);

  const openPicker = useCallback(
    (e?: React.SyntheticEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      if (disabledRef.current) return;
      if (pickerSessionRef.current) return;
      if (Date.now() < suppressUntilRef.current) return;

      pickerSessionRef.current = true;
      // 必须在用户手势回调内同步调用，避免 setTimeout 在系统文件框关闭后误触发
      inputRef.current?.click();
    },
    [],
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      releasePickerSession();
      const list = e.target.files;
      if (list?.length) onFiles(Array.from(list));
      e.target.value = '';
    },
    [onFiles, releasePickerSession],
  );

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return undefined;

    const onCancel = () => {
      releasePickerSession();
    };

    input.addEventListener('cancel', onCancel);
    return () => input.removeEventListener('cancel', onCancel);
  }, [releasePickerSession]);

  useEffect(() => {
    const onWindowFocus = () => {
      if (!pickerSessionRef.current) return;
      releasePickerSession();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && pickerSessionRef.current) {
        releasePickerSession();
      }
    };

    const blockReopenClick = (event: MouseEvent) => {
      if (Date.now() < suppressUntilRef.current) {
        const target = event.target as Node | null;
        if (inputRef.current?.contains(target) || triggerRef.current?.contains(target)) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
        }
      }
    };

    window.addEventListener('focus', onWindowFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('click', blockReopenClick, true);
    document.addEventListener('pointerup', blockReopenClick, true);

    return () => {
      window.removeEventListener('focus', onWindowFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('click', blockReopenClick, true);
      document.removeEventListener('pointerup', blockReopenClick, true);
    };
  }, [releasePickerSession]);

  return {
    inputId,
    inputRef,
    triggerRef,
    openPicker,
    onInputChange,
    isPickerSuppressed: () => Date.now() < suppressUntilRef.current,
  };
}
