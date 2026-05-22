import { motion } from 'framer-motion';
import { FaUser, FaClock, FaExclamationTriangle } from 'react-icons/fa';
import { TaskRow, type TaskPriority } from '../services/taskService';
import { resolveUiStatus, daysUntilDeadline } from '../pages/tasks/taskDisplay';

interface TaskKanbanCardProps {
  task: TaskRow;
  executors: { user_id: string; name: string }[];
  projectName?: string;
  onClick?: () => void;
}

const priorityConfig: Record<TaskPriority, { label: string; color: string; bg: string }> = {
  urgent: { label: '紧急', color: 'text-red-600', bg: 'bg-red-100' },
  high: { label: '高', color: 'text-orange-600', bg: 'bg-orange-100' },
  medium: { label: '中', color: 'text-blue-600', bg: 'bg-blue-100' },
  low: { label: '低', color: 'text-gray-600', bg: 'bg-gray-100' },
};

export default function TaskKanbanCard({ task, executors, projectName, onClick }: TaskKanbanCardProps) {
  const ui = resolveUiStatus(task);
  const pct = Math.min(100, Math.max(0, Number(task.total_progress) || 0));
  const days = daysUntilDeadline(task.acceptor_deadline);
  const priority = (task.priority || 'medium') as TaskPriority;
  const priorityStyle = priorityConfig[priority];
  const rejected = Boolean(task.last_reject_opinion && task.status === 'in_progress');

  const getProgressBarColor = () => {
    if (ui === 'completed') return 'bg-green-500';
    if (rejected) return 'bg-orange-500';
    if (ui === 'overdue') return 'bg-red-500';
    return 'bg-blue-500';
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm cursor-pointer hover:border-blue-300 transition-all"
    >
      {/* 顶部状态栏 */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityStyle.bg} ${priorityStyle.color}`}>
            {priorityStyle.label}
          </span>
          {rejected && (
            <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-600 font-medium flex items-center gap-1">
              <FaExclamationTriangle className="w-3 h-3" />
              已驳回
            </span>
          )}
        </div>
        {days >= 0 && days < 3 && ui !== 'completed' && (
          <span className="text-xs text-yellow-600 flex items-center gap-1">
            <FaClock className="w-3 h-3" />
            {days === 0 ? '今天到期' : `${days}天后到期`}
          </span>
        )}
        {ui === 'overdue' && (
          <span className="text-xs text-red-600 flex items-center gap-1">
            <FaClock className="w-3 h-3" />
            逾期{-days}天
          </span>
        )}
      </div>

      {/* 任务名称 */}
      <h4 className="font-medium text-gray-800 mb-2 line-clamp-2">{task.task_name}</h4>

      {/* 项目名（可选） */}
      {projectName && (
        <div className="text-xs text-gray-500 mb-2 truncate">{projectName}</div>
      )}

      {/* 进度条 */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>进度</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${getProgressBarColor()} rounded-full transition-all duration-300`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* 执行人 */}
      {executors.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
          <FaUser className="w-3 h-3" />
          <span className="truncate">
            {executors.map(e => e.name).join('、')}
          </span>
        </div>
      )}

      {/* 截止日期 */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <FaClock className="w-3 h-3" />
          {task.acceptor_deadline?.slice(0, 10)}
        </span>
        {task.last_report_time && (
          <span>最新汇报: {task.last_report_time.slice(0, 10)}</span>
        )}
      </div>
    </motion.div>
  );
}
