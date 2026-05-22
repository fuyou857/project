/**
 * 任务评论后的站内通知（避免 taskService ↔ notificationService 循环依赖）
 */
import { supabase } from '../supabase/client';
import { notifyUsers } from './notificationService';

export async function notifyAfterTaskComment(params: {
  taskId: string;
  taskName: string;
  authorId: string;
  bodyPreview: string;
}): Promise<void> {
  const { taskId, taskName, authorId, bodyPreview } = params;
  const { data: task, error } = await supabase
    .from('tasks')
    .select('publisher_id')
    .eq('id', taskId)
    .maybeSingle();
  if (error || !task) return;

  const [{ data: ex }, { data: cc }] = await Promise.all([
    supabase.from('task_executors').select('user_id').eq('task_id', taskId),
    supabase.from('task_cc').select('user_id').eq('task_id', taskId),
  ]);

  const ids = new Set<string>();
  ids.add(task.publisher_id as string);
  for (const r of ex ?? []) ids.add((r as { user_id: string }).user_id);
  for (const r of cc ?? []) ids.add((r as { user_id: string }).user_id);
  ids.delete(authorId);
  if (!ids.size) return;

  const snippet = bodyPreview.trim().slice(0, 200);
  await notifyUsers(
    [...ids].map(uid => ({
      user_id: uid,
      title: '任务新评论',
      body: `「${taskName}」${snippet ? `：${snippet}` : '有新评论'}`,
      category: 'task_comment',
      payload: { task_id: taskId },
    }))
  );
}
