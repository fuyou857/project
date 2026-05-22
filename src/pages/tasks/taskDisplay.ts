import type { TaskRow } from '../../services/taskService';

export type UiTaskStatus = 'in_progress' | 'pending_acceptance' | 'completed' | 'overdue';

export function resolveUiStatus(row: Pick<TaskRow, 'status' | 'acceptor_deadline'>): UiTaskStatus {
  if (row.status === 'completed') return 'completed';
  const deadline = row.acceptor_deadline?.slice(0, 10) ?? '';
  const today = new Date().toISOString().slice(0, 10);
  if (deadline && deadline < today) return 'overdue';
  return row.status as UiTaskStatus;
}

export function uiStatusLabel(s: UiTaskStatus): string {
  switch (s) {
    case 'in_progress':
      return '进行中';
    case 'pending_acceptance':
      return '待验收';
    case 'completed':
      return '已完成';
    case 'overdue':
      return '已逾期';
    default:
      return s;
  }
}

export function uiStatusClass(s: UiTaskStatus): string {
  switch (s) {
    case 'in_progress':
      return 'bg-blue-100 text-blue-800';
    case 'pending_acceptance':
      return 'bg-orange-100 text-orange-800';
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'overdue':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

export function daysUntilDeadline(acceptor_deadline: string): number {
  const d = new Date(acceptor_deadline.slice(0, 10));
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}
