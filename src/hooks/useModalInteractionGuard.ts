import { useEffect, useRef, useState } from 'react';

/** 阻止「打开弹窗的同一次点击」穿透到弹窗内控件（如文件选择 label） */
export const MODAL_CLICK_THROUGH_GUARD_MS = 480;

/**
 * 弹窗打开后短暂禁止内容与遮罩响应指针，避免 mousedown 在触发按钮、
 * mouseup 落在弹窗内上传区而误唤起文件选择框或立刻关闭弹窗。
 */
export function useModalInteractionGuard(open: boolean): boolean {
  const [ready, setReady] = useState(false);
  const generationRef = useRef(0);

  useEffect(() => {
    if (!open) {
      setReady(false);
      return undefined;
    }

    setReady(false);
    const generation = ++generationRef.current;

    const timer = window.setTimeout(() => {
      if (generationRef.current === generation) {
        setReady(true);
      }
    }, MODAL_CLICK_THROUGH_GUARD_MS);

    return () => window.clearTimeout(timer);
  }, [open]);

  return ready;
}
