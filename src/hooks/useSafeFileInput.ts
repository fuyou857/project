import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** 透明覆盖在触发区上的 file input（勿用 hidden/sr-only，Edge 等浏览器无法唤起选择框） */
export const FILE_INPUT_OVERLAY_CLASS =
  'absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0';

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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cancelCleanupRef = useRef<(() => void) | null>(null);
  const triggerRef = useRef<HTMLElement>(null);
  const pickerSessionRef = useRef(false);
  const suppressUntilRef = useRef(0);
  const disabledRef = useRef(disabled);

  disabledRef.current = disabled;

  const releasePickerSession = useCallback((options?: { suppress?: boolean }) => {
    pickerSessionRef.current = false;
    if (options?.suppress !== false) {
      suppressUntilRef.current = Date.now() + FILE_PICKER_SUPPRESS_MS;
    }
    inputRef.current?.blur();
    triggerRef.current?.blur();
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body) {
      active.blur();
    }
  }, []);

  /** 用户直接点击透明 file input 时标记会话，供 cancel / focus 清理 */
  const markPickerOpening = useCallback(() => {
    if (disabledRef.current) return;
    if (Date.now() < suppressUntilRef.current) return;
    pickerSessionRef.current = true;
  }, []);

  const openPicker = useCallback(
    (e?: React.SyntheticEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      if (disabledRef.current) return;
      if (pickerSessionRef.current) return;
      if (Date.now() < suppressUntilRef.current) return;

      const input = inputRef.current;
      if (!input) return;

      pickerSessionRef.current = true;
      // 必须在用户手势回调内同步调用，避免 setTimeout 在系统文件框关闭后误触发
      try {
        input.click();
      } catch {
        pickerSessionRef.current = false;
      }
    },
    [],
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const list = e.target.files;
      releasePickerSession({ suppress: false });
      if (list?.length) onFiles(Array.from(list));
      e.target.value = '';
    },
    [onFiles, releasePickerSession],
  );

  const setInputRef = useCallback(
    (node: HTMLInputElement | null) => {
      cancelCleanupRef.current?.();
      cancelCleanupRef.current = null;
      inputRef.current = node;
      if (!node) return;

      const onCancel = () => {
        if (!pickerSessionRef.current) return;
        releasePickerSession({ suppress: true });
      };

      node.addEventListener('cancel', onCancel);
      cancelCleanupRef.current = () => node.removeEventListener('cancel', onCancel);
    },
    [releasePickerSession],
  );

  useEffect(() => () => cancelCleanupRef.current?.(), []);

  useEffect(() => {
    const onWindowFocus = () => {
      if (!pickerSessionRef.current) return;
      releasePickerSession({ suppress: true });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && pickerSessionRef.current) {
        releasePickerSession({ suppress: true });
      }
    };

    const blockReopenClick = (event: MouseEvent) => {
      if (Date.now() < suppressUntilRef.current) {
        const target = event.target as Node | null;
        // 直接点击 file input 必须放行，否则 Edge 等浏览器无法再次打开文件框
        if (target === inputRef.current) return;
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
    inputRef: setInputRef,
    triggerRef,
    openPicker,
    markPickerOpening,
    onInputChange,
    isPickerSuppressed: () => Date.now() < suppressUntilRef.current,
  };
}

export type PortaledOverlayRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

/**
 * 将透明 file input 定位到触发区（挂到 body），避免弹窗 overflow:hidden 导致 Edge 无法打开文件框。
 */
export function usePortaledOverlayRect(
  triggerRef: RefObject<HTMLElement | null>,
  active: boolean,
): PortaledOverlayRect | null {
  const [rect, setRect] = useState<PortaledOverlayRect | null>(null);

  useLayoutEffect(() => {
    if (!active) {
      setRect(null);
      return undefined;
    }

    const update = () => {
      const el = triggerRef.current;
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
      });
    };

    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    const el = triggerRef.current;
    if (el) ro?.observe(el);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [active, triggerRef]);

  return rect;
}
