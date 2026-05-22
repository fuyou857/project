"""
发票OCR服务 - 完全重写版本
功能：
1. 强制使用腾讯云VatInvoiceOCR
2. 简单直接的接口
3. 100%兼容前端
4. 处理免税发票
"""
import asyncio
import base64
import logging
import json
import os
import time
import traceback
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware

# 日志配置
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("ocr-service")

# 加载环境变量
load_dotenv()

# 腾讯云相关导入
try:
    from tencentcloud.common import credential
    from tencentcloud.common.profile.client_profile import ClientProfile
    from tencentcloud.common.profile.http_profile import HttpProfile
    from tencentcloud.common.common_client import CommonClient
except ImportError:
    logger.error("需要安装腾讯云SDK: pip install tencentcloud-sdk-python")
    raise

# 图片处理
from PIL import Image
import io

app = FastAPI(title="Invoice OCR Service", version="2.0.0")

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 全局变量
_tencent_client = None

def get_tencent_client():
    """获取腾讯云OCR客户端"""
    global _tencent_client
    if _tencent_client is None:
        cred = credential.Credential(
            os.getenv("TENCENTCLOUD_SECRET_ID", ""),
            os.getenv("TENCENTCLOUD_SECRET_KEY", "")
        )
        httpProfile = HttpProfile()
        httpProfile.endpoint = "ocr.tencentcloudapi.com"
        httpProfile.reqTimeout = 30
        clientProfile = ClientProfile()
        clientProfile.httpProfile = httpProfile
        clientProfile.signMethod = "TC3-HMAC-SHA256"
        _tencent_client = CommonClient("ocr", "2018-11-19", cred, "", profile=clientProfile)
    return _tencent_client


def call_tencent_ocr(image_base64: str):
    """调用腾讯云VatInvoiceOCR"""
    client = get_tencent_client()
    params = {"ImageBase64": image_base64}
    resp = client.call_json("VatInvoiceOCR", params)
    return json.loads(resp) if isinstance(resp, str) else resp


def normalize_money(val: str) -> Optional[float]:
    """标准化金额"""
    if not val:
        return None
    val = str(val).replace(',', '').strip()
    if not val:
        return None
    try:
        return float(val)
    except ValueError:
        return None


def parse_tencent_result(result: Dict) -> Dict:
    """解析腾讯云返回的发票"""
    output = {
        "ocr_status": "failed",
        "warnings": [],
        "ocr_invoice_type_label": None,
        "invoice_code": None,
        "invoice_number": None,
        "invoice_date": None,
        "buyer_name": None,
        "buyer_tax_id": None,
        "buyer_address_phone": None,
        "buyer_bank": None,
        "seller_name": None,
        "seller_tax_id": None,
        "seller_address_phone": None,
        "seller_bank": None,
        "goods_name": None,
        "unit": None,
        "quantity": None,
        "unit_price": None,
        "tax_rate": None,
        "tax_amount": None,
        "amount_excluding_tax": None,
        "invoice_amount": None,
        "amount_in_words": None,
        "remark": None,
        "fieldWarnings": {}
    }
    
    infos = []
    
    # 获取VatInvoiceInfos格式
    if "VatInvoiceInfos" in result:
        infos = result["VatInvoiceInfos"]
    elif "Response" in result and "VatInvoiceInfos" in result["Response"]:
        infos = result["Response"]["VatInvoiceInfos"]
    elif "Items" in result:
        infos = result["Items"]
    elif "Response" in result and "Items" in result["Response"]:
        infos = result["Response"]["Items"]
    
    # 解析字段
    fields = {}
    for item in infos:
        name = item.get("Name", "")
        val = item.get("Value", "")
        fields[name] = val
    
    # 查找字段映射
    mappings = {
        "发票代码": "invoice_code",
        "发票号码": "invoice_number",
        "开票日期": "invoice_date",
        "购买方名称": "buyer_name",
        "购方名称": "buyer_name",
        "购买方纳税人识别号": "buyer_tax_id",
        "购方纳税人识别号": "buyer_tax_id",
        "购买方地址电话": "buyer_address_phone",
        "购方地址电话": "buyer_address_phone",
        "购买方开户行及账号": "buyer_bank",
        "购方开户行及账号": "buyer_bank",
        "销售方名称": "seller_name",
        "销方名称": "seller_name",
        "销售方纳税人识别号": "seller_tax_id",
        "销方纳税人识别号": "seller_tax_id",
        "销售方地址电话": "seller_address_phone",
        "销方地址电话": "seller_address_phone",
        "销售方开户行及账号": "seller_bank",
        "销方开户行及账号": "seller_bank",
        "货物或应税劳务、服务名称": "goods_name",
        "商品名称": "goods_name",
        "规格型号": "unit",
        "单位": "unit",
        "数量": "quantity",
        "单价": "unit_price",
        "金额": "amount_excluding_tax",
        "税率": "tax_rate",
        "税额": "tax_amount",
        "价税合计": "invoice_amount",
        "价税合计(小写)": "invoice_amount",
        "价税合计(大写)": "amount_in_words",
        "备注": "remark"
    }
    
    src_names = list(mappings.keys())
    for src_name in src_names:
        if src_name in fields:
            dst_name = mappings[src_name]
            output[dst_name] = fields[src_name]
    
    # 处理日期格式化
    if output["invoice_date"]:
        date_str = output["invoice_date"]
        import re
        m = re.search(r"(\d{4})年(\d{1,2})月(\d{1,2})", date_str)
        if m:
            y, m, d = m.groups()
            output["invoice_date"] = f"{int(y):04d}-{int(m):02d}-{int(d):02d}"
    
    # 免税处理
    is_tax_free = False
    if output["tax_rate"] and "免税" in output["tax_rate"]:
        is_tax_free = True
    for name, value in fields.items():
        value = value or ""
        if "免税" in name or "免税" in value:
            is_tax_free = True
            break
    if is_tax_free:
        output["tax_rate"] = None
        output["tax_amount"] = 0.0
        output["invoice_amount"] = normalize_money(output["invoice_amount"])
        if output["invoice_amount"]:
            output["amount_excluding_tax"] = output["invoice_amount"]
    
    # 转换金额为数值
    for field in ["invoice_amount", "amount_excluding_tax", "tax_amount"]:
        if output[field]:
            output[field] = normalize_money(output[field])
    
    # 标记成功
    has_valid_data = False
    if output["invoice_code"] or output["invoice_number"] or output["invoice_amount"]:
        has_valid_data = True
    if has_valid_data:
        output["ocr_status"] = "success"
    
    return output


def prepare_image(image_bytes: bytes) -> str:
    """准备图片，转换为Base64"""
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode == "RGBA":
        img = img.convert("RGB")
    output = io.BytesIO()
    img.save(output, format="JPEG", quality=95, optimize=False)
    return base64.b64encode(output.getvalue()).decode("utf-8")


async def extract_image(request: Request, file: Optional[UploadFile], image_base64: Optional[str]):
    """从各种方式提取图片数据"""
    raw = b""
    suffix = ".jpg"
    
    # 优先file参数
    if file and file.filename:
        raw = await file.read()
        if raw:
            fn = file.filename.lower()
            if "." in fn:
                suffix = fn[fn.rfind("."):]
    if not raw:
        if image_base64:
            raw = base64.b64decode(image_base64)
            suffix = ".jpg"
    if not raw:
        content_type = request.headers.get("content-type", "")
        if "multipart/form-data" in content_type:
            try:
                form_data = await request.form()
                upload_file = form_data.get("file")
                if upload_file:
                    if hasattr(upload_file, "read"):
                        raw = await upload_file.read()
                        if raw:
                            fn = getattr(upload_file, "filename", "")
                            if "." in fn:
                                suffix = fn[fn.rfind("."):]
                if not raw:
                    b64 = form_data.get("image_base64") or form_data.get("image_data")
                    if b64:
                        raw = base64.b64decode(b64)
                        suffix = ".jpg"
            except:
                pass
    if not raw:
        if "application/json" in (request.headers.get("content-type", "")):
            try:
                data = await request.json()
                for key in ["image_base64", "image_data", "image", "file_base64", "data"]:
                    if key in data and data[key]:
                        raw = base64.b64decode(data[key])
                        suffix = ".jpg"
                        break
            except:
                pass
    return raw, suffix


@app.get("/health")
def health():
    """健康检查"""
    return {"status": "ok", "message": "服务正常", "ocr_provider": "tencent_cloud_vat_invoice_only"}


@app.post("/api/invoice/ocr")
async def ocr_endpoint(request: Request, file: Optional[UploadFile] = File(None), image_base64: Optional[str] = Form(None)):
    """发票OCR接口"""
    req_id = time.time()
    
    try:
        logger.info(f"[{req_id}] 收到请求")
        
        # 1. 提取图片
        raw, suffix = await extract_image(request, file, image_base64)
        
        if not raw:
            logger.error(f"[{req_id}] 未找到图片数据")
            return {"code": 500, "message": "识别失败：未提供图片数据", "data": None}
        
        logger.info(f"[{req_id}] 图片已收到，大小={len(raw)} 字节，格式={suffix}")
        
        # 2. 准备图片
        img_b64 = prepare_image(raw)
        logger.info(f"[{req_id}] 图片准备完成")
        
        # 3. 调用腾讯云
        tencent_result = call_tencent_ocr(img_b64)
        logger.info(f"[{req_id}] 腾讯云调用成功")
        
        # 4. 解析结果
        result = parse_tencent_result(tencent_result)
        
        logger.info(f"[{req_id}] 解析完成，识别状态={result['ocr_status']}")
        
        return {"code": 200, "message": "识别成功", "data": result}
        
    except Exception as e:
        logger.error(f"[{req_id}] 出错: {e}")
        logger.error(traceback.format_exc())
        return {"code": 500, "message": f"识别失败: {str(e)}", "data": None}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8810)
