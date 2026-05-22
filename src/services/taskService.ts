/**
 * 任务管理：发布、进度、验收（含驳回回退进行中、进度保留）
 */
import { supabase } from '../supabase/client';
import { insertTaskComment } from './taskCommentService';
import { notifyAfterTaskComment } from './taskDiscussionNotify';

export type TaskStatus = 'in_progress' | 'pending_acceptance' | 'completed';

export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';

export interface TaskRow {
  id: string;
  task_name: string;
  description: string | null;
  project_id: string;
  publisher_id: string;
  acceptor_deadline: string;
  /** 紧急/高/中/低，缺省由前端按 medium 处理 */
  priority?: string | null;
  status: TaskStatus;
  current_progress: number;
  total_progress: number;
  attachments: unknown;
  publish_time: string;
  complete_time: string | null;
  last_report_time: string | null;
  last_reject_opinion: string | null;
  last_reject_at: string | null;
  reject_count: number;
  del_flag: number;
  created_at: string;
  updated_at: string;
}

export interface TaskExecutorRow {
  id: string;
  task_id: string;
  user_id: string;
  progress: number;
  sort_order: number;
  /** executor=负责人；co_assistant=协办（缺省按 executor） */
  member_role?: string | null;
}

export interface TaskPublishInput {
  task_name: string;
  description?: string | null;
  project_id: string;
  publisher_id: string;
  acceptor_deadline: string;
  priority?: TaskPriority;
  executor_user_ids: string[];
  cc_user_ids: string[];
  attachments?: unknown[];
}

async function appendOpLog(
  taskId: string,
  actorId: string | null,
  action: string,
  detail?: Record<string, unknown>
) {
  await supabase.from('task_operation_logs').insert({
    task_id: taskId,
    actor_id: actorId,
    action,
    detail: detail ?? null,
  });
}

function weightedProgress(executors: { progress: number; sort_order: number }[]): number {
  if (executors.length === 0) return 0;
  const weights = executors.map(e => (e.sort_order > 0 ? e.sort_order : 1));
  const sumW = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  executors.forEach((e, i) => {
    acc += e.progress * weights[i];
  });
  return Math.round((acc / sumW) * 100) / 100;
}

export async function publishTask(input: TaskPublishInput): Promise<string> {
  const names = input.task_name.trim();
  if (!names || names.length > 200) throw new Error('任务名称无效');
  if (!input.executor_user_ids.length) throw new Error('请至少选择一名执行人');

  const prio = input.priority ?? 'medium';
  if (!['urgent', 'high', 'medium', 'low'].includes(prio)) {
    throw new Error('优先级无效');
  }

  const { data: task, error: tErr } = await supabase
    .from('tasks')
    .insert({
      task_name: names,
      description: input.description ?? null,
      project_id: input.project_id,
      publisher_id: input.publisher_id,
      acceptor_deadline: input.acceptor_deadline,
      priority: prio,
      status: 'in_progress',
      current_progress: 0,
      total_progress: 0,
      attachments: (input.attachments ?? []) as unknown,
      del_flag: 0,
    })
    .select('id')
    .single();

  if (tErr || !task) throw tErr ?? new Error('创建任务失败');

  const taskId = task.id as string;

  const execRows = input.executor_user_ids.map((user_id, i) => ({
    task_id: taskId,
    user_id,
    progress: 0,
    sort_order: i,
    member_role: 'executor' as const,
  }));
  const { error: eErr } = await supabase.from('task_executors').insert(execRows);
  if (eErr) throw eErr;

  if (input.cc_user_ids.length) {
    const ccRows = input.cc_user_ids.map(user_id => ({ task_id: taskId, user_id }));
    const { error: cErr } = await supabase.from('task_cc').insert(ccRows);
    if (cErr) throw cErr;
  }

  await appendOpLog(taskId, input.publisher_id, 'publish', {
    task_name: names,
    executor_count: input.executor_user_ids.length,
    priority: prio,
  });

  return taskId;
}

export async function updateTaskBasics(
  taskId: string,
  actorId: string,
  patch: Partial<{
    task_name: string;
    description: string | null;
    acceptor_deadline: string;
    priority: TaskPriority;
    attachments: unknown[];
  }>
) {
  const { data: cur, error: gErr } = await supabase
    .from('tasks')
    .select('id,status')
    .eq('id', taskId)
    .maybeSingle();
  if (gErr || !cur) throw gErr ?? new Error('任务不存在');
  if (cur.status === 'completed') throw new Error('已完成任务不可编辑');

  if (patch.priority !== undefined && !['urgent', 'high', 'medium', 'low'].includes(patch.priority)) {
    throw new Error('优先级无效');
  }

  const { error } = await supabase
    .from('tasks')
    .update({
      ...(patch.task_name !== undefined ? { task_name: patch.task_name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.acceptor_deadline !== undefined ? { acceptor_deadline: patch.acceptor_deadline } : {}),
      ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
      ...(patch.attachments !== undefined ? { attachments: patch.attachments as unknown } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId);
  if (error) throw error;
  await appendOpLog(taskId, actorId, 'update', patch as Record<string, unknown>);
}

export async function softDeleteTask(taskId: string, actorId: string) {
  const { data: reports } = await supabase
    .from('task_progress_reports')
    .select('id')
    .eq('task_id', taskId)
    .limit(1);
  const hasReports = (reports?.length ?? 0) > 0;
  if (hasReports) {
    const { error } = await supabase
      .from('tasks')
      .update({ del_flag: 1, updated_at: new Date().toISOString() })
      .eq('id', taskId);
    if (error) throw error;
    await appendOpLog(taskId, actorId, 'archive', { reason: 'has_progress' });
    return 'archived' as const;
  }
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) throw error;
  await appendOpLog(taskId, actorId, 'delete', {});
  return 'deleted' as const;
}

export async function sendTaskUrge(taskId: string, publisherId: string, content: string): Promise<void> {
  const trimmed = content.trim();
  if (!trimmed) throw new Error('请填写催办说明');
  const { data: task, error: tErr } = await supabase
    .from('tasks')
    .select('id,task_name,publisher_id,status')
    .eq('id', taskId)
    .maybeSingle();
  if (tErr || !task) throw tErr ?? new Error('任务不存在');
  if (task.publisher_id !== publisherId) throw new Error('仅发布者可催办');
  if (task.status === 'completed') throw new Error('已完成任务不可催办');

  const { error: uErr } = await supabase.from('task_urge_records').insert({
    task_id: taskId,
    from_user_id: publisherId,
    content: trimmed,
  });
  if (uErr) throw uErr;
  await appendOpLog(taskId, publisherId, 'urge', { content: trimmed });

  const { data: ex } = await supabase.from('task_executors').select('user_id').eq('task_id', taskId);
  const notifyIds = [...new Set((ex ?? []).map((r: { user_id: string }) => r.user_id))].filter(
    uid => uid && uid !== publisherId
  );
  if (notifyIds.length) {
    const name = task.task_name as string;
    const { notifyUsers } = await import('./notificationService');
    await notifyUsers(
      notifyIds.map(uid => ({
        user_id: uid,
        title: '任务催办通知',
        body: `发布者对「${name}」发起催办：${trimmed.slice(0, 500)}`,
        category: 'task_urge',
        payload: { task_id: taskId },
      }))
    );
  }
}

export async function fetchTaskUrgeRecords(taskId: string) {
  const { data, error } = await supabase
    .from('task_urge_records')
    .select('id,task_id,from_user_id,content,created_at')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createTaskSupervision(
  taskId: string,
  publisherId: string,
  content: string,
  remindAt?: string | null
): Promise<void> {
  const trimmed = content.trim();
  if (!trimmed) throw new Error('请填写督办内容');
  const { data: task, error: tErr } = await supabase
    .from('tasks')
    .select('id,task_name,publisher_id,status')
    .eq('id', taskId)
    .maybeSingle();
  if (tErr || !task) throw tErr ?? new Error('任务不存在');
  if (task.publisher_id !== publisherId) throw new Error('仅发布者可发起督办');
  if (task.status === 'completed') throw new Error('已完成任务不可督办');

  const { error } = await supabase.from('task_supervision_records').insert({
    task_id: taskId,
    publisher_id: publisherId,
    content: trimmed,
    status: 'open',
    remind_at: remindAt && remindAt.trim() ? remindAt : null,
  });
  if (error) throw error;
  await appendOpLog(taskId, publisherId, 'supervision_create', { content: trimmed, remind_at: remindAt });

  const { data: ex } = await supabase.from('task_executors').select('user_id').eq('task_id', taskId);
  const notifyIds = [...new Set((ex ?? []).map((r: { user_id: string }) => r.user_id))].filter(
    uid => uid && uid !== publisherId
  );
  if (notifyIds.length) {
    const name = task.task_name as string;
    const { notifyUsers } = await import('./notificationService');
    await notifyUsers(
      notifyIds.map(uid => ({
        user_id: uid,
        title: '任务督办通知',
        body: `「${name}」督办事项：${trimmed.slice(0, 500)}`,
        category: 'task_supervision',
        payload: { task_id: taskId },
      }))
    );
  }
}

export async function closeTaskSupervision(taskId: string, publisherId: string, recordId: string): Promise<void> {
  const { data: rec, error: rErr } = await supabase
    .from('task_supervision_records')
    .select('id,task_id,publisher_id,status')
    .eq('id', recordId)
    .maybeSingle();
  if (rErr || !rec) throw rErr ?? new Error('记录不存在');
  if (rec.task_id !== taskId || rec.publisher_id !== publisherId) throw new Error('无权操作');
  if (rec.status === 'closed') return;
  const { error } = await supabase
    .from('task_supervision_records')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', recordId);
  if (error) throw error;
  await appendOpLog(taskId, publisherId, 'supervision_close', { record_id: recordId });
}

export async function fetchTaskSupervisionRecords(taskId: string) {
  const { data, error } = await supabase
    .from('task_supervision_records')
    .select('id,task_id,publisher_id,content,status,remind_at,closed_at,created_at')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addTaskCoAssistant(
  taskId: string,
  publisherId: string,
  userId: string,
  note?: string | null
): Promise<void> {
  if (userId === publisherId) throw new Error('不可将自己设为协办');
  const { data: task, error: tErr } = await supabase
    .from('tasks')
    .select('id,task_name,publisher_id,status')
    .eq('id', taskId)
    .maybeSingle();
  if (tErr || !task) throw tErr ?? new Error('任务不存在');
  if (task.publisher_id !== publisherId) throw new Error('仅发布者可添加协办');
  if (task.status === 'completed') throw new Error('已完成任务不可添加协办');

  const { data: existing } = await supabase
    .from('task_executors')
    .select('id,member_role')
    .eq('task_id', taskId)
    .eq('user_id', userId)
    .maybeSingle();
  if (existing) throw new Error('该用户已是执行人或协办');

  const { data: mxRows } = await supabase
    .from('task_executors')
    .select('sort_order')
    .eq('task_id', taskId)
    .order('sort_order', { ascending: false })
    .limit(1);
  const mx = mxRows?.[0] as { sort_order: number } | undefined;
  const sortOrder = (Number(mx?.sort_order) || 0) + 1;

  const { data: prim } = await supabase
    .from('task_executors')
    .select('progress')
    .eq('task_id', taskId)
    .eq('member_role', 'executor');
  let initProgress = 0;
  if (prim?.length) {
    const sum = prim.reduce((a, b) => a + Number((b as { progress: number }).progress), 0);
    initProgress = Math.round((sum / prim.length) * 100) / 100;
  }

  const { error: insErr } = await supabase.from('task_executors').insert({
    task_id: taskId,
    user_id: userId,
    progress: initProgress,
    sort_order: sortOrder,
    member_role: 'co_assistant',
  });
  if (insErr) throw insErr;

  await supabase.from('task_co_assistant_events').insert({
    task_id: taskId,
    user_id: userId,
    action: 'add',
    actor_id: publisherId,
    note: note?.trim() || null,
  });

  const { data: allEx } = await supabase.from('task_executors').select('progress,sort_order').eq('task_id', taskId);
  const agg = weightedProgress((allEx ?? []) as { progress: number; sort_order: number }[]);
  await supabase
    .from('tasks')
    .update({
      total_progress: agg,
      current_progress: agg,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  await appendOpLog(taskId, publisherId, 'co_assistant_add', { user_id: userId });
  const taskName = task.task_name as string;
  const { notifyUsers } = await import('./notificationService');
  await notifyUsers([
    {
      user_id: userId,
      title: '您已被添加为任务协办',
      body: `任务「${taskName}」：发布者已将您设为协办，可查看任务、汇报进度并参与评论。`,
      category: 'task_co_assistant',
      payload: { task_id: taskId },
    },
  ]);
}

export async function removeTaskCoAssistant(
  taskId: string,
  publisherId: string,
  userId: string,
  note?: string | null
): Promise<void> {
  const { data: task, error: tErr } = await supabase
    .from('tasks')
    .select('id,task_name,publisher_id,status')
    .eq('id', taskId)
    .maybeSingle();
  if (tErr || !task) throw tErr ?? new Error('任务不存在');
  if (task.publisher_id !== publisherId) throw new Error('仅发布者可移除协办');
  const { data: row } = await supabase
    .from('task_executors')
    .select('id')
    .eq('task_id', taskId)
    .eq('user_id', userId)
    .eq('member_role', 'co_assistant')
    .maybeSingle();
  if (!row) throw new Error('未找到该协办人员');

  const { error: delErr } = await supabase.from('task_executors').delete().eq('id', row.id as string);
  if (delErr) throw delErr;

  await supabase.from('task_co_assistant_events').insert({
    task_id: taskId,
    user_id: userId,
    action: 'remove',
    actor_id: publisherId,
    note: note?.trim() || null,
  });

  const { data: allEx } = await supabase.from('task_executors').select('progress,sort_order').eq('task_id', taskId);
  const agg = weightedProgress((allEx ?? []) as { progress: number; sort_order: number }[]);
  await supabase
    .from('tasks')
    .update({
      total_progress: agg,
      current_progress: agg,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  await appendOpLog(taskId, publisherId, 'co_assistant_remove', { user_id: userId });
  const taskName = task.task_name as string;
  const { notifyUsers } = await import('./notificationService');
  await notifyUsers([
    {
      user_id: userId,
      title: '协办已移除',
      body: `您已不再是任务「${taskName}」的协办人员。`,
      category: 'task_co_assistant',
      payload: { task_id: taskId },
    },
  ]);
}

export async function fetchCoAssistantEvents(taskId: string) {
  const { data, error } = await supabase
    .from('task_co_assistant_events')
    .select('id,task_id,user_id,action,actor_id,note,created_at')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function remindTask(taskId: string, actorId: string) {
  await sendTaskUrge(taskId, actorId, '【快捷催办】请尽快推进本任务办理进度。');
}

export async function fetchPublishedTasks(publisherId: string): Promise<TaskRow[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('publisher_id', publisherId)
    .eq('del_flag', 0)
    .order('acceptor_deadline', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TaskRow[];
}

export async function fetchTodoTasks(executorId: string): Promise<TaskRow[]> {
  const { data: links, error: lErr } = await supabase
    .from('task_executors')
    .select('task_id')
    .eq('user_id', executorId);
  if (lErr) throw lErr;
  const ids = [...new Set((links ?? []).map(r => r.task_id as string))];
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .in('id', ids)
    .eq('del_flag', 0)
    .order('acceptor_deadline', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TaskRow[];
}

/** 我相关的任务：发布、执行、抄送（去重合并） */
export async function fetchInvolvedTasks(userId: string): Promise<TaskRow[]> {
  const [published, todo, ccIds] = await Promise.all([
    fetchPublishedTasks(userId),
    fetchTodoTasks(userId),
    supabase.from('task_cc').select('task_id').eq('user_id', userId),
  ]);
  const ccTaskIds = [...new Set((ccIds.data ?? []).map(r => r.task_id as string))];
  let ccTasks: TaskRow[] = [];
  if (ccTaskIds.length) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .in('id', ccTaskIds)
      .eq('del_flag', 0);
    if (error) throw error;
    ccTasks = (data ?? []) as TaskRow[];
  }
  const map = new Map<string, TaskRow>();
  for (const t of [...published, ...todo, ...ccTasks]) {
    map.set(t.id, t);
  }
  return [...map.values()].sort((a, b) =>
    (a.acceptor_deadline || '').localeCompare(b.acceptor_deadline || '')
  );
}

/** 当前用户相关、未完成、在若干天内到期的任务（可按公司过滤，经 project.company_id） */
export async function fetchUpcomingInvolvedTasks(
  userId: string,
  options?: { companyIds?: string[]; withinDays?: number }
): Promise<TaskRow[]> {
  const tasks = await fetchInvolvedTasks(userId);
  const list = tasks.filter(t => t.status !== 'completed');
  const projectIds = [...new Set(list.map(t => t.project_id))];
  if (!projectIds.length) return [];
  const { data: projects, error: pErr } = await supabase
    .from('projects')
    .select('id, company_id')
    .in('id', projectIds);
  if (pErr) throw pErr;
  const projCompany = new Map((projects ?? []).map((p: { id: string; company_id: string }) => [p.id, p.company_id]));
  let filtered = list;
  const cids = options?.companyIds;
  if (cids?.length) {
    filtered = filtered.filter(t => {
      const cid = projCompany.get(t.project_id);
      return cid && cids.includes(cid);
    });
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const within = options?.withinDays ?? 14;
  const out = filtered.filter(t => {
    const dl = new Date((t.acceptor_deadline || '').slice(0, 10));
    if (Number.isNaN(dl.getTime())) return false;
    dl.setHours(0, 0, 0, 0);
    const daysLeft = Math.round((dl.getTime() - today.getTime()) / 86400000);
    return daysLeft >= 0 && daysLeft <= within;
  });
  return out.sort((a, b) => (a.acceptor_deadline || '').localeCompare(b.acceptor_deadline || ''));
}

export async function getTaskDetail(taskId: string) {
  const { data: task, error: tErr } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .eq('del_flag', 0)
    .maybeSingle();
  if (tErr) throw tErr;
  if (!task) return null;

  const [{ data: executors }, { data: cc }, { data: reports }, { data: acceptances }, { data: logs }, pRes] =
    await Promise.all([
      supabase.from('task_executors').select('*').eq('task_id', taskId).order('sort_order'),
      supabase.from('task_cc').select('*').eq('task_id', taskId),
      supabase
        .from('task_progress_reports')
        .select('*')
        .eq('task_id', taskId)
        .order('report_time', { ascending: false }),
      supabase
        .from('task_acceptances')
        .select('*')
        .eq('task_id', taskId)
        .order('accept_time', { ascending: false }),
      supabase
        .from('task_operation_logs')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('projects').select('id,name').eq('id', task.project_id as string).maybeSingle(),
    ]);

  const userIds = new Set<string>();
  (executors ?? []).forEach((e: { user_id: string }) => userIds.add(e.user_id));
  (cc ?? []).forEach((c: { user_id: string }) => userIds.add(c.user_id));
  (reports ?? []).forEach((r: { executor_id: string }) => userIds.add(r.executor_id));
  userIds.add(task.publisher_id as string);

  const { data: users } = await supabase
    .from('users')
    .select('id,real_name,username')
    .in('id', [...userIds]);

  const userMap = new Map((users ?? []).map((u: { id: string }) => [u.id, u]));

  return {
    task: task as TaskRow,
    project: pRes.data as { id: string; name: string } | null,
    executors: (executors ?? []) as TaskExecutorRow[],
    cc: cc ?? [],
    reports: reports ?? [],
    acceptances: acceptances ?? [],
    logs: logs ?? [],
    userMap,
  };
}

export async function submitTaskComment(taskId: string, authorId: string, body: string): Promise<string> {
  const id = await insertTaskComment(taskId, authorId, body);
  await appendOpLog(taskId, authorId, 'comment', { comment_id: id });
  const { data: task } = await supabase.from('tasks').select('task_name').eq('id', taskId).maybeSingle();
  const name = (task?.task_name as string) || '任务';
  await notifyAfterTaskComment({
    taskId,
    taskName: name,
    authorId,
    bodyPreview: body,
  });
  return id;
}

export async function submitProgress(
  taskId: string,
  executorUserId: string,
  progressAfter: number,
  reportContent: string,
  attachments: unknown[] = []
) {
  if (!reportContent.trim()) throw new Error('请填写汇报说明');
  if (progressAfter < 0 || progressAfter > 100) throw new Error('进度范围 0–100');

  const { data: ex, error: xErr } = await supabase
    .from('task_executors')
    .select('id,progress')
    .eq('task_id', taskId)
    .eq('user_id', executorUserId)
    .maybeSingle();
  if (xErr || !ex) throw xErr ?? new Error('非任务负责人或协办，无法汇报进度');

  const { data: task, error: tErr } = await supabase
    .from('tasks')
    .select('id,status')
    .eq('id', taskId)
    .maybeSingle();
  if (tErr || !task) throw tErr ?? new Error('任务不存在');
  if (task.status === 'completed') throw new Error('任务已完成');
  if (task.status === 'pending_acceptance') throw new Error('待验收阶段请等待验收结果');

  const progressBefore = Number(ex.progress);
  if (progressAfter < progressBefore) throw new Error('进度只能增加，不能回退');


  const { error: rErr } = await supabase.from('task_progress_reports').insert({
    task_id: taskId,
    executor_id: executorUserId,
    progress_before: progressBefore,
    progress_after: progressAfter,
    report_content: reportContent.trim(),
    attachments: attachments as unknown,
  });
  if (rErr) throw rErr;

  await supabase
    .from('task_executors')
    .update({ progress: progressAfter })
    .eq('id', ex.id as string);

  const { data: allEx } = await supabase.from('task_executors').select('progress,sort_order').eq('task_id', taskId);
  const agg = weightedProgress((allEx ?? []) as { progress: number; sort_order: number }[]);

  await supabase
    .from('tasks')
    .update({
      current_progress: agg,
      total_progress: agg,
      last_report_time: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  await appendOpLog(taskId, executorUserId, 'progress', {
    progress_before: progressBefore,
    progress_after: progressAfter,
  });
}

export async function applyAcceptanceRequest(taskId: string, executorUserId: string) {
  const { data: task, error: tErr } = await supabase
    .from('tasks')
    .select('id,status,total_progress')
    .eq('id', taskId)
    .maybeSingle();
  if (tErr || !task) throw tErr ?? new Error('任务不存在');

  const { data: ex } = await supabase
    .from('task_executors')
    .select('id')
    .eq('task_id', taskId)
    .eq('user_id', executorUserId)
    .or('member_role.eq.executor,member_role.is.null')
    .maybeSingle();
  if (!ex) throw new Error('仅负责人执行人可申请验收');

  if (task.status !== 'in_progress') throw new Error('当前状态不可申请验收');
  if (Number(task.total_progress) < 100) throw new Error('总进度需达到 100% 后方可申请验收');

  const { error } = await supabase
    .from('tasks')
    .update({ status: 'pending_acceptance', updated_at: new Date().toISOString() })
    .eq('id', taskId);
  if (error) throw error;
  await appendOpLog(taskId, executorUserId, 'apply_acceptance', {});
}

export async function submitAcceptance(
  taskId: string,
  acceptorId: string,
  pass: boolean,
  opinion: string,
  rejectReasonCategory?: string | null
) {
  const trimmed = opinion.trim();
  if (!pass && !trimmed) throw new Error('验收不通过时须填写驳回意见');

  const { data: task, error: tErr } = await supabase
    .from('tasks')
    .select('id,status,publisher_id,reject_count')
    .eq('id', taskId)
    .maybeSingle();
  if (tErr || !task) throw tErr ?? new Error('任务不存在');
  if (task.publisher_id !== acceptorId) throw new Error('仅发布者可验收');
  if (task.status !== 'pending_acceptance') throw new Error('当前非待验收状态');

  const result = pass ? 'pass' : 'reject';

  const { error: aErr } = await supabase.from('task_acceptances').insert({
    task_id: taskId,
    acceptor_id: acceptorId,
    result,
    opinion: trimmed || (pass ? '通过' : ''),
    reject_reason_category: pass ? null : rejectReasonCategory ?? null,
  });
  if (aErr) throw aErr;

  if (pass) {
    const { error } = await supabase
      .from('tasks')
      .update({
        status: 'completed',
        complete_time: new Date().toISOString(),
        last_reject_opinion: null,
        last_reject_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);
    if (error) throw error;
    await appendOpLog(taskId, acceptorId, 'accept_pass', {});
  } else {
    const rc = (Number(task.reject_count) || 0) + 1;
    const { error } = await supabase
      .from('tasks')
      .update({
        status: 'in_progress',
        last_reject_opinion: trimmed,
        last_reject_at: new Date().toISOString(),
        reject_count: rc,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);
    if (error) throw error;
    await appendOpLog(taskId, acceptorId, 'accept_reject', { opinion: trimmed });
  }
}

export async function replaceExecutorsAndCc(
  taskId: string,
  actorId: string,
  executorUserIds: string[],
  ccUserIds: string[]
) {
  const { data: task } = await supabase.from('tasks').select('status').eq('id', taskId).maybeSingle();
  if (!task || task.status === 'completed') throw new Error('不可修改');

  await supabase.from('task_executors').delete().eq('task_id', taskId);
  await supabase.from('task_cc').delete().eq('task_id', taskId);

  if (executorUserIds.length) {
    await supabase.from('task_executors').insert(
      executorUserIds.map((user_id, i) => ({
        task_id: taskId,
        user_id,
        progress: 0,
        sort_order: i,
        member_role: 'executor',
      }))
    );
  }
  if (ccUserIds.length) {
    await supabase.from('task_cc').insert(ccUserIds.map(user_id => ({ task_id: taskId, user_id })));
  }

  const { data: allEx } = await supabase.from('task_executors').select('progress,sort_order').eq('task_id', taskId);
  const agg = weightedProgress((allEx ?? []) as { progress: number; sort_order: number }[]);
  await supabase.from('tasks').update({ total_progress: agg, updated_at: new Date().toISOString() }).eq('id', taskId);

  await appendOpLog(taskId, actorId, 'update_members', { executorUserIds, ccUserIds });
}

export function executorMemberRole(row: Pick<TaskExecutorRow, 'member_role'>): 'executor' | 'co_assistant' {
  return row.member_role === 'co_assistant' ? 'co_assistant' : 'executor';
}

export function isTaskCoAssistant(detail: TaskDetailBundle, userId: string): boolean {
  return detail.executors.some(e => e.user_id === userId && executorMemberRole(e) === 'co_assistant');
}

export function isPrimaryTaskExecutor(detail: TaskDetailBundle, userId: string): boolean {
  return detail.executors.some(e => e.user_id === userId && executorMemberRole(e) === 'executor');
}

/** 负责人或协办：可提交进度 */
export function canSubmitTaskProgress(detail: TaskDetailBundle, userId: string): boolean {
  return detail.executors.some(e => e.user_id === userId) && detail.task.publisher_id !== userId;
}

/** 发布者或任一执行人（含协办）：可发评论；纯抄送只读 */
export function canPostTaskComment(detail: TaskDetailBundle, userId: string, isSuperAdmin: boolean): boolean {
  if (isSuperAdmin) return true;
  if (detail.task.publisher_id === userId) return true;
  return detail.executors.some(e => e.user_id === userId);
}

export type TaskDetailBundle = NonNullable<Awaited<ReturnType<typeof getTaskDetail>>>;

export function canViewTask(detail: TaskDetailBundle, userId: string, isSuperAdmin: boolean): boolean {
  if (isSuperAdmin) return true;
  if (detail.task.publisher_id === userId) return true;
  if (detail.executors.some(e => e.user_id === userId)) return true;
  if ((detail.cc as { user_id: string }[]).some(c => c.user_id === userId)) return true;
  return false;
}

export function isTaskExecutor(detail: TaskDetailBundle, userId: string): boolean {
  return detail.executors.some(e => e.user_id === userId);
}

export function isTaskPublisher(detail: TaskDetailBundle, userId: string): boolean {
  return detail.task.publisher_id === userId;
}
