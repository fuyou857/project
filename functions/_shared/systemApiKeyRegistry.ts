/**
 * 全项目第三方密钥注册表（单一数据源）
 * 新增集成时在此登记 key_code 与对应 Edge Secret / 环境变量名。
 */
export type ApiKeyRegistryEntry = {
  key_code: string;
  name: string;
  usage_scene: string;
  /** Edge / 服务端环境变量（按优先级尝试） */
  env_keys: string[];
  /** api_url 来源环境变量；无则 secret 可为 URL 或 JSON */
  url_env_keys?: string[];
  category: 'ocr' | 'convert' | 'wechat' | 'office' | 'other';
};

export const SYSTEM_API_KEY_REGISTRY: ApiKeyRegistryEntry[] = [
  {
    key_code: 'invoice_ocr_upstream',
    name: '发票 OCR 上游',
    usage_scene: '成本发票 OCR（Edge invoice-ocr / 本地 OCR 服务）',
    env_keys: ['INVOICE_OCR_UPSTREAM_URL'],
    url_env_keys: ['INVOICE_OCR_UPSTREAM_URL'],
    category: 'ocr',
  },
  {
    key_code: 'doc_convert_service_base',
    name: '合同文档转换服务根地址',
    usage_scene: 'contract-document-convert 编排 /invoke',
    env_keys: ['DOC_CONVERT_SERVICE_BASE_URL', 'DOC_CONVERT_WEBHOOK_URL'],
    url_env_keys: ['DOC_CONVERT_SERVICE_BASE_URL', 'DOC_CONVERT_WEBHOOK_URL'],
    category: 'convert',
  },
  {
    key_code: 'doc_convert_webhook_url',
    name: '合同转换 Webhook（原样转发）',
    usage_scene: 'contract-document-convert action=convert',
    env_keys: ['DOC_CONVERT_WEBHOOK_URL'],
    url_env_keys: ['DOC_CONVERT_WEBHOOK_URL'],
    category: 'convert',
  },
  {
    key_code: 'doc_convert_webhook_secret',
    name: '合同转换服务密钥',
    usage_scene: '请求头 X-Contract-Convert-Secret，对应容器 CONTRACT_CONVERT_SECRET',
    env_keys: ['DOC_CONVERT_WEBHOOK_SECRET', 'CONTRACT_CONVERT_SECRET'],
    category: 'convert',
  },
  {
    key_code: 'wechat_work',
    name: '企业微信',
    usage_scene: '扫码登录、消息推送（corpsecret 仅存服务端）',
    env_keys: ['WECHAT_WORK_CORP_SECRET'],
    category: 'wechat',
  },
  {
    key_code: 'onlyoffice_jwt_secret',
    name: 'ONLYOFFICE JWT',
    usage_scene: '文档服务器 JWT 校验（若启用）',
    env_keys: ['ONLYOFFICE_JWT_SECRET'],
    category: 'office',
  },
];

export function getRegistryEntry(keyCode: string): ApiKeyRegistryEntry | undefined {
  return SYSTEM_API_KEY_REGISTRY.find(e => e.key_code === keyCode);
}

/** 从环境变量读取首个非空值 */
export function readFirstEnv(keys: string[]): string | null {
  for (const k of keys) {
    const v = Deno.env.get(k)?.trim();
    if (v) return v;
  }
  return null;
}

/** 企业微信：合并公开项 + 密钥为 JSON 存入 secret 字段 */
export function buildWechatWorkBundle(): { api_url: string | null; secret: string } | null {
  const corpId = readFirstEnv(['WECHAT_WORK_CORP_ID']);
  const agentId = readFirstEnv(['WECHAT_WORK_AGENT_ID']);
  const redirectUri = readFirstEnv(['WECHAT_WORK_REDIRECT_URI']);
  const corpSecret = readFirstEnv(['WECHAT_WORK_CORP_SECRET']);
  if (!corpSecret && !corpId) return null;
  const bundle = {
    corp_id: corpId ?? '',
    agent_id: agentId ?? '',
    redirect_uri: redirectUri ?? '',
    corp_secret: corpSecret ?? '',
  };
  return {
    api_url: redirectUri,
    secret: JSON.stringify(bundle),
  };
}
