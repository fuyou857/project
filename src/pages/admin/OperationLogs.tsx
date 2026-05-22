import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaSearch, FaFilter, FaDownload, FaEye, FaTimes, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import {
  OperationLog,
  LogFilter,
  getLogs,
  getLogDetail,
  getUsersForFilter,
  logModule,
  logAction,
  addLog } from
'../../services/logService';
import ResponsiveTable from '../../components/ResponsiveTable';
import { SearchableSelect } from '../../components/ui';
import { windowedPageNumber } from '../../utils/pagination';

const PAGE_SIZE = 20;

const MODULE_OPTIONS = Object.entries(logModule).map(([key, value]) => ({
  value,
  label: value
}));

const ACTION_OPTIONS = [
{ value: '', label: '全部' },
...Object.entries(logAction).map(([key, value]) => ({
  value,
  label: value
}))];


export default function OperationLogs() {
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<{id: string;name: string;email: string;}[]>([]);
  const [showDetail, setShowDetail] = useState(false);
  const [detailLog, setDetailLog] = useState<OperationLog | null>(null);

  const getDefaultDateRange = () => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 10);

    return {
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0]
    };
  };

  const [filter, setFilter] = useState<LogFilter>({
    user_id: '',
    module: '',
    action: '',
    ...getDefaultDateRange(),
    keyword: ''
  });

  useEffect(() => {
    fetchUsers();
    fetchLogs();
  }, [page, filter]);

  async function fetchUsers() {
    const usersData = await getUsersForFilter();
    setUsers(usersData);
  }

  async function fetchLogs() {
    setLoading(true);
    const { logs: data, total: count } = await getLogs(filter, page, PAGE_SIZE);
    setLogs(data);
    setTotal(count);
    setLoading(false);
  }

  async function handleDetail(id: string) {
    const log = await getLogDetail(id);
    if (log) {
      setDetailLog(log);
      setShowDetail(true);
    }
  }

  async function handleExport() {
    if (logs.length === 0) {
      alert('没有可导出的数据');
      return;
    }

    await addLog(
      logModule.SYSTEM,
      logAction.EXPORT,
      `导出操作日志 Excel（当前页 ${logs.length} 条）`,
      {
        row_count: logs.length,
        module_filter: filter.module || undefined,
        action_filter: filter.action || undefined
      }
    );

    const rows = logs.map((log) => ({
      操作人: log.user_name,
      操作时间: formatDate(log.created_at),
      IP地址: log.ip_address,
      操作模块: log.module,
      操作类型: log.action,
      操作描述: log.description,
      操作状态: log.status
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '操作日志');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(
      new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }),
      `操作日志_${new Date().toISOString().split('T')[0]}.xlsx`
    );
  }

  function formatDate(dateString: unknown): string {
    if (typeof dateString !== 'string' || !dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  function getStatusColor(status: unknown): string {
    return status === 'success' ? 'bg-green-600' : 'bg-red-600';
  }

  function getActionColor(action: unknown): string {
    const colors: Record<string, string> = {
      新增: 'bg-green-600',
      编辑: 'bg-blue-600',
      删除: 'bg-red-600',
      登录: 'bg-purple-600',
      登出: 'bg-gray-600',
      导入: 'bg-orange-600',
      导出: 'bg-cyan-600',
      外借: 'bg-yellow-600',
      销号: 'bg-teal-600'
    };
    const key = typeof action === 'string' ? action : String(action ?? '');
    return colors[key] || 'bg-gray-600';
  }

  const totalPages = useMemo(() => Math.ceil(total / PAGE_SIZE), [total]);

  const userFilterOptions = useMemo(
    () => [{ value: '', label: '全部用户' }, ...users.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }))],
    [users]
  );

  const moduleFilterOptions = useMemo(
    () => [{ value: '', label: '全部模块' }, ...MODULE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))],
    []
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="text-xl font-bold text-gray-800">操作日志</h3>
        <button
          onClick={handleExport}
          disabled={logs.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50">
          
          <FaDownload /> 导出Excel
        </button>
      </div>

      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">操作人</label>
              <SearchableSelect
                value={filter.user_id ?? ''}
                onChange={(v) => setFilter({ ...filter, user_id: v, start_date: '', end_date: '' })}
                options={userFilterOptions}
                placeholder="全部用户"
                searchPlaceholder="搜索用户…" />
              
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">操作模块</label>
              <SearchableSelect
                value={filter.module ?? ''}
                onChange={(v) => setFilter({ ...filter, module: v, start_date: '', end_date: '' })}
                options={moduleFilterOptions}
                placeholder="全部模块"
                searchPlaceholder="搜索模块…" />
              
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">操作类型</label>
              <SearchableSelect
                value={filter.action ?? ''}
                onChange={(v) => setFilter({ ...filter, action: v, start_date: '', end_date: '' })}
                options={ACTION_OPTIONS}
                placeholder="全部"
                searchPlaceholder="搜索类型…" />
              
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">关键字</label>
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={filter.keyword}
                  onChange={(e) => setFilter({ ...filter, keyword: e.target.value, start_date: '', end_date: '' })}
                  placeholder="搜索操作描述..."
                  className="w-full pl-10 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                
              </div>
            </div>
          </div>
          <div className="flex gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">开始日期</label>
              <input
                type="date"
                value={filter.start_date}
                onChange={(e) => setFilter({ ...filter, start_date: e.target.value })}
                className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">结束日期</label>
              <input
                type="date"
                value={filter.end_date}
                onChange={(e) => setFilter({ ...filter, end_date: e.target.value })}
                className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              
            </div>
            <div className="flex items-end">
              <button
                onClick={() =>
                setFilter({
                  user_id: '',
                  module: '',
                  action: '',
                  ...getDefaultDateRange(),
                  keyword: ''
                })
                }
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg flex items-center gap-1">
                
                <FaFilter /> 重置
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {(() => {if (loading) {return (
              <div className="text-center text-gray-500 py-12">加载中...</div>);} else {if (
            logs.length === 0) {return (
                <div className="text-center text-gray-500 py-12">暂无操作日志</div>);} else {return (

                <ResponsiveTable
                  columns={[
                  { key: 'user_name', label: '操作人' },
                  { key: 'created_at', label: '操作时间', render: (val) => formatDate(val) },
                  { key: 'ip_address', label: 'IP地址', hiddenOnMobile: true },
                  { key: 'module', label: '操作模块' },
                  { key: 'action', label: '操作类型', render: (val) =>
                    <span className={`px-2 py-1 text-xs text-white rounded-full ${getActionColor(val)}`}>
                  {String(val ?? '')}
                </span>
                  },
                  { key: 'description', label: '操作描述' },
                  { key: 'status', label: '操作状态', render: (val) =>
                    <span className={`px-2 py-1 text-xs text-white rounded-full ${getStatusColor(val)}`}>
                  {val === 'success' ? '成功' : '失败'}
                </span>
                  }]
                  }
                  data={logs}
                  keyField="id"
                  actionColumn={(log) =>
                  <button
                    onClick={() => handleDetail(log.id)}
                    className="p-2.5 text-blue-600 hover:bg-blue-100 rounded-lg"
                    title="查看详情">
                    
                <FaEye className="w-4 h-4" />
              </button>
                  } />);}}})()

        }

        {!loading && total > PAGE_SIZE &&
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              显示 {(page - 1) * PAGE_SIZE + 1} - {Math.min(page * PAGE_SIZE, total)} 条，
              共 {total} 条
            </div>
            <div className="flex items-center gap-2">
              <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 text-gray-600 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed">
              
                <FaChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = windowedPageNumber(totalPages, page, i);
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`px-3 py-1 text-sm rounded ${
                  page === pageNum ?
                  'bg-blue-600 text-white' :
                  'text-gray-600 hover:bg-gray-200'}`
                  }>
                  
                    {pageNum}
                  </button>);

            })}
              <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 text-gray-600 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed">
              
                <FaChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        }
      </div>

      <AnimatePresence>
        {showDetail && detailLog &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDetail(false)}>
          
            <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}>
            
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">日志详情</h3>
                <button
                onClick={() => setShowDetail(false)}
                className="text-gray-400 hover:text-gray-600">
                
                  <FaTimes />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-1">操作人</label>
                  <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-800">
                    {detailLog.user_name} ({detailLog.user_email})
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">操作时间</label>
                  <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-800">
                    {formatDate(detailLog.created_at)}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">IP地址</label>
                  <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-800">
                    {detailLog.ip_address}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">操作模块</label>
                  <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-800">
                    {detailLog.module}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">操作类型</label>
                  <span
                  className={`px-3 py-2 rounded-lg text-white ${getActionColor(detailLog.action)}`}>
                  
                    {detailLog.action}
                  </span>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">操作状态</label>
                  <span
                  className={`px-3 py-2 rounded-lg text-white ${getStatusColor(detailLog.status)}`}>
                  
                    {detailLog.status === 'success' ? '成功' : '失败'}
                  </span>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm text-gray-500 mb-1">操作描述</label>
                <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-800">
                  {detailLog.description}
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                <label className="block text-sm text-gray-500 mb-1">请求参数</label>
                <pre className="p-4 bg-gray-900 text-green-400 rounded-lg text-sm overflow-auto max-h-[300px]">
                  {detailLog.request_params ?
                JSON.stringify(JSON.parse(detailLog.request_params), null, 2) :
                '{}'}
                </pre>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end">
                <button
                onClick={() => setShowDetail(false)}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg">
                
                  关闭
                </button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>
    </motion.div>);

}