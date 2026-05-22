# 发票 OCR 部署与排障手册

主站：[https://www.ciond.com](https://www.ciond.com)  
OCR 子域：[https://ocr.ciond.com](https://ocr.ciond.com)  
后端代码：`invoice-ocr-service/`（默认端口 **8810**）

---

## 一、现存问题汇总

| 问题 | 表现 |
|------|------|
| OCR 未常驻 | `8810` 拒绝连接，公网 **502** |
| `.env` 含 `localhost` | 构建后浏览器请求本机端口 |
| Nginx 缺超时/上传限制 | POST 识别 **502**，GET `/health` 仍可能 200 |
| CORS 重复配置 | Nginx + FastAPI 双写头，浏览器 **Failed to fetch** |
| 前端未重新构建 | 新 `INVOICE_OCR_SERVICE_URL` 未进 bundle |
| 识别链路中断 | 无回填 / 识别不全提示 |

---

## 二、排查步骤（速查）

1. **端口**：`ss -tlnp | grep 8810`  
2. **服务**：`systemctl status invoice-ocr`、`journalctl -u invoice-ocr -n 80`  
3. **Nginx**：`ocr.ciond.com` → `127.0.0.1:8810`，`proxy_read_timeout 300s`，`client_max_body_size 12m`  
4. **CORS**：仅 Python `.env` 的 `CORS_ORIGINS`，Nginx **不要** `add_header Access-Control-*`  
5. **前端 `.env`**：仅 `https://ocr.ciond.com`，禁止 `localhost`  
6. **接口**：`POST https://ocr.ciond.com/api/invoice/ocr`，`multipart` 字段名 **`file`**  
7. **链路**：上传 Storage → `runInvoiceOcr` → 解析 → `setForm` 回填  

一键检查：`bash scripts/check-invoice-ocr.sh`

---

## 三、分步修复操作

### 步骤 1：重启并常驻 OCR 后端服务

```bash
cd /www/wwwroot/ciond
bash scripts/deploy-invoice-ocr-stack.sh
```

或手动：

```bash
sudo cp invoice-ocr-service/invoice-ocr.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable invoice-ocr
sudo systemctl restart invoice-ocr
sudo systemctl status invoice-ocr
curl -sS http://127.0.0.1:8810/health
```

生产启动脚本：`invoice-ocr-service/run-prod.sh`（**无 `--reload`**）。

### 步骤 2：修正 Nginx 子域名代理

参考并合并：**`scripts/nginx-ocr-ciond.conf.example`**

要点：

- `proxy_pass http://127.0.0.1:8810;`
- `client_max_body_size 12m;`
- `proxy_read_timeout 300s;`（及 `proxy_send_timeout`）
- **删除** 站点内所有 `add_header Access-Control-*`

```bash
nginx -t && nginx -s reload
curl -sS https://ocr.ciond.com/health
```

### 步骤 3：修正前端环境变量

编辑 **`/www/wwwroot/ciond/.env`**（示例）：

```env
INVOICE_OCR_SERVICE_URL=https://ocr.ciond.com
NEXT_PUBLIC_INVOICE_OCR_SERVICE_URL=https://ocr.ciond.com
```

**禁止** `http://localhost:8810` / `127.0.0.1`（会打进浏览器 bundle）。

### 步骤 4：前端重新打包部署

```bash
cd /www/wwwroot/ciond
npm run deploy:site
# 内存不足时: npm run build:low-mem 后按 deploy-site.sh 同步 dist
```

浏览器：**强刷**或清缓存后再测成本发票录入。

### 步骤 5：Python CORS（仅主站）

`invoice-ocr-service/.env`：

```env
CORS_ORIGINS=https://www.ciond.com,https://ciond.com
```

**勿**写 `*`。修改后：`sudo systemctl restart invoice-ocr`。

### 步骤 6：全链路验证

```bash
# 本机识别（换真实发票路径）
curl -sS -m 300 -X POST "http://127.0.0.1:8810/api/invoice/ocr" \
  -F "file=@/path/to/invoice.jpg"

# 公网
curl -sS -m 300 -X POST "https://ocr.ciond.com/api/invoice/ocr" \
  -F "file=@/path/to/invoice.jpg"
```

浏览器 F12 → Network → `api/invoice/ocr` 应为 **200** + JSON；表单字段应回填或出现黄色「识别不完整」提示。

---

## 四、预防与长效

- `invoice-ocr.service` 已配置 **`Restart=on-failure`**，建议 **`enable`** 开机自启  
- 固定生产 `.env`，禁止把 `localhost` 提交进构建环境  
- Nginx 统一使用仓库内 **`nginx-ocr-ciond.conf.example`** 模板  
- 改 OCR / 前端配置后：**必须** `systemctl restart invoice-ocr` + `npm run deploy:site`  
- 定期：`journalctl -u invoice-ocr`、磁盘与内存；`dmesg | grep -i oom`  
- CORS 仅放行主站域名，不对外网开放 `*`  

---

## 五、相关文件

| 文件 | 说明 |
|------|------|
| `scripts/deploy-invoice-ocr-stack.sh` | 启动 OCR + 健康检查 |
| `scripts/check-invoice-ocr.sh` | 本机/公网快速探活 |
| `scripts/nginx-ocr-ciond.conf.example` | Nginx 反代模板 |
| `src/services/invoiceOcrService.ts` | 前端 OCR 调用与错误处理 |
| `docs/INVOICE_ATTACHMENT_UPLOAD_TROUBLESHOOTING.md` | 上传附件专项排障 |
