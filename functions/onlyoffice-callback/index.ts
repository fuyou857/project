/**
 * ONLYOFFICE 文档保存回调（文档服务器 POST，无用户 JWT）。
 *
 * 查询参数（由前端 OnlyOfficeEditor 拼到 callbackUrl 上）：
 * - `template_file_version_id`：contract_template_file_versions.id；status 为 2/6 时把 ONLYOFFICE 返回的 `url` 下载后写回该行的 `storage_path`。
 *
 * 环境变量（Supabase Dashboard → Edge Functions → Secrets）：
 * - `SUPABASE_URL`
 * - `SUPABASE_SERVICE_ROLE_KEY`
 *
 * 部署后请将 `ONLYOFFICE_CALLBACK_URL` 设为（无查询串，由前端追加版本 id）：
 *   https://<project-ref>.supabase.co/functions/v1/onlyoffice-callback
 * 并在 `supabase/config.toml` 为本函数设置 `verify_jwt = false`（见仓库已加段落）。
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { getCorsHeaders } from "../_shared/cors.ts";

const BUCKET = 'files';

let _reqOrigin: string | null = null;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(_reqOrigin) },
  });
}

type OnlyOfficeCallbackBody = {
  status?: number | string;
  url?: string;
  key?: string;
  [k: string]: unknown;
};

Deno.serve(async (req: Request) => {
  _reqOrigin = req.headers.get("origin");
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, header...getCorsHeaders(_reqOrigin) });
  }
  if (req.method !== 'POST') {
    return json({ error: 1 }, 405);
  }

  let body: OnlyOfficeCallbackBody;
  try {
    body = (await req.json()) as OnlyOfficeCallbackBody;
  } catch {
    return json({ error: 0 });
  }

  const status = typeof body.status === 'string' ? parseInt(body.status, 10) : Number(body.status);
  if (status !== 2 && status !== 6) {
    return json({ error: 0 });
  }

  const url = new URL(req.url);
  const versionId = url.searchParams.get('template_file_version_id')?.trim();
  const downloadUrl = typeof body.url === 'string' ? body.url.trim() : '';
  if (!versionId || !downloadUrl) {
    console.warn('[onlyoffice-callback] 缺少 template_file_version_id 或 body.url，跳过写回');
    return json({ error: 0 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() || Deno.env.get('APP_SERVICE_ROLE_KEY')?.trim();
  if (!supabaseUrl || !serviceKey) {
    console.error('[onlyoffice-callback] 未配置 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY');
    return json({ error: 1 });
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: row, error: qErr } = await admin
    .from('contract_template_file_versions')
    .select('id, storage_path')
    .eq('id', versionId)
    .maybeSingle();

  if (qErr || !row?.storage_path) {
    console.error('[onlyoffice-callback] 查询模板版本失败:', qErr?.message, versionId);
    return json({ error: 1 });
  }

  const storagePath = String(row.storage_path).trim();
  let fileBytes: ArrayBuffer;
  try {
    const r = await fetch(downloadUrl, { redirect: 'follow' });
    if (!r.ok) {
      console.error('[onlyoffice-callback] 下载编辑结果失败 HTTP', r.status);
      return json({ error: 1 });
    }
    fileBytes = await r.arrayBuffer();
  } catch (e) {
    console.error('[onlyoffice-callback] fetch 文档失败:', e);
    return json({ error: 1 });
  }

  const { error: upErr } = await admin.storage.from(BUCKET).upload(storagePath, fileBytes, {
    upsert: true,
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  if (upErr) {
    console.error('[onlyoffice-callback] 写回 Storage 失败:', upErr.message);
    return json({ error: 1 });
  }

  console.log('[onlyoffice-callback] 已写回模板 Word:', storagePath);
  return json({ error: 0 });
});
