# 合同转换服务问题修复指南

## 问题诊断

**问题描述**: 前端页面报错：
`error sending request for url (http://contract-convert:8788/invoke): client error (Connect): dns error: failed to lookup address information: Name or service not known`

**根本原因**：
- Supabase 云端的 Edge Functions 无法解析 Docker 内部网络的服务名 `contract-convert`
- 当前架构：浏览器 → Supabase Edge Functions → Docker 内部服务

## 解决方案

### 方案一：本地 Node.js 服务替代 Supabase Edge Functions（推荐）

我们已经为您创建了完整的本地服务解决方案。请按以下步骤操作：

#### 1. 安装本地服务依赖
```bash
cd /www/wwwroot/ciond
# 创建临时目录安装本地服务
mkdir -p local-services
cd local-services
cp ../package-local-services.json package.json
npm install
```

#### 2. 启动本地 contract-convert 服务

首先，我们需要确保 contract-convert 服务正在运行。由于 Docker 方式（或者直接用 Python 运行：

**方式 A：使用 Python 直接运行（更简单）
```bash
cd /www/wwwroot/ciond/contract-convert-service
# 首先安装 Python 依赖
pip install -r requirements.txt
# 运行服务
uvicorn app.main:app --host 0.0.0.0 --port 8788
```

**方式 B：如果您有 Docker 可用**
```bash
cd /www/wwwroot/ciond
# 检查并启动 Docker 服务
docker compose up -d contract-convert
```

#### 3. 启动本地 Node.js 中间服务
```bash
cd /www/wwwroot/ciond
# 复制我们创建的服务到临时目录
# 复制本地服务文件
cp contract-document-convert-local.js local-services/
cd local-services
node contract-document-convert-local.js
```

#### 4. 更新 Nginx 配置并重启
我们已经更新了 nginx-full.conf 文件，现在您需要：

将该文件更新到实际 Nginx 配置目录并重启服务：

```bash
# 备份原配置
sudo cp /www/wwwroot/ciond/nginx-full.conf /www/server/panel/vhost/nginx/www.ciond.com.conf
# 或者您的 Nginx 配置位置可能有所不同，请根据实际情况替换

# 测试 Nginx 配置
sudo nginx -t

# 重启 Nginx
sudo nginx -s reload
```

### 方案二：暴露 contract-convert 服务到公网（备选方案）

如果您有公网 IP 和域名，可以直接暴露 contract-convert 服务：

1. 使用 Nginx 将 contract-convert 服务暴露到公网，然后修改 Edge Functions 配置通过公网访问。

### 方案三：使用本地 Supabase 函数（高级）

如果您使用本地 Supabase CLI 和 Docker 来运行 Edge Functions 本地版本。

## 我们创建的文件：

1. `nginx-full.conf 更新了，包含本地服务反向代理
2. `contract-document-convert-local.js本地 Node.js 中间服务
3. `package-local-services.json本地服务依赖配置

## 注意事项

- 在生产环境使用前，请确保：

1. 正确配置 `SUPABASE_SERVICE_ROLE_KEY`（不要硬编码在服务中
2. 确保安全配置安全配置安全配置安全配置安全配置安全配置安全配置安全配置
3. 仅在内网环境或受信任的网络中运行这些服务
4. 考虑添加适当的访问控制和身份验证
