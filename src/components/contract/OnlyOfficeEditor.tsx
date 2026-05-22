import React, { useEffect, useId, useRef, useState } from 'react';

declare global {
  interface Window {
    DocsAPI?: {
      DocEditor: new (placeholder: HTMLElement | string, config: Record<string, unknown>) => {
        destroyEditor?: () => void;
      };
    };
    /** 可选：部署时在主 bundle 之前注入，免重新 webpack 构建即可指向 ONLYOFFICE 文档服务器根地址 */
    __CIOND_ONLYOFFICE_DOCUMENT_SERVER_URL__?: string;
    /** 可选：保存回调完整 URL；与 .env 中 ONLYOFFICE_CALLBACK_URL 二选一即可 */
    __CIOND_ONLYOFFICE_CALLBACK_URL__?: string;
    __ciondOnlyOfficeScriptPromise?: Promise<void>;
  }
}

interface OnlyOfficeEditorProps {
  /** 文档下载地址（须为 ONLYOFFICE 文档服务器可访问的绝对 HTTPS URL，推荐 Supabase 签名 URL） */
  documentUrl: string;
  documentTitle: string;
  /**
   * 文档在业务侧的稳定标识（如模板文件版本 UUID、合同 id + 刷新序号）。
   * 传入后 ONLYOFFICE 的 `document.key` 在相同文档上保持不变，便于文档服务器命中转换缓存，明显加快二次打开。
   * 文件内容被替换后请更换此值（例如递增 nonce），否则会沿用旧缓存。
   */
  documentKey?: string;
  height?: string;
  onDocumentReady?: () => void;
  onDocumentSaved?: (url: string) => void;
  /**
   * 合同预览等场景应传 true：始终只读，不附带 callbackUrl。
   * 否则全局配置了 ONLYOFFICE_CALLBACK_URL 但回调不可达时，文档服务器可能无法正常打开文档。
   */
  forceViewMode?: boolean;
  /**
   * 拼接到 ONLYOFFICE `callbackUrl` 查询串，供服务端回调识别写回路径：
   * - `generated_contract_id=<uuid>`：写回合同草稿副本（推荐用于「用当前模板新建合同」）
   * - `template_file_version_id=<uuid>`：写回系统模板（仅管理员改模板时使用）
   * 仅在非 forceViewMode 且已配置 ONLYOFFICE_CALLBACK_URL 时生效。
   */
  onlyOfficeCallbackQuery?: string;
}

/** ONLYOFFICE 要求 key 为稳定字符串；同 key 可复用文档服务器上的转换缓存，显著加快二次打开 */
function onlyOfficeDocumentKey(documentUrl: string, explicitKey?: string): string {
  const raw = (explicitKey && explicitKey.trim()) || (() => {
    try {
      const u = new URL(documentUrl);
      return `${u.origin}${u.pathname}`;
    } catch {
      return documentUrl.split('?')[0] || documentUrl;
    }
  })();
  const alnum = raw.replace(/[^a-zA-Z0-9]/g, '');
  if (alnum.length >= 8) {
    return alnum.slice(0, 120);
  }
  let h = 2166136261 >>> 0;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const tail = alnum.slice(-48);
  const key = `ciond${h.toString(16)}${tail}`;
  return key.slice(0, 120);
}

function injectOnlyOfficePreconnect(server: string): void {
  if (typeof document === 'undefined') return;
  const id = 'ciond-onlyoffice-preconnect';
  if (document.getElementById(id)) return;
  try {
    const origin = new URL(server).origin;
    const dns = document.createElement('link');
    dns.id = `${id}-dns`;
    dns.rel = 'dns-prefetch';
    dns.href = origin;
    const pc = document.createElement('link');
    pc.id = id;
    pc.rel = 'preconnect';
    pc.href = origin;
    document.head.appendChild(dns);
    document.head.appendChild(pc);
  } catch {
    /* ignore */
  }
}

function onlyOfficeServerBase(): string {
  if (typeof window !== 'undefined') {
    const rt = window.__CIOND_ONLYOFFICE_DOCUMENT_SERVER_URL__;
    if (rt && String(rt).trim()) {
      return String(rt).trim().replace(/\/$/, '');
    }
  }
  const raw =
    typeof process !== 'undefined' && process.env.ONLYOFFICE_DOCUMENT_SERVER_URL
      ? String(process.env.ONLYOFFICE_DOCUMENT_SERVER_URL).trim()
      : '';
  return raw.replace(/\/$/, '');
}

function onlyOfficeCallbackUrl(): string {
  if (typeof window !== 'undefined') {
    const rt = window.__CIOND_ONLYOFFICE_CALLBACK_URL__;
    if (rt && String(rt).trim()) {
      return String(rt).trim();
    }
  }
  const raw =
    typeof process !== 'undefined' && process.env.ONLYOFFICE_CALLBACK_URL
      ? String(process.env.ONLYOFFICE_CALLBACK_URL).trim()
      : '';
  return raw;
}

/** 历史 Nginx 占位：仅返回 JSON，不能写回 Storage；ONLYOFFICE 也常无法进入真正编辑 */
function looksLikePlaceholderOnlyofficeCallback(url: string): boolean {
  const t = url.trim();
  if (!t) return false;
  try {
    const p = new URL(t).pathname.replace(/\/+$/, '') || '/';
    return p === '/api/onlyoffice/callback';
  } catch {
    return false;
  }
}

function resolveOnlyOfficeEditMode(forceViewMode: boolean): {
  callbackRaw: string;
  editMode: boolean;
  isStubCallback: boolean;
} {
  const callbackRaw = onlyOfficeCallbackUrl().trim();
  const isStubCallback = looksLikePlaceholderOnlyofficeCallback(callbackRaw);
  const editMode = Boolean(callbackRaw) && !forceViewMode && !isStubCallback;
  return { callbackRaw, editMode, isStubCallback };
}

function parseHeightPx(height: string): number {
  const m = /^\s*(\d+)\s*px\s*$/i.exec(height || '');
  if (m) return Math.max(200, parseInt(m[1], 10));
  const n = parseInt(String(height).replace(/\D/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? Math.max(200, n) : 600;
}

/** embedded 模式下 iframe 常挂在 body 上，通过 frameEditorId 与占位 div 关联 */
function findOnlyOfficeIframe(editorId: string, host?: HTMLElement | null): HTMLIFrameElement | null {
  const inHost = host?.querySelector('iframe');
  if (inHost instanceof HTMLIFrameElement) return inHost;
  const byName = document.querySelector(`iframe[name="${editorId}"]`);
  if (byName instanceof HTMLIFrameElement) return byName;
  const byFrameId = document.querySelector(`iframe[src*="frameEditorId=${editorId}"]`);
  if (byFrameId instanceof HTMLIFrameElement) return byFrameId;
  return null;
}

function onlyOfficeErrorMessage(code: number | string | undefined, desc: string | undefined): string {
  const c = typeof code === 'string' ? parseInt(code, 10) : code;
  const tail = desc ? `（${desc}）` : '';
  switch (c) {
    case -4:
    case -6:
      return `文档下载失败 ${tail}。请确认：① ONLYOFFICE 容器/服务器能访问公网（Supabase 签名 URL 为 HTTPS）；② 桶策略与签名未过期；③ 未被防火墙拦截。`;
    case -2:
      return `文档转换超时 ${tail}。可尝试缩小文档或提高文档服务器资源。`;
    case -3:
      return `文档转换失败 ${tail}。请确认上传的是有效 .docx。`;
    case -8:
      return `JWT 校验失败 ${tail}。请关闭文档服务器 JWT（JWT_ENABLED=false）或在集成中传入 token。`;
    default:
      return `ONLYOFFICE 报错（代码 ${String(code)}）${tail}`;
  }
}

function loadOnlyOfficeApi(server: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.DocsAPI?.DocEditor && typeof window.DocsAPI.DocEditor === 'function') {
    return Promise.resolve();
  }
  if (window.__ciondOnlyOfficeScriptPromise) {
    return window.__ciondOnlyOfficeScriptPromise;
  }

  const apiScript = `${server}/web-apps/apps/api/documents/api.js`;
  window.__ciondOnlyOfficeScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-ciond-onlyoffice-api="1"]`);
    if (existing) {
      if (window.DocsAPI?.DocEditor) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error(`无法加载 ONLYOFFICE 脚本：${apiScript}`)),
        { once: true },
      );
      return;
    }

    const scriptEl = document.createElement('script');
    scriptEl.src = apiScript;
    scriptEl.async = true;
    scriptEl.dataset.ciondOnlyofficeApi = '1';
    scriptEl.onload = () => resolve();
    scriptEl.onerror = () => reject(new Error(`无法加载 ONLYOFFICE 脚本（请检查网络与地址）：${apiScript}`));
    document.head.appendChild(scriptEl);
  });

  return window.__ciondOnlyOfficeScriptPromise;
}

/** 在模板库等页面提前 dns-prefetch / 预加载 api.js，缩短首次打开编辑器时间 */
export function preloadOnlyOfficeEnvironment(): void {
  const server = onlyOfficeServerBase();
  if (!server) return;
  injectOnlyOfficePreconnect(server);
  void loadOnlyOfficeApi(server);
}

export default function OnlyOfficeEditor({
  documentUrl,
  documentTitle,
  documentKey,
  height = '600px',
  onDocumentReady,
  onDocumentSaved: _onDocumentSaved,
  forceViewMode = false,
  onlyOfficeCallbackQuery,
}: OnlyOfficeEditorProps) {
  const reactId = useId().replace(/:/g, '');
  const placeholderId = `onlyoffice-editor-${reactId}`;
  const editorRef = useRef<HTMLDivElement>(null);
  const [bootErr, setBootErr] = useState<string | null>(null);
  const [runtimeErr, setRuntimeErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const onReadyRef = useRef(onDocumentReady);
  onReadyRef.current = onDocumentReady;

  useEffect(() => {
    setBootErr(null);
    setRuntimeErr(null);
    setLoading(true);

    const url = (documentUrl || '').trim();
    if (!url) {
      setBootErr('文档地址为空');
      setLoading(false);
      return;
    }

    const server = onlyOfficeServerBase();
    if (!server) {
      setBootErr(
        [
          '未检测到 ONLYOFFICE 文档服务器地址。',
          '请在项目根 .env 中设置 ONLYOFFICE_DOCUMENT_SERVER_URL（例如 http://localhost:8080 或 https://office.你的域名），然后执行 npm run build 并重新部署 dist；构建会把该值写入 index.html 的 window.__CIOND_ONLYOFFICE_DOCUMENT_SERVER_URL__ 与前端 bundle。',
          '若暂不能重建，可在 index.html 中、主应用 .js 之前手写：<script>window.__CIOND_ONLYOFFICE_DOCUMENT_SERVER_URL__=\'…\'</script>',
          '未完成配置时，请使用「HTML 预览」或「正文与编辑」中的 Word 预览 / 下载 Word。',
        ].join('\n'),
      );
      setLoading(false);
      return;
    }

    injectOnlyOfficePreconnect(server);

    const { callbackRaw, editMode } = resolveOnlyOfficeEditMode(forceViewMode);
    const heightPx = parseHeightPx(height);

    const callbackWithContext = (() => {
      if (!editMode || !callbackRaw) return '';
      const q = onlyOfficeCallbackQuery?.trim();
      if (!q) return callbackRaw;
      return `${callbackRaw}${callbackRaw.includes('?') ? '&' : '?'}${q}`;
    })();

    let disposed = false;
    let editorInst: { destroyEditor?: () => void } | null = null;
    let iframeTimer: number | undefined;
    let observer: MutationObserver | undefined;

    const markIframeReady = () => {
      if (disposed) return;
      if (iframeTimer) {
        window.clearTimeout(iframeTimer);
        iframeTimer = undefined;
      }
      setLoading(false);
    };

    const watchForIframe = (host: HTMLElement) => {
      if (findOnlyOfficeIframe(placeholderId, host)) {
        markIframeReady();
        return;
      }
      observer = new MutationObserver(() => {
        if (findOnlyOfficeIframe(placeholderId, host)) {
          observer?.disconnect();
          observer = undefined;
          markIframeReady();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    };

    const buildConfig = (): Record<string, unknown> => {
      const key = onlyOfficeDocumentKey(url, documentKey);
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const editorConfig: Record<string, unknown> = {
        lang: 'zh-CN',
        mode: editMode ? 'edit' : 'view',
        user: { id: 'ciond-user', name: 'User' },
      };
      if (editMode) {
        editorConfig.callbackUrl = callbackWithContext;
        editorConfig.customization = {
          autosave: true,
          forcesave: true,
        };
      }
      const docPermissions: Record<string, unknown> = editMode
        ? {
            edit: true,
            download: true,
            print: true,
            review: true,
          }
        : {
            edit: false,
            download: true,
            print: true,
          };
      const cfg: Record<string, unknown> = {
        width: '100%',
        height: heightPx,
        /**
         * desktop + 占位 div 的 id 字符串：可编辑且 iframe 正常挂载。
         * embedded 在部分浏览器/嵌套场景下 parentOrigin 未对齐时易表现为只读。
         */
        type: 'desktop',
        documentType: 'word',
        document: {
          title: documentTitle || 'document.docx',
          url,
          fileType: 'docx',
          key,
          permissions: docPermissions,
        },
        editorConfig,
        events: {
          onAppReady: () => {
            if (!disposed) markIframeReady();
          },
          onDocumentReady: () => {
            if (!disposed) markIframeReady();
            onReadyRef.current?.();
          },
          onError: (e: { data?: { errorCode?: number; errorDescription?: string } }) => {
            if (disposed) return;
            const code = e?.data?.errorCode;
            const desc = e?.data?.errorDescription;
            setRuntimeErr(onlyOfficeErrorMessage(code, desc));
            setLoading(false);
          },
        },
      };
      /** 与父站同源通信；缺失时常导致内嵌编辑器无法获得编辑焦点（表现为只能看不能改） */
      if (origin) {
        cfg.parentOrigin = origin;
      }
      return cfg;
    };

    const tryStart = () => {
      if (disposed) return;
      const host = document.getElementById(placeholderId);
      if (!host) {
        window.requestAnimationFrame(tryStart);
        return;
      }

      const DocsAPI = window.DocsAPI;
      const Ctor = DocsAPI?.DocEditor;
      if (typeof Ctor !== 'function') {
        setBootErr('ONLYOFFICE DocsAPI 未就绪（请确认文档服务器地址正确、浏览器可访问且未被 CSP 拦截）。');
        setLoading(false);
        return;
      }

      host.innerHTML = '';
      try {
        editorInst = new Ctor(placeholderId, buildConfig());
      } catch (e: unknown) {
        try {
          editorInst?.destroyEditor?.();
        } catch {
          /* ignore */
        }
        editorInst = null;
        setBootErr((e as Error)?.message || '初始化 ONLYOFFICE 编辑器失败');
        setLoading(false);
        return;
      }

      watchForIframe(host);

      iframeTimer = window.setTimeout(() => {
        if (disposed) return;
        if (!findOnlyOfficeIframe(placeholderId, host)) {
          setBootErr(
            'ONLYOFFICE 未能在页面中创建编辑器（常见原因：api.js 被拦截，或初始化参数错误）。请刷新后重试，并查看浏览器控制台 Network 是否成功加载 office 域名下的资源。',
          );
          setLoading(false);
        } else {
          markIframeReady();
        }
      }, 30000);
    };

    void loadOnlyOfficeApi(server)
      .then(() => {
        if (!disposed) tryStart();
      })
      .catch((e: unknown) => {
        if (!disposed) {
          setBootErr((e as Error)?.message || '加载 ONLYOFFICE 脚本失败');
          setLoading(false);
        }
      });

    return () => {
      disposed = true;
      observer?.disconnect();
      if (iframeTimer) window.clearTimeout(iframeTimer);
      try {
        editorInst?.destroyEditor?.();
      } catch {
        /* ignore */
      }
      editorInst = null;
      const host = document.getElementById(placeholderId);
      if (host) host.innerHTML = '';
    };
  }, [documentUrl, documentTitle, documentKey, height, forceViewMode, onlyOfficeCallbackQuery, placeholderId]);

  const serverConfigured = Boolean(onlyOfficeServerBase());
  const { callbackRaw, editMode, isStubCallback } = resolveOnlyOfficeEditMode(forceViewMode);
  const heightPx = parseHeightPx(height);

  let modeBanner: React.ReactNode = null;
  if (serverConfigured) {
    if (forceViewMode) {
      modeBanner = (
        <div className="px-4 py-2.5 text-sm border-b border-slate-200 bg-slate-50 text-slate-800">
          <span className="font-medium">只读预览</span>
          <span className="ml-2 text-slate-600">合同预览场景不启用保存回调，无法在浏览器中直接改 Word。</span>
        </div>
      );
    } else if (!callbackRaw) {
      modeBanner = (
        <div className="px-4 py-2.5 text-sm border-b border-amber-200 bg-amber-50 text-amber-950">
          <span className="font-medium">未配置保存回调</span>
          <span className="ml-2">
            请在项目根 <code className="text-xs bg-amber-100 px-1 rounded">.env</code> 设置{' '}
            <code className="text-xs break-all bg-amber-100 px-1 rounded">ONLYOFFICE_CALLBACK_URL</code> 为已部署的{' '}
            <code className="text-xs break-all bg-amber-100 px-1 rounded">
              https://wlkrdylgojkhgfzvcagc.supabase.co/functions/v1/onlyoffice-callback
            </code>
            ，执行 <code className="text-xs bg-amber-100 px-1 rounded">npm run build:low-mem</code> 并部署{' '}
            <code className="text-xs bg-amber-100 px-1 rounded">dist</code>；或在 <code className="text-xs bg-amber-100 px-1 rounded">index.html</code>{' '}
            里设置 <code className="text-xs bg-amber-100 px-1 rounded">window.__CIOND_ONLYOFFICE_CALLBACK_URL__</code>。
          </span>
        </div>
      );
    } else if (isStubCallback) {
      modeBanner = (
        <div className="px-4 py-2.5 text-sm border-b border-amber-300 bg-amber-100 text-amber-950">
          <span className="font-medium">当前回调为旧版占位地址</span>
          <span className="ml-2 block mt-1 leading-relaxed">
            您配置的 <code className="break-all text-xs bg-white/80 px-1 rounded">{callbackRaw}</code>{' '}
            不会把 Word 写回数据库，ONLYOFFICE 也常无法进入可编辑状态。请改为（不要带查询参数，由页面自动附加版本 id）：
          </span>
          <code className="mt-2 block text-xs break-all bg-white/90 px-2 py-1.5 rounded border border-amber-300">
            https://wlkrdylgojkhgfzvcagc.supabase.co/functions/v1/onlyoffice-callback
          </code>
        </div>
      );
    } else if (editMode) {
      modeBanner = (
        <div className="px-4 py-2.5 text-sm border-b border-green-200 bg-green-50 text-green-950">
          <span className="font-medium">在线编辑已启用</span>
          <span className="ml-2">
            请在 ONLYOFFICE 内直接改字；已开启自动保存与定时强制保存（约数十秒一次），保存时由回调写回 Storage。若仍无法输入文字，请确认 Word 本身未设「限制编辑」密码。
          </span>
        </div>
      );
    }
  }

  return (
    <div className="flex flex-col border border-gray-200 rounded-lg overflow-hidden bg-white">
      <div className="shrink-0 bg-gray-100 px-4 py-2 border-b border-gray-200 text-sm text-gray-700 font-medium">
        ONLYOFFICE 编辑器
      </div>
      {modeBanner}
      {bootErr ? (
        <div className="px-4 py-6 text-sm text-red-700 bg-red-50 min-h-[200px] whitespace-pre-wrap break-words">
          {bootErr}
        </div>
      ) : null}
      {runtimeErr && !bootErr ? (
        <div className="px-4 py-3 text-sm text-red-800 bg-red-50 border-b border-red-100 whitespace-pre-wrap break-words">
          {runtimeErr}
        </div>
      ) : null}
      <div className="relative w-full min-h-0" style={{ height, minHeight: heightPx }}>
        {loading && !bootErr ? (
          <div className="absolute inset-0 z-[1] flex items-center justify-center bg-white/80 text-sm text-gray-500">
            正在加载 ONLYOFFICE 编辑器…
          </div>
        ) : null}
        <div
          id={placeholderId}
          ref={editorRef}
          className="w-full h-full onlyoffice-host relative"
        />
      </div>
    </div>
  );
}
