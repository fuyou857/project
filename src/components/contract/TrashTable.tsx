import { FaArrowLeft, FaRecycle, FaSync, FaUndo, FaTrash } from 'react-icons/fa';
import { SearchableSelect } from '../ui';
import type { GeneratedContractListRow } from '../../services/contractGenerationService';

type TrashCompositeSort = 'deleted_at_desc' | 'deleted_at_asc' | 'contract_no_asc' | 'contract_no_desc';

interface TrashTableProps {
  rows: GeneratedContractListRow[];
  selected: Set<string>;
  loading: boolean;
  actionBusy: boolean;
  total: number;
  page: number;
  pageSize: number;
  sort: TrashCompositeSort;
  search: string;
  sortOptions: { value: string; label: string }[];
  isSuperAdmin: boolean;
  onSelectChange: (selected: Set<string>) => void;
  onPageChange: (page: number) => void;
  onSortChange: (sort: string) => void;
  onSearchChange: (search: string) => void;
  onRefresh: () => void;
  onBatchRestore: () => void;
  onRestoreOne: (id: string) => void;
  onPermanentDelete: (ids: string[]) => void;
  onViewDetail: (row: GeneratedContractListRow) => void;
  onNavigateBack: () => void;
}

function statusBadgeClass(status: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'draft') return 'bg-slate-100 text-slate-800 border border-slate-200';
  if (s === 'contract_final') return 'bg-blue-50 text-blue-900 border border-blue-200';
  if (s === 'published' || s === 'sealed') return 'bg-emerald-50 text-emerald-800 border border-emerald-200';
  if (s === 'archived') return 'bg-gray-100 text-gray-600 border border-gray-200';
  return 'bg-amber-50 text-amber-900 border border-amber-200';
}

function formatGeneratedContractStatusLabel(status: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'draft') return '草稿';
  if (s === 'contract_final') return '已定稿';
  if (s === 'sealed') return '已签章';
  return status;
}

export default function TrashTable({
  rows,
  selected,
  loading,
  actionBusy,
  total,
  page,
  pageSize,
  sort,
  search,
  sortOptions,
  isSuperAdmin,
  onSelectChange,
  onPageChange,
  onSortChange,
  onSearchChange,
  onRefresh,
  onBatchRestore,
  onRestoreOne,
  onPermanentDelete,
  onViewDetail,
  onNavigateBack,
}: TrashTableProps) {
  const allPageSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));
  const toggleSelectAllPage = () => {
    const n = new Set(selected);
    if (allPageSelected) {
      for (const row of rows) n.delete(row.id);
    } else {
      for (const row of rows) n.add(row.id);
    }
    onSelectChange(n);
  };
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <button
          type="button"
          className="text-sm text-blue-700 inline-flex items-center gap-1"
          onClick={onNavigateBack}
          aria-label="返回我生成的合同">
          <FaArrowLeft /> 我生成的合同
        </button>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-lg bg-white"
            disabled={loading || actionBusy}
            aria-busy={loading}>
            <FaSync className={loading ? 'animate-spin' : ''} /> 刷新
          </button>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mb-1 flex flex-wrap items-center gap-2">
        <FaRecycle className="text-amber-600 shrink-0" aria-hidden />
        合同回收站
      </h2>
      <p className="text-xs text-amber-900/90 mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 leading-relaxed">
        <strong>回收站</strong>中的合同仍保留原业务状态与附件；「恢复」后回到主列表。彻底删除仅<strong>超级管理员</strong>可用，且不可撤销。可在数据库侧配置定时任务调用{' '}
        <code className="text-[11px] bg-white/80 px-1 rounded">purge_contract_template_generated_trash_older_than(30)</code>{' '}
        自动清理软删除超过 30 天的记录。
      </p>

      {selected.size > 0 && (
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 mb-3 p-3 rounded-lg border border-slate-200 bg-slate-50">
          <span className="text-sm text-slate-800">已选 {selected.size} 条</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={actionBusy}
              onClick={onBatchRestore}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
              aria-label="批量恢复">
              <FaUndo className="text-xs" /> 批量恢复
            </button>
            {isSuperAdmin && (
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => onPermanentDelete([...selected])}
                className="btn-action-danger disabled:opacity-50"
                aria-label="批量彻底删除">
                <FaTrash className="text-xs" /> 批量彻底删除
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row flex-wrap gap-3 mb-4">
        <input
          type="search"
          className="flex-1 min-w-[160px] border border-gray-300 rounded-lg px-3 py-2 text-sm"
          placeholder="按合同编号筛选…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="搜索合同编号" />
        <SearchableSelect
          className="min-w-[200px] max-w-[280px]"
          value={sort}
          onChange={(v) => onSortChange(v as string)}
          options={sortOptions}
          placeholder="排序"
          searchThreshold={99} />
      </div>

      <p className="text-xs text-gray-500 mb-3">
        共 {total} 条在回收站
        {totalPages > 1 ? ` · 第 ${page + 1} / ${totalPages} 页` : null}
      </p>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button
            type="button"
            className="px-3 py-1.5 text-sm border rounded-lg bg-white disabled:opacity-40"
            disabled={page <= 0 || loading}
            onClick={() => onPageChange(Math.max(0, page - 1))}
            aria-label="上一页">
            上一页
          </button>
          <button
            type="button"
            className="px-3 py-1.5 text-sm border rounded-lg bg-white disabled:opacity-40"
            disabled={page + 1 >= totalPages || loading}
            onClick={() => onPageChange(page + 1)}
            aria-label="下一页">
            下一页
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-gray-500 border rounded-lg bg-white" role="status" aria-live="polite">加载中…</div>
      ) : total === 0 ? (
        <div className="py-16 text-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-gray-600 px-4">
          <p className="font-medium text-gray-800">回收站为空</p>
          <p className="text-sm mt-2">在「我生成的合同」列表中删除的合同会出现在这里。</p>
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-lg bg-white shadow-sm">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-amber-50/80 text-gray-700 border-b border-amber-100">
              <tr>
                <th className="px-2 py-2 w-10">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={allPageSelected}
                    onChange={toggleSelectAllPage}
                    aria-label="全选本页" />
                </th>
                <th className="px-3 py-2 whitespace-nowrap">编号</th>
                <th className="px-3 py-2 min-w-[100px]">模板</th>
                <th className="px-3 py-2 whitespace-nowrap">状态</th>
                <th className="px-3 py-2 whitespace-nowrap hidden sm:table-cell">删除时间</th>
                <th className="px-3 py-2 min-w-[120px] hidden md:table-cell">删除原因</th>
                <th className="px-3 py-2 text-right min-w-[200px]">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const checked = selected.has(row.id);
                return (
                  <tr
                    key={row.id}
                    className="border-t border-amber-100/80 hover:bg-amber-50/40 cursor-pointer"
                    onClick={() => onViewDetail(row)}
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') onViewDetail(row); }}
                    aria-label={`合同 ${row.contract_no}`}>
                    <td className="px-2 py-2 align-middle" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        checked={checked}
                        onChange={() => {
                          const n = new Set(selected);
                          if (n.has(row.id)) n.delete(row.id);
                          else n.add(row.id);
                          onSelectChange(n);
                        }}
                        aria-label={`选择 ${row.contract_no}`} />
                    </td>
                    <td className="px-3 py-2 font-medium text-amber-950 whitespace-nowrap">
                      {row.contract_no}
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-200 text-amber-950">已删除</span>
                    </td>
                    <td className="px-3 py-2 text-gray-800 max-w-[180px] truncate" title={row.contract_templates?.title}>
                      {row.contract_templates?.title ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(row.status)}`}>
                        {formatGeneratedContractStatusLabel(row.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap hidden sm:table-cell">
                      {row.deleted_at ? new Date(row.deleted_at).toLocaleString('zh-CN') : '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-600 text-xs max-w-[200px] truncate hidden md:table-cell" title={row.delete_reason ?? ''}>
                      {row.delete_reason?.trim() ? row.delete_reason : '—'}
                    </td>
                    <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={actionBusy}
                          className="px-2 py-1 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 text-xs disabled:opacity-50"
                          onClick={() => onRestoreOne(row.id)}
                          aria-label={`恢复 ${row.contract_no}`}>
                          <FaUndo className="inline mr-0.5 text-[10px]" /> 恢复
                        </button>
                        {isSuperAdmin ? (
                          <button
                            type="button"
                            disabled={actionBusy}
                            className="btn-action-danger disabled:opacity-50"
                            onClick={() => onPermanentDelete([row.id])}
                            aria-label={`彻底删除 ${row.contract_no}`}>
                            彻底删除
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-400 self-center">彻底删除限超管</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}