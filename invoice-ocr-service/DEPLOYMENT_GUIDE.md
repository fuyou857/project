# Invoice OCR Service 部署指南

## 服务概述

本服务已迁移至 **腾讯云OCR服务**，替代原有的PaddleOCR本地识别方案。

### 服务架构
- **配置层**：管理腾讯云密钥、请求超时、重试策略等
- **图片工具层**：图片预处理、压缩、Base64转换、PDF/OFD解析
- **OCR请求层**：调用腾讯云OCR API（增值税发票识别、通用发票识别）
- **结果解析层**：将腾讯云返回结果映射为系统标准字段
- **接口服务层**：提供RESTful API，保持与原有接口兼容

### 支持的OCR识别
| API名称 | 用途 | 优先级 |
|---------|------|--------|
| VatInvoiceOCR | 增值税发票识别 | 1（优先） |
| InvoiceOCR | 通用发票识别 | 2（兜底） |
| GeneralBasicOCR | 通用文字识别 | 3（最终兜底） |

## 部署步骤

### 1. 环境准备
```bash
# 1. 进入项目目录
cd /www/wwwroot/ciond/invoice-ocr-service

# 2. 创建虚拟环境（可选但推荐）
python3.8 -m venv .venv

# 3. 激活虚拟环境
source .venv/bin/activate

# 4. 更新pip和基础工具
pip install -U pip setuptools wheel
```

### 2. 安装依赖
```bash
# 安装所有依赖（包括腾讯云SDK）
pip install -r requirements.txt -i https://mirrors.aliyun.com/pypi/simple
```

### 3. 配置环境变量
```bash
# 复制示例配置文件
cp .env.example .env

# 根据实际需求修改配置（必须配置腾讯云密钥）
vi .env
```

**关键配置说明**：

| 配置项 | 说明 | 必填 |
|--------|------|------|
| TENCENTCLOUD_SECRET_ID | 腾讯云API密钥ID | ✅ |
| TENCENTCLOUD_SECRET_KEY | 腾讯云API密钥Key | ✅ |
| TENCENTCLOUD_REGION | 腾讯云区域（如ap-guangzhou） | ✅ |
| OCR_REQUEST_TIMEOUT | 请求超时时间（秒） | 否（默认60） |
| OCR_RETRY_TIMES | 重试次数 | 否（默认3） |
| OCR_MAX_IMAGE_SIZE | 最大图片大小（字节） | 否（默认4MB） |

### 4. 启动服务

#### 方式1：直接运行（开发环境）
```bash
./run-prod.sh
```

#### 方式2：使用systemd管理（生产环境推荐）
```bash
# 复制服务配置文件
sudo cp invoice-ocr.service /etc/systemd/system/

# 重新加载systemd配置
sudo systemctl daemon-reload

# 启动服务
sudo systemctl start invoice-ocr

# 设置开机自启
sudo systemctl enable invoice-ocr

# 查看服务状态
sudo systemctl status invoice-ocr

# 查看日志
sudo journalctl -u invoice-ocr -f
```

## 验证服务

### 健康检查
```bash
curl -X GET http://localhost:8810/health
# 预期返回: {"status":"ok","message":"配置验证通过","ocr_provider":"tencent_cloud"}
```

### 监控指标
```bash
curl -X GET http://localhost:8810/metrics
# 预期返回服务监控指标JSON
```

### 发票OCR识别
```bash
curl -X POST http://localhost:8810/api/invoice/ocr \
  -F "file=@test_invoice.jpg"
# 预期返回识别结果JSON
```

## API接口说明

### POST /api/invoice/ocr

**请求参数**：
- `file`: 发票文件（支持PDF、JPG、PNG、OFD格式）

**响应结构**：
```json
{
  "code": 200,
  "message": "识别成功",
  "data": {
    "invoice_code": "发票代码",
    "invoice_number": "发票号码",
    "invoice_date": "开票日期",
    "service_name": "服务名称",
    "goods_name": "商品名称",
    "amount_exclude_tax": "不含税金额",
    "tax_rate": "税率",
    "tax_amount": "税额",
    "total_amount": "价税合计",
    "seller_name": "销售方名称",
    "seller_tax_id": "销售方税号",
    "buyer_name": "购买方名称",
    "buyer_tax_id": "购买方税号",
    "remark": "备注"
  }
}
```

## 错误处理

服务实现了完善的错误处理机制：

| 错误类型 | HTTP状态码 | 处理方式 |
|----------|-----------|----------|
| 配置错误 | 500 | 返回配置验证失败信息 |
| 文件类型不支持 | 500 | 返回支持的文件类型列表 |
| 文件过大 | 500 | 返回最大允许大小 |
| 网络超时 | 500 | 返回超时提示，建议优化图片 |
| OCR API失败 | 500 | 返回错误详情，自动重试 |

## 性能优化建议

1. **增加超时时间**：对于大型文件，可以在 `.env` 中增加 `OCR_PROCESS_TIMEOUT_SEC` 参数

2. **使用进程管理器**：生产环境建议使用 `systemd` 管理服务

3. **日志管理**：定期清理日志文件，或配置日志轮转

4. **连接池优化**：腾讯云SDK内部已优化连接复用

## 故障排查

### 常见问题

1. **服务启动失败**：
   - 检查Python版本（需要3.8+）
   - 检查依赖是否安装完整
   - 查看日志文件获取详细错误信息

2. **文件上传失败**：
   - 检查文件类型是否在允许列表中
   - 检查文件大小是否超过限制
   - 查看服务日志获取详细错误信息

3. **OCR识别失败**：
   - 检查图片质量是否清晰
   - 检查腾讯云密钥配置是否正确
   - 检查网络连接是否正常
   - 查看服务日志获取详细错误信息

### 日志查看

```bash
# 使用systemd时查看日志
sudo journalctl -u invoice-ocr -f

# 直接运行时查看控制台输出
```

## 注意事项

1. **不要提交敏感信息**：确保 `.env` 文件中的敏感信息不会被提交到Git
2. **定期更新依赖**：定期更新Python依赖包以获得最新的安全补丁和功能
3. **监控服务状态**：定期检查服务状态和监控指标，确保服务正常运行
4. **腾讯云API费用**：使用腾讯云OCR服务会产生API调用费用，请关注费用账单
5. **密钥安全**：建议使用腾讯云密钥管理服务(KMS)管理密钥，或使用角色授权

## 联系信息

如有问题，请联系技术支持团队。
