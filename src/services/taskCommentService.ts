/**
 * 任务评论：列表、带作者信息展示、发布
 */
import { supabase } from '../supabase/client';

export interface TaskCommentRow {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  attachments: unknown;
  created_at: string;
}

export interface TaskCommentAuthor {
  id: string;
  real_name: string | null;
  username: string;
  avatar_url?: string | null;
}

export interface TaskCommentWithAuthor extends TaskCommentRow {
  author?: TaskCommentAuthor | null;
}

export async function fetchTaskComments(taskId: string): Promise<TaskCommentRow[]> {
  const { data, error } = await supabase
    .from('task_comments')
    .select('id,task_id,author_id,body,attachments,created_at')
    .eq('task_id', taskId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TaskCommentRow[];
}

export async function fetchTaskCommentsWithAuthors(taskId: string): Promise<TaskCommentWithAuthor[]> {
  const rows = await fetchTaskComments(taskId);
  if (!rows.length) return [];
  const authorIds = [...new Set(rows.map(r => r.author_id))];
  const { data: users, error } = await supabase
    .from('users')
    .select('id,real_name,username')
    .in('id', authorIds);
  if (error) throw error;
  const umap = new Map((users ?? []).map((u: TaskCommentAuthor) => [u.id, u]));
  return rows.map(r => ({ ...r, author: umap.get(r.author_id) ?? null }));
}

export async function insertTaskComment(taskId: string, authorId: string, body: string): Promise<string> {
  const t = body.trim();
  if (!t) throw new Error('评论内容不能为空');
  if (t.length > 5000) throw new Error('评论过长');
  const { data, error } = await supabase
    .from('task_comments')
    .insert({
      task_id: taskId,
      author_id: authorId,
      body: t,
      attachments: [],
    })
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('评论发表失败');
  return data.id as string;
}
