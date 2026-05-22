import { supabase } from '../supabase/client';

/** 将审批类站内信同步写入邮件队列（需运维配置发信通道后消费 pending 记录） */
export async function queueApprovalEmail(
  userId: string,
  subject: string,
  body: string,
  category = 'approval',
): Promise<void> {
  const { data: user } = await supabase
    .from('users')
    .select('email')
    .eq('id', userId)
    .maybeSingle();

  const email = user?.email?.trim();
  if (!email) return;

  const { error } = await supabase.from('approval_email_queue').insert({
    user_id: userId,
    to_email: email,
    subject,
    body,
    category,
    status: 'pending',
  });

  if (error) {
    console.warn('[approval_email_queue]', error.message);
  }
}
