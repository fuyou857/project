import type { ComponentType } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTasks, FaCheckCircle, FaClock, FaExclamationCircle } from 'react-icons/fa';
import TaskKanbanCard from './TaskKanbanCard';
import { TaskRow } from '../services/taskService';
import { resolveUiStatus } from '../pages/tasks/taskDisplay';
import { useNavigate } from 'react-router-dom';

interface KanbanColumn {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
  bg: string;
}

const columns: KanbanColumn[] = [
  { id: 'in_progress', label: '进行中', icon: FaTasks, color: 'text-blue-600', bg: 'bg-blue-50' },
  { id: 'pending_acceptance', label: '待验收', icon: FaClock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  { id: 'completed', label: '已完成', icon: FaCheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
  { id: 'overdue', label: '已逾期', icon: FaExclamationCircle, color: 'text-red-600', bg: 'bg-red-50' },
];

interface TaskKanbanViewProps {
  tasks: TaskRow[];
  executorsByTask: Record<string, { user_id: string; name: string }[]>;
  projectNames: Record<string, string>;
  loading?: boolean;
}

export default function TaskKanbanView({ tasks, executorsByTask, projectNames, loading }: TaskKanbanViewProps) {
  const navigate = useNavigate();

  // 按状态分组任务
  const tasksByStatus = columns.reduce((acc, col) => {
    acc[col.id] = tasks.filter(task => {
      const uiStatus = resolveUiStatus(task);
      return uiStatus === col.id;
    });
    return acc;
  }, {} as Record<string, TaskRow[]>);

  // 按优先级和截止日期排序
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  const sortTasks = (taskList: TaskRow[]) => {
    return [...taskList].sort((a, b) => {
      // 先按优先级排序
      const priorityA = priorityOrder[(a.priority || 'medium') as keyof typeof priorityOrder];
      const priorityB = priorityOrder[(b.priority || 'medium') as keyof typeof priorityOrder];
      if (priorityA !== priorityB) return priorityA - priorityB;
      
      // 再按截止日期排序
      return new Date(a.acceptor_deadline).getTime() - new Date(b.acceptor_deadline).getTime();
    });
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {columns.map(col => (
          <div key={col.id} className="space-y-3">
            <div className={`${col.bg} rounded-lg p-3 border border-gray-200`}>
              <div className="h-5 bg-gray-200 rounded animate-pulse w-24" />
            </div>
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
                  <div className="h-2 bg-gray-200 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {columns.map(col => {
        const columnTasks = sortTasks(tasksByStatus[col.id] || []);
        const Icon = col.icon;
        
        return (
          <div key={col.id} className="space-y-3">
            {/* 列标题 */}
            <div className={`${col.bg} rounded-lg p-3 border border-gray-200`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${col.color}`} />
                  <span className="font-medium text-gray-800">{col.label}</span>
                </div>
                <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-200">
                  {columnTasks.length}
                </span>
              </div>
            </div>

            {/* 任务卡片列表 */}
            <AnimatePresence>
              <div className="space-y-3 min-h-[100px]">
                {columnTasks.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-gray-50 rounded-lg border border-dashed border-gray-200 p-6 text-center"
                  >
                    <p className="text-gray-400 text-sm">暂无任务</p>
                  </motion.div>
                ) : (
                  columnTasks.map(task => (
                    <TaskKanbanCard
                      key={task.id}
                      task={task}
                      executors={executorsByTask[task.id] || []}
                      projectName={projectNames[task.project_id]}
                      onClick={() => navigate(`/tasks/${task.id}`)}
                    />
                  ))
                )}
              </div>
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
