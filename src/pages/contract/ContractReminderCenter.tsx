import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaBell,
  FaCheck,
  FaClock,
  FaEye,
  FaFilter,
  FaCalendar,
  FaDollarSign,
  FaFlag,
  FaChevronRight } from
'react-icons/fa';
import {
  getReminderRecords,
  updateReminderStatus } from
'../../services/contractReminderService';
import {
  ContractReminder as ReminderRecord,
  ReminderStatus,
  ReminderType } from
'../../types';
import { SegmentedControl } from '../../components/ui';

const REMINDER_TYPE_LABELS: Record<ReminderType, string> = {
  contract_expiry: '合同到期',
  payment_due: '付款提醒',
  milestone: '里程碑'
};

const REMINDER_STATUS_LABELS: Record<ReminderStatus, string> = {
  pending: '未处理',
  processed: '处理中',
  resolved: '已处理'
};

const REMINDER_STATUS_COLORS: Record<ReminderStatus, string> = {
  pending: 'bg-red-100 text-red-800',
  processed: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800'
};

const REMINDER_TYPE_COLORS: Record<ReminderType, string> = {
  contract_expiry: 'bg-blue-100 text-blue-800',
  payment_due: 'bg-orange-100 text-orange-800',
  milestone: 'bg-purple-100 text-purple-800'
};

export default function ContractReminderCenter() {
  const [reminders, setReminders] = useState<ReminderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ReminderStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<ReminderType | 'all'>('all');
  const [selectedReminder, setSelectedReminder] = useState<ReminderRecord | null>(null);

  const fetchReminders = useCallback(async () => {
    setLoading(true);
    try {
      const filters: Record<string, string> = {};
      if (statusFilter !== 'all') filters.status = statusFilter;
      if (typeFilter !== 'all') filters.reminder_type = typeFilter;

      const data = await getReminderRecords(filters);
      setReminders(data);
    } catch (error) {
      console.error('获取提醒记录失败:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    void fetchReminders();
  }, [fetchReminders]);

  async function handleStatusChange(id: string, status: ReminderStatus) {
    try {
      await updateReminderStatus(id, status);
      setReminders((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
      if (selectedReminder?.id === id) {
        setSelectedReminder({ ...selectedReminder, status });
      }
    } catch (error) {
      console.error('更新提醒状态失败:', error);
    }
  }

  const filteredReminders = reminders.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (typeFilter !== 'all' && r.reminder_type !== typeFilter) return false;
    return true;
  });

  const pendingCount = reminders.filter((r) => r.status === 'pending').length;
  const processedCount = reminders.filter((r) => r.status === 'processed').length;
  const resolvedCount = reminders.filter((r) => r.status === 'resolved').length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <FaBell className="text-blue-600" />
                    合同提醒中心
                </h3>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                            <FaClock className="text-red-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">未处理</p>
                            <p className="text-2xl font-bold text-gray-800">{pendingCount}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                            <FaEye className="text-yellow-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">处理中</p>
                            <p className="text-2xl font-bold text-gray-800">{processedCount}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                            <FaCheck className="text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">已处理</p>
                            <p className="text-2xl font-bold text-gray-800">{resolvedCount}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200">
                <div className="flex items-center gap-4 mb-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <FaFilter className="text-gray-500" />
                        <SegmentedControl
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as ReminderStatus | 'all')}
              options={[
              { value: 'all', label: '全部状态' },
              { value: 'pending', label: '未处理' },
              { value: 'processed', label: '处理中' },
              { value: 'resolved', label: '已处理' }]
              }
              metricsContext="page:contract_reminder_center:status_filter"
              className="max-w-full"
              aria-label="按状态筛选" />
            
                        <SegmentedControl
              value={typeFilter}
              onChange={(v) => setTypeFilter(v as ReminderType | 'all')}
              options={[
              { value: 'all', label: '全部类型' },
              { value: 'contract_expiry', label: '合同到期' },
              { value: 'payment_due', label: '付款提醒' },
              { value: 'milestone', label: '里程碑' }]
              }
              metricsContext="page:contract_reminder_center:type_filter"
              className="max-w-full"
              aria-label="按类型筛选" />
            
                    </div>
                </div>

                {(() => {if (loading) {return (
              <div className="text-center py-8">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
                        <p className="mt-2 text-gray-500">加载中...</p>
                    </div>);} else {if (
            filteredReminders.length === 0) {return (
                <div className="text-center py-8">
                        <FaBell className="mx-auto text-gray-300 text-4xl" />
                        <p className="mt-2 text-gray-500">暂无提醒记录</p>
                    </div>);} else {return (

                <div className="space-y-3">
                        {filteredReminders.map((reminder) =>
                  <motion.div
                    key={reminder.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                    reminder.status === 'pending' ?
                    'border-red-200 bg-red-50/50' :
                    'border-gray-200 bg-white'}`
                    }
                    onClick={() => setSelectedReminder(reminder)}>
                    
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`px-2 py-1 text-xs rounded-full ${REMINDER_TYPE_COLORS[reminder.reminder_type]}`}>
                                                {REMINDER_TYPE_LABELS[reminder.reminder_type]}
                                            </span>
                                            <span className={`px-2 py-1 text-xs rounded-full ${REMINDER_STATUS_COLORS[reminder.status]}`}>
                                                {REMINDER_STATUS_LABELS[reminder.status]}
                                            </span>
                                        </div>
                                        <h4 className="font-semibold text-gray-800">{reminder.title}</h4>
                                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{reminder.content}</p>
                                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                            <span className="flex items-center gap-1">
                                                <FaCalendar className="text-gray-400" />
                                                {reminder.target_date}
                                            </span>
                                            {reminder.days_remaining !== null &&
                          <span className="flex items-center gap-1">
                                                    <FaClock className="text-gray-400" />
                                                    剩余{reminder.days_remaining}天
                                                </span>
                          }
                                            {reminder.amount !== null &&
                          <span className="flex items-center gap-1">
                                                    <FaDollarSign className="text-gray-400" />
                                                    {reminder.amount}元
                                                </span>
                          }
                                        </div>
                                    </div>
                                    <FaChevronRight className="text-gray-400" />
                                </div>
                            </motion.div>
                  )}
                    </div>);}}})()
        }
            </div>

            <AnimatePresence>
                {selectedReminder &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setSelectedReminder(null)}>
          
                        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-gray-800">提醒详情</h3>
                                <button
                onClick={() => setSelectedReminder(null)}
                className="text-gray-500 hover:text-gray-800 text-2xl">
                
                                    &times;
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-1 text-xs rounded-full ${REMINDER_TYPE_COLORS[selectedReminder.reminder_type]}`}>
                                        {REMINDER_TYPE_LABELS[selectedReminder.reminder_type]}
                                    </span>
                                    <span className={`px-2 py-1 text-xs rounded-full ${REMINDER_STATUS_COLORS[selectedReminder.status]}`}>
                                        {REMINDER_STATUS_LABELS[selectedReminder.status]}
                                    </span>
                                </div>

                                <div>
                                    <h4 className="font-semibold text-gray-800 text-lg">{selectedReminder.title}</h4>
                                </div>

                                <div className="p-4 bg-gray-50 rounded-lg">
                                    <p className="text-gray-700 whitespace-pre-line">{selectedReminder.content}</p>
                                </div>

                                {selectedReminder.contract_name &&
              <div className="flex items-center gap-2 text-sm">
                                        <FaFlag className="text-gray-400" />
                                        <span className="text-gray-600">关联合同：{selectedReminder.contract_name}</span>
                                    </div>
              }

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-blue-50 rounded-lg p-3">
                                        <p className="text-xs text-blue-600">目标日期</p>
                                        <p className="font-semibold text-blue-800">{selectedReminder.target_date}</p>
                                    </div>
                                    {selectedReminder.days_remaining !== null &&
                <div className="bg-orange-50 rounded-lg p-3">
                                            <p className="text-xs text-orange-600">剩余天数</p>
                                            <p className="font-semibold text-orange-800">{selectedReminder.days_remaining}天</p>
                                        </div>
                }
                                </div>

                                {selectedReminder.amount !== null &&
              <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-gray-50 rounded-lg p-3">
                                            <p className="text-xs text-gray-600">应付款金额</p>
                                            <p className="font-semibold text-gray-800">{selectedReminder.amount}元</p>
                                        </div>
                                        <div className="bg-gray-50 rounded-lg p-3">
                                            <p className="text-xs text-gray-600">已付金额</p>
                                            <p className="font-semibold text-gray-800">{selectedReminder.paid_amount || 0}元</p>
                                        </div>
                                        <div className="bg-gray-50 rounded-lg p-3">
                                            <p className="text-xs text-gray-600">未付金额</p>
                                            <p className="font-semibold text-red-800">{((selectedReminder.amount ?? 0) - (selectedReminder.paid_amount || 0)).toFixed(2)}元</p>
                                        </div>
                                    </div>
              }

                                <div className="flex gap-3">
                                    {selectedReminder.status !== 'pending' &&
                <button
                  onClick={() => handleStatusChange(selectedReminder.id, 'pending')}
                  className="flex-1 px-4 py-2 border border-red-500 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                  
                                            设为未处理
                                        </button>
                }
                                    {selectedReminder.status !== 'processed' &&
                <button
                  onClick={() => handleStatusChange(selectedReminder.id, 'processed')}
                  className="flex-1 px-4 py-2 border border-yellow-500 text-yellow-600 rounded-lg hover:bg-yellow-50 transition-colors">
                  
                                            设为处理中
                                        </button>
                }
                                    {selectedReminder.status !== 'resolved' &&
                <button
                  onClick={() => handleStatusChange(selectedReminder.id, 'resolved')}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                  
                                            设为已处理
                                        </button>
                }
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
        }
            </AnimatePresence>
        </motion.div>);

}