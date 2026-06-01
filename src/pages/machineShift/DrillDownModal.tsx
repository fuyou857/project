/**
 * 数据穿透模态框组件
 * 用于展示统计数字的明细数据
 */

import { useState, useEffect } from 'react';
import { FaTimes, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { fetchDrillDownRecords } from './api';
import UiModalOverlay from '@/components/ui/UiModalOverlay';

interface DrillDownModalProps {
  title?: string;
  projectId?: string;
  machineId?: string;
  month?: string;
  onClose: () => void;
}

interface DrillDownRecord {
  id: string;
  project_name?: string;
  machine_name?: string;
  machine_code?: string;
  record_date: string;
  shift_count: number;
  cost_per_shift?: number;
  total_cost: number;
  status: string;
  operator?: string;
}

export default function DrillDownModal({ title, projectId, machineId, month, onClose }: DrillDownModalProps) {
  const [records, setRecords] = useState<DrillDownRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    loadRecords();
  }, [projectId, machineId, month, page]);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const filter: any = {
        projectId,
        machineId,
        status: 'confirmed',
        page,
        pageSize,
      };

      if (month) {
        const [year, mon] = month.split('-');
        filter.dateFrom = `${year}-${mon}-01`;
        const lastDay = new Date(parseInt(year), parseInt(mon), 0).getDate();
        filter.dateTo = `${year}-${mon}-${lastDay}`;
      }

      const result = await fetchDrillDownRecords(filter);
      setRecords(result.data);
      setTotal(result.total);
    } catch (err) {
      console.error('Failed to load drill down records:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  const getStatusDisplay = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      draft: { label: '草稿', className: 'bg-gray-100 text-gray-800' },
      pending: { label: '待审批', className: 'bg-orange-100 text-orange-800' },
      confirmed: { label: '已确认', className: 'bg-green-100 text-green-800' },
      rejected: { label: '已拒绝', className: 'bg-red-100 text-red-800' },
    };
    return map[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
  };

  return (
    <UiModalOverlay
      open={true}
      onClose={onClose}
      panelClassName="w-full max-w-4xl"
    >
      <div className="bg-white rounded-xl overflow-hidden flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-bold text-gray-800">
            {title || '明细数据'}
          </h3>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FaTimes className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 内容区 */}
        <div className="overflow-y-auto p-6 max-h-[70vh]">
          {loading ? (
            <div className="text-center py-12 text-gray-500">加载中...</div>
          ) : records.length === 0 ? (
            <div className="text-center py-12 text-gray-500">暂无数据</div>
          ) : (
            <>
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="text-left text-sm text-gray-600">
                    <th className="py-3 px-4">项目</th>
                    <th className="py-3 px-4">机械</th>
                    <th className="py-3 px-4">日期</th>
                    <th className="py-3 px-4 text-right">台班数</th>
                    <th className="py-3 px-4 text-right">单价</th>
                    <th className="py-3 px-4 text-right">总费用</th>
                    <th className="py-3 px-4 text-center">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {records.map((record) => {
                    const statusInfo = getStatusDisplay(record.status);
                    return (
                      <tr key={record.id} className="hover:bg-gray-50/50">
                        <td className="py-3 px-4 text-sm text-gray-800">
                          {record.project_name || '-'}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-800">
                          <div>{record.machine_name || '-'}</div>
                          <div className="text-xs text-gray-500">{record.machine_code}</div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-800">
                          {record.record_date}
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-gray-800 font-medium">
                          {record.shift_count.toFixed(1)}
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-gray-700">
                          {record.cost_per_shift ? `¥${record.cost_per_shift.toFixed(2)}` : '-'}
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-gray-800 font-medium">
                          ¥{record.total_cost.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-1 rounded text-xs ${statusInfo.className}`}>
                            {statusInfo.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-600">
                    共 {total} 条记录
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      className="p-2 bg-gray-50 rounded disabled:opacity-50"
                    >
                      <FaChevronLeft className="w-3 h-3 text-gray-800" />
                    </button>
                    <span className="text-sm text-gray-600">
                      {page} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page >= totalPages}
                      className="p-2 bg-gray-50 rounded disabled:opacity-50"
                    >
                      <FaChevronRight className="w-3 h-3 text-gray-800" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </UiModalOverlay>
  );
}
