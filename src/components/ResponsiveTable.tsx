import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { useUiPreferences } from '../contexts/UiPreferencesContext';
import EmptyState from './ui/EmptyState';

function cellValueToNode(value: unknown): React.ReactNode {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (React.isValidElement(value)) return value;
  return String(value);
}

function rowAsRecord(row: object): Record<string, unknown> {
  return row as Record<string, unknown>;
}

export interface ColumnDef<TRow extends object = Record<string, unknown>> {
  key: string;
  label: string;
  render?: (value: unknown, row: TRow) => React.ReactNode;
  hiddenOnMobile?: boolean;
}

export interface ResponsiveTableProps<TRow extends object = Record<string, unknown>> {
  columns: ColumnDef<TRow>[];
  data: TRow[];
  keyField: string;
  onRowClick?: (row: TRow) => void;
  actionColumn?: (row: TRow) => React.ReactNode;
  /** 宽表首列冻结，便于横向滚动时对照主键列 */
  stickyFirstColumn?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
}

export default function ResponsiveTable<TRow extends object = Record<string, unknown>>({
  columns,
  data,
  keyField,
  onRowClick,
  actionColumn,
  stickyFirstColumn = true,
  emptyTitle = '暂无数据',
  emptyDescription,
  emptyAction,
}: ResponsiveTableProps<TRow>) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const { tableHeadCellClass, tableCellClass } = useUiPreferences();

  const toggleRow = (key: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setExpandedRows(newSet);
  };

  const visibleColumns = columns.filter(col => !col.hiddenOnMobile);

  const renderCell = (col: ColumnDef<TRow>, row: TRow) => {
    const value = rowAsRecord(row)[col.key];
    if (col.render) {
      return col.render(value, row);
    }
    return cellValueToNode(value);
  };

  const firstColKey = columns[0]?.key;
  const useSticky = stickyFirstColumn && columns.length > 1;

  if (data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="bg-gray-50">
          <tr className="border-b border-gray-200">
            {columns.map((col, colIdx) => (
              <th
                key={col.key}
                className={`text-left font-medium text-gray-600 ${tableHeadCellClass} ${
                  col.hiddenOnMobile ? 'hidden sm:table-cell' : ''
                } ${useSticky && colIdx === 0 ? 'sticky left-0 z-20 bg-gray-50 shadow-[1px_0_0_0_rgb(229,231,235)]' : ''}`}
              >
                {col.label}
              </th>
            ))}
            {actionColumn && (
              <th
                className={`text-center font-medium text-gray-600 ${tableHeadCellClass} ${
                  useSticky ? 'sticky right-0 z-20 bg-gray-50 shadow-[-1px_0_0_0_rgb(229,231,235)]' : ''
                }`}
              >
                操作
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {data.map(row => {
            const keyVal = rowAsRecord(row)[keyField];
            const key = keyVal == null ? '' : String(keyVal);
            const isExpanded = expandedRows.has(key);

            return (
              <React.Fragment key={key || JSON.stringify(rowAsRecord(row))}>
                <tr
                  className={`group border-b border-gray-100 hover:bg-gray-50 md:hover:bg-gray-50/80 ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col, colIdx) => (
                    <td
                      key={col.key}
                      className={`${tableCellClass} text-gray-800 ${col.hiddenOnMobile ? 'hidden sm:table-cell' : ''} ${
                        useSticky && colIdx === 0
                          ? 'sticky left-0 z-10 bg-white shadow-[1px_0_0_0_rgb(229,231,235)] group-hover:bg-gray-50'
                          : ''
                      }`}
                    >
                      {col.key === firstColKey && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              toggleRow(key);
                            }}
                            className="flex h-11 w-11 shrink-0 items-center justify-center text-gray-400 hover:text-gray-600 md:hidden"
                          >
                            {isExpanded ? <FaChevronUp className="h-5 w-5" /> : <FaChevronDown className="h-5 w-5" />}
                          </button>
                          <span className="min-w-0 font-medium text-gray-800">{renderCell(col, row)}</span>
                        </div>
                      )}
                      {col.key !== firstColKey && (
                        <span className={col.key === keyField ? 'font-medium' : ''}>{renderCell(col, row)}</span>
                      )}
                    </td>
                  ))}
                  {actionColumn && (
                    <td
                      className={`${tableCellClass} ${
                        useSticky
                          ? 'sticky right-0 z-10 bg-white shadow-[-1px_0_0_0_rgb(229,231,235)] group-hover:bg-gray-50'
                          : ''
                      }`}
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center gap-2">{actionColumn(row)}</div>
                    </td>
                  )}
                </tr>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.tr
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="md:hidden"
                    >
                      <td colSpan={columns.length + (actionColumn ? 1 : 0)} className="bg-gray-50 p-4">
                        <div className="space-y-3">
                          {visibleColumns
                            .filter(col => col.key !== firstColKey)
                            .map(col => (
                              <div
                                key={col.key}
                                className="flex items-center justify-between border-b border-gray-200 py-2"
                              >
                                <span className="text-sm font-medium text-gray-500">{col.label}</span>
                                <span className="text-sm text-gray-800">{renderCell(col, row)}</span>
                              </div>
                            ))}
                          {actionColumn && (
                            <div className="pt-2">
                              <div className="flex items-center justify-center gap-2">{actionColumn(row)}</div>
                            </div>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  )}
                </AnimatePresence>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
