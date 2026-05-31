import { FaArrowLeft, FaRecycle, FaSync, FaPlus, FaDownload, FaTrash } from 'react-icons/fa';
import { SearchableSelect } from '../ui';
import { partyBDisplayNameFromListRow } from '../../utils/generatedContractListSearch';
import type { GeneratedContractListRow } from '../../services/contractGenerationService';

interface MyGeneratedTableProps {
  rows: GeneratedContractListRow[];
  filteredRows: GeneratedContractListRow[];
  loading: boolean;
  search: string;
  statusFilter: string;
  statusFilterOptions: { value: string; label: string }[];
  sort: string;
  sortOptions: { value: string; label: string }[];
  onSearchChange: (v: string) => void;
  onStatusFilterChange: (v: string) => void;
  onSortChange: (v: string) => void;
  onRefresh: () => void;
  onNavigateBack: () => void;
  onNavigateTrash: () => void;
  onNavigateNewFromTemplate: () => void;
  onExportCsv: () => void;
  onPreview: (row: GeneratedContractListRow) => void;
  onViewDetail: (row: GeneratedContractListRow) => void;
  onDelete: (row: GeneratedContractListRow) => void;
  buildPublicUrl?: (storagePath: string) => string;
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

export default function MyGeneratedTable({
  rows,
  filteredRows,
  loading,
  search,
  statusFilter,
  statusFilterOptions,
  sort,
  sortOptions,
  onSearchChange,
  onStatusFilterChange,
  onSortChange,
  onRefresh,
  onNavigateBack,
  onNavigateTrash,
  onNavigateNewFromTemplate,
  onExportCsv,
  onPreview,
  onViewDetail,
  onDelete,
  buildPublicUrl,
}: MyGeneratedTableProps) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <button
          type="button"
          className="text-sm text-blue-700 inline-flex items-center gap-1"
          onClick={onNavigateBack}
          aria-label="返回分类">
          <FaArrowLeft /> 返回分类
        </button>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onNavigateTrash}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-lg border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100"
            aria-label="回收站">
            <FaRecycle /> 回收站
          </button>
          <button
            type="button"
            onClick={onExportCsv}
            className="px-3 py-2 text-sm border rounded-lg bg-white"
            disabled={filteredRows.length === 0}
            title={filteredRows.length === 0 ? '无数据可导出' : '导出当前筛选与排序结果'}
            aria-label="导出 CSV">
            导出 CSV
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-lg bg-white"
            disabled={loading}
            aria-busy={loading}
            aria-label="刷新">
            <FaSync className={loading ? 'animate-spin' : ''} /> 刷新
          </button>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-gray-800 mb-1">已生成正式合同</h2>
      <p className="text-xs text-gray-500 mb-3">
        共 {rows.length} 条记录
        {filteredRows.length !== rows.length ? ` · 当前筛选后 ${filteredRows.length} 条` : null}
      </p>

      <div className="mb-4">
        <button
          type="button"
          onClick={onNavigateNewFromTemplate}
          className="inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-green-600 text-white hover:bg-green-700 text-sm font-medium shadow-md"
          aria-label="从模板新建业务合同">
          <FaPlus />
          从模板新建业务合同
        </button>
      </div>

      <div className="flex flex-col lg:flex-row flex-wrap gap-3 mb-4">
        <input
          type="search"
          className="flex-1 min-w-[180px] border border-gray-300 rounded-lg px-3 py-2 text-sm"
          placeholder="搜索：编号、模板名、工程、甲乙方…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="搜索合同" />
        <SearchableSelect
          className="min-w-[140px] max-w-[220px]"
          value={statusFilter}
          onChange={(v) => onStatusFilterChange(v)}
          options={statusFilterOptions}
          placeholder="全部状态"
          searchThreshold={99} />
        <SearchableSelect
          className="min-w-[180px] max-w-[280px]"
          value={sort}
          onChange={(v) => onSortChange(v)}
          options={sortOptions}
          placeholder="排序"
          searchThreshold={99} />
      </div>

      {loading ? (
        <div className="py-16 text-center text-gray-500 border rounded-lg bg-white" role="status" aria-live="polite">加载中…</div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-gray-600 px-4">
          <p className="font-medium text-gray-800">尚无由模板生成的合同</p>
          <p className="text-sm mt-2 max-w-md mx-auto">在「模板总览」中选择模板并上传 Word 后，使用「从模板生成合同」即可在此查看。</p>
          <button
            type="button"
            className="mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
            onClick={onNavigateBack}>
            前往模板总览
          </button>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="py-12 text-center rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-sm">
          没有符合当前关键字或状态的合同，请调整筛选条件。
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-lg bg-white shadow-sm">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 whitespace-nowrap">编号</th>
                <th className="px-3 py-2 min-w-[120px]">模板</th>
                <th className="px-3 py-2 min-w-[100px] hidden lg:table-cell">工程</th>
                <th className="px-3 py-2 min-w-[100px] hidden xl:table-cell">甲方</th>
                <th className="px-3 py-2 min-w-[100px] hidden xl:table-cell">乙方</th>
                <th className="px-3 py-2 whitespace-nowrap">状态</th>
                <th className="px-3 py-2 whitespace-nowrap">文档</th>
                <th className="px-3 py-2 whitespace-nowrap hidden md:table-cell">审批</th>
                <th className="px-3 py-2 whitespace-nowrap hidden sm:table-cell">创建</th>
                <th className="px-3 py-2 text-right min-w-[200px]">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => {
                const hasDocx = Boolean(r.generated_docx_storage_path);
                const hasPdf = Boolean(r.merged_pdf_storage_path);
                return (
                  <tr
                    key={r.id}
                    className="border-t border-gray-100 hover:bg-gray-50/80 cursor-pointer"
                    onClick={() => onViewDetail(r)}
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') onViewDetail(r); }}
                    aria-label={`合同 ${r.contract_no}`}>
                    <td className="px-3 py-2 font-medium text-blue-700 whitespace-nowrap">{r.contract_no}</td>
                    <td className="px-3 py-2 text-gray-800 max-w-[200px] truncate" title={r.contract_templates?.title}>
                      {r.contract_templates?.title ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-600 max-w-[160px] truncate hidden lg:table-cell" title={r.projects?.name}>
                      {r.projects?.name ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-600 max-w-[140px] truncate hidden xl:table-cell" title={r.party_a?.name ?? ''}>
                      {r.party_a?.name ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-600 max-w-[140px] truncate hidden xl:table-cell" title={partyBDisplayNameFromListRow(r)}>
                      {partyBDisplayNameFromListRow(r)}
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(r.status)}`}>
                        {formatGeneratedContractStatusLabel(r.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${hasDocx ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                          Word
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${hasPdf ? 'bg-blue-50 text-blue-800 border-blue-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                          PDF
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-600 hidden md:table-cell">
                      {r.approval_id ? (
                        <span className="text-emerald-700">已关联</span>
                      ) : (
                        <span className="text-gray-400">未发起</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap hidden sm:table-cell">
                      {new Date(r.created_at).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <button
                          type="button"
                          className="px-2 py-1 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-xs"
                          onClick={() => onPreview(r)}
                          aria-label={`预览 ${r.contract_no}`}>
                          预览
                        </button>
                        {hasPdf && buildPublicUrl ? (
                          <a
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100 text-xs"
                            href={buildPublicUrl(r.merged_pdf_storage_path!)}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`下载 ${r.contract_no} PDF`}>
                            <FaDownload className="text-[10px]" /> PDF
                          </a>
                        ) : null}
                        <button
                          type="button"
                          className="px-2 py-1 rounded-md bg-gray-900 text-white hover:bg-gray-800 text-xs"
                          onClick={() => onViewDetail(r)}
                          aria-label={`${r.contract_no} 详情`}>
                          详情
                        </button>
                        <button
                          type="button"
                          className="px-2 py-1 rounded-md border border-red-200 bg-red-50 text-red-800 hover:bg-red-100 text-xs"
                          onClick={() => onDelete(r)}
                          aria-label={`删除 ${r.contract_no}`}>
                          <FaTrash className="inline mr-0.5 text-[10px]" aria-hidden />
                          删除
                        </button>
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