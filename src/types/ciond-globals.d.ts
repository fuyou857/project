export {};

declare global {
  interface Window {
    /** 构建时由 template.html 注入，与 OnlyOffice 配置同理 */
    __CIOND_INVOICE_OCR_SERVICE_URL__?: string;
  }
}
