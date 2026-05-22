# OCR 服务识别失败排查指南

## 问题描述

用户在上传发票后，看到错误信息：
```
识别失败：无法提取有效发票信息
识别日志：
[00:54:42] 识别失败：无法提取有效发票信息
[00:54:40] 开始调用本地 OCR 服务
[00:54:37] 上传 1 个发票文件
```

## 可能原因分析

### 1. 发票文件问题（最常见）
- ❌ 上传的不是增值税发票（可能是收据、订单、合同等）
- ❌ 发票图片不清晰、模糊
- ❌ 发票文件损坏或格式不支持
- ❌ 文件过大（超过12MB）

### 2. 网络问题
- ❌ 浏览器无法访问 `https://ocr.ciond.com`
- ❌ 防火墙阻止了请求
- ❌ CORS 跨域问题

### 3. 后端服务问题
- ❌ 后端服务未启动
- ❌ 腾讯云 API 密钥配置错误
- ❌ 腾讯云 API 调用失败

## 排查步骤

### ✅ 第一步：检查浏览器控制台日志

1. 打开浏览器开发者工具（F12）
2. 切换到 **Console（控制台）** 标签
3. 上传发票文件
4. **应该看到以下日志**：
   ```
   [invoiceOcr] POST (Tencent Cloud) https://ocr.ciond.com/api/invoice/ocr 文件名.pdf 文件大小
   ```
5. **应该看到识别结果**：
   ```
   [invoiceOcr] 识别结果（腾讯云） { ... }
   ```

**如果看到这些日志，说明前端正在正确调用腾讯云 OCR 服务！**

### ✅ 第二步：检查网络请求

1. 切换到 **Network（网络）** 标签
2. 筛选条件输入 `ocr`
3. 上传发票文件
4. **应该看到请求**：
   - URL: `https://ocr.ciond.com/api/invoice/ocr`
   - Method: POST
   - Status: 200

**如果状态不是 200，检查响应内容**

### ✅ 第三步：测试后端服务

在服务器上运行：

```bash
# 检查服务状态
curl http://localhost:8810/health

# 测试识别（使用测试PDF）
cd /www/wwwroot/ciond
python test_ocr_api.py
```

**期望结果**：
```json
{
  "code": 200,
  "message": "识别成功",
  "data": {...}
}
```

### ✅ 第四步：验证发票文件

**支持的文件格式**：
- ✅ JPG / JPEG
- ✅ PNG
- ✅ PDF
- ✅ OFD

**不支持的文件**：
- ❌ 收据
- ❌ 订单截图
- ❌ 合同文件
- ❌ Word 文档
- ❌ Excel 表格

**发票类型要求**：
- ✅ 增值税普通发票
- ✅ 增值税专用发票
- ✅ 增值税电子发票
- ✅ 增值税卷式发票

**不支持的发票**：
- ❌ 通用机打发票
- ❌ 出租车票
- ❌ 火车票
- ❌ 飞机票
- ❌ 购物小票

### ✅ 第五步：检查发票图片质量

**清晰的发票图片应该**：
- ✅ 文字清晰可读
- ✅ 金额数字清晰
- ✅ 发票章印可见
- ✅ 分辨率足够（建议至少 300 DPI）

**模糊的发票图片应该**：
- ❌ 避免使用手机拍摄的模糊照片
- ❌ 避免使用扫描质量差的图片
- ❌ 避免使用过度压缩的图片

## 快速诊断清单

请逐一检查以下项目：

- [ ] **发票类型**：上传的是增值税发票吗？（不是收据）
- [ ] **文件格式**：是 JPG/PNG/PDF/OFD 吗？
- [ ] **文件大小**：小于 12MB 吗？
- [ ] **图片清晰度**：文字清晰可读吗？
- [ ] **浏览器控制台**：有 `[invoiceOcr] POST (Tencent Cloud)` 日志吗？
- [ ] **网络请求**：请求 URL 是 `https://ocr.ciond.com/api/invoice/ocr` 吗？
- [ ] **响应状态**：HTTP 状态是 200 吗？
- [ ] **后端服务**：`curl http://localhost:8810/health` 返回正常吗？

## 获取帮助

如果以上步骤都无法解决问题，请提供以下信息：

1. **浏览器控制台日志截图**（F12 → Console）
2. **网络请求截图**（F12 → Network → 筛选 ocr）
3. **发票文件**（或者发票文件的信息：类型、大小、格式）
4. **完整的错误信息**

## 服务状态检查命令

```bash
# 1. 检查后端服务是否运行
ps aux | grep uvicorn

# 2. 检查端口是否监听
netstat -tlnp | grep 8810

# 3. 健康检查
curl http://localhost:8810/health

# 4. 查看服务日志
cd /www/wwwroot/ciond/invoice-ocr-service
tail -50 logs/service.log

# 5. 重启服务（如需要）
pkill -f "uvicorn.*8810"
cd /www/wwwroot/ciond/invoice-ocr-service
nohup uvicorn app.main:app --host 0.0.0.0 --port 8810 --log-level debug > logs/service.log 2>&1 &
```
