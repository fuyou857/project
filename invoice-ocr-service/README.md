# 发票 OCR 服务（腾讯云 VatInvoiceOCR 专用）

基于 **腾讯云 VatInvoiceOCR 接口**的独立 HTTP 服务，专门用于增值税发票识别。

## 重要说明

- **已完全移除本地 OCR 引擎**，所有识别任务均由腾讯云 VatInvoiceOCR 接口处理
- **已精简依赖**，移除了不需要的本地 OCR 相关库
- **保持 API 接口完全兼容**，前端无需任何更改

## 功能特性

### 核心功能
- 支持 `POST /api/invoice/ocr`：`multipart/form-data`，字段名 **`file`**（PDF / JPG / PNG / OFD）
- 支持 `POST /api/invoice/ocr/url`：通过图片 URL 识别
- 返回 JSON 字段与现有系统完全兼容

### 发票识别
- 支持增值税普通发票、专用发票、电子发票
- 自动识别免税发票，税率返回 `null`，税额强制为 0
- 价税分离自动校验
- 异常非标数值自动过滤（如 9.16、343、826、1082 等）

### 错误处理
- 配置验证失败检测
- 文件类型验证
- 文件大小限制
- 请求超时处理
- 腾讯云 API 调用重试（3次）
- 详细的错误日志记录

## 环境配置

### 1. Python 环境
```bash
cd invoice-ocr-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. 配置文件
复制 `.env.example` 为 `.env` 并配置腾讯云密钥：
```bash
cp .env.example .env
vi .env
```

**必需配置项：**
```env
# 腾讯云 OCR 配置
TENCENTCLOUD_SECRET_ID=your_secret_id
TENCENTCLOUD_SECRET_KEY=your_secret_key
TENCENTCLOUD_REGION=ap-guangzhou
```

**其他配置项：**
```env
# 服务配置
HOST=0.0.0.0
PORT=8810
MAX_FILE_SIZE=12582912

# 腾讯云 API 配置
OCR_REQUEST_TIMEOUT=60
OCR_RETRY_TIMES=3
OCR_MAX_IMAGE_SIZE=4194304

# 超时配置
OCR_PROCESS_TIMEOUT_SEC=120

# 文件格式支持
ALLOWED_EXTENSIONS=.pdf,.jpg,.jpeg,.png,.ofd

# CORS 配置
CORS_ORIGINS=https://www.ciond.com,https://ciond.com
```

## 服务启动

### 开发环境
```bash
cd invoice-ocr-service
./run.sh
# 或直接使用 uvicorn
uvicorn app.main:app --host 0.0.0.0 --port 8810 --reload
```

### 生产环境（systemd）
```bash
sudo cp invoice-ocr.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start invoice-ocr
sudo systemctl enable invoice-ocr
```

默认监听 **`0.0.0.0:8810`**

## API 接口文档

### 健康检查
```
GET /health
```
**响应：**
```json
{
  "status": "ok",
  "message": "配置验证通过",
  "ocr_provider": "tencent_cloud_vat_invoice_only"
}
```

### 发票识别 - 文件上传
```
POST /api/invoice/ocr
Content-Type: multipart/form-data

字段：
- file: 文件 (必需)
- image_base64: Base64 编码图片 (可选)
- image_data: Image data (可选)
```

**成功响应：**
```json
{
  "code": 200,
  "message": "识别成功",
  "data": {
    "ocr_invoice_type_label": "普通发票",
    "invoice_code": "042002100411",
    "invoice_number": "73870100",
    "invoice_date": "2022-09-29",
    "invoice_title": null,
    "consumption_type": null,
    "buyer_name": "湖北公源建设工程有限公司张湾分公司",
    "buyer_tax_id": "91420300MA49L6L23C",
    "buyer_address_phone": "湖北省十堰市张湾区车城道街道公园路57号2-2",
    "buyer_bank": "中信银行股份有限公司十堰分行 8111501010800781889",
    "goods_name": "*电子计算机*电脑",
    "tax_rate": null,
    "unit_price": "2025.00",
    "unit": "台",
    "quantity": "2",
    "line_amount": "4050.00",
    "line_tax": "0.00",
    "subtotal_amount": "4050.00",
    "amount_excluding_tax": 4050.0,
    "total_amount_excl": "4050.00",
    "tax_amount": 0.0,
    "total_tax": "0.00",
    "invoice_amount": 4050.0,
    "amount_in_words": "肆仟零伍拾圆整",
    "seller_name": "十堰精维信息科技有限公司",
    "seller_address_phone": "十堰市张湾区天麟泰弘广场2楼A区13号189 8690 1728",
    "seller_bank": "工商银行十堰六堰支行1810000109200465494",
    "seller_tax_id": "91420300MA489L6C4P",
    "remark": null,
    "service_category": null,
    "ocr_status": "success",
    "warnings": [],
    "fieldWarnings": {}
  }
}
```

**失败响应：**
```json
{
  "code": 500,
  "message": "识别失败：原因描述",
  "data": null
}
```

### 发票识别 - URL 方式
```
POST /api/invoice/ocr/url
Content-Type: application/json

{
  "url": "https://example.com/invoice.jpg"
}

# 或者兼容格式
{
  "entities": [
    {
      "entity_content": {
        "image": {
          "image_ori": {
            "url": "https://example.com/invoice.jpg"
          }
        }
      }
    }
  ]
}
```

## 服务架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Invoice OCR Service                      │
├─────────────────────────────────────────────────────────────┤
│  API Layer (app/main.py)                                    │
│  - POST /api/invoice/ocr (文件上传)                         │
│  - POST /api/invoice/ocr/url (URL方式)                     │
│  - GET /health                                              │
│  - GET /metrics                                             │
├─────────────────────────────────────────────────────────────┤
│  OCR Layer (app/tencent_ocr.py)                            │
│  - TencentCloudOcrClient: 调用 VatInvoiceOCR               │
│  - validate_and_prepare_image: 图片预处理                   │
│  - compress_image: 图片压缩 (如需要)                        │
├─────────────────────────────────────────────────────────────┤
│  Result Parser (app/invoice_parser.py)                      │
│  - TencentCloudInvoiceParser: 字段映射和解析                │
│  - 价税分离校验                                             │
│  - 免税发票处理                                             │
│  - 异常数值过滤                                             │
├─────────────────────────────────────────────────────────────┤
│  Image Utils (app/image_utils.py)                          │
│  - pdf_bytes_to_images: PDF 转图片                         │
│  - ofd_bytes_to_images: OFD 处理                           │
├─────────────────────────────────────────────────────────────┤
│  Config (app/config.py)                                     │
│  - 腾讯云密钥配置                                           │
│  - 超时和重试配置                                           │
└─────────────────────────────────────────────────────────────┘
```

## 调试和测试

### 1. 单元测试
项目包含 `test_ocr_debug.py` 用于本地测试解析功能：
```bash
python test_ocr_debug.py
```

### 2. API 调试
使用 curl 进行简单测试：
```bash
# 健康检查
curl http://localhost:8810/health

# 识别测试（需要真实发票文件）
curl -X POST http://localhost:8810/api/invoice/ocr \
  -F "file=@/path/to/invoice.jpg"
```

### 3. 监控指标
```bash
curl http://localhost:8810/metrics
```

## 注意事项

### 腾讯云费用
- 使用腾讯云 VatInvoiceOCR 接口会产生 API 调用费用
- 请参考腾讯云官方文档了解最新的定价信息
- 建议在腾讯云控制台开启费用监控和告警

### 密钥安全
- 确保 `.env` 文件中的敏感信息不会被提交到 Git
- 生产环境请使用环境变量或专门的密钥管理服务
- 定期轮换密钥以确保安全

### 网络要求
- 服务需要能够访问腾讯云 API
- 确保服务器网络畅通
- 建议配置网络代理（如果需要）

### 文件大小限制
- 默认最大文件大小为 12MB
- 腾讯云 API 限制单张图片最大 4MB（会自动压缩）

## 版本历史

### v3.0.0 (最新)
- 完全移除本地 OCR 引擎
- 只使用腾讯云 VatInvoiceOCR 接口
- 精简依赖
- 优化错误处理
- 保持 API 接口完全兼容

### v2.0.0
- 重构字段映射系统
- 实现免税发票处理
- 添加价税分离校验
- 实现异常数值过滤

### v1.0.0
- 初始版本，基于本地 OCR 引擎

## 技术支持

如有问题，请检查：
1. 腾讯云密钥配置是否正确
2. 服务健康检查是否通过
3. 服务日志（`logs/` 目录或控制台输出）
4. 腾讯云 API 调用是否成功（可在腾讯云控制台查看）

## 许可证

Copyright © 2025 Ciond. All rights reserved.
