/**
 * 站内信与任务截止提醒（首版：Dashboard 进入时同步生成去重通知）
 */
import { supabase } from '../supabase/client';
import { fetchInvolvedTasks } from './taskService';

export interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  category: string;
  read_at: string | null;
  dedupe_key: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

function parseDays(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [1, 3, 7];
  const out = raw
    .map(x => Number(x))
    .filter(n => Number.isInteger(n) && n >= 0 && n <= 90);
  const u = [...new Set(out.length ? out : [1, 3, 7])].sort((a, b) => a - b);
  return u;
}

export async function getReminderDays(userId: string): Promise<number[]> {
  const { data } = await supabase
    .from('user_reminder_prefs')
    .select('days_before')
    .eq('user_id', userId)
    .maybeSingle();
  return parseDays(data?.days_before);
}

export async function saveReminderDays(userId: string, days: number[]): Promise<void> {
  const cleaned = [...new Set(days.map(n => Math.floor(n)))].filter(n => n >= 0 && n <= 90).sort((a, b) => a - b);
  if (!cleaned.length) return;
  const { error } = await supabase.from('user_reminder_prefs').upsert(
    { user_id: userId, days_before: cleaned, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
  if (error) throw error;
}

/** 按偏好天数在「剩余天数 = before」当日写入一条去重通知 */
export async function syncDeadlineNotifications(userId: string): Promise<void> {
  const prefs = await getReminderDays(userId);
  const tasks = await fetchInvolvedTasks(userId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  const rows: {
    user_id: string;
    title: string;
    body: string;
    category: string;
    dedupe_key: string;
    payload: Record<string, unknown>;
  }[] = [];

  for (const t of tasks) {
    if (t.status === 'completed') continue;
    const dl = new Date((t.acceptor_deadline || '').slice(0, 10));
    if (Number.isNaN(dl.getTime())) continue;
    dl.setHours(0, 0, 0, 0);
    const daysLeft = Math.round((dl.getTime() - today.getTime()) / 86400000);

    for (const before of prefs) {
      if (daysLeft !== before) continue;
      const dedupeKey = `task_deadline|${userId}|${t.id}|${before}|${todayStr}`;
      const title = '任务即将到期';
      const body = `「${t.task_name}」将在 ${before} 天后（${String(t.acceptor_deadline).slice(0, 10)}）到达验收日，请及时处理。`;
      rows.push({
        user_id: userId,
        title,
        body,
        category: 'task_deadline',
        dedupe_key: dedupeKey,
        payload: { task_id: t.id, days_before: before, deadline: t.acceptor_deadline },
      });
    }
  }

  if (!rows.length) return;

  // 使用insert而不是upsert，因为dedupe_key列可能没有唯一约束
  const { error } = await supabase.from('notifications').insert(rows);
  if (error) {
    // 忽略唯一约束冲突错误，其他错误仍然记录
    if ((error as { code?: string }).code !== '23505') {
      console.warn('[syncDeadlineNotifications]', error.message);
    }
  }
}

export async function fetchNotifications(userId: string, limit = 100): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as NotificationRow[];
}

/** 未读条数：`.is('read_at', null)`（勿手写 URL）。用 GET + exact count + `limit(0)`，避免 `head:true` 触发的 HEAD 在部分浏览器控制台误报「提取 加载失败」。永不抛错。 */
export async function countUnreadNotifications(userId: string): Promise<number> {
  if (!userId) return 0;
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: false })
      .eq('user_id', userId)
      .is('read_at', null)
      .limit(0);
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function markNotificationRead(id: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) throw error;
}

export interface NotifyUserInput {
  user_id: string;
  title: string;
  body: string | null;
  category: string;
  payload?: Record<string, unknown>;
}

/** 批量写入站内通知（无去重键；用于催办/评论/协办等业务） */
export async function notifyUsers(rows: NotifyUserInput[]): Promise<void> {
  if (!rows.length) return;
  const { error } = await supabase.from('notifications').insert(
    rows.map(r => ({
      user_id: r.user_id,
      title: r.title,
      body: r.body,
      category: r.category,
      payload: (r.payload ?? {}) as Record<string, unknown>,
    }))
  );
  // 忽略唯一约束冲突错误，其他错误仍然抛出
  if (error && (error as { code?: string }).code !== '23505') {
    throw error;
  }
}
