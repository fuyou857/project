import { useCallback, useEffect, useId, useRef } from 'react';

/** 关闭原生文件框后抑制再次唤起，避免 focus/click 回弹导致循环弹窗 */
export const FILE_PICKER_SUPPRESS_MS = 1200;

type Options = {
  disabled?: boolean;
  accept?: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  debug?: boolean; // 启用调试模式
};

/**
 * 安全封装 <input type="file">：仅在用户明确点击触发区时同步打开；
 * 用户取消系统文件框后抑制重复 click()，并 blur 焦点以防页面锁死。
 *
 * 增强版：添加错误处理、调试日志、回退机制
 */
export function useSafeFileInput({ disabled = false, accept, multiple = false, onFiles, debug = false }: Options) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pickerSessionRef = useRef(false);
  const suppressUntilRef = useRef(0);
  const disabledRef = useRef(disabled);

  disabledRef.current = disabled;

  const log = (msg: string) => {
    if (!debug) return;
    console.log(`[useSafeFileInput] ${msg}`);
  };

  const releasePickerSession = useCallback(() => {
    log('releasePickerSession called');
    pickerSessionRef.current = false;
    suppressUntilRef.current = Date.now() + FILE_PICKER_SUPPRESS_MS;
    log(`Suppress until ${new Date(suppressUntilRef.current).toLocaleTimeString()}`);

    inputRef.current?.blur();
    triggerRef.current?.blur();

    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body) {
      active.blur();
    }
  }, [log]);

  const openPicker = useCallback(
    (e?: React.SyntheticEvent) => {
      e?.preventDefault();
      e?.stopPropagation();

      log('openPicker called');
      log(`  disabled=${disabledRef.current}`);
      log(`  pickerSession=${pickerSessionRef.current}`);
      log(`  suppressed=${Date.now() < suppressUntilRef.current}`);

      if (disabledRef.current) {
        log('  BLOCKED: disabled');
        return;
      }

      if (pickerSessionRef.current) {
        log('  BLOCKED: picker session already active');
        return;
      }

      if (Date.now() < suppressUntilRef.current) {
        log(`  BLOCKED: suppressed until ${new Date(suppressUntilRef.current).toLocaleTimeString()}`);
        return;
      }

      pickerSessionRef.current = true;

      const input = inputRef.current;
      log(`  input exists: !!input = ${!!input}`);
      if (input) {
        log(`  input.disabled = ${input.disabled}`);
        log(`  input.type = ${input.type}`);
        log(`  input.parentElement = ${input.parentElement?.tagName}`);
        log(`  input.offsetParent = ${input.offsetParent ? 'visible' : 'hidden (display:none or not in DOM)'}`);
        log(`  input.hidden = ${input.hidden}`);
        log(`  input.getBoundingClientRect() = ${JSON.stringify(input.getBoundingClientRect())}`);
      }

      // 必须在用户手势回调内同步调用，避免 setTimeout 在系统文件框关闭后误触发
      try {
        input?.click();
        log('  input.click() called successfully');
      } catch (err) {
        console.error('[useSafeFileInput] Error calling input.click():', err);
        log(`  ERROR: ${(err as Error).message}`);
        pickerSessionRef.current = false; // 重置状态以便重试
      }
    },
    [log],
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      log('onInputChange triggered');
      releasePickerSession();
      const list = e.target.files;
      log(`  files length: ${list?.length || 0}`);
      if (list?.length) {
        const files = Array.from(list);
        log(`  calling onFiles with ${files.length} files`);
        onFiles(files);
      }
      e.target.value = '';
    },
    [onFiles, releasePickerSession, log],
  );

  useEffect(() => {
    const input = inputRef.current;
    if (!input) {
      log('useEffect[input]: no input element found');
      return undefined;
    }

    log(`useEffect[input]: setting up cancel listener`);

    const onCancel = () => {
      log('input cancel event triggered');
      releasePickerSession();
    };

    input.addEventListener('cancel', onCancel);
    return () => {
      log('useEffect[input]: cleanup cancel listener');
      input.removeEventListener('cancel', onCancel);
    };
  }, [releasePickerSession, log]);

  useEffect(() => {
    log('useEffect[global]: setting up global listeners');

    const onWindowFocus = () => {
      log('window focus event');
      if (!pickerSessionRef.current) return;
      releasePickerSession();
    };

    const onVisibilityChange = () => {
      log(`visibilitychange: ${document.visibilityState}`);
      if (document.visibilityState === 'visible' && pickerSessionRef.current) {
        releasePickerSession();
      }
    };

    const blockReopenClick = (event: MouseEvent) => {
      if (Date.now() < suppressUntilRef.current) {
        const target = event.target as Node | null;
        const targetTag = (target as HTMLElement)?.tagName?.toLowerCase() || 'unknown';

        const inInput = inputRef.current?.contains(target);
        const inTrigger = triggerRef.current?.contains(target);

        if (inInput || inTrigger) {
          log(`blockReopenClick: blocking ${event.type} on <${targetTag}> (inInput=${inInput}, inTrigger=${inTrigger})`);
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
        }
      }
    };

    window.addEventListener('focus', onWindowFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('click', blockReopenClick, true); // 捕获阶段
    document.addEventListener('pointerup', blockReopenClick, true); // 捕获阶段

    return () => {
      log('useEffect[global]: cleanup global listeners');
      window.removeEventListener('focus', onWindowFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('click', blockReopenClick, true);
      document.removeEventListener('pointerup', blockReopenClick, true);
    };
  }, [releasePickerSession, log]);

  return {
    inputId,
    inputRef,
    triggerRef,
    openPicker,
    onInputChange,
    isPickerSuppressed: () => Date.now() < suppressUntilRef.current,
  };
}