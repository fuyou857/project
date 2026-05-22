/**
 * 合同模板库 · 文档转换网关
 *
 * - `capabilities`：返回能力说明与编排就绪状态；**无需登录**（Bearer 可为 anon JWT），若已登录则返回 `user_id`。
 * - `convert`：将请求体 JSON **原样** POST 到 `DOC_CONVERT_WEBHOOK_URL`（兼容第三方网关）。
 * - `docx_to_pdf` / `merge_pdf` / `fill_docx` / `docx_diff` / `pdf_stamp`：
 *   使用 `SUPABASE_SERVICE_ROLE_KEY` 生成签名 URL、调用自建服务 `/invoke`、将二进制结果写回 Storage。
 *
 * 环境变量：
 * - `DOC_CONVERT_WEBHOOK_URL`：第三方「原样转发」目标（`convert` action）；未设置时也可仅依赖 SERVICE_BASE。
 * - `DOC_CONVERT_SERVICE_BASE_URL`（可选）：自建编排服务根。**托管在 Supabase 云上的 Edge 无法访问**
 *   Docker 内部主机名（如 `http://contract-convert:8788`）；须使用公网 HTTPS，例如经 Nginx 反代：
 *   `https://你的域名/api/contract-convert`（见仓库 `scripts/nginx-contract-convert-proxy.conf`）。缺省则用
 *   `DOC_CONVERT_WEBHOOK_URL` 并自动追加 `/invoke`。
 * - `DOC_CONVERT_WEBHOOK_SECRET` → 请求头 `X-Contract-Convert-Secret`，需与容器内 `CONTRACT_CONVERT_SECRET` 一致。
 * - `SUPABASE_SERVICE_ROLE_KEY`：编排写回 Storage 所必需（与控制台「Secrets」一致）。
 * - `APP_SERVICE_ROLE_KEY`：历史别名，若已配置可继续生效；新环境请只用 `SUPABASE_SERVICE_ROLE_KEY`。
 *
 * 自建服务：`docker compose up -d contract-convert`（见仓库 `contract-convert-service/`）。
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
  resolveDocConvertConfig,
  resolveInvokeUrlFromConfig } from
'../_shared/resolveIntegrationConfig.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors }
  });
}

/** Nginx 502 等常返回整页 HTML；勿原样塞进 JSON，以免前端 `<pre>` 铺满且难读 */
function summarizeUpstreamFailure(status: number, bodyText: string): string {
  const raw = (bodyText || '').trim();
  if (!raw) {
    return `自建转换服务返回 HTTP ${status}（无响应体）。请确认本机 contract-convert 已启动且 Nginx 可反代到 127.0.0.1:8788。`;
  }
  const probe = raw.slice(0, 500).toLowerCase();
  if (
  probe.includes('<html') ||
  probe.includes('<!doctype') ||
  probe.includes('bad gateway') && probe.includes('<title>') ||
  probe.includes('gateway time-out') && probe.includes('<title>'))
  {
    return (
      `自建转换服务返回 HTTP ${status}（上游为 HTML 错误页，多为 Nginx 无法连接后端）。` +
      '请检查：① `docker compose ps` 中 contract-convert 正常；② 服务器执行 `curl -sS http://127.0.0.1:8788/health` 应成功；③ 站点已 include 仓库 `scripts/nginx-contract-convert-proxy.conf` 并执行 `nginx -s reload`；④ Supabase Secret `DOC_CONVERT_SERVICE_BASE_URL` 与当前域名 HTTPS 路径一致。');

  }
  return raw.length > 2000 ? raw.slice(0, 2000) + '…' : raw;
}

const CHECKLIST = {
  pdf_merge_attachments: [
  '自建服务 merge_pdf：pypdf 合并多 PDF；结果写回 merged_pdf_storage_path',
  'docx_to_pdf：LibreOffice headless 将版式转为 PDF'],

  docx_variable_fill: [
  'fill_docx：docxtpl 替换 {{变量}}；图片键与模板中 jinja 变量名一致（如 {{ id_front }}）'],

  id_photo_resize: [
  'fill_docx 的 image_signed_urls：先上传身份证图到 Storage，再传占位键与签名 URL',
  'fill_docx 的 image_base64：前端 data:image Base64，键与 variables_json 中图片类 label 一致时由自建服务解码为 InlineImage'],

  word_binary_diff: [
  'docx_diff：对比 word/document.xml 文本 unified diff；复杂版式请以业务字段快照为准'],

  ca_signature: [
  'pdf_stamp 仅为页脚文字戳示意；具法律效力请对接 CA 厂商并将 sealed 路径写回数据库']

};

function resolveLegacyWebhookUrl(cfg: Awaited<ReturnType<typeof resolveDocConvertConfig>>): string | null {
  return cfg.webhookUrl;
}

function webhookConfigured(cfg: Awaited<ReturnType<typeof resolveDocConvertConfig>>): boolean {
  return Boolean(resolveInvokeUrlFromConfig(cfg) || cfg.webhookUrl);
}

/** Supabase 云端 Edge 无法解析 Docker / 内网专用主机名 */
function explainUnreachableInvokeUrl(url: string): string | null {
  let hostname = '';
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (
  hostname === 'contract-convert' ||
  hostname === 'host.docker.internal' ||
  hostname.endsWith('.docker.internal') ||
  hostname.endsWith('.internal') ||
  hostname === 'localhost')
  {
    return (
      'DOC_CONVERT_SERVICE_BASE_URL 使用了仅内网/Docker 可解析的主机名，Supabase 云端 Edge 无法访问。' +
      '请将 Secret 改为公网 HTTPS（例如 https://你的域名/api/contract-convert），并在 Nginx 反代到本机 8788；' +
      '参考仓库 scripts/nginx-contract-convert-proxy.conf 与 scripts/apply-contract-convert-nginx.sh。');

  }
  return null;
}

async function postInvoke(
invokeUrl: string | null,
secret: string | undefined,
payload: Record<string, unknown>)
: Promise<Response> {
  const url = invokeUrl;
  if (!url) {
    return new Response(JSON.stringify({ error: '未配置转换服务 URL' }), { status: 503 });
  }
  const unreachable = explainUnreachableInvokeUrl(url);
  if (unreachable) {
    return json({ ok: false, code: 'BAD_ORCHESTRATION_URL', message: unreachable }, 503);
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret) headers['X-Contract-Convert-Secret'] = secret;
  try {
    return await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    let message = msg;
    if (/contract-convert|Name or service not known|dns error|lookup address information/i.test(msg)) {
      message =
      `${msg}。编排 URL 须为公网可达地址：在服务器 Nginx 将路径反代到 127.0.0.1:8788，并把 Supabase Secret ` +
      '`DOC_CONVERT_SERVICE_BASE_URL` 设为 `https://你的域名/api/contract-convert`（勿使用 http://contract-convert:8788）。';
    }
    return json({ ok: false, code: 'INVOKE_TRANSPORT_ERROR', message }, 502);
  }
}

/** 仅允许合同模板相关路径经编排接口签名/写回（防滥用 Service Role） */
function assertContractStoragePath(path: string, label: string) {
  const p = path.trim();
  if (!p.startsWith('contract-templates/') && !p.startsWith('contract-generated/')) {
    throw new Error(`${label} 仅允许 contract-templates/ 或 contract-generated/ 前缀`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: { ...cors, 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
    });
  }
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('APP_SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('APP_SUPABASE_ANON_KEY')!;
  const serviceKey =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() || Deno.env.get('APP_SERVICE_ROLE_KEY')?.trim();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: '无效 JSON' }, 400);
  }

  const action = typeof body.action === 'string' ? body.action : '';

  const adminForConfig = serviceKey ?
  createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  }) :
  null;
  const docCfg = adminForConfig ?
  await resolveDocConvertConfig(adminForConfig) :
  {
    serviceBaseUrl: Deno.env.get('DOC_CONVERT_SERVICE_BASE_URL')?.trim() || null,
    webhookUrl: Deno.env.get('DOC_CONVERT_WEBHOOK_URL')?.trim() || null,
    webhookSecret: Deno.env.get('DOC_CONVERT_WEBHOOK_SECRET')?.trim() || null
  };
  const invokeUrl = resolveInvokeUrlFromConfig(docCfg);
  const secret = docCfg.webhookSecret?.trim() || undefined;

  if (action === 'capabilities') {
    const invoke = invokeUrl;
    const roleFrom = (() => {if (
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()) {return (
          'SUPABASE_SERVICE_ROLE_KEY');} else {if (
        Deno.env.get('APP_SERVICE_ROLE_KEY')?.trim()) {return (
            'APP_SERVICE_ROLE_KEY');} else {return (
            null);}}})();
    return json({
      ok: true,
      user_id: null,
      webhook_configured: webhookConfigured(docCfg),
      orchestration_invoke_url: invoke ? '(configured)' : null,
      service_role_configured: Boolean(serviceKey),
      /** 便于区分：未配 Service Role 还是未配自建转换服务 URL */
      service_role_env_used: roleFrom,
      doc_convert_service_base_set: Boolean(docCfg.serviceBaseUrl),
      doc_convert_webhook_url_set: Boolean(docCfg.webhookUrl),
      api_key_center: Boolean(adminForConfig),
      orchestration_ready: Boolean(serviceKey && invoke),
      checklist: CHECKLIST,
      hint: (() => {if (!serviceKey) {return (
            '请在 Edge Secrets 中设置 SUPABASE_SERVICE_ROLE_KEY（勿用仅前端的 anon key）。旧名 APP_SERVICE_ROLE_KEY 仍兼容。');} else {if (
          !invoke) {return (
              '请设置 DOC_CONVERT_SERVICE_BASE_URL 或 DOC_CONVERT_WEBHOOK_URL（将自动使用 …/invoke）');} else {return (
              '已配置编排服务；带 source_path/output_path 的 action 将由 Edge 签名、调用 /invoke 并写回 Storage');}}})()
    });
  }

  // 非 capabilities 动作需要验证用户登录
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return json({ error: '未授权' }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: auth } }
  });
  const { data: authData, error: authErr } = await userClient.auth.getUser();

  if (authErr || !authData.user) return json({ error: '登录已失效' }, 401);

  if (action === 'convert') {
    const webhook = resolveLegacyWebhookUrl(docCfg);
    if (!webhook) {
      return json(
        {
          ok: false,
          code: 'NOT_CONFIGURED',
          message: '未设置 DOC_CONVERT_WEBHOOK_URL，无法原样转发 convert',
          checklist: CHECKLIST
        },
        501
      );
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (secret) headers['X-Contract-Convert-Secret'] = secret;
    const upstream = await fetch(webhook, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...body, _meta: { caller_user_id: authData.user.id } })
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('Content-Type') || 'application/json', ...cors }
    });
  }

  if (!serviceKey) {
    return json(
      {
        ok: false,
        code: 'NO_SERVICE_ROLE',
        message:
        'Edge 未配置 SUPABASE_SERVICE_ROLE_KEY（或兼容别名 APP_SERVICE_ROLE_KEY），无法为转换服务生成签名 URL 或上传结果',
        checklist: CHECKLIST
      },
      503
    );
  }

  const admin = createClient(supabaseUrl, serviceKey);
  /** 须与前端 `CONTRACT_FILES_STORAGE_BUCKET`（默认 files）一致 */
  const bucket = typeof body.bucket === 'string' && body.bucket ? body.bucket : 'files';
  const signTtl = typeof body.sign_ttl_sec === 'number' && body.sign_ttl_sec > 60 ? body.sign_ttl_sec : 3600;

  async function signedUrl(path: unknown): Promise<string> {
    if (typeof path !== 'string' || !path.trim()) throw new Error('invalid storage path');
    const { data, error } = await admin.storage.from(bucket).createSignedUrl(path.trim(), signTtl);
    if (error || !data?.signedUrl) throw new Error(error?.message || 'createSignedUrl failed');
    return data.signedUrl;
  }

  async function uploadOutput(outputPath: string, bytes: Uint8Array, contentType: string) {
    const { error } = await admin.storage.from(bucket).upload(outputPath, bytes, {
      contentType,
      upsert: true
    });
    if (error) throw new Error(error.message);
  }

  try {
    if (action === 'docx_to_pdf') {
      const source_path = body.source_path;
      const output_path = body.output_path;
      if (typeof source_path !== 'string' || typeof output_path !== 'string') {
        return json({ error: '需要 source_path 与 output_path' }, 400);
      }
      assertContractStoragePath(source_path, 'source_path');
      assertContractStoragePath(output_path, 'output_path');
      const input_signed_url = await signedUrl(source_path);
      const upstream = await postInvoke(invokeUrl, secret, { action: 'docx_to_pdf', input_signed_url });
      if (!upstream.ok) {
        const t = await upstream.text();
        return json(
          { ok: false, message: summarizeUpstreamFailure(upstream.status, t || upstream.statusText) },
          upstream.status as 502
        );
      }
      const buf = new Uint8Array(await upstream.arrayBuffer());
      await uploadOutput(output_path, buf, 'application/pdf');
      return json({
        ok: true,
        output_path,
        bucket,
        caller_user_id: authData.user.id
      });
    }

    if (action === 'merge_pdf') {
      const source_paths = body.source_paths;
      const output_path = body.output_path;
      if (!Array.isArray(source_paths) || source_paths.length < 1 || typeof output_path !== 'string') {
        return json({ error: '需要 source_paths（非空数组）与 output_path' }, 400);
      }
      assertContractStoragePath(output_path, 'output_path');
      const input_signed_urls: string[] = [];
      for (const p of source_paths) {
        assertContractStoragePath(String(p), 'source_paths[]');
        input_signed_urls.push(await signedUrl(p));
      }
      const upstream = await postInvoke(invokeUrl, secret, {
        action: 'merge_pdf',
        input_signed_urls
      });
      if (!upstream.ok) {
        const t = await upstream.text();
        return json(
          { ok: false, message: summarizeUpstreamFailure(upstream.status, t || upstream.statusText) },
          upstream.status as 502
        );
      }
      const buf = new Uint8Array(await upstream.arrayBuffer());
      await uploadOutput(output_path, buf, 'application/pdf');
      return json({
        ok: true,
        output_path,
        bucket,
        caller_user_id: authData.user.id
      });
    }

    if (action === 'fill_docx') {
      const template_path = body.template_path;
      const output_path = body.output_path;
      const variables = body.variables;
      if (typeof template_path !== 'string' || typeof output_path !== 'string') {
        return json({ error: '需要 template_path 与 output_path' }, 400);
      }
      assertContractStoragePath(template_path, 'template_path');
      assertContractStoragePath(output_path, 'output_path');
      if (variables !== undefined && typeof variables !== 'object') {
        return json({ error: 'variables 须为对象' }, 400);
      }
      const template_signed_url = await signedUrl(template_path);
      const image_paths = body.image_paths;
      const image_signed_urls: Record<string, string> = {};
      if (image_paths && typeof image_paths === 'object' && !Array.isArray(image_paths)) {
        for (const [k, v] of Object.entries(image_paths as Record<string, unknown>)) {
          if (typeof v !== 'string' || !v.trim()) continue;
          const s = v.trim();
          if (s.startsWith('http://') || s.startsWith('https://')) {
            image_signed_urls[k] = s;
          } else {
            assertContractStoragePath(s, `image_paths.${k}`);
            image_signed_urls[k] = await signedUrl(s);
          }
        }
      }
      const upstream = await postInvoke(invokeUrl, secret, {
        action: 'fill_docx',
        template_signed_url,
        variables: variables && typeof variables === 'object' ? variables : {},
        image_signed_urls,
        image_base64:
        body.image_base64 && typeof body.image_base64 === 'object' && !Array.isArray(body.image_base64) ?
        body.image_base64 :
        {}
      });
      if (!upstream.ok) {
        const t = await upstream.text();
        return json(
          { ok: false, message: summarizeUpstreamFailure(upstream.status, t || upstream.statusText) },
          upstream.status as 502
        );
      }
      try {
        const buf = new Uint8Array(await upstream.arrayBuffer());
        await uploadOutput(
          output_path,
          buf,
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );
        return json({
          ok: true,
          output_path,
          bucket,
          caller_user_id: authData.user.id
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return json({ ok: false, error: `上传填充后的文档失败：${msg}` }, 500);
      }
    }

    if (action === 'docx_diff') {
      const left_path = body.left_path;
      const right_path = body.right_path;
      if (typeof left_path !== 'string' || typeof right_path !== 'string') {
        return json({ error: '需要 left_path 与 right_path' }, 400);
      }
      assertContractStoragePath(left_path, 'left_path');
      assertContractStoragePath(right_path, 'right_path');
      const upstream = await postInvoke(invokeUrl, secret, {
        action: 'docx_diff',
        left_signed_url: await signedUrl(left_path),
        right_signed_url: await signedUrl(right_path)
      });
      if (!upstream.ok) {
        const t = await upstream.text();
        return json(
          { ok: false, message: summarizeUpstreamFailure(upstream.status, t || upstream.statusText) },
          upstream.status as 502
        );
      }
      const j = await upstream.json();
      return json({ ...j, caller_user_id: authData.user.id });
    }

    if (action === 'pdf_stamp') {
      const source_path = body.source_path;
      const output_path = body.output_path;
      const lines = body.lines;
      if (typeof source_path !== 'string' || typeof output_path !== 'string') {
        return json({ error: '需要 source_path 与 output_path' }, 400);
      }
      assertContractStoragePath(source_path, 'source_path');
      assertContractStoragePath(output_path, 'output_path');
      if (!Array.isArray(lines)) return json({ error: 'lines 须为字符串数组' }, 400);
      const upstream = await postInvoke(invokeUrl, secret, {
        action: 'pdf_stamp',
        input_signed_url: await signedUrl(source_path),
        lines
      });
      if (!upstream.ok) {
        const t = await upstream.text();
        return json(
          { ok: false, message: summarizeUpstreamFailure(upstream.status, t || upstream.statusText) },
          upstream.status as 502
        );
      }
      const buf = new Uint8Array(await upstream.arrayBuffer());
      await uploadOutput(output_path, buf, 'application/pdf');
      return json({
        ok: true,
        output_path,
        bucket,
        caller_user_id: authData.user.id
      });
    }

    if (action === 'docx_to_html') {
      const source_path = body.source_path;
      if (typeof source_path !== 'string') {
        return json({ error: '需要 source_path' }, 400);
      }
      assertContractStoragePath(source_path, 'source_path');
      const upstream = await postInvoke(invokeUrl, secret, {
        action: 'docx_to_html',
        input_signed_url: await signedUrl(source_path)
      });
      if (!upstream.ok) {
        const t = await upstream.text();
        return json(
          { ok: false, message: summarizeUpstreamFailure(upstream.status, t || upstream.statusText) },
          upstream.status as 502
        );
      }
      const j = await upstream.json();
      return json({ ...j, caller_user_id: authData.user.id });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ ok: false, error: msg }, 400);
  }

  return json(
    {
      error: '未知 action',
      supported: [
      'capabilities',
      'convert',
      'docx_to_pdf',
      'merge_pdf',
      'fill_docx',
      'docx_diff',
      'pdf_stamp',
      'docx_to_html']

    },
    400
  );
});