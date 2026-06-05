/** 弹窗面板动画：仅 opacity，勿用 scale（Edge 等浏览器在 transform 容器内无法打开 file input） */
export const MODAL_PANEL_MOTION = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.18 },
} as const;

export const MODAL_BACKDROP_MOTION = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.18 },
} as const;
