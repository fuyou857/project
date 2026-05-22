/**
 * 系统内置密钥注册表（与 functions/_shared/systemApiKeyRegistry.ts 保持一致）
 * 浏览器端禁止读取密钥明文；列表与同步经 api-key-ops Edge Function。
 */
export const SYSTEM_API_KEY_REGISTRY_META = [
  {
    key_code: 'invoice_ocr_upstream',
    name: '发票 OCR 上游',
    usage_scene: '成本发票 OCR',
    category: 'ocr' as const,
    env_keys: ['INVOICE_OCR_UPSTREAM_URL'],
  },
  {
    key_code: 'doc_convert_service_base',
    name: '合同文档转换服务根地址',
    usage_scene: 'contract-document-convert 编排',
    category: 'convert' as const,
    env_keys: ['DOC_CONVERT_SERVICE_BASE_URL', 'DOC_CONVERT_WEBHOOK_URL'],
  },
  {
    key_code: 'doc_convert_webhook_url',
    name: '合同转换 Webhook',
    usage_scene: 'convert 原样转发',
    category: 'convert' as const,
    env_keys: ['DOC_CONVERT_WEBHOOK_URL'],
  },
  {
    key_code: 'doc_convert_webhook_secret',
    name: '合同转换服务密钥',
    usage_scene: 'X-Contract-Convert-Secret',
    category: 'convert' as const,
    env_keys: ['DOC_CONVERT_WEBHOOK_SECRET', 'CONTRACT_CONVERT_SECRET'],
  },
  {
    key_code: 'wechat_work',
    name: '企业微信',
    usage_scene: '登录与消息',
    category: 'wechat' as const,
    env_keys: ['WECHAT_WORK_CORP_SECRET', 'WECHAT_WORK_CORP_ID', 'WECHAT_WORK_AGENT_ID'],
  },
  {
    key_code: 'onlyoffice_jwt_secret',
    name: 'ONLYOFFICE JWT',
    usage_scene: '文档服务器 JWT',
    category: 'office' as const,
    env_keys: ['ONLYOFFICE_JWT_SECRET'],
  },
] as const;

export const KEY_CODE = {
  INVOICE_OCR_UPSTREAM: 'invoice_ocr_upstream',
  DOC_CONVERT_SERVICE_BASE: 'doc_convert_service_base',
  DOC_CONVERT_WEBHOOK_URL: 'doc_convert_webhook_url',
  DOC_CONVERT_WEBHOOK_SECRET: 'doc_convert_webhook_secret',
  WECHAT_WORK: 'wechat_work',
  ONLYOFFICE_JWT_SECRET: 'onlyoffice_jwt_secret',
} as const;

export type SystemApiKeyCode = (typeof KEY_CODE)[keyof typeof KEY_CODE];

/** @deprecated 使用 KEY_CODE */
export const SYSTEM_API_KEY_CODES = KEY_CODE;
