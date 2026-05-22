import React from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T, index: number) => React.ReactNode;
  width?: string;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  emptyText?: string;
  onRowClick?: (item: T) => void;
  currentPage?: number;
  pageSize?: number;
  totalCount?: number;
  onPageChange?: (page: number) => void;
  className?: string;
}

export function DataTable<T extends { id?: string }>({
  data,
  columns,
  loading = false,
  emptyText = '暂无数据',
  onRowClick,
  currentPage = 1,
  pageSize = 10,
  totalCount,
  onPageChange,
  className = '',
}: DataTableProps<T>) {
  const totalPages = totalCount ? Math.ceil(totalCount / pageSize) : 1;

  const renderLoading = () => (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-4 border-slate-600 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  const renderEmpty = () => (
    <div className="flex items-center justify-center py-12 text-slate-400">
      {emptyText}
    </div>
  );

  const renderTableBody = () => {
    if (loading) return renderLoading();
    if (data.length === 0) return renderEmpty();
    return data.map((item, index) => (
      <tr
        key={item.id || index}
        onClick={() => onRowClick?.(item)}
        className={`${onRowClick ? 'cursor-pointer hover:bg-slate-700/50' : ''} transition-colors`}
      >
        {columns.map(col => (
          <td key={col.key} className={`px-4 py-3 text-sm text-white ${col.className || ''}`}>
            {col.render ? col.render(item, index) : String((item as Record<string, unknown>)[col.key] ?? '')}
          </td>
        ))}
      </tr>
    ));
  };

  const renderPagination = () => {
    if (!onPageChange || !totalCount) return null;

    return (
      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
        <div className="text-sm text-slate-400">
          共 {totalCount} 条记录，第 {currentPage}/{totalPages} 页
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FaChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-slate-300 px-2">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FaChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={`bg-slate-800 rounded-xl overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-700/50">
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-sm font-medium text-slate-300 ${col.className || ''}`}
                  style={{ width: col.width }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {renderTableBody()}
          </tbody>
        </table>
      </div>
      {renderPagination()}
    </div>
  );
}
