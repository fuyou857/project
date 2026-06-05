/**
 * 机械台班记录列表页面
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaEdit, FaTrash, FaSearch, FaTimes, FaCheck, FaClock } from 'react-icons/fa';
import { SearchableSelect, SegmentedControl, UiModalOverlay as Modal } from '../../components/ui';
import { useProjectsForSelect } from '../../hooks/useProjectsForSelect';
import { supabase } from '../../supabase/client';
import {
  fetchMachineShiftRecords,
  deleteMachineShiftRecord,
  updateMachineShiftRecord,
} from './api';
import MachineShiftEntry from './MachineShiftEntry';
import DrillDownModal from './DrillDownModal';
import type { MachineShiftRecord, MachineShiftFilter } from './types';

const PROJECT_SEARCH_PROPS = {
  searchThreshold: 1 as const,
  searchPlaceholder: '搜索项目名称或编号…',
};

export default function MachineShiftList() {
  const { filterOptions: projectFilterOptions } = useProjectsForSelect({
    activeOnly: true,
    filterEmptyLabel: '全部项目',
  });
  
  const [records, setRecords] = useState<MachineShiftRecord[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // 筛选条件
  const [filter, setFilter] = useState<MachineShiftFilter>({
    page: 1,
    pageSize: 20,
  });
  const [searchText, setSearchText] = useState('');

  // 模态框状态
  const [showEntry, setShowEntry] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MachineShiftRecord | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showDrillDown, setShowDrillDown] = useState(false);
  const [drillDownParams, setDrillDownParams] = useState<MachineShiftFilter>({});

  // 加载机械列表
  useEffect(() => {
    async function loadMachines() {
      try {
        const { data, error } = await supabase
          .from('machines')
          .select('id, name, code')
          .eq('status', 'available')
          .order('name');
        
        if (error) {
          console.warn('Failed to load machines from database:', error);
          // 使用模拟数据
          setMachines([
            { id: 'eq001', name: '挖掘机', code: 'EQ001' },
            { id: 'eq002', name: '塔吊', code: 'EQ002' },
            { id: 'eq003', name: '混凝土泵车', code: 'EQ003' },
            { id: 'eq004', name: '压路机', code: 'EQ004' },
            { id: 'eq005', name: '装载机', code: 'EQ005' },
            { id: 'eq006', name: '吊车', code: 'EQ006' },
            { id: 'eq007', name: '推土机', code: 'EQ007' },
            { id: 'eq008', name: '发电机', code: 'EQ008' },
          ]);
          return;
        }
        
        if (data) setMachines(data);
      } catch (err) {
        console.error('Error loading machines:', err);
      }
    }
    loadMachines();
  }, []);

  // 加载台班记录
  const loadRecords = async () => {
    setLoading(true);
    try {
      const result = await fetchMachineShiftRecords(filter);
      setRecords(result.data);
      setTotal(result.total);
    } catch (err) {
      console.error('Failed to load records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [filter]);

  // 筛选选项
  const projectOptions = projectFilterOptions;

  const machineOptions = useMemo(() => [
    { value: '', label: '全部机械' },
    ...machines.map(m => ({
      value: m.id,
      label: `${m.name} (${m.code || '无编码'})`,
    })),
  ], [machines]);

  const statusOptions = [
    { value: '', label: '全部状态' },
    { value: 'draft', label: '草稿' },
    { value: 'pending', label: '待审批' },
    { value: 'confirmed', label: '已确认' },
    { value: 'rejected', label: '已驳回' },
  ];

  const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    draft: { label: '草稿', color: 'text-gray-500 bg-gray-100', icon: FaClock },
    pending: { label: '待审批', color: 'text-yellow-600 bg-yellow-100', icon: FaClock },
    confirmed: { label: '已确认', color: 'text-green-600 bg-green-100', icon: FaCheck },
    rejected: { label: '已驳回', color: 'text-red-600 bg-red-100', icon: FaTimes },
  };

  const handleSearch = () => {
    setFilter(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    setFilter(prev => ({ ...prev, page: newPage }));
  };

  const handleEdit = (record: MachineShiftRecord) => {
    setEditingRecord(record);
    setShowEdit(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMachineShiftRecord(id);
      setShowDeleteConfirm(null);
      loadRecords();
    } catch (err: any) {
      alert(err.message || '删除失败');
    }
  };

  const handleStatusChange = async (record: MachineShiftRecord, newStatus: string) => {
    try {
      await updateMachineShiftRecord(record.id, { status: newStatus as any });
      loadRecords();
    } catch (err: any) {
      alert(err.message || '更新失败');
    }
  };

  const handleDrillDown = (record: MachineShiftRecord) => {
    setDrillDownParams({
      projectId: record.project_id,
      dateFrom: record.record_date,
      dateTo: record.record_date,
    });
    setShowDrillDown(true);
  };

  return (
    <div className="space-y-4">
      {/* 筛选栏 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="min-w-[200px]">
            <SearchableSelect
              value={filter.projectId || ''}
              onChange={(value) => setFilter(prev => ({ ...prev, projectId: value || undefined }))}
              options={projectOptions}
              placeholder="选择项目"
              {...PROJECT_SEARCH_PROPS}
              emptyLabel="全部项目"
              className="min-w-[200px]"
            />
          </div>
          
          <div className="min-w-[200px]">
            <SearchableSelect
              value={filter.machineId || ''}
              onChange={(value) => setFilter(prev => ({ ...prev, machineId: value || undefined }))}
              options={machineOptions}
              placeholder="选择机械"
              searchPlaceholder="搜索机械..."
              emptyLabel="全部机械"
              className="min-w-[200px]"
            />
          </div>

          <div className="min-w-[150px]">
            <SearchableSelect
              value={filter.status || ''}
              onChange={(value) => setFilter(prev => ({ ...prev, status: value || undefined }))}
              options={statusOptions}
              placeholder="选择状态"
              emptyLabel="全部状态"
              className="min-w-[150px]"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={filter.dateFrom || ''}
              onChange={(e) => setFilter(prev => ({ ...prev, dateFrom: e.target.value || undefined }))}
              className="px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800 text-sm"
            />
            <span className="text-gray-500">至</span>
            <input
              type="date"
              value={filter.dateTo || ''}
              onChange={(e) => setFilter(prev => ({ ...prev, dateTo: e.target.value || undefined }))}
              className="px-3 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800 text-sm"
            />
          </div>

          <button
            onClick={() => setShowEntry(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors ml-auto"
          >
            <FaPlus />
            录入台班
          </button>
        </div>
      </div>

      {/* 记录列表 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">项目</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">机械</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">作业日期</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">台班数</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">单价</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">总费用</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">状态</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">操作人</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    加载中...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    暂无记录
                  </td>
                </tr>
              ) : (
                records.map((record) => {
                  const status = statusConfig[record.status] || statusConfig.draft;
                  const StatusIcon = status.icon;
                  
                  return (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-800">
                        {record.projects?.name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800">
                        {record.machines?.name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800">
                        {record.record_date}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800">
                        {record.shift_count} {record.machines?.unit || '台班'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800">
                        ¥{record.cost_per_shift?.toFixed(2) || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800">
                        ¥{record.total_cost?.toFixed(2) || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                          <StatusIcon />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800">
                        {record.operator || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {record.status === 'draft' && (
                            <button
                              onClick={() => handleStatusChange(record, 'confirmed')}
                              className="p-1 hover:bg-green-100 text-green-600 rounded transition-colors"
                              title="确认"
                            >
                              <FaCheck />
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(record)}
                            className="p-1 hover:bg-blue-100 text-blue-600 rounded transition-colors"
                            title="编辑"
                          >
                            <FaEdit />
                          </button>
                          <button
                            onClick={() => handleDelete(record.id)}
                            className="p-1 hover:bg-red-100 text-red-600 rounded transition-colors"
                            title="删除"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {total > pageSize && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              共 {total} 条记录，第 {page} / {Math.ceil(total / pageSize)} 页
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded disabled:opacity-50"
              >
                上一页
              </button>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= Math.ceil(total / pageSize)}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 录入模态框 */}
      <AnimatePresence>
        {showEntry && (
          <Modal open={showEntry} onClose={() => setShowEntry(false)}>
            <MachineShiftEntry
              onSuccess={loadRecords}
              onClose={() => setShowEntry(false)}
            />
          </Modal>
        )}
      </AnimatePresence>

      {/* 编辑模态框 */}
      <AnimatePresence>
        {showEdit && editingRecord && (
          <Modal open={showEdit} onClose={() => setShowEdit(false)}>
            <MachineShiftEntry
              defaultProjectId={editingRecord.project_id}
              onSuccess={() => {
                loadRecords();
                setShowEdit(false);
              }}
              onClose={() => setShowEdit(false)}
            />
          </Modal>
        )}
      </AnimatePresence>

      {/* 删除确认 */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <Modal open={!!showDeleteConfirm} onClose={() => setShowDeleteConfirm(null)}>
            <div className="bg-white rounded-xl p-6 max-w-md mx-auto">
              <h3 className="text-lg font-bold text-gray-800 mb-4">确认删除</h3>
              <p className="text-gray-600 mb-6">确定要删除该台班记录吗？此操作不可恢复。</p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg"
                >
                  取消
                </button>
                <button
                  onClick={() => handleDelete(showDeleteConfirm)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                >
                  删除
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* 穿透模态框 */}
      <AnimatePresence>
        {showDrillDown && (
          <DrillDownModal
            {...drillDownParams}
            onClose={() => setShowDrillDown(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
