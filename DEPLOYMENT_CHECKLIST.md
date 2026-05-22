# 建筑工程企业内部管理平台 - 生产环境部署检查清单

## 一、云数据库自动备份配置

### 1.1 阿里云 RDS 自动备份设置

#### 操作路径
阿里云控制台 → RDS控制台 → 实例列表 → 选择目标实例 → 备份恢复 → 设置备份策略

#### 配置参数

| 配置项 | 推荐值 | 说明 |
|--------|--------|------|
| 备份时间 | 02:00 (凌晨2点) | 业务低峰期进行备份 |
| 备份周期 | 每天 | 确保数据每日完整备份 |
| 保留天数 | 7天 | 保留最近7个备份 |
| 备份方式 | 物理备份 | 恢复速度更快 |

#### Terraform 脚本示例

```hcl
resource "alicloud_rds_backup_policy" "example" {
  instance_id              = alicloud_rds_instance.example.id
  backup_period            = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
  backup_time              = "02:00Z"
  retention_period         = 7
  backup_method            = "Physical"
  log_backup_enabled       = true
  log_retention_period     = 7
}
```

#### 备份验证

```sql
-- 查看备份日志
SELECT * FROM backup_logs
ORDER BY backup_time DESC
LIMIT 10;
```

---

## 二、基于角色的权限隔离（RBAC）配置

### 2.1 角色说明

| 角色标识 | 角色名称 | 说明 |
|----------|----------|------|
| super_admin | 超级管理员 | 拥有全部权限，可删除数据 |
| finance | 财务 | 财务相关操作 |
| project_manager | 项目经理 | 项目管理、印章申请、农民工管理 |
| material_staff | 材料员 | 物资管理 |
| labor_staff | 劳资员 | 农民工管理 |
| supplier | 外部供应商 | 仅查看权限 |

### 2.2 权限矩阵

| 权限代码 | 权限名称 | 超级管理员 | 财务 | 项目经理 | 材料员 | 劳资员 | 供应商 |
|----------|----------|-------------|------|----------|--------|--------|--------|
| project_read | 查看项目 | 全部 | - | 全部 | - | - | - |
| project_create | 创建项目 | 全部 | - | ✓ | - | - | - |
| project_update | 编辑项目 | 全部 | - | ✓ | - | - | - |
| project_delete | 删除项目 | 全部 | - | - | - | - | - |
| finance_read | 查看财务 | 全部 | 全部 | - | - | - | - |
| finance_create | 创建财务 | 全部 | ✓ | - | - | - | - |
| finance_update | 编辑财务 | 全部 | ✓ | - | - | - | - |
| finance_delete | 删除财务 | 全部 | - | - | - | - | - |
| supplier_read | 查看供应商 | 全部 | 全部 | - | - | - | - |
| supplier_create | 创建供应商 | 全部 | - | - | - | - | - |
| supplier_update | 编辑供应商 | 全部 | - | - | - | - | - |
| supplier_delete | 删除供应商 | 全部 | - | - | - | - | - |
| seal_read | 查看印章 | 全部 | - | 全部 | - | - | - |
| seal_create | 申请印章 | 全部 | - | ✓ | - | - | - |
| seal_approve | 审批印章 | 全部 | - | ✓ | - | - | - |
| worker_read | 查看农民工 | 全部 | - | 全部 | - | 全部 | - |
| worker_create | 创建农民工 | 全部 | - | ✓ | - | ✓ | - |
| worker_update | 编辑农民工 | 全部 | - | ✓ | - | ✓ | - |
| worker_delete | 删除农民工 | 全部 | - | - | - | - | - |
| material_read | 查看物资 | 全部 | - | - | 全部 | - | - |
| material_create | 创建物资 | 全部 | - | - | ✓ | - | - |
| material_update | 编辑物资 | 全部 | - | - | ✓ | - | - |
| material_delete | 删除物资 | 全部 | - | - | - | - | - |
| role_manage | 角色管理 | 全部 | - | - | - | - | - |
| backup_manage | 备份管理 | 全部 | - | - | - | - | - |

### 2.3 权限说明

- **can_create**: 创建数据权限
- **can_read**: 查看数据权限（默认开启）
- **can_update**: 编辑数据权限
- **can_delete**: 删除数据权限（仅超级管理员拥有）
- **can_approve**: 审批权限

### 2.4 删除数据权限控制

**关键约束**: 只有 `super_admin` (超级管理员) 角色拥有 `can_delete = true` 权限。

数据库层面通过 RLS 策略实现：

```sql
-- 验证角色删除权限
CREATE OR REPLACE FUNCTION public.can_delete_data(_table_name TEXT, _role_name TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM role_permissions rp
    JOIN roles r ON rp.role_id = r.id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE r.name = _role_name
      AND p.module = _table_name
      AND rp.can_delete = true
  );
$$;
```

### 2.5 前端权限控制

在需要权限控制的组件中：

```typescript
// 检查用户权限
const hasPermission = (permissionCode: string, action: 'create' | 'read' | 'update' | 'delete' | 'approve') => {
  // 从用户角色信息中检查权限
  // action 对应 role_permissions 表中的 can_create, can_read, can_update, can_delete, can_approve
};

// 删除操作示例
const handleDelete = async (id: string) => {
  if (!hasPermission('project', 'delete')) {
    alert('您没有删除权限，请联系超级管理员');
    return;
  }
  // 执行删除操作
};
```

---

## 三、部署检查清单

### 3.1 数据库检查

- [ ] RDS 实例状态正常
- [ ] 自动备份策略已启用
- [ ] 备份保留周期设置为7天
- [ ] 备份时间设置为凌晨2点
- [ ] 手动执行一次备份验证成功

### 3.2 权限配置检查

- [ ] 6个角色已创建（super_admin, finance, project_manager, material_staff, labor_staff, supplier）
- [ ] 24个权限已配置
- [ ] 角色权限关联正确
- [ ] RLS 策略已启用
- [ ] 超级管理员可删除数据验证通过

### 3.3 安全检查

- [ ] 数据库访问白名单已配置
- [ ] SSL 加密连接已启用
- [ ] 敏感数据已加密存储
- [ ] 审计日志已开启

### 3.4 应用部署检查

- [ ] 前端构建成功 (pnpm run build)
- [ ] 生产环境配置正确
- [ ] 静态资源 CDN 配置完成
- [ ] 域名 SSL 证书有效

---

## 四、环境变量配置

### 4.1 前端环境变量

在项目根目录创建 `.env.production` 文件：

```bash
# Meoo Cloud 配置（自动注入，无需手动配置）
# VITE_APP_TITLE=建筑工程企业内部管理平台
# VITE_APP_VERSION=1.0.0

# 可选：自定义分析工具
# VITE_GA_ID=UA-XXXXXXXXX-X
```

### 4.2 后端 Edge Functions 环境变量

通过 CloudListFunctions 查看可用环境变量，代码中使用：

```typescript
const apiKey = Deno.env.get('SUPABASE_ANON_KEY');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
```

---

## 五、CDN 与静态资源部署

### 5.1 阿里云 OSS 配置

#### 操作路径
阿里云控制台 → 对象存储 OSS → 创建 Bucket → 配置跨域和缓存策略

#### Bucket 配置

| 配置项 | 推荐值 |
|--------|--------|
| 存储类型 | 标准存储 |
| 区域 | 与 ECS 同区域 |
| 读写权限 | 公共读 |
| 缓存策略 | CDN 节点缓存 7 天 |

#### Terraform 脚本示例

```hcl
resource "alicloud_oss_bucket" "example" {
  bucket = "construction-erp-assets"
  acl    = "public-read"
}

resource "alicloud_oss_bucket_policy" "example" {
  bucket = alicloud_oss_bucket.example.id
  policy = jsonencode({
    "Statement" = [{
      "Action"   = ["oss:GetObject"],
      "Effect"   = "Allow",
      "Principal" = ["*"],
      "Resource" = ["acs:oss:*:*:construction-erp-assets/*"]
    }]
  })
}
```

### 5.2 阿里云 CDN 配置

#### 操作路径
阿里云控制台 → CDN → 添加域名 → 配置源站和缓存规则

#### CDN 配置参数

| 配置项 | 推荐值 |
|--------|--------|
| 加速区域 | 国内+海外 |
| 业务类型 | 静态加速 |
| 源站类型 | OSS 域名 |
| 缓存过期规则 | .js/.css: 1月，图片: 7天 |
| 防盗链 | 开启 Referer 白名单 |
| HTTPS | 开启 SSL 证书 |

---

## 六、域名与 SSL 证书配置

### 6.1 域名解析

#### 操作路径
阿里云控制台 → 云解析 DNS → 选择域名 → 添加解析记录

#### 记录配置

| 记录类型 | 主机记录 | 记录值 |
|----------|----------|--------|
| CNAME | www | your-cdn-domain.aliyuncs.com |
| A | @ | 你的 ECS 公网 IP |

### 6.2 SSL 证书申请与部署

#### 操作路径
阿里云控制台 → SSL 证书 → 购买证书 → 申请免费证书 → 部署到 CDN/ALB

#### 证书要求

- 证书格式：PEM
- 私钥格式：PEM
- 证书链：完整包含中间证书
- 有效期：免费证书 1 年

#### Terraform 脚本示例

```hcl
resource "alicloud_cloud_ssl_certificate" "example" {
  certificate_name = "construction-erp-ssl"
  certificate      = file("./ssl/server.crt")
  private_key      = file("./ssl/server.key")
}
```

---

## 七、监控与告警配置

### 7.1 云监控配置

#### 操作路径
阿里云控制台 → 云监控 → 应用分组 → 添加告警规则

#### 监控指标

| 监控项 | 阈值 | 告警方式 |
|--------|------|----------|
| CPU 使用率 | > 80% | 短信+邮件 |
| 内存使用率 | > 85% | 短信+邮件 |
| 磁盘使用率 | > 90% | 短信+邮件 |
| RDS 连接数 | > 80% | 短信+邮件 |
| CDN 命中率 | < 90% | 邮件 |

### 7.2 自定义业务告警

通过 Edge Functions 实现业务告警：

```typescript
// 印章超期预警检测
Deno.serve(async (req) => {
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const today = new Date().toISOString().split('T')[0];

  // 检测超期未归还的印章
  const { data } = await supabaseAdmin
    .from('seal_usage_records')
    .select('*')
    .eq('status', 'active')
    .lt('expected_return_date', today);

  if (data && data.length > 0) {
    // 写入预警表或发送通知
    await supabaseAdmin.from('warnings').insert(
      data.map(r => ({
        warning_type: '印章外借',
        content: `印章外借超期未归还: ${r.usage_reason}`,
        urgent: true
      }))
    );
  }

  return new Response(JSON.stringify({ count: data?.length || 0 }));
});
```

---

## 八、日志配置

### 8.1 应用日志

#### 前端日志收集

```typescript
// 错误上报
window.onerror = (message, source, lineno, colno, error) => {
  console.error('[Global Error]', { message, source, lineno, colno, error });
};

// Promise 异常捕获
window.onunhandledrejection = (event) => {
  console.error('[Unhandled Rejection]', event.reason);
};
```

#### 后端日志（Edge Functions）

```typescript
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  level: 'INFO',
  message: 'Function invoked',
  body: await req.json()
}));
```

### 8.2 数据库审计日志

```sql
-- 开启审计日志
CREATE EXTENSION IF NOT EXISTS pg_audit;

-- 创建审计日志表
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  user_id UUID,
  ip_address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 审计触发器示例
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO audit_logs (table_name, operation, old_values, new_values)
  VALUES (TG_TABLE_NAME, TG_OP, row_to_json(OLD), row_to_json(NEW));
  RETURN NEW;
END;
$$;
```

---

## 九、性能优化配置

### 9.1 前端优化

| 优化项 | 配置 |
|--------|------|
| 代码分割 | Webpack 自动按路由分割 |
| 资源压缩 | Gzip + Brotli |
| 图片优化 | WebP 格式 + CDN 加速 |
| 缓存策略 | 静态资源长期缓存 |

### 9.2 数据库优化

```sql
-- 常用索引创建
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_seal_usage_status ON seal_usage_records(status, expected_return_date);
CREATE INDEX IF NOT EXISTS idx_invoices_project ON cost_invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payment_records(invoice_id);
```

### 9.3 连接池配置

```hcl
# RDS 连接池配置
resource "alicloud_rds_parameter_group" "example" {
  name   = "connection-pool"
  type   = "MySQL"
  parameters {
    name  = "max_connections"
    value = "200"
  }
}
```

---

## 十、灾备与恢复

### 10.1 恢复演练

| 演练项目 | 周期 | 负责人 |
|----------|------|--------|
| 数据库恢复演练 | 季度 | DBA |
| 文件恢复演练 | 半年 | 运维 |
| 全链路切换演练 | 年度 | 技术负责人 |

### 10.2 恢复步骤

```bash
# 1. 下载最新备份
aliyun rds RestoreDBInstance \
  --DBInstanceId rm-xxxx \
  --BackupId 123456 \
  --TargetInstanceId rm-restored

# 2. 验证数据完整性
psql -h rm-xxxx.mysql.rds.aliyuncs.com -U admin -d erp_db -c "SELECT COUNT(*) FROM projects;"

# 3. 切换应用连接
# 更新应用配置中的数据库地址
```

---

## 十一、部署检查清单（完整版）

### 11.1 数据库检查

- [ ] RDS 实例状态正常
- [ ] 自动备份策略已启用
- [ ] 备份保留周期设置为7天
- [ ] 备份时间设置为凌晨2点
- [ ] 手动执行一次备份验证成功
- [ ] 常用索引已创建

### 11.2 权限配置检查

- [ ] 6个角色已创建（super_admin, finance, project_manager, material_staff, labor_staff, supplier）
- [ ] 24个权限已配置
- [ ] 角色权限关联正确
- [ ] RLS 策略已启用
- [ ] 超级管理员可删除数据验证通过

### 11.3 安全检查

- [ ] 数据库访问白名单已配置
- [ ] SSL 加密连接已启用
- [ ] 敏感数据已加密存储
- [ ] 审计日志已开启
- [ ] CDN 防盗链已配置

### 11.4 应用部署检查

- [ ] 前端构建成功 (pnpm run build)
- [ ] 生产环境配置正确
- [ ] 静态资源 CDN 配置完成
- [ ] 域名 SSL 证书有效
- [ ] 环境变量配置正确

### 11.5 监控告警检查

- [ ] 云监控告警规则已配置
- [ ] 业务告警（印章超期等）已实现
- [ ] 告警通知渠道已验证

### 11.6 容灾演练检查

- [ ] 数据库恢复流程已文档化
- [ ] 恢复演练记录完整

---

## 十二、数据库迁移约定

**⚠️ 重要：所有团队成员必须遵守**

数据库迁移文件必须使用 **14位完整时间戳** 格式，禁止使用8位短时间戳，以避免版本号冲突。

详细约定请参阅：[数据库迁移约定](./DATABASE_MIGRATION_CONVENTIONS.md)

### 快速参考

| 项目 | 说明 |
|------|------|
| ❌ 禁止格式 | `20260513_fix_operation_logs.sql` |
| ✅ 正确格式 | `20260513000000_fix_operation_logs.sql` |
| 推荐方式 | 使用 `npx supabase migration new name` 自动生成 |

## 十三、相关文件索引

| 文件 | 说明 |
|------|------|
| [DATABASE_MIGRATION_CONVENTIONS.md](./DATABASE_MIGRATION_CONVENTIONS.md) | ⭐ 数据库迁移约定（必读） |
| migrations/20260425_061614_rbac_permissions.sql | RBAC 权限数据库结构 |
| migrations/20260425_053137_create_erp_tables.sql | 核心业务表结构 |
| src/supabase/client.ts | 数据库客户端 |
| src/pages/Seals.tsx | 印章管理模块 |
| src/pages/Finance.tsx | 财务管理模块 |
| package.json | 项目依赖配置 |
| webpack.config.js | 构建配置 |
| tailwind.config.js | 样式配置 |
