# API 端点文档与 HTTP 方法配置报告

**文档版本**：v1.0  
**编制日期**：2026-05-19  
**项目名称**：建筑工程管理系统  

---

## 一、文档概述

### 1.1 文档目的

本报告旨在全面记录系统中使用的所有 API 端点及其 HTTP 方法配置，识别潜在的配置不匹配问题，并提供优化建议。

### 1.2 范围

- Supabase 数据库 API
- Supabase Storage API
- Supabase Edge Functions
- 本地 Edge Functions
- Nginx 反向代理配置

---

## 二、系统架构

### 2.1 技术栈概览

| 组件 | 技术选型 | 版本 |
|-----|---------|-----|
| 前端框架 | React | 18.2.0 |
| 后端即服务 | Supabase | - |
| 数据库 | PostgreSQL (via Supabase) | - |
| 存储 | Supabase Storage | - |
| 认证 | Supabase Auth | - |
| Web 服务器 | Nginx | - |
| Edge Functions | Supabase / 本地 Deno | - |

### 2.2 请求流程

```
浏览器 → Nginx → Supabase API
            ↓
      本地 Edge Functions (contract-convert)
```

---

## 三、API 端点清单

### 3.1 Supabase REST API

#### 3.1.1 数据库操作

**基础 URL**：`/sb-api/rest/v1/`

| 端点路径 | HTTP 方法 | 操作 | 代码位置 | 状态 |
|---------|----------|------|---------|------|
| `/projects` | GET | 查询项目列表 | `InvoiceEntry.tsx` | ✅ 正常 |
| `/projects` | POST | 创建项目 | `useApi.tsx` | ✅ 正常 |
| `/projects/:id` | GET | 获取项目详情 | `userService.ts` | ✅ 正常 |
| `/projects/:id` | PATCH | 更新项目 | `useApi.tsx` | ✅ 正常 |
| `/projects/:id` | DELETE | 删除项目 | `useApi.tsx` | ✅ 正常 |
| `/party_b` | GET | 查询乙方单位 | `InvoiceEntry.tsx` | ✅ 正常 |
| `/party_b` | POST | 创建乙方单位 | `InvoiceEntry.tsx` | ✅ 正常 |
| `/party_b` | PATCH | 更新乙方单位 | `useApi.tsx` | ✅ 正常 |
| `/cost_invoices` | GET | 查询成本发票 | `InvoiceEntry.tsx` | ✅ 正常 |
| `/cost_invoices` | POST | 创建成本发票 | `InvoiceEntry.tsx` | ✅ 正常 |
| `/cost_invoices` | PATCH | 更新成本发票 | `InvoiceEntry.tsx` | ✅ 正常 |
| `/cost_invoices` | DELETE | 删除成本发票 | `useApi.tsx` | ✅ 正常 |
| `/suppliers` | GET | 查询供应商 | `InvoiceEntry.tsx` | ✅ 正常 |
| `/suppliers` | POST | 创建供应商 | `InvoiceEntry.tsx` | ✅ 正常 |
| `/suppliers` | PATCH | 更新供应商 | `useApi.tsx` | ✅ 正常 |
| `/users` | GET | 查询用户列表 | `userService.ts` | ✅ 正常 |
| `/users/:id` | GET | 获取用户详情 | `userService.ts` | ✅ 正常 |
| `/approvals` | GET | 查询审批列表 | `approvalService.ts` | ✅ 正常 |
| `/approvals` | POST | 创建审批 | `approvalService.ts` | ✅ 正常 |
| `/approvals/:id` | PATCH | 更新审批状态 | `approvalService.ts` | ✅ 正常 |
| `/approval_records` | GET | 查询审批记录 | `approvalService.ts` | ✅ 正常 |
| `/approval_records` | POST | 创建审批记录 | `approvalService.ts` | ✅ 正常 |
| `/approval_steps` | GET | 查询审批步骤 | `approvalService.ts` | ✅ 正常 |

#### 3.1.2 Storage 操作

**基础 URL**：`/sb-api/storage/v1/`

| 端点路径 | HTTP 方法 | 操作 | 代码位置 | 状态 |
|---------|----------|------|---------|------|
| `/object/files/:path` | POST | 上传文件 | `InvoiceEntry.tsx` | ✅ 正常 |
| `/object/files/:path` | GET | 下载文件 | `InvoiceEntry.tsx` | ✅ 正常 |
| `/object/files/:path` | DELETE | 删除文件 | Storage API | ✅ 正常 |
| `/sign/files/:path` | POST | 创建签名URL | Storage API | ⚠️ 需验证 |

### 3.2 Supabase Edge Functions

**基础 URL**：`/supabase/functions/v1/`

| 函数名称 | HTTP 方法 | 描述 | 状态 |
|---------|----------|------|------|
| `contract-document-convert` | POST | 合同文档转换 | ✅ 正常 |
| `*` (其他) | GET/POST | 通配符匹配 | ⚠️ 配置限制 |

### 3.3 本地 Edge Functions

**基础 URL**：`/api/contract-convert/`

| 函数名称 | HTTP 方法 | 描述 | 端口 | 状态 |
|---------|----------|------|------|------|
| `*` | GET/POST | 文档转换 | 8788 | ✅ 正常 |

### 3.4 ONLYOFFICE 回调

**基础 URL**：`/api/onlyoffice-callback/`

| 端点 | HTTP 方法 | 描述 | 状态 |
|-----|----------|------|------|
| `/callback` | POST | ONLYOFFICE 编辑器回调 | ✅ 正常 |

---

## 四、Nginx 配置分析

### 4.1 当前配置（修复前）

#### `/sb-api/` 路径配置

```nginx
location /sb-api/ {
    rewrite ^/sb-api/(.*)$ /$1 break;
    proxy_pass https://wlkrdylgojkhgfzvcagc.supabase.co;
    # ... 其他代理配置
}
```

**评估**：✅ 无方法限制，直接代理到 Supabase。

#### `/supabase/functions/v1/` 路径配置

```nginx
location /supabase/functions/v1/ {
    # CORS preflight
    if ($request_method = OPTIONS) {
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
        return 204;
    }
    # ... 代理到本地 8789 端口
}
```

**问题**：⚠️ CORS 头限制为 `GET, POST, OPTIONS`，但未限制实际请求方法。

#### `/api/contract-convert/` 路径配置

```nginx
location /api/contract-convert/ {
    # CORS preflight
    if ($request_method = OPTIONS) {
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
        return 204;
    }
    # ... 代理到本地 8788 端口
}
```

**问题**：⚠️ CORS 头限制为 `GET, POST, OPTIONS`，但未限制实际请求方法。

### 4.2 CORS 配置矩阵

| 路径 | 当前允许方法 | 最小需求 | 建议配置 | 优先级 |
|-----|------------|---------|---------|-------|
| `/sb-api/` | 无限制 | GET, POST, PUT, PATCH, DELETE | 保持无限制 | - |
| `/supabase/functions/v1/` | GET, POST, OPTIONS | GET, POST, PUT, PATCH, DELETE | GET, POST, PUT, PATCH, DELETE, OPTIONS | 高 |
| `/api/contract-convert/` | GET, POST, OPTIONS | GET, POST, OPTIONS | GET, POST, PUT, PATCH, DELETE, OPTIONS | 中 |
| `/api/onlyoffice-callback/` | 无 CORS 头 | POST | POST + CORS | 低 |

---

## 五、Supabase API 方法映射

### 5.1 Supabase JS 客户端方法

| 客户端方法 | 实际 HTTP 方法 | 描述 |
|-----------|--------------|------|
| `.select()` | GET | 查询数据 |
| `.insert()` | POST | 插入数据 |
| `.update()` | PATCH | 更新数据（部分更新） |
| `.upsert()` | POST 或 PUT | 插入或更新 |
| `.delete()` | DELETE | 删除数据 |
| `.rpc()` | POST | 调用远程函数 |

### 5.2 Storage API 方法

| 客户端方法 | HTTP 方法 | 描述 |
|-----------|----------|------|
| `upload()` | POST | 上传文件 |
| `download()` | GET | 下载文件 |
| `remove()` | DELETE | 删除文件 |
| `move()` | POST | 移动文件 |
| `copy()` | POST | 复制文件 |
| `createSignedUrl()` | POST | 创建签名 URL |

### 5.3 潜在问题识别

| 场景 | 可能使用的 HTTP 方法 | 当前配置 | 是否支持 |
|-----|---------------------|---------|---------|
| 批量插入 | POST | ✅ | 是 |
| 部分更新 | PATCH | ✅ | 是 |
| 完整替换 | PUT | ⚠️ | 可能受限 |
| 文件删除 | DELETE | ⚠️ | 可能受限 |
| 签名 URL | POST | ✅ | 是 |

---

## 六、问题与风险

### 6.1 已识别问题

| 问题编号 | 问题描述 | 严重程度 | 状态 |
|---------|---------|---------|------|
| API-001 | CORS 头限制过多 HTTP 方法 | 中 | 待修复 |
| API-002 | 405 错误频繁出现 | 中 | 待修复 |
| API-003 | 日志监控缺失 | 低 | 待实现 |

### 6.2 风险评估

| 风险项 | 可能性 | 影响程度 | 风险等级 | 缓解措施 |
|-------|-------|---------|---------|---------|
| CORS 阻止 PUT/PATCH/DELETE | 中 | 高 | 中 | 扩展 CORS 方法 |
| Edge Functions 调用失败 | 低 | 中 | 低 | 配置重试机制 |
| 配置错误导致服务中断 | 低 | 高 | 中 | 备份和回滚方案 |

---

## 七、建议与优化

### 7.1 短期优化（1-2周）

1. **修复 CORS 配置**
   - 扩展允许的 HTTP 方法
   - 添加详细的 CORS 头

2. **添加日志监控**
   - 配置 Nginx 错误日志分析
   - 设置告警阈值

3. **完善错误处理**
   - 前端添加 API 错误提示
   - 实现请求重试机制

### 7.2 中期优化（1-3月）

1. **API 版本管理**
   - 引入 API 版本控制
   - 维护 API 变更日志

2. **性能优化**
   - 添加请求缓存
   - 优化数据库查询

3. **安全加固**
   - 添加速率限制
   - 增强认证机制

### 7.3 长期规划（3-6月）

1. **监控体系**
   - 集成 Prometheus/Grafana
   - 实现实时监控面板

2. **自动化运维**
   - 配置即代码
   - 自动化部署

---

## 八、测试计划

### 8.1 CORS 测试用例

| 用例编号 | 端点 | HTTP 方法 | 预期结果 | 状态 |
|---------|-----|---------|---------|------|
| CORS-001 | `/supabase/functions/v1/*` | GET | ✅ 成功 | 待测试 |
| CORS-002 | `/supabase/functions/v1/*` | POST | ✅ 成功 | 待测试 |
| CORS-003 | `/supabase/functions/v1/*` | PUT | ✅ 成功 | 待测试 |
| CORS-004 | `/supabase/functions/v1/*` | PATCH | ✅ 成功 | 待测试 |
| CORS-005 | `/supabase/functions/v1/*` | DELETE | ✅ 成功 | 待测试 |
| CORS-006 | `/supabase/functions/v1/*` | OPTIONS | ✅ 204 | 待测试 |
| CORS-007 | `/api/contract-convert/*` | GET | ✅ 成功 | 待测试 |
| CORS-008 | `/api/contract-convert/*` | POST | ✅ 成功 | 待测试 |

### 8.2 API 功能测试

| 用例编号 | 功能 | 操作 | 预期结果 | 状态 |
|---------|-----|------|---------|------|
| API-FUNC-001 | 查询项目 | GET /projects | 返回项目列表 | 待测试 |
| API-FUNC-002 | 创建项目 | POST /projects | 创建成功 | 待测试 |
| API-FUNC-003 | 更新项目 | PATCH /projects/:id | 更新成功 | 待测试 |
| API-FUNC-004 | 删除项目 | DELETE /projects/:id | 删除成功 | 待测试 |
| API-FUNC-005 | 文件上传 | POST Storage | 上传成功 | 待测试 |
| API-FUNC-006 | 文档转换 | POST Edge Function | 转换成功 | 待测试 |

---

## 九、附录

### A. 相关文件清单

| 文件路径 | 描述 | 重要性 |
|---------|-----|-------|
| `/www/wwwroot/ciond/nginx-full.conf` | 主 Nginx 配置 | ⭐⭐⭐⭐⭐ |
| `/www/wwwroot/ciond/nginx-ocr-complete.conf` | OCR 相关配置 | ⭐⭐⭐ |
| `/www/wwwroot/ciond/scripts/nginx-supabase-functions-snippet.conf` | Supabase Functions 配置 | ⭐⭐⭐⭐ |
| `/www/wwwroot/ciond/scripts/nginx-contract-convert-proxy.conf` | 文档转换代理配置 | ⭐⭐⭐ |
| `/www/wwwroot/ciond/scripts/nginx-onlyoffice-callback-snippet.conf` | ONLYOFFICE 回调配置 | ⭐⭐⭐ |

### B. Supabase 配置信息

| 配置项 | 值 | 说明 |
|-----|---|-----|
| Project ID | wlkrdylgojkhgfzvcagc | Supabase 项目标识 |
| API URL | https://wlkrdylgojkhgfzvcagc.supabase.co | REST API 基础 URL |
| Storage URL | https://wlkrdylgojkhgfzvcagc.supabase.co/storage/v1 | Storage API URL |
| Edge Functions URL | https://wlkrdylgojkhgfzvcagc.supabase.co/functions/v1 | Edge Functions URL |

### C. 日志文件位置

| 文件路径 | 描述 | 格式 |
|---------|-----|-----|
| `/www/wwwlogs/www.ciond.com.log` | 访问日志 | 标准格式 |
| `/www/wwwlogs/www.ciond.com.error.log` | 错误日志 | 标准格式 |

### D. 参考资料

- [Nginx HttpProxyModule](http://nginx.org/en/docs/http/ngx_http_proxy_module.html)
- [Supabase REST API](https://supabase.com/docs/guides/api)
- [MDN HTTP Methods](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods)
- [CORS 跨域资源共享](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

---

**文档维护**：

| 版本 | 日期 | 修改人 | 修改内容 |
|-----|-----|-------|---------|
| v1.0 | 2026-05-19 | 技术支持团队 | 初始版本 |

---

**报告编制人**：技术支持团队  
**审核人**：待定  
**批准人**：待定  
**文档版本**：v1.0
