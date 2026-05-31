import { FaPlus, FaSync } from 'react-icons/fa';
import { SearchableSelect } from '../ui';

interface ContractTemplateFiltersProps {
  filterL1: string;
  filterL2: string;
  hubSearch: string;
  hubSortField: string;
  hubSortAsc: boolean;
  hubShowTrash: boolean;
  hubFilterL1Options: { value: string; label: string }[];
  hubFilterL2Options: { value: string; label: string }[];
  hubSortComboOptions: { value: string; label: string }[];
  isSuperAdmin: boolean;
  hasActiveFilters: boolean;
  onFilterL1Change: (v: string) => void;
  onFilterL2Change: (v: string) => void;
  onSearchChange: (v: string) => void;
  onSortChange: (field: string, asc: boolean) => void;
  onShowTrashChange: (v: boolean) => void;
  onClearFilters: () => void;
  onNewTemplate: () => void;
  onManageCategories: () => void;
  onRefresh: () => void;
}

export default function ContractTemplateFilters({
  filterL1,
  filterL2,
  hubSearch,
  hubSortField,
  hubSortAsc,
  hubShowTrash,
  hubFilterL1Options,
  hubFilterL2Options,
  hubSortComboOptions,
  isSuperAdmin,
  hasActiveFilters,
  onFilterL1Change,
  onFilterL2Change,
  onSearchChange,
  onSortChange,
  onShowTrashChange,
  onClearFilters,
  onNewTemplate,
  onManageCategories,
  onRefresh,
}: ContractTemplateFiltersProps) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end w-full">
        <div className="lg:col-span-2 flex flex-col">
          <label className="text-xs text-gray-500 mb-1">一级类别</label>
          <SearchableSelect
            value={filterL1}
            onChange={(v) => {
              onFilterL1Change(v);
              onFilterL2Change('');
            }}
            options={hubFilterL1Options}
            placeholder="全部"
            searchPlaceholder="搜索一级…"
            searchThreshold={99} />
        </div>
        <div className="lg:col-span-2 flex flex-col">
          <label className="text-xs text-gray-500 mb-1">二级类别</label>
          <SearchableSelect
            value={filterL2}
            disabled={!filterL1}
            onChange={(v) => onFilterL2Change(v)}
            options={hubFilterL2Options}
            placeholder="全部（该一级下）"
            searchPlaceholder="搜索二级…"
            searchThreshold={99} />
        </div>
        <div className="lg:col-span-6 flex flex-col">
          <label className="text-xs text-gray-500 mb-1">关键字（标题/说明全文检索 + 变量名）</label>
          <input
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
            placeholder="多词用空格分词，如：分包 付款"
            value={hubSearch}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="搜索模板关键字" />
        </div>
        <div className="lg:col-span-2 flex flex-col">
          <label className="text-xs text-gray-500 mb-1">排序</label>
          <SearchableSelect
            value={`${hubSortField}:${hubSortAsc ? 'asc' : 'desc'}`}
            onChange={(v) => {
              const [f, o] = v.split(':');
              onSortChange(f, o === 'asc');
            }}
            options={hubSortComboOptions}
            placeholder="排序"
            searchPlaceholder="搜索排序…"
            searchThreshold={99} />
        </div>
      </div>

      {hasActiveFilters ? (
        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
          <span className="text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 max-w-[min(100%,42rem)] leading-snug">
            列表正在筛选中。新建模板若未出现在本页，请先点「清除筛选」或确认二级分类与模板一致。
          </span>
          <button
            type="button"
            className="shrink-0 px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 font-medium"
            onClick={onClearFilters}
            aria-label="清除筛选">
            清除筛选
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-amber-200 bg-amber-50 text-amber-900 cursor-pointer select-none">
            <input
              type="checkbox"
              className="rounded border-gray-300"
              checked={hubShowTrash}
              onChange={(e) => onShowTrashChange(e.target.checked)}
              aria-label="查看回收站" />
            查看回收站
          </label>
          {isSuperAdmin && (
            <button
              type="button"
              onClick={onNewTemplate}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              aria-label="新建模板">
              <FaPlus /> 新建模板
            </button>
          )}
          {isSuperAdmin ? (
            <button
              type="button"
              onClick={onManageCategories}
              className="px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white hover:bg-gray-50"
              aria-label="管理分类">
              管理分类
            </button>
          ) : null}
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-white border border-gray-300"
            aria-label="刷新">
            <FaSync /> 刷新
          </button>
        </div>
      </div>
    </>
  );
}