import { supabase } from '../supabase/client';

export type ReminderType = 'contract_expiry' | 'payment_due' | 'milestone';
export type ReminderChannel = 'system' | 'wechat_work';
export type ReminderLevel = 'low' | 'medium' | 'high' | 'urgent';
export type ReminderStatus = 'pending' | 'processed' | 'resolved';
export type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'overdue';
export type PaymentStatus = 'unpaid' | 'partial_paid' | 'fully_paid';

export interface PaymentNode {
    id: string;
    contract_id: string;
    contract_type: 'income' | 'expense';
    node_name: string;
    due_date: string;
    amount: number;
    paid_amount: number;
    status: PaymentStatus;
    reminder_days_before: number;
    reminder_level: ReminderLevel;
    created_at: string;
    updated_at: string;
}

export interface Milestone {
    id: string;
    contract_id: string;
    contract_type: 'income' | 'expense';
    milestone_name: string;
    description: string | null;
    target_date: string;
    status: MilestoneStatus;
    reminder_days_before: number;
    reminder_level: ReminderLevel;
    created_at: string;
    updated_at: string;
}

export interface ReminderRule {
    id: string;
    contract_id: string | null;
    contract_type: 'income' | 'expense' | null;
    reminder_type: ReminderType;
    days_before: number;
    channels: ReminderChannel[];
    level: ReminderLevel;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface ReminderRecord {
    id: string;
    rule_id: string | null;
    contract_id: string;
    contract_type: 'income' | 'expense';
    contract_name: string | null;
    contract_code: string | null;
    reminder_type: ReminderType;
    title: string;
    content: string | null;
    related_node_id: string | null;
    related_node_name: string | null;
    target_date: string;
    days_remaining: number | null;
    amount: number | null;
    paid_amount: number | null;
    status: ReminderStatus;
    notified_channels: ReminderChannel[];
    failed_channels: ReminderChannel[];
    user_ids: string[];
    created_at: string;
    processed_at: string | null;
    resolved_at: string | null;
}

export interface UserReminderChannels {
    user_id: string;
    preferred_channels: ReminderChannel[];
    contract_expiry_enabled: boolean;
    payment_due_enabled: boolean;
    milestone_enabled: boolean;
    created_at: string;
    updated_at: string;
}

export async function createPaymentNode(node: Omit<PaymentNode, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    const { data, error } = await supabase
        .from('contract_payment_nodes')
        .insert(node)
        .select('id')
        .single();
    if (error) throw error;
    return data.id;
}

export async function updatePaymentNode(id: string, updates: Partial<PaymentNode>): Promise<void> {
    const { error } = await supabase
        .from('contract_payment_nodes')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
    if (error) throw error;
}

export async function deletePaymentNode(id: string): Promise<void> {
    const { error } = await supabase
        .from('contract_payment_nodes')
        .delete()
        .eq('id', id);
    if (error) throw error;
}

export async function getPaymentNodesByContract(contractId: string, contractType: 'income' | 'expense'): Promise<PaymentNode[]> {
    const { data, error } = await supabase
        .from('contract_payment_nodes')
        .select('*')
        .eq('contract_id', contractId)
        .eq('contract_type', contractType)
        .order('due_date');
    if (error) throw error;
    return data || [];
}

export async function createMilestone(milestone: Omit<Milestone, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    const { data, error } = await supabase
        .from('contract_milestones')
        .insert(milestone)
        .select('id')
        .single();
    if (error) throw error;
    return data.id;
}

export async function updateMilestone(id: string, updates: Partial<Milestone>): Promise<void> {
    const { error } = await supabase
        .from('contract_milestones')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
    if (error) throw error;
}

export async function deleteMilestone(id: string): Promise<void> {
    const { error } = await supabase
        .from('contract_milestones')
        .delete()
        .eq('id', id);
    if (error) throw error;
}

export async function getMilestonesByContract(contractId: string, contractType: 'income' | 'expense'): Promise<Milestone[]> {
    const { data, error } = await supabase
        .from('contract_milestones')
        .select('*')
        .eq('contract_id', contractId)
        .eq('contract_type', contractType)
        .order('target_date');
    if (error) throw error;
    return data || [];
}

export async function createReminderRule(rule: Omit<ReminderRule, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    const { data, error } = await supabase
        .from('contract_reminder_rules')
        .insert(rule)
        .select('id')
        .single();
    if (error) throw error;
    return data.id;
}

export async function updateReminderRule(id: string, updates: Partial<ReminderRule>): Promise<void> {
    const { error } = await supabase
        .from('contract_reminder_rules')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
    if (error) throw error;
}

export async function deleteReminderRule(id: string): Promise<void> {
    const { error } = await supabase
        .from('contract_reminder_rules')
        .delete()
        .eq('id', id);
    if (error) throw error;
}

export async function getReminderRules(contractId?: string, contractType?: 'income' | 'expense'): Promise<ReminderRule[]> {
    let query = supabase.from('contract_reminder_rules').select('*');
    if (contractId) query = query.eq('contract_id', contractId);
    if (contractType) query = query.eq('contract_type', contractType);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

export async function createReminderRecord(
  record: Omit<ReminderRecord, 'id' | 'created_at' | 'rule_id' | 'processed_at' | 'resolved_at'> &
    Partial<Pick<ReminderRecord, 'rule_id' | 'processed_at' | 'resolved_at'>>
): Promise<string> {
    const { data, error } = await supabase
        .from('contract_reminders')
        .insert({
            rule_id: null,
            processed_at: null,
            resolved_at: null,
            ...record,
        })
        .select('id')
        .single();
    if (error) throw error;
    return data.id;
}

export async function updateReminderRecord(id: string, updates: Partial<ReminderRecord>): Promise<void> {
    const { error } = await supabase
        .from('contract_reminders')
        .update(updates)
        .eq('id', id);
    if (error) throw error;
}

export async function getReminderRecords(filters?: {
    status?: ReminderStatus;
    contractId?: string;
    contractType?: 'income' | 'expense';
    reminderType?: ReminderType;
}): Promise<ReminderRecord[]> {
    let query = supabase.from('contract_reminders').select('*');
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.contractId) query = query.eq('contract_id', filters.contractId);
    if (filters?.contractType) query = query.eq('contract_type', filters.contractType);
    if (filters?.reminderType) query = query.eq('reminder_type', filters.reminderType);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

export async function updateReminderStatus(id: string, status: ReminderStatus): Promise<void> {
    const updateData: Partial<ReminderRecord> = { status };
    if (status === 'processed') updateData.processed_at = new Date().toISOString();
    if (status === 'resolved') updateData.resolved_at = new Date().toISOString();
    await updateReminderRecord(id, updateData);
}

export async function getUserReminderChannels(userId: string): Promise<UserReminderChannels | null> {
    const { data, error } = await supabase
        .from('user_reminder_channels')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
    if (error) throw error;
    return data || null;
}

export async function upsertUserReminderChannels(userId: string, preferences: Partial<UserReminderChannels>): Promise<void> {
    const { error } = await supabase
        .from('user_reminder_channels')
        .upsert({
            user_id: userId,
            ...preferences,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
    if (error) throw error;
}

export async function calculateDaysRemaining(targetDate: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export async function checkAndTriggerReminders(): Promise<{ triggeredCount: number; failedCount: number }> {
    let triggeredCount = 0;
    let failedCount = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [incomeContracts, expenseContracts] = await Promise.all([
        supabase.from('income_contracts').select('id, contract_name, contract_code, contract_period'),
        supabase.from('expense_contracts').select('id, contract_name, contract_code, contract_period'),
    ]);

    for (const contract of incomeContracts.data || []) {
        try {
            const expiryDate = parseContractPeriod(contract.contract_period);
            if (expiryDate) {
                const daysRemaining = await calculateDaysRemaining(expiryDate);
                const defaultRule = await getDefaultRule('contract_expiry');
                const daysBefore = defaultRule?.days_before || 30;

                if (daysRemaining === daysBefore) {
                    await createContractExpiryReminder(contract, expiryDate, daysRemaining);
                    triggeredCount++;
                }
            }
        } catch {
            failedCount++;
        }
    }

    for (const contract of expenseContracts.data || []) {
        try {
            const expiryDate = parseContractPeriod(contract.contract_period);
            if (expiryDate) {
                const daysRemaining = await calculateDaysRemaining(expiryDate);
                const defaultRule = await getDefaultRule('contract_expiry');
                const daysBefore = defaultRule?.days_before || 30;

                if (daysRemaining === daysBefore) {
                    await createContractExpiryReminder(contract, expiryDate, daysRemaining, 'expense');
                    triggeredCount++;
                }
            }
        } catch {
            failedCount++;
        }
    }

    const [paymentNodes, milestones] = await Promise.all([
        supabase.from('contract_payment_nodes').select('*'),
        supabase.from('contract_milestones').select('*'),
    ]);

    for (const node of paymentNodes.data || []) {
        try {
            const daysRemaining = await calculateDaysRemaining(node.due_date);
            if (daysRemaining === node.reminder_days_before) {
                await createPaymentDueReminder(node);
                triggeredCount++;
            }
        } catch {
            failedCount++;
        }
    }

    for (const milestone of milestones.data || []) {
        try {
            const daysRemaining = await calculateDaysRemaining(milestone.target_date);
            if (daysRemaining === milestone.reminder_days_before) {
                await createMilestoneReminder(milestone);
                triggeredCount++;
            }
        } catch {
            failedCount++;
        }
    }

    return { triggeredCount, failedCount };
}

async function getDefaultRule(type: ReminderType): Promise<ReminderRule | null> {
    const { data, error } = await supabase
        .from('contract_reminder_rules')
        .select('*')
        .eq('reminder_type', type)
        .is('contract_id', null)
        .eq('is_active', true)
        .maybeSingle();
    if (error) return null;
    return data || null;
}

function parseContractPeriod(period: string | null): string | null {
    if (!period) return null;
    const match = period.match(/至\s*(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    const dateMatch = period.match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) return dateMatch[1];
    return null;
}

async function createContractExpiryReminder(
    contract: { id: string; contract_name: string; contract_code: string },
    expiryDate: string,
    daysRemaining: number,
    contractType: 'income' | 'expense' = 'income'
): Promise<void> {
    const title = `合同即将到期提醒`;
    const content = `合同名称：${contract.contract_name}\n合同编号：${contract.contract_code}\n到期日期：${expiryDate}\n剩余天数：${daysRemaining}天`;

    await createReminderRecord({
        contract_id: contract.id,
        contract_type: contractType,
        contract_name: contract.contract_name,
        contract_code: contract.contract_code,
        reminder_type: 'contract_expiry',
        title,
        content,
        related_node_id: null,
        related_node_name: null,
        target_date: expiryDate,
        days_remaining: daysRemaining,
        amount: null,
        paid_amount: null,
        status: 'pending',
        notified_channels: [],
        failed_channels: [],
        user_ids: [],
    });
}

async function createPaymentDueReminder(node: PaymentNode): Promise<void> {
    const contract = await getContractInfo(node.contract_id, node.contract_type);
    const unpaidAmount = node.amount - node.paid_amount;
    const title = `付款节点到期提醒`;
    const content = `合同名称：${contract?.contract_name || '未知'}\n付款节点：${node.node_name}\n应付款金额：${node.amount}\n已付金额：${node.paid_amount}\n未付金额：${unpaidAmount}\n付款截止日期：${node.due_date}\n剩余天数：${node.reminder_days_before}天`;

    await createReminderRecord({
        contract_id: node.contract_id,
        contract_type: node.contract_type,
        contract_name: contract?.contract_name || null,
        contract_code: contract?.contract_code || null,
        reminder_type: 'payment_due',
        title,
        content,
        related_node_id: node.id,
        related_node_name: node.node_name,
        target_date: node.due_date,
        days_remaining: node.reminder_days_before,
        amount: node.amount,
        paid_amount: node.paid_amount,
        status: 'pending',
        notified_channels: [],
        failed_channels: [],
        user_ids: [],
    });
}

async function createMilestoneReminder(milestone: Milestone): Promise<void> {
    const contract = await getContractInfo(milestone.contract_id, milestone.contract_type);
    const title = `里程碑节点提醒`;
    const content = `合同名称：${contract?.contract_name || '未知'}\n里程碑名称：${milestone.milestone_name}\n描述：${milestone.description || '无'}\n计划完成日期：${milestone.target_date}\n当前状态：${milestone.status}\n剩余天数：${milestone.reminder_days_before}天`;

    await createReminderRecord({
        contract_id: milestone.contract_id,
        contract_type: milestone.contract_type,
        contract_name: contract?.contract_name || null,
        contract_code: contract?.contract_code || null,
        reminder_type: 'milestone',
        title,
        content,
        related_node_id: milestone.id,
        related_node_name: milestone.milestone_name,
        target_date: milestone.target_date,
        days_remaining: milestone.reminder_days_before,
        amount: null,
        paid_amount: null,
        status: 'pending',
        notified_channels: [],
        failed_channels: [],
        user_ids: [],
    });
}

async function getContractInfo(contractId: string, contractType: 'income' | 'expense'): Promise<{ contract_name: string; contract_code: string } | null> {
    const table = contractType === 'income' ? 'income_contracts' : 'expense_contracts';
    const { data, error } = await supabase
        .from(table)
        .select('contract_name, contract_code')
        .eq('id', contractId)
        .maybeSingle();
    if (error || !data) return null;
    return data;
}

export async function getPendingRemindersCount(): Promise<number> {
    const { count, error } = await supabase
        .from('contract_reminders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
    if (error) return 0;
    return count || 0;
}

export async function batchUpdatePaymentStatus(contractId: string, contractType: 'income' | 'expense'): Promise<void> {
    const { data: nodes, error } = await supabase
        .from('contract_payment_nodes')
        .select('id, amount, paid_amount')
        .eq('contract_id', contractId)
        .eq('contract_type', contractType);
    if (error) throw error;

    for (const node of nodes || []) {
        let status: PaymentStatus = 'unpaid';
        if (node.paid_amount >= node.amount) {
            status = 'fully_paid';
        } else if (node.paid_amount > 0) {
            status = 'partial_paid';
        }
        await updatePaymentNode(node.id, { status });
    }
}

export async function batchUpdateMilestoneStatus(): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const { data: milestones, error } = await supabase
        .from('contract_milestones')
        .select('id, target_date, status')
        .neq('status', 'completed');
    if (error) throw error;

    for (const milestone of milestones || []) {
        if (milestone.target_date < today && milestone.status !== 'overdue') {
            await updateMilestone(milestone.id, { status: 'overdue' });
        }
    }
}