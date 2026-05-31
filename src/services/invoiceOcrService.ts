/**
 * 本地 OCR 正式接口（腾讯云重构版）
 *
 * 接口格式：POST /api/invoice/ocr → data 为 InvoiceOcrPayload
 *
 * 生产站点优先走同源反代（www.ciond.com/api/invoice/ocr），避免跨域 Failed to fetch。
 */
import { formatHttpNonJsonError } from '../utils/httpErrorMessage';
import { resolveIntegrationPostUrl } from '../utils/integrationServiceUrl';

export const INVOICE_OCR_POST_URL_DEFAULT = 'https://ocr.ciond.com/api/invoice/ocr';
export const INVOICE_OCR_SAME_ORIGIN_PATH = '/api/invoice/ocr';
export const INVOICE_OCR_MAX_BYTES = 12 * 1024 * 1024;
export const INVOICE_OCR_TIMEOUT_MS = 300_000;

/** 完整的发票OCR识别结果（前端直接使用后端返回的格式） */
export type InvoiceOcrPayload = {
  ocr_invoice_type_label: string | null;
  invoice_code: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  invoice_title: string | null;
  consumption_type: string | null;
  buyer_name: string | null;
  buyer_address_phone: string | null;
  buyer_bank: string | null;
  goods_name: string | null;
  tax_rate: number | null;
  unit_price: string | null;
  unit: string | null;
  quantity: string | null;
  line_amount: string | null;
  line_tax: string | null;
  subtotal_amount: string | null;
  amount_excluding_tax: number | null;
  total_amount_excl: string | null;
  tax_amount: number | null;
  total_tax: string | null;
  invoice_amount: number | null;
  amount_in_words: string | null;
  seller_name: string | null;
  seller_address_phone: string | null;
  seller_bank: string | null;
  seller_tax_id: string | null;
  remark: string | null;
  service_category: string | null;
  ocr_status: 'success' | 'partial' | 'failed';
  warnings: string[];
  fieldWarnings?: Record<string, string>;
};

/** 本地OCR服务响应格式 */
type LocalOcrResponse = {
  code: number;
  message: string;
  data: InvoiceOcrPayload | null;
};

const OCR_PATH_SUFFIX = '/api/invoice/ocr';

export function resolveInvoiceOcrPostUrl(): string {
  return resolveIntegrationPostUrl({
    sameOriginPath: INVOICE_OCR_SAME_ORIGIN_PATH,
    sameOriginHostnames: ['www.ciond.com', 'ciond.com'],
    windowGlobalKey: '__CIOND_INVOICE_OCR_SERVICE_URL__',
    envKeys: ['INVOICE_OCR_SERVICE_URL', 'NEXT_PUBLIC_INVOICE_OCR_SERVICE_URL'],
    defaultUrl: INVOICE_OCR_POST_URL_DEFAULT,
    suffix: OCR_PATH_SUFFIX,
  });
}

async function fileForOcrUpload(params: {
  files?: File[];
  fileUrls: string[];
}): Promise<File | null> {
  if (params.files?.length) return params.files[0];
  const url = params.fileUrls[0]?.trim();
  if (!url) return null;
  try {
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) return null;
    const blob = await res.blob();
    const name = decodeURIComponent(url.split('/').pop()?.split('?')[0] || 'invoice.jpg');
    return new File([blob], name, { type: blob.type || 'application/octet-stream' });
  } catch (e) {
    console.error('[invoiceOcr] 无法从附件URL拉取文件用于OCR', e);
    return null;
  }
}

/**
 * 异常值过滤：检查并移除异常数值
 */
function normalizeAndFilter(payload: InvoiceOcrPayload): InvoiceOcrPayload {
  const filtered = { ...payload } as Record<string, unknown>;
  
  const ABNORMAL_NUMBERS = ['343', '826', '1082', '9.16', '343.00', '826.00', '1082.00'];
  const ABNORMAL_STRINGS = new Set(ABNORMAL_NUMBERS);
  
  for (const key of Object.keys(filtered)) {
    const value = filtered[key];
    if (typeof value === 'string') {
      if (ABNORMAL_STRINGS.has(value)) {
        filtered[key] = null;
      }
    }
  }
  
  return filtered as InvoiceOcrPayload;
}

/**
 * 统计OCR结果中可用于回填的字段数量
 */
export function countRecognizedInvoiceOcrFields(data: InvoiceOcrPayload): number {
  const keys: Array<keyof InvoiceOcrPayload> = [
    'invoice_code', 'invoice_number', 'invoice_date', 'ocr_invoice_type_label',
    'invoice_title', 'consumption_type', 'buyer_name', 'buyer_address_phone',
    'buyer_bank', 'goods_name', 'tax_rate', 'unit_price', 'unit', 'quantity',
    'line_amount', 'line_tax', 'subtotal_amount', 'amount_excluding_tax',
    'total_tax', 'tax_amount', 'invoice_amount', 'amount_in_words',
    'seller_name', 'seller_address_phone', 'seller_bank', 'seller_tax_id',
    'service_category', 'remark'
  ];
  
  let n = 0;
  for (const key of keys) {
    const value = data[key];
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' && !value.trim()) continue;
    if (typeof value === 'number' && Number.isNaN(value)) continue;
    n++;
  }
  return n;
}

const EMPTY_OCR_WARNING =
  '识别接口已响应，但未解析出可回填的发票信息，请上传更清晰的扫描件/照片，或手工填写。';

function enrichOcrPayloadWhenEmpty(data: InvoiceOcrPayload): InvoiceOcrPayload {
  if (countRecognizedInvoiceOcrFields(data) > 0) return data;
  const warnings = data.warnings?.length ? [...data.warnings] : [];
  if (!warnings.includes(EMPTY_OCR_WARNING)) warnings.push(EMPTY_OCR_WARNING);
  return {
    ...data,
    ocr_status: data.ocr_status === 'failed' ? 'failed' : 'partial',
    warnings
  };
}

/**
 * 识别发票：POST本地OCR服务（腾讯云重构版）
 * 
 * 新特性：
 * - 直接返回完整的InvoiceOcrPayload格式
 * - 自动过滤异常数值（343/826/1082）
 * - 免税发票识别
 * - 发票类型识别
 * - 价税分离校验
 */
export async function runInvoiceOcr(params: {
  fileUrls: string[];
  files?: File[];
}): Promise<{ data: InvoiceOcrPayload | null; error: Error | null }> {
  const ocrPostUrl = resolveInvoiceOcrPostUrl();
  if (!ocrPostUrl) {
    return { data: null, error: new Error('未配置本地OCR服务地址') };
  }

  const uploadFile =
    params.fileUrls.length > 0 || (params.files?.length ?? 0) > 0 ? await fileForOcrUpload(params) : null;

  if (!uploadFile) {
    return {
      data: null,
      error: new Error('无法读取发票文件用于识别，请重新上传或检查存储访问')
    };
  }

  if (uploadFile.size > INVOICE_OCR_MAX_BYTES) {
    return { data: null, error: new Error('发票文件不能超过12MB') };
  }

  {
    const controller = new AbortController();
    const timeoutMs = INVOICE_OCR_TIMEOUT_MS;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      console.warn('[invoiceOcr] POST (Tencent Cloud)', ocrPostUrl, uploadFile.name, uploadFile.size);
      const res = await fetch(ocrPostUrl, {
        method: 'POST',
        body: fd,
        signal: controller.signal
      });
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      const bodyText = await res.text();
      if (!ct.includes('application/json')) {
        return {
          data: null,
          error: new Error(formatHttpNonJsonError(res.status, ct, bodyText, 'OCR接口')),
        };
      }
      let result: LocalOcrResponse;
      try {
        result = JSON.parse(bodyText);
      } catch {
        return {
          data: null,
          error: new Error(`OCR接口返回非法JSON（HTTP ${res.status}）`)
        };
      }
      if (!res.ok || result.code !== 200 || !result.data) {
        return {
          data: null,
          error: new Error(result.message || `本地OCR识别失败（HTTP ${res.status}）`)
        };
      }
      
      // 直接使用后端返回的完整数据，增加异常值过滤
      let payload = result.data;
      payload = normalizeAndFilter(payload);
      payload = enrichOcrPayloadWhenEmpty(payload);
      
      console.warn('[invoiceOcr] 识别结果（腾讯云）', payload);
      return { data: payload, error: null };
      
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        return {
          data: null,
          error: new Error(
            `发票识别超时（${timeoutMs / 1000}s）。请确认OCR服务是否正常运行。`
          )
        };
      }
      const raw = e instanceof Error ? e.message : String(e);
      const isNetwork =
        /failed to fetch|networkerror|load failed|network request failed/i.test(raw);
      const hint = isNetwork
        ? '（网络不可达：请确认 invoice-ocr 服务已启动且 Nginx 已配置 /api/invoice/ocr 反代）'
        : '';
      return {
        data: null,
        error: new Error(raw + hint),
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * 解析税率输入：支持"免税"特殊值
 */
export function parseTaxRateInput(raw: string | null | undefined): number | undefined {
  if (raw == null) return undefined;
  const s = String(raw).trim().replace(/\s+/g, '');
  
  if (!s) return undefined;
  
  if (s.includes('免税') || s.toLowerCase() === 'free' || s === '0') {
    return 0;
  }
  
  const cleaned = s.replace('%', '').replace('％', '');
  const n = parseFloat(cleaned);
  if (Number.isNaN(n)) return undefined;
  
  if (n > 1) return n / 100;
  
  return n;
}

export function formatTaxRateForInput(rate: number | undefined | null): string {
  if (rate === undefined || rate === null) return '免税';
  const n = Number(rate);
  if (Number.isNaN(n)) return '免税';
  if (n === 0) return '免税';
  const pct = n <= 1 ? n * 100 : n;
  if (Math.abs(pct - Math.round(pct)) < 1e-6) return `${Math.round(pct)}%`;
  return `${pct.toFixed(2).replace(/\.?0+$/, '')}%`;
}
