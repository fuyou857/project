import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FaKey,
  FaPlus,
  FaSync,
  FaShieldAlt,
  FaHistory,
  FaExclamationTriangle,
  FaCheckCircle,
  FaEye,
  FaEyeSlash,
  FaDownload,
  FaUpload,
  FaPlug,
} from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';
import { SegmentedControl } from '../../components/ui';
import {
  listApiKeys,
  listApiKeyLogs,
  createApiKey,
  updateApiKey,
  deleteApiKey,
  revealApiKeySecret,
  testApiKey,
  batchTestApiKeys,
  exportApiKeyBackup,
  runApiKeyExpiryCheck,
  getApiKeyCenterStatus,
  setApiKeyCenterEnabled,
  batchImportApiKeys,
  syncApiKeysFromSystem,
  batchUpdateApiKeys,
  readApiKeysListCache,
  type ApiKeyPublic,
  type ApiKeyRegistryItem,
  type ApiKeySummary,
  type ApiKeyLog,
} from '../../services/apiKeyOpsService';

const STATUS_LABEL: Record<string, string> = {
  active: '正常',
  expiring_soon: '即将过期',
  expired: '已过期',
  disabled: '停用',
  env_only: '仅环境变量',
  missing: '未配置',
};

const STATUS_CLASS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  expiring_soon: 'bg-amber-100 text-amber-800',
  expired: 'bg-red-100 text-red-800',
  disabled: 'bg-gray-100 text-gray-600',
  env_only: 'bg-blue-100 text-blue-800',
  missing: 'bg-slate-100 text-slate-600',
};

const PAGE_SIZE = 10;

function SummaryCard({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="ui-card p-4 border border-gray-200"
    >
      <p className="text-caption text-gray-500">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums mt-1 ${tone ?? 'text-gray-900'}`}>{value}</p>
    </motion.div>
  );
}

const emptyForm = {
  key_code: '',
  name: '',
  api_url: '',
  secret_key: '',
  expires_at: '',
  usage_scene: '',
  rate_limit_per_minute: '',
  allowed_ips: '',
  is_enabled: true,
};

export default function ApiKeyCenter() {
  const { isStrictSuperAdmin, user } = useAuth();
  const [keys, setKeys] = useState<ApiKeyPublic[]>([]);
  const [registry, setRegistry] = useState<ApiKeyRegistryItem[]>([]);
  const [extraKeys, setExtraKeys] = useState<ApiKeyPublic[]>([]);
  const [summary, setSummary] = useState<ApiKeySummary>({ total: 0, expiringSoon: 0, expired: 0, disabled: 0 });
  const [logs, setLogs] = useState<ApiKeyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [centerEnabled, setCenterEnabled] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'list' | 'form' | 'tools' | 'logs'>('list');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [listPage, setListPage] = useState(1);
  const [usingCache, setUsingCache] = useState(false);
  const [show7dModal, setShow7dModal] = useState(false);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [logFilters, setLogFilters] = useState({
    key_code: '',
    action: '',
    operator_email: '',
    from: '',
    to: '',
  });
  const [logPage, setLogPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setUsingCache(false);
    try {
      const [listRes, logRes, enabled] = await Promise.all([
        listApiKeys({
          search: search.trim() || undefined,
          status: statusFilter || undefined,
          category: categoryFilter || undefined,
        }),
        listApiKeyLogs({ limit: 30, page: logPage, ...logFilters }),
        getApiKeyCenterStatus(),
      ]);
      setKeys(listRes.keys);
      setRegistry(listRes.registry);
      setExtraKeys(listRes.extraKeys);
      setSummary(listRes.summary);
      setLogs(logRes.logs);
      setCenterEnabled(enabled);
      const warn7 = listRes.keys.filter(k => k.warning_level === 'warn_7d' || k.status === 'expiring_soon');
      if (warn7.length > 0) setShow7dModal(true);
    } catch (e) {
      const cached = readApiKeysListCache();
      if (cached) {
        setKeys(cached.keys);
        setRegistry(cached.registry);
        setExtraKeys(cached.extraKeys);
        setSummary(cached.summary);
        setUsingCache(true);
      } else {
        alert(e instanceof Error ? e.message : '加载失败');
      }
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, categoryFilter, logPage, logFilters]);

  useEffect(() => {
    if (isStrictSuperAdmin) void load();
  }, [isStrictSuperAdmin, load]);

  useEffect(() => {
    if (!isStrictSuperAdmin) return;
    void runApiKeyExpiryCheck().catch(() => {});
  }, [isStrictSuperAdmin]);

  type DisplayRow = {
    key_code: string;
    name: string;
    usage_scene: string | null;
    secret_masked: string;
    status: string;
    expires_at: string | null;
    id: string;
    in_database: boolean;
    env_configured: boolean;
    env_keys: string[];
  };

  const displayRows = useMemo((): DisplayRow[] => {
    const fromRegistry: DisplayRow[] = registry.map(r => {
      const k = r.key;
      return {
        key_code: r.key_code,
        name: k?.name ?? r.name,
        usage_scene: k?.usage_scene ?? r.usage_scene,
        secret_masked: k?.secret_masked ?? (r.env_configured ? '（Edge 已配置）' : '—'),
        status: k?.status ?? (r.env_configured ? 'env_only' : 'missing'),
        expires_at: k?.expires_at ?? null,
        id: k?.id ?? `registry-${r.key_code}`,
        in_database: r.in_database,
        env_configured: r.env_configured,
        env_keys: r.env_keys,
      };
    });
    const extra: DisplayRow[] = extraKeys.map(k => ({
      key_code: k.key_code,
      name: k.name,
      usage_scene: k.usage_scene,
      secret_masked: k.secret_masked,
      status: k.status,
      expires_at: k.expires_at,
      id: k.id,
      in_database: true,
      env_configured: false,
      env_keys: [],
    }));
    return [...fromRegistry, ...extra];
  }, [registry, extraKeys]);

  const warn15Keys = useMemo(
    () => keys.filter(k => k.warning_level === 'warn_15d'),
    [keys],
  );

  const urgentKeys = useMemo(
    () => keys.filter(k => k.status === 'expiring_soon' || k.status === 'expired'),
    [keys],
  );

  const paginatedRows = useMemo(() => {
    const start = (listPage - 1) * PAGE_SIZE;
    return displayRows.slice(start, start + PAGE_SIZE);
  }, [displayRows, listPage]);

  const listTotalPages = Math.max(1, Math.ceil(displayRows.length / PAGE_SIZE));

  useEffect(() => {
    setListPage(1);
  }, [search, statusFilter, categoryFilter, displayRows.length]);

  async function handleSyncFromSystem() {
    const overwrite = window.confirm(
      '是否覆盖数据库中已存在的同名密钥？\n\n确定 = 覆盖；取消 = 仅导入尚未入库的项',
    );
    setBusy(true);
    try {
      const res = await syncApiKeysFromSystem(overwrite);
      alert(
        `同步完成：写入 ${res.synced} 项${res.skipped.length ? `\n跳过/失败 ${res.skipped.length} 项：\n${res.skipped.slice(0, 8).join('\n')}` : ''}`,
      );
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '同步失败');
    } finally {
      setBusy(false);
    }
  }

  function startCreateFromRegistry(item: ApiKeyRegistryItem) {
    setEditingCode(null);
    setForm({
      ...emptyForm,
      key_code: item.key_code,
      name: item.name,
      usage_scene: item.usage_scene,
    });
    setTab('form');
  }

  if (!isStrictSuperAdmin) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ui-card p-8 text-center border border-gray-200">
        <FaShieldAlt className="mx-auto text-red-400 mb-3" size={40} />
        <h3 className="ui-section-title text-gray-800">无权访问</h3>
        <p className="text-body text-gray-600 mt-2">API 密钥中心仅对超级管理员（super_admin）开放。</p>
      </motion.div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        key_code: form.key_code.trim(),
        name: form.name.trim(),
        api_url: form.api_url.trim() || undefined,
        secret_key: form.secret_key.trim() || undefined,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
        usage_scene: form.usage_scene.trim() || undefined,
        rate_limit_per_minute: form.rate_limit_per_minute ? Number(form.rate_limit_per_minute) : undefined,
        allowed_ips: form.allowed_ips
          .split(/[,，\s]+/)
          .map(s => s.trim())
          .filter(Boolean),
        is_enabled: form.is_enabled,
      };
      let connectivity: { ok: boolean; message: string } | undefined;
      if (editingCode) {
        const res = await updateApiKey(editingCode, {
          name: payload.name,
          api_url: payload.api_url,
          secret_key: payload.secret_key,
          expires_at: payload.expires_at,
          usage_scene: payload.usage_scene,
          rate_limit_per_minute: payload.rate_limit_per_minute,
          allowed_ips: payload.allowed_ips,
          is_enabled: payload.is_enabled,
        });
        connectivity = res.connectivity;
      } else {
        const res = await createApiKey(payload);
        connectivity = res.connectivity;
      }
      alert(
        connectivity
          ? `保存成功。连通性：${connectivity.ok ? '通过' : '失败'} — ${connectivity.message}`
          : '保存成功',
      );
      setForm(emptyForm);
      setEditingCode(null);
      setTab('list');
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }

  function startEdit(k: ApiKeyPublic) {
    setEditingCode(k.key_code);
    setForm({
      key_code: k.key_code,
      name: k.name,
      api_url: k.api_url ?? '',
      secret_key: '',
      expires_at: k.expires_at ? k.expires_at.slice(0, 16) : '',
      usage_scene: k.usage_scene ?? '',
      rate_limit_per_minute: k.rate_limit_per_minute != null ? String(k.rate_limit_per_minute) : '',
      allowed_ips: (k.allowed_ips ?? []).join(', '),
      is_enabled: k.is_enabled,
    });
    setTab('form');
  }

  async function toggleEnabled(k: ApiKeyPublic) {
    setBusy(true);
    try {
      await updateApiKey(k.key_code, { is_enabled: !k.is_enabled });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '更新失败');
    } finally {
      setBusy(false);
    }
  }

  async function handleBatchEnable(enable: boolean) {
    if (selectedCodes.size === 0) {
      alert('请先勾选密钥');
      return;
    }
    setBusy(true);
    try {
      const res = await batchUpdateApiKeys(
        [...selectedCodes].map(key_code => ({ key_code, is_enabled: enable })),
      );
      alert(`已更新 ${res.updated} 项${res.errors.length ? `\n${res.errors.join('\n')}` : ''}`);
      setSelectedCodes(new Set());
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '批量更新失败');
    } finally {
      setBusy(false);
    }
  }

  async function handleReveal(keyCode: string) {
    try {
      const secret = await revealApiKeySecret(keyCode);
      setRevealed(prev => ({ ...prev, [keyCode]: secret }));
      setTimeout(() => {
        setRevealed(prev => {
          const next = { ...prev };
          delete next[keyCode];
          return next;
        });
      }, 30_000);
    } catch (e) {
      alert(e instanceof Error ? e.message : '解锁失败');
    }
  }

  async function handleBatchTest() {
    setBusy(true);
    try {
      const results = await batchTestApiKeys();
      const failed = results.filter(r => !r.ok);
      alert(
        failed.length
          ? `检测完成：${results.length - failed.length}/${results.length} 通过\n${failed.map(f => `${f.key_code}: ${f.message}`).join('\n')}`
          : `全部 ${results.length} 项连通性正常`,
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : '检测失败');
    } finally {
      setBusy(false);
    }
  }

  async function handleExport(includeCiphertext: boolean) {
    try {
      const data = await exportApiKeyBackup(includeCiphertext);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `api-keys-backup-${data.exported_at.slice(0, 10)}.json`;
      a.click();
    } catch (e) {
      alert(e instanceof Error ? e.message : '导出失败');
    }
  }

  async function handleImport(file: File) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { keys?: Record<string, unknown>[]; items?: Record<string, unknown>[] };
      const items = parsed.items ?? parsed.keys ?? [];
      const res = await batchImportApiKeys(items);
      alert(`导入 ${res.imported} 条${res.errors?.length ? `，失败：\n${res.errors.join('\n')}` : ''}`);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '导入失败');
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <div>
          <p className="text-caption text-gray-500">系统设置 · 高级运维配置</p>
          <h2 className="ui-page-title text-gray-900 flex items-center gap-2 mt-1">
            <FaKey className="text-blue-600" /> API 密钥中心
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={centerEnabled}
              onChange={async ev => {
                await setApiKeyCenterEnabled(ev.target.checked);
                setCenterEnabled(ev.target.checked);
              }}
            />
            密钥中心启用
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleSyncFromSystem()}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            <FaDownload /> 从系统同步
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm hover:bg-gray-50"
          >
            <FaSync /> 刷新
          </button>
        </div>
      </motion.div>

      {urgentKeys.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 flex gap-3">
          <FaExclamationTriangle className="text-amber-600 shrink-0 mt-0.5" />
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="font-medium text-amber-900">7 日内到期 / 已过期</p>
            <p className="text-sm text-amber-800 mt-1">
              {urgentKeys.map(k => `「${k.name}」(${STATUS_LABEL[k.status]})`).join('、')}
            </p>
          </motion.div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <SummaryCard label="系统注册项" value={summary.registryTotal ?? registry.length} />
        <SummaryCard label="已入库" value={summary.inDatabase ?? summary.total} />
        <SummaryCard label="Edge 已配置" value={summary.envConfigured ?? 0} tone="text-blue-600" />
        <SummaryCard label="15日预警" value={summary.warn15 ?? 0} tone="text-yellow-600" />
        <SummaryCard label="7日紧急" value={summary.warn7 ?? summary.expiringSoon} tone="text-amber-600" />
        <SummaryCard label="已过期" value={summary.expired} tone="text-red-600" />
      </div>

      {usingCache && (
        <div className="p-3 rounded-lg border border-blue-200 bg-blue-50 text-sm text-blue-800">
          网络异常，已展示上次缓存的密钥清单（脱敏）。恢复网络后请点击刷新。
        </div>
      )}

      {warn15Keys.length > 0 && (
        <div className="p-4 rounded-xl border border-yellow-200 bg-yellow-50 flex gap-3">
          <FaExclamationTriangle className="text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-900">15 日内到期预警</p>
            <p className="text-sm text-yellow-800 mt-1">{warn15Keys.map(k => `「${k.name}」`).join('、')}</p>
          </div>
        </div>
      )}

      {show7dModal && urgentKeys.some(k => k.status === 'expiring_soon') && (
        <motion.div
          role="dialog"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div className="ui-card max-w-md w-full p-6 border border-amber-300">
            <h3 className="ui-section-title text-amber-900">紧急：密钥 7 日内到期</h3>
            <ul className="mt-3 text-sm text-gray-700 space-y-1 list-disc pl-5">
              {keys
                .filter(k => k.status === 'expiring_soon')
                .map(k => (
                  <li key={k.key_code}>
                    {k.name}（{k.key_code}）
                  </li>
                ))}
            </ul>
            <button
              type="button"
              className="mt-4 w-full py-2 bg-amber-600 text-white rounded-lg"
              onClick={() => setShow7dModal(false)}
            >
              我知道了
            </button>
          </motion.div>
        </motion.div>
      )}

      <SegmentedControl
        value={tab}
        onChange={v => setTab(v as typeof tab)}
        aria-label="密钥中心分区"
        options={[
          { value: 'list', label: '密钥列表' },
          { value: 'form', label: editingCode ? '编辑密钥' : '新增密钥' },
          { value: 'tools', label: '批量工具' },
          { value: 'logs', label: '操作日志' },
        ]}
      />

      {loading ? (
        <motion.div className="text-center py-16 text-gray-500">加载中…</motion.div>
      ) : (
        <>
          {tab === 'list' && (
            <div className="ui-card border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 space-y-3">
                <p className="text-caption text-gray-500">
                  清单来自系统注册表与数据库；更新后约 30 秒全站热生效，无需重启。
                </p>
                <div className="flex flex-wrap gap-3 items-end">
                  <motion.div className="flex-1 min-w-[12rem]">
                    <label className="ui-label">搜索</label>
                    <input
                      className="ui-input w-full"
                      placeholder="标识 / 名称 / 场景"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                  </motion.div>
                  <motion.div>
                    <label className="ui-label">状态</label>
                    <SegmentedControl
                      value={statusFilter}
                      onChange={setStatusFilter}
                      aria-label="状态筛选"
                      options={[
                        { value: '', label: '全部' },
                        { value: 'active', label: '正常' },
                        { value: 'expiring_soon', label: '即将过期' },
                        { value: 'expired', label: '已过期' },
                        { value: 'disabled', label: '停用' },
                      ]}
                    />
                  </motion.div>
                  <motion.div>
                    <label className="ui-label">分类</label>
                    <SegmentedControl
                      value={categoryFilter}
                      onChange={setCategoryFilter}
                      aria-label="分类筛选"
                      options={[
                        { value: '', label: '全部' },
                        { value: 'ocr', label: 'OCR' },
                        { value: 'convert', label: '转换' },
                        { value: 'wechat', label: '企微' },
                        { value: 'office', label: 'Office' },
                      ]}
                    />
                  </motion.div>
                  <button
                    type="button"
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    onClick={() => void load()}
                  >
                    应用筛选
                  </button>
                </div>
                {selectedCodes.size > 0 && (
                  <div className="flex gap-2 text-sm">
                    <button
                      type="button"
                      className="px-3 py-1 bg-emerald-600 text-white rounded"
                      onClick={() => void handleBatchEnable(true)}
                    >
                      批量启用
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1 bg-gray-600 text-white rounded"
                      onClick={() => void handleBatchEnable(false)}
                    >
                      批量停用
                    </button>
                  </div>
                )}
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="py-3 px-2 w-8" />
                    <th className="text-left py-3 px-4">标识</th>
                    <th className="text-left py-3 px-4">名称</th>
                    <th className="text-left py-3 px-4">来源</th>
                    <th className="text-left py-3 px-4">密钥</th>
                    <th className="text-left py-3 px-4">状态</th>
                    <th className="text-left py-3 px-4">过期时间</th>
                    <th className="text-right py-3 px-4">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map(row => {
                    const dbKey = keys.find(k => k.key_code === row.key_code);
                    const reg = registry.find(r => r.key_code === row.key_code);
                    return (
                      <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50/80">
                        <td className="py-3 px-2">
                          {dbKey && (
                            <input
                              type="checkbox"
                              checked={selectedCodes.has(row.key_code)}
                              onChange={ev => {
                                setSelectedCodes(prev => {
                                  const next = new Set(prev);
                                  if (ev.target.checked) next.add(row.key_code);
                                  else next.delete(row.key_code);
                                  return next;
                                });
                              }}
                            />
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs">{row.key_code}</td>
                        <td className="py-3 px-4">
                          <div>{row.name}</div>
                          {row.usage_scene && (
                            <div className="text-caption text-gray-400 mt-0.5">{row.usage_scene}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-500">
                          {row.in_database && <span className="text-emerald-600">库 </span>}
                          {row.env_configured && <span className="text-blue-600">Edge </span>}
                          {!row.in_database && !row.env_configured && '—'}
                          {row.env_keys.length > 0 && (
                            <div className="font-mono mt-1 text-[10px] leading-tight" title={row.env_keys.join(', ')}>
                              {row.env_keys.join(', ')}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs">
                          {row.in_database ? (
                            <>
                              {revealed[row.key_code] ?? row.secret_masked}
                              <button
                                type="button"
                                className="ml-2 text-blue-600"
                                title="短暂查看明文（30秒）"
                                onClick={() => void handleReveal(row.key_code)}
                              >
                                {revealed[row.key_code] ? <FaEyeSlash /> : <FaEye />}
                              </button>
                            </>
                          ) : (
                            row.secret_masked
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-xs ${STATUS_CLASS[row.status] ?? ''}`}>
                            {STATUS_LABEL[row.status] ?? row.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {row.expires_at ? new Date(row.expires_at).toLocaleString() : '—'}
                        </td>
                        <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                          {dbKey ? (
                            <>
                              <button
                                type="button"
                                className="text-gray-600 hover:underline"
                                onClick={() => void toggleEnabled(dbKey)}
                              >
                                {dbKey.is_enabled ? '停用' : '启用'}
                              </button>
                              <button
                                type="button"
                                className="text-blue-600 hover:underline"
                                onClick={() => startEdit(dbKey)}
                              >
                                编辑
                              </button>
                              <button
                                type="button"
                                className="text-gray-600 hover:underline"
                                onClick={async () => {
                                  const t = await testApiKey(row.key_code);
                                  alert(t.ok ? `连通正常：${t.message}` : `失败：${t.message}`);
                                }}
                              >
                                检测
                              </button>
                              <button
                                type="button"
                                className="text-red-600 hover:underline"
                                onClick={async () => {
                                  if (!confirm(`确定删除 ${row.key_code}？`)) return;
                                  await deleteApiKey(row.key_code);
                                  await load();
                                }}
                              >
                                删除
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="text-blue-600 hover:underline"
                              onClick={() => reg && startCreateFromRegistry(reg)}
                            >
                              录入
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {displayRows.length === 0 && (
                <p className="text-center py-12 text-gray-500">
                  无法读取系统清单，请确认已部署 api-key-ops 并执行数据库迁移
                </p>
              )}
              {displayRows.length > 0 && (
                <motion.div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm">
                  <span className="text-gray-500">
                    共 {displayRows.length} 项，第 {listPage}/{listTotalPages} 页
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={listPage <= 1}
                      className="px-3 py-1 border rounded disabled:opacity-40"
                      onClick={() => setListPage(p => Math.max(1, p - 1))}
                    >
                      上一页
                    </button>
                    <button
                      type="button"
                      disabled={listPage >= listTotalPages}
                      className="px-3 py-1 border rounded disabled:opacity-40"
                      onClick={() => setListPage(p => Math.min(listTotalPages, p + 1))}
                    >
                      下一页
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {tab === 'form' && (
            <form onSubmit={handleSubmit} className="ui-card p-6 border border-gray-200 space-y-4 max-w-2xl">
              <h3 className="ui-section-title flex items-center gap-2">
                <FaPlus className="text-blue-500" />
                {editingCode ? `编辑 · ${editingCode}` : '新增密钥'}
              </h3>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="ui-label">接口标识 key_code</label>
                  <input
                    className="ui-input w-full"
                    value={form.key_code}
                    disabled={!!editingCode}
                    onChange={e => setForm(f => ({ ...f, key_code: e.target.value }))}
                    placeholder="invoice_ocr_upstream"
                    required
                  />
                </div>
                <div>
                  <label className="ui-label">接口名称</label>
                  <input
                    className="ui-input w-full"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="sm:col-span-2">
                  <label className="ui-label">请求地址 api_url</label>
                  <input
                    className="ui-input w-full"
                    value={form.api_url}
                    onChange={e => setForm(f => ({ ...f, api_url: e.target.value }))}
                    placeholder="https://api.example.com/v1"
                  />
                </motion.div>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="sm:col-span-2">
                  <label className="ui-label">密钥 secret_key {editingCode && '（留空则不修改）'}</label>
                  <input
                    type="password"
                    className="ui-input w-full"
                    value={form.secret_key}
                    onChange={e => setForm(f => ({ ...f, secret_key: e.target.value }))}
                    autoComplete="new-password"
                  />
                </motion.div>
                <div>
                  <label className="ui-label">过期时间</label>
                  <input
                    type="datetime-local"
                    className="ui-input w-full"
                    value={form.expires_at}
                    onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="ui-label">限流（次/分钟）</label>
                  <input
                    type="number"
                    className="ui-input w-full"
                    value={form.rate_limit_per_minute}
                    onChange={e => setForm(f => ({ ...f, rate_limit_per_minute: e.target.value }))}
                  />
                </div>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="sm:col-span-2">
                  <label className="ui-label">调用场景</label>
                  <input
                    className="ui-input w-full"
                    value={form.usage_scene}
                    onChange={e => setForm(f => ({ ...f, usage_scene: e.target.value }))}
                  />
                </motion.div>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="sm:col-span-2">
                  <label className="ui-label">IP 白名单（逗号分隔，留空不限制）</label>
                  <input
                    className="ui-input w-full"
                    value={form.allowed_ips}
                    onChange={e => setForm(f => ({ ...f, allowed_ips: e.target.value }))}
                    placeholder="203.0.113.1, 10.0.0.0/8"
                  />
                </motion.div>
                <motion.div className="sm:col-span-2 flex items-center gap-2">
                  <input
                    id="form-enabled"
                    type="checkbox"
                    checked={form.is_enabled}
                    onChange={e => setForm(f => ({ ...f, is_enabled: e.target.checked }))}
                  />
                  <label htmlFor="form-enabled" className="text-sm text-gray-700">
                    启用该密钥
                  </label>
                </motion.div>
              </motion.div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {busy ? '提交中…' : '保存并检测连通性'}
                </button>
                {editingCode && (
                  <button
                    type="button"
                    className="px-4 py-2 border border-gray-300 rounded-lg"
                    onClick={() => {
                      setEditingCode(null);
                      setForm(emptyForm);
                    }}
                  >
                    取消
                  </button>
                )}
              </div>
              <p className="text-caption text-gray-500">
                操作人：{user?.real_name || user?.username || user?.email} · 密钥将 AES 加密入库并同步本地备份
              </p>
            </form>
          )}

          {tab === 'tools' && (
            <div className="ui-card p-6 border border-gray-200 space-y-4 max-w-xl">
              <h3 className="ui-section-title">批量工具</h3>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleBatchTest()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg"
                >
                  <FaPlug /> 一键检测全部
                </button>
                <button
                  type="button"
                  onClick={() => void handleExport(false)}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <FaDownload /> 脱敏导出
                </button>
                <button
                  type="button"
                  onClick={() => void handleExport(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <FaDownload /> 密文备份
                </button>
                <label className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer relative">
                  <FaUpload /> 批量导入
                  <input
                    type="file"
                    accept="application/json"
                    className="ui-file-input-overlay" data-file-upload-field="true"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) void handleImport(f);
                    }}
                  />
                </label>
              </div>
              <p className="text-caption text-gray-500 flex items-start gap-2">
                <FaCheckCircle className="text-emerald-500 shrink-0 mt-0.5" />
                更新后无需重启：Edge Function 内存缓存约 30 秒自动刷新；数据库与 system_settings 双备份持久化。
              </p>
            </div>
          )}

          {tab === 'logs' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ui-card border border-gray-200">
              <motion.div className="p-4 border-b border-gray-100 space-y-3">
                <div className="flex items-center gap-2">
                  <FaHistory className="text-gray-500" />
                  <h3 className="font-medium text-gray-800">操作日志（脱敏）</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <input
                    className="ui-input"
                    placeholder="key_code"
                    value={logFilters.key_code}
                    onChange={e => setLogFilters(f => ({ ...f, key_code: e.target.value }))}
                  />
                  <input
                    className="ui-input"
                    placeholder="操作类型"
                    value={logFilters.action}
                    onChange={e => setLogFilters(f => ({ ...f, action: e.target.value }))}
                  />
                  <input
                    className="ui-input"
                    placeholder="操作人邮箱"
                    value={logFilters.operator_email}
                    onChange={e => setLogFilters(f => ({ ...f, operator_email: e.target.value }))}
                  />
                  <input
                    type="datetime-local"
                    className="ui-input"
                    value={logFilters.from}
                    onChange={e => setLogFilters(f => ({ ...f, from: e.target.value }))}
                  />
                  <input
                    type="datetime-local"
                    className="ui-input"
                    value={logFilters.to}
                    onChange={e => setLogFilters(f => ({ ...f, to: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm"
                    onClick={() => {
                      setLogPage(1);
                      void load();
                    }}
                  >
                    查询日志
                  </button>
                </div>
              </motion.div>
              <ul className="divide-y divide-gray-100 max-h-[28rem] overflow-y-auto">
                {logs.map(log => (
                  <li key={log.id} className="px-4 py-3 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium text-gray-800">{log.action}</span>
                      <span className="text-gray-400 text-xs">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-gray-600 mt-1">
                      {log.key_code && <span className="font-mono mr-2">{log.key_code}</span>}
                      {log.operator_email} · {log.ip_address || '—'}
                    </p>
                    {log.detail && Object.keys(log.detail).length > 0 && (
                      <pre className="text-xs text-gray-400 mt-1 overflow-x-auto">
                        {JSON.stringify(log.detail)}
                      </pre>
                    )}
                  </li>
                ))}
                {logs.length === 0 && <li className="py-12 text-center text-gray-500">暂无日志</li>}
              </ul>
              <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-100">
                <button
                  type="button"
                  disabled={logPage <= 1}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-40"
                  onClick={() => setLogPage(p => Math.max(1, p - 1))}
                >
                  上一页
                </button>
                <span className="text-sm text-gray-500 self-center">第 {logPage} 页</span>
                <button
                  type="button"
                  className="px-3 py-1 border rounded text-sm"
                  onClick={() => setLogPage(p => p + 1)}
                >
                  下一页
                </button>
              </div>
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  );
}
