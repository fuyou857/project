# 企业微信工作台对接 - 后端API接口文档

## 概述

本文档描述了建筑管理平台与企业微信工作台对接所需的后端API接口。

---

## 配置环境变量

在部署前，需要配置以下环境变量：

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| WECHAT_WORK_CORP_ID | 企业微信企业ID | wx1234567890abcdef |
| WECHAT_WORK_AGENT_ID | 自建应用ID | 1000001 |
| WECHAT_WORK_SECRET | 应用密钥 | abc123xyz789 |
| WECHAT_WORK_REDIRECT_URI | 授权回调地址 | https://your-domain.com/api/auth/wechat-work/callback |

---

## API接口列表

### 1. 企业微信登录接口

#### POST /api/auth/wechat-work/login

**功能描述**: 通过企业微信授权码完成登录

**请求体**:
```json
{
  "code": "string",
  "userInfo": {
    "userid": "string",
    "name": "string",
    "avatar": "string",
    "email": "string",
    "mobile": "string"
  }
}
```

**响应成功**:
```json
{
  "success": true,
  "message": "登录成功",
  "token": "string",
  "user": {
    "id": "string",
    "name": "string",
    "email": "string",
    "role": "string"
  }
}
```

**响应失败**:
```json
{
  "success": false,
  "message": "登录失败原因"
}
```

---

### 2. 企业微信授权回调接口

#### GET /api/auth/wechat-work/callback

**功能描述**: 企业微信授权回调地址，接收code参数

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| code | string | 是 | 临时授权码 |
| state | string | 否 | 状态值 |

**响应**:
- 成功：重定向到登录页面并携带code参数
- 失败：返回错误页面

---

### 3. 获取企业微信用户信息

#### GET /api/auth/wechat-work/user

**功能描述**: 根据code获取企业微信用户信息（内部调用）

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| code | string | 是 | 临时授权码 |

**响应成功**:
```json
{
  "success": true,
  "userInfo": {
    "userid": "string",
    "name": "string",
    "avatar": "string",
    "email": "string",
    "mobile": "string",
    "department": ["string"],
    "position": "string"
  }
}
```

---

## 后端实现流程

```
1. 用户点击企业微信登录按钮
2. 前端跳转到企业微信OAuth2授权页面
3. 用户扫码/确认授权后，企业微信回调到 /api/auth/wechat-work/callback
4. 后端获取code，调用企业微信API获取用户信息
5. 后端检查用户是否已存在于系统中
   - 存在：直接登录，生成JWT token
   - 不存在：自动创建用户（或返回需要绑定账号）
6. 后端返回登录结果给前端
7. 前端保存token并跳转到首页
```

---

## 企业微信API调用说明

### 获取访问令牌
```
GET https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=CORPID&corpsecret=SECRET
```

### 获取用户信息
```
GET https://qyapi.weixin.qq.com/cgi-bin/user/getuserinfo?access_token=ACCESS_TOKEN&code=CODE
```

### 获取用户详情
```
GET https://qyapi.weixin.qq.com/cgi-bin/user/get?access_token=ACCESS_TOKEN&userid=USERID
```

---

## 安全注意事项

1. **Token管理**: 企业微信access_token有效期为7200秒，建议缓存
2. **参数校验**: 所有输入参数必须进行严格校验
3. **日志记录**: 记录所有登录尝试，包括成功和失败
4. **HTTPS**: 所有接口必须使用HTTPS协议
5. **IP白名单**: 考虑配置企业微信IP白名单

---

## 用户映射策略

| 场景 | 处理方式 |
|------|----------|
| 用户首次通过企业微信登录 | 创建新用户，关联企业微信userid |
| 用户已存在，邮箱匹配 | 直接关联企业微信userid |
| 用户已存在，邮箱不匹配 | 提示用户绑定已有账号或联系管理员 |