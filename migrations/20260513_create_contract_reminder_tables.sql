-- ============================================
-- 合同智能提醒功能数据库表
-- ============================================

-- 提醒类型枚举
DO $$ BEGIN
    CREATE TYPE reminder_type AS ENUM ('contract_expiry', 'payment_due', 'milestone');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 提醒渠道枚举
DO $$ BEGIN
    CREATE TYPE reminder_channel AS ENUM ('system', 'wechat_work');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 提醒级别枚举
DO $$ BEGIN
    CREATE TYPE reminder_level AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 提醒状态枚举
DO $$ BEGIN
    CREATE TYPE reminder_status AS ENUM ('pending', 'processed', 'resolved');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 里程碑状态枚举
DO $$ BEGIN
    CREATE TYPE milestone_status AS ENUM ('pending', 'in_progress', 'completed', 'overdue');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 付款节点状态枚举
DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('unpaid', 'partial_paid', 'fully_paid');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- 付款节点表
-- ============================================
CREATE TABLE IF NOT EXISTS contract_payment_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL,
    contract_type VARCHAR(20) NOT NULL CHECK (contract_type IN ('income', 'expense')),
    node_name VARCHAR(200) NOT NULL,
    due_date DATE NOT NULL,
    amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    status payment_status NOT NULL DEFAULT 'unpaid',
    reminder_days_before INTEGER DEFAULT 7,
    reminder_level reminder_level DEFAULT 'medium',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_nodes_contract ON contract_payment_nodes(contract_id, contract_type);
CREATE INDEX IF NOT EXISTS idx_payment_nodes_due_date ON contract_payment_nodes(due_date);

-- ============================================
-- 里程碑节点表
-- ============================================
CREATE TABLE IF NOT EXISTS contract_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL,
    contract_type VARCHAR(20) NOT NULL CHECK (contract_type IN ('income', 'expense')),
    milestone_name VARCHAR(200) NOT NULL,
    description TEXT,
    target_date DATE NOT NULL,
    status milestone_status NOT NULL DEFAULT 'pending',
    reminder_days_before INTEGER DEFAULT 7,
    reminder_level reminder_level DEFAULT 'medium',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_milestones_contract ON contract_milestones(contract_id, contract_type);
CREATE INDEX IF NOT EXISTS idx_milestones_target_date ON contract_milestones(target_date);

-- ============================================
-- 提醒规则表
-- ============================================
CREATE TABLE IF NOT EXISTS contract_reminder_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID,
    contract_type VARCHAR(20) CHECK (contract_type IN ('income', 'expense')),
    reminder_type reminder_type NOT NULL,
    days_before INTEGER NOT NULL DEFAULT 30,
    channels reminder_channel[] NOT NULL DEFAULT ARRAY['system']::reminder_channel[],
    level reminder_level DEFAULT 'medium',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminder_rules_contract ON contract_reminder_rules(contract_id, contract_type);
CREATE INDEX IF NOT EXISTS idx_reminder_rules_type ON contract_reminder_rules(reminder_type);

-- ============================================
-- 提醒记录表
-- ============================================
CREATE TABLE IF NOT EXISTS contract_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID REFERENCES contract_reminder_rules(id) ON DELETE SET NULL,
    contract_id UUID NOT NULL,
    contract_type VARCHAR(20) NOT NULL CHECK (contract_type IN ('income', 'expense')),
    contract_name VARCHAR(255),
    contract_code VARCHAR(50),
    reminder_type reminder_type NOT NULL,
    title VARCHAR(500) NOT NULL,
    content TEXT,
    related_node_id UUID,
    related_node_name VARCHAR(200),
    target_date DATE NOT NULL,
    days_remaining INTEGER,
    amount DECIMAL(15,2),
    paid_amount DECIMAL(15,2),
    status reminder_status NOT NULL DEFAULT 'pending',
    notified_channels reminder_channel[] NOT NULL DEFAULT '{}'::reminder_channel[],
    failed_channels reminder_channel[] NOT NULL DEFAULT '{}'::reminder_channel[],
    user_ids UUID[] NOT NULL DEFAULT '{}'::UUID[],
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP,
    resolved_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reminders_contract ON contract_reminders(contract_id, contract_type);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON contract_reminders(status);
CREATE INDEX IF NOT EXISTS idx_reminders_created ON contract_reminders(created_at DESC);

-- ============================================
-- 用户提醒偏好设置表
-- ============================================
CREATE TABLE IF NOT EXISTS user_reminder_channels (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    preferred_channels reminder_channel[] NOT NULL DEFAULT ARRAY['system']::reminder_channel[],
    contract_expiry_enabled BOOLEAN DEFAULT true,
    payment_due_enabled BOOLEAN DEFAULT true,
    milestone_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 启用 RLS
-- ============================================
ALTER TABLE contract_payment_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_reminder_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_reminder_channels ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS 策略
-- ============================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contract_payment_nodes' AND policyname = '公开读取') THEN
        CREATE POLICY "公开读取" ON contract_payment_nodes FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contract_payment_nodes' AND policyname = '公开插入') THEN
        CREATE POLICY "公开插入" ON contract_payment_nodes FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contract_payment_nodes' AND policyname = '公开更新') THEN
        CREATE POLICY "公开更新" ON contract_payment_nodes FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contract_payment_nodes' AND policyname = '管理员删除') THEN
        CREATE POLICY "管理员删除" ON contract_payment_nodes FOR DELETE USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contract_milestones' AND policyname = '公开读取') THEN
        CREATE POLICY "公开读取" ON contract_milestones FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contract_milestones' AND policyname = '公开插入') THEN
        CREATE POLICY "公开插入" ON contract_milestones FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contract_milestones' AND policyname = '公开更新') THEN
        CREATE POLICY "公开更新" ON contract_milestones FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contract_milestones' AND policyname = '管理员删除') THEN
        CREATE POLICY "管理员删除" ON contract_milestones FOR DELETE USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contract_reminder_rules' AND policyname = '公开读取') THEN
        CREATE POLICY "公开读取" ON contract_reminder_rules FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contract_reminder_rules' AND policyname = '公开插入') THEN
        CREATE POLICY "公开插入" ON contract_reminder_rules FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contract_reminder_rules' AND policyname = '公开更新') THEN
        CREATE POLICY "公开更新" ON contract_reminder_rules FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contract_reminder_rules' AND policyname = '管理员删除') THEN
        CREATE POLICY "管理员删除" ON contract_reminder_rules FOR DELETE USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contract_reminders' AND policyname = '公开读取') THEN
        CREATE POLICY "公开读取" ON contract_reminders FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contract_reminders' AND policyname = '公开插入') THEN
        CREATE POLICY "公开插入" ON contract_reminders FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contract_reminders' AND policyname = '公开更新') THEN
        CREATE POLICY "公开更新" ON contract_reminders FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contract_reminders' AND policyname = '管理员删除') THEN
        CREATE POLICY "管理员删除" ON contract_reminders FOR DELETE USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_reminder_channels' AND policyname = '公开读取') THEN
        CREATE POLICY "公开读取" ON user_reminder_channels FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_reminder_channels' AND policyname = '公开插入') THEN
        CREATE POLICY "公开插入" ON user_reminder_channels FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_reminder_channels' AND policyname = '公开更新') THEN
        CREATE POLICY "公开更新" ON user_reminder_channels FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_reminder_channels' AND policyname = '管理员删除') THEN
        CREATE POLICY "管理员删除" ON user_reminder_channels FOR DELETE USING (true);
    END IF;
END $$;