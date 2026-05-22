import { WECHAT_WORK_CONFIG } from '../config/wechatWork';
import { supabase } from '../supabase/client';

async function invokeWechatWork<T extends Record<string, unknown>>(
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<{ error?: string } & T>('wechat-work-ops', { body });
  if (error) throw new Error(error.message || 'wechat-work-ops 调用失败');
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error));
  }
  return data as T;
}

export interface WechatWorkMessageResponse {
    errcode: number;
    errmsg: string;
    invaliduser?: string;
    invalidparty?: string;
    invalidtag?: string;
}

export interface TextMessage {
    touser?: string;
    toparty?: string;
    totag?: string;
    msgtype: 'text';
    agentid: string;
    text: {
        content: string;
    };
    safe?: number;
}

export interface MarkdownMessage {
    touser?: string;
    toparty?: string;
    totag?: string;
    msgtype: 'markdown';
    agentid: string;
    markdown: {
        content: string;
    };
    safe?: number;
}

export async function sendTextMessage(
    userId: string,
    content: string
): Promise<WechatWorkMessageResponse> {
    const message: TextMessage = {
        touser: userId,
        msgtype: 'text',
        agentid: WECHAT_WORK_CONFIG.agentId,
        text: { content },
        safe: 0,
    };
    const data = await invokeWechatWork<{ result: WechatWorkMessageResponse }>({
        action: 'sendMessage',
        message,
    });
    return data.result;
}

export async function sendMarkdownMessage(
    userId: string,
    content: string
): Promise<WechatWorkMessageResponse> {
    const message: MarkdownMessage = {
        touser: userId,
        msgtype: 'markdown',
        agentid: WECHAT_WORK_CONFIG.agentId,
        markdown: { content },
        safe: 0,
    };
    const data = await invokeWechatWork<{ result: WechatWorkMessageResponse }>({
        action: 'sendMessage',
        message,
    });
    return data.result;
}

export async function sendContractExpiryReminder(
    userId: string,
    contractName: string,
    contractCode: string,
    expiryDate: string,
    daysRemaining: number
): Promise<WechatWorkMessageResponse> {
    const content = `## 📅 合同到期提醒

**合同名称**：${contractName}

**合同编号**：${contractCode}

**到期日期**：${expiryDate}

**剩余天数**：${daysRemaining}天

请及时处理合同续签事宜，避免合同逾期。`;

    return await sendMarkdownMessage(userId, content);
}

export async function sendPaymentDueReminder(
    userId: string,
    contractName: string,
    nodeName: string,
    amount: number,
    paidAmount: number,
    dueDate: string,
    daysRemaining: number
): Promise<WechatWorkMessageResponse> {
    const unpaidAmount = amount - paidAmount;
    const content = `## 💰 付款节点提醒

**合同名称**：${contractName}

**付款节点**：${nodeName}

**应付款金额**：${amount}元

**已付金额**：${paidAmount}元

**未付金额**：${unpaidAmount}元

**付款截止日期**：${dueDate}

**剩余天数**：${daysRemaining}天

请及时安排付款事宜。`;

    return await sendMarkdownMessage(userId, content);
}

export async function sendMilestoneReminder(
    userId: string,
    contractName: string,
    milestoneName: string,
    description: string,
    targetDate: string,
    status: string,
    daysRemaining: number
): Promise<WechatWorkMessageResponse> {
    const content = `## 🎯 里程碑节点提醒

**合同名称**：${contractName}

**里程碑名称**：${milestoneName}

**描述**：${description || '无'}

**计划完成日期**：${targetDate}

**当前状态**：${status}

**剩余天数**：${daysRemaining}天

请关注里程碑进度，确保按时完成。`;

    return await sendMarkdownMessage(userId, content);
}

export async function batchSendReminder(
    userIds: string[],
    title: string,
    content: string
): Promise<{ successCount: number; failCount: number; failedUsers: string[] }> {
    let successCount = 0;
    let failCount = 0;
    const failedUsers: string[] = [];

    for (const userId of userIds) {
        try {
            await sendTextMessage(userId, `${title}\n\n${content}`);
            successCount++;
        } catch {
            failCount++;
            failedUsers.push(userId);
        }
    }

    return { successCount, failCount, failedUsers };
}

export async function sendReminderWithRetry(
    userId: string,
    title: string,
    content: string,
    maxRetries: number = 3
): Promise<boolean> {
    let retries = 0;
    while (retries < maxRetries) {
        try {
            const result = await sendTextMessage(userId, `${title}\n\n${content}`);
            if (result.errcode === 0) {
                return true;
            }
            if (result.errcode === 42001) {
                /* token 由 Edge 侧重试 */
            }
        } catch {
            if (retries === maxRetries - 1) {
                return false;
            }
        }
        retries++;
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
    }
    return false;
}