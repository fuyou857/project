/**
 * 将弹窗打开推迟到当前指针/点击事件结束之后，降低 click-through 风险。
 */
export function deferModalOpen(open: () => void): void {
  queueMicrotask(() => {
    requestAnimationFrame(() => {
      open();
    });
  });
}
