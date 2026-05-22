import type { TaskRow, TaskPriority } from '../../services/taskService';
import { daysUntilDeadline } from './taskDisplay';

export type { TaskPriority } from '../../services/taskService';

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  urgent: '紧急',
  high: '高',
  medium: '中',
  low: '低',
};

/** 规范要求色值 */
export const PRIORITY_COLOR: Record<TaskPriority, string> = {
  urgent: '#FF4D4F',
  high: '#FAAD14',
  medium: '#1890FF',
  low: '#8C8C8C',
};

export function normalizePriority(p: string | null | undefined): TaskPriority {
  if (p === 'urgent' || p === 'high' || p === 'medium' || p === 'low') return p;
  return 'medium';
}

/** 数值越大优先级越高（用于排序：紧急在上） */
export function priorityRank(p: TaskPriority): number {
  switch (p) {
    case 'urgent':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 2;
  }
}

export type TaskSortMode = 'smart' | 'deadline_asc' | 'priority_desc' | 'priority_asc';

export function compareDeadline(a: TaskRow, b: TaskRow): number {
  return (a.acceptor_deadline || '').localeCompare(b.acceptor_deadline || '');
}

/** 我发布的任务列表排序 */
export function sortPublishedTasks(rows: TaskRow[], sortMode: TaskSortMode): TaskRow[] {
  const arr = [...rows];
  const pr = (t: TaskRow) => normalizePriority(t.priority);
  if (sortMode === 'deadline_asc') {
    arr.sort((a, b) => compareDeadline(a, b));
    return arr;
  }
  if (sortMode === 'priority_asc') {
    arr.sort((a, b) => priorityRank(pr(a)) - priorityRank(pr(b)) || compareDeadline(a, b));
    return arr;
  }
  // smart、priority_desc：优先级高的在前，同优先级按验收日升序
  arr.sort((a, b) => priorityRank(pr(b)) - priorityRank(pr(a)) || compareDeadline(a, b));
  return arr;
}

function rejectedFirst(a: TaskRow, b: TaskRow): number {
  const ra = a.last_reject_at && a.status === 'in_progress' ? 1 : 0;
  const rb = b.last_reject_at && b.status === 'in_progress' ? 1 : 0;
  return rb - ra;
}

/** 待办：已驳回始终优先，再按排序模式 */
export function sortTodoTasks(rows: TaskRow[], sortMode: TaskSortMode = 'smart'): TaskRow[] {
  const arr = [...rows];
  const pr = (t: TaskRow) => normalizePriority(t.priority);
  if (sortMode === 'deadline_asc') {
    arr.sort((a, b) => rejectedFirst(a, b) || compareDeadline(a, b));
    return arr;
  }
  if (sortMode === 'priority_asc') {
    arr.sort(
      (a, b) =>
        rejectedFirst(a, b) ||
        priorityRank(pr(a)) - priorityRank(pr(b)) ||
        compareDeadline(a, b)
    );
    return arr;
  }
  if (sortMode === 'priority_desc') {
    arr.sort(
      (a, b) =>
        rejectedFirst(a, b) ||
        priorityRank(pr(b)) - priorityRank(pr(a)) ||
        compareDeadline(a, b)
    );
    return arr;
  }
  arr.sort(
    (a, b) =>
      rejectedFirst(a, b) ||
      priorityRank(pr(b)) - priorityRank(pr(a)) ||
      daysUntilDeadline(a.acceptor_deadline) - daysUntilDeadline(b.acceptor_deadline)
  );
  return arr;
}
