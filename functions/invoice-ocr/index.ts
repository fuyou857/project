/**
 * 成本发票 · OCR 网关
 *
 * 1) 若配置 Supabase Secret `INVOICE_OCR_UPSTREAM_URL`（完整 URL，如 https://ocr.example.com/api/invoice/ocr），
 *    则从请求体 `fileUrls[0]` 拉取文件并 multipart 转发至该服务（与仓库 `invoice-ocr-service` 接口一致），
 *    将返回 JSON 映射为 `InvoiceOcrPayload`。
 * 2) 未配置上游时：返回占位结果 + 提示（便于联调）。
 *
 * Secrets（Dashboard → Project → Edge Functions → Secrets）：
 *   - INVOICE_OCR_UPSTREAM_URL（可选）：真实 OCR HTTP 根路径下的 `/api/invoice/ocr` 完整地址
 *   - 部署时已注入：SUPABASE_URL、SUPABASE_ANON_KEY（平台）
 *
 * 部署：`npm run deploy:functions -- invoice-ocr`
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { getSystemApiEndpoint } from '../_shared/systemApiKeys.ts';
import { resolveUpstreamBaseWithSuffix } from '../_shared/integrationServiceUrl.ts';

const OCR_API_SUFFIX = '/api/invoice/ocr';

const corsBase = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsBase },
  });
}

/** 与前端 `InvoiceOcrPayload` 对齐 */
export type InvoiceOcrPayload = {
  ocr_invoice_type_label: string | null;
  invoice_code: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  invoice_amount: number | null;
  amount_excluding_tax: number | null;
  tax_rate: number | null;
  tax_amount: number | null;
  goods_name: string | null;
  seller_name: string | null;
  seller_tax_id: string | null;
  remark: string | null;
  ocr_status: 'success' | 'partial' | 'failed';
  warnings: string[];
  fieldWarnings?: Record<string, string>;
};

type LocalOcrData = {
  invoice_code?: string;
  invoice_number?: string;
  invoice_date?: string;
  service_name?: string;
  amount_exclude_tax?: string;
  tax_rate?: string;
  tax_amount?: string;
  total_amount?: string;
  seller_name?: string;
  seller_tax_id?: string;
  remark?: string;
};

function emptyPayload(warnings: string[]): InvoiceOcrPayload {
  return {
    ocr_invoice_type_label: null,
    invoice_code: null,
    invoice_number: null,
    invoice_date: null,
    invoice_amount: null,
    amount_excluding_tax: null,
    tax_rate: null,
    tax_amount: null,
    goods_name: null,
    seller_name: null,
    seller_tax_id: null,
    remark: null,
    ocr_status: 'success',
    warnings,
  };
}

function parseMoneyString(s: string | null | undefined): number | null {
  if (s == null || !String(s).trim()) return null;
  const n = parseFloat(String(s).replace(/,/g, '').replace(/，/g, '').replace(/[￥¥\s]/g, ''));
  return Number.isNaN(n) ? null : n;
}

function parseTaxRateInput(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).trim().replace(/\s/g, '');
  if (!s) return null;
  if (s.endsWith('%') || s.endsWith('％')) {
    const n = parseFloat(s.slice(0, -1));
    if (Number.isNaN(n)) return null;
    return n / 100;
  }
  const n = parseFloat(s);
  if (Number.isNaN(n)) return null;
  if (n > 1) return n / 100;
  return n;
}

function mapLocalOcrToPayload(d: LocalOcrData): InvoiceOcrPayload {
  return {
    ocr_invoice_type_label: null,
    invoice_code: d.invoice_code?.trim() || null,
    invoice_number: d.invoice_number?.trim() || null,
    invoice_date: d.invoice_date?.trim() || null,
    invoice_amount: parseMoneyString(d.total_amount),
    amount_excluding_tax: parseMoneyString(d.amount_exclude_tax),
    tax_rate: parseTaxRateInput(d.tax_rate),
    tax_amount: parseMoneyString(d.tax_amount),
    goods_name: d.service_name?.trim() || null,
    seller_name: d.seller_name?.trim() || null,
    seller_tax_id: d.seller_tax_id?.trim() || null,
    remark: d.remark?.trim() || null,
    ocr_status: 'success',
    warnings: [],
  };
}

function guessFilenameFromUrl(fileUrl: string): string {
  try {
    const u = new URL(fileUrl);
    const last = u.pathname.split('/').filter(Boolean).pop();
    if (last && /\.(pdf|png|jpe?g)$/i.test(last)) return last;
  } catch {
    /* ignore */
  }
  return 'invoice.pdf';
}

async function resolveInvoiceOcrUpstream(
  admin: ReturnType<typeof createClient>,
): Promise<string | null> {
  const fromKeys = await getSystemApiEndpoint(admin, 'invoice_ocr_upstream');
  const env = Deno.env.get('INVOICE_OCR_UPSTREAM_URL')?.trim();
  return resolveUpstreamBaseWithSuffix(fromKeys || env, OCR_API_SUFFIX);
}

async function runUpstreamOcr(
  fileUrls: string[],
  upstream: string | null,
): Promise<InvoiceOcrPayload> {
  if (!upstream || fileUrls.length === 0) {
    return emptyPayload(
      fileUrls.length > 0
        ? ['当前为占位识别：字段为空，请手工填写；或在「API 密钥中心」配置 invoice_ocr_upstream，或设置 Edge Secret INVOICE_OCR_UPSTREAM_URL。']
        : [],
    );
  }

  const ocrEndpoint = upstream;
  const fileUrl = fileUrls[0];

  let fileRes: Response;
  try {
    fileRes = await fetch(fileUrl, { signal: AbortSignal.timeout(60_000) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ...emptyPayload([`拉取票据文件失败：${msg}`]),
      ocr_status: 'failed',
    };
  }
  if (!fileRes.ok) {
    return {
      ...emptyPayload([`拉取票据文件 HTTP ${fileRes.status}`]),
      ocr_status: 'failed',
    };
  }

  const buf = await fileRes.arrayBuffer();
  const ctype = fileRes.headers.get('content-type') || 'application/octet-stream';
  const fname = guessFilenameFromUrl(fileUrl);
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: ctype }), fname);

  let ocrRes: Response;
  try {
    ocrRes = await fetch(ocrEndpoint, {
      method: 'POST',
      body: fd,
      signal: AbortSignal.timeout(120_000),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ...emptyPayload([`OCR 上游请求失败：${msg}`]),
      ocr_status: 'failed',
    };
  }

  let body: { code?: number; message?: string; data?: LocalOcrData | null };
  try {
    body = (await ocrRes.json()) as { code?: number; message?: string; data?: LocalOcrData | null };
  } catch {
    return {
      ...emptyPayload(['OCR 上游返回非 JSON']),
      ocr_status: 'failed',
    };
  }

  if (!ocrRes.ok || body.code !== 200 || !body.data) {
    return {
      ...emptyPayload([body.message || 'OCR 上游识别失败']),
      ocr_status: 'failed',
    };
  }

  return mapLocalOcrToPayload(body.data);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        ...corsBase,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: '未授权' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    return json({ error: '服务端未配置 SUPABASE_URL / SUPABASE_ANON_KEY' }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: authData, error: authErr } = await userClient.auth.getUser();
  if (authErr || !authData.user) {
    return json({ error: '登录已失效' }, 401);
  }

  let body: { fileUrls?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: '请求体须为 JSON' }, 400);
  }

  const urls = body.fileUrls;
  if (!Array.isArray(urls) || !urls.every((u) => typeof u === 'string')) {
    return json({ error: 'fileUrls 须为非空字符串数组' }, 400);
  }

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const admin = serviceKey
    ? createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : userClient;
  const upstream = await resolveInvoiceOcrUpstream(admin);
  const payload = await runUpstreamOcr(urls as string[], upstream);
  return json(payload);
});
