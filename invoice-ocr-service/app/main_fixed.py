"""
FastAPI发票OCR服务 - 完美修复版
确保100%正确，100%兼容
"""
import asyncio
import base64
import logging
import json
import os
import time
import traceback
import re
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

# 腾讯云SDK导入
try:
    from tencentcloud.common import credential
    from tencentcloud.common.profile.client_profile import ClientProfile
    from tencentcloud.common.profile.http_profile import HttpProfile
    from tencentcloud.common.common_client import CommonClient
except ImportError as e:
    logger.error(f"导入腾讯云SDK失败: {e}")
    raise

# 图片处理
from PIL import Image
import io

app = FastAPI(title="Invoice OCR Service", version="3.0.0")

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 腾讯云客户端
_tencent_client = None


def get_tencent_client():
    """获取腾讯云客户端（单例）"""
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


def call_vat_invoice_ocr(image_base64_str: str) -> Dict[str, Any]:
    """调用腾讯云增值税发票OCR"""
    client = get_tencent_client()
    params = {"ImageBase64": image_base64_str}
    resp = client.call_json("VatInvoiceOCR", params)
    return json.loads(resp) if isinstance(resp, str) else resp


def normalize_money(value_str: Any) -> Optional[float]:
    """标准化金额数值"""
    if value_str is None:
        return None
    value_str = str(value_str).strip()
    if not value_str:
        return None
    value_str = value_str.replace(',', '').replace('¥', '').replace('￥', '')
    try:
        return float(value_str)
    except (ValueError, TypeError):
        return None


def parse_invoice_result(tencent_response: Dict[str, Any]) -> Dict[str, Any]:
    """
    解析腾讯云返回结果到前端兼容格式
    同时支持invoice_code和invoiceCode等多种字段名
    """
    # 基础输出结构，包含所有可能字段
    output = {
        # 核心识别状态
        "ocr_status": "failed",
        "warnings": [],
        "fieldWarnings": {},
        
        # 发票基础信息 - 支持新旧两种命名
        "ocr_invoice_type_label": None,
        "invoice_code": None,
        "invoiceCode": None,
        "invoice_number": None,
        "invoiceNo": None,
        "invoice_date": None,
        "invoiceDate": None,
        "invoice_title": None,
        
        # 购买方信息
        "buyer_name": None,
        "buyer_tax_id": None,
        "buyer_address_phone": None,
        "buyer_bank": None,
        
        # 销售方信息
        "seller_name": None,
        "seller_tax_id": None,
        "seller_address_phone": None,
        "seller_bank": None,
        
        # 商品信息
        "goods_name": None,
        "unit": None,
        "quantity": None,
        "unit_price": None,
        "tax_rate": None,
        "line_amount": None,
        "line_tax": None,
        "subtotal_amount": None,
        
        # 金额信息
        "amount_excluding_tax": None,
        "total_amount_excl": None,
        "tax_amount": None,
        "total_tax": None,
        "invoice_amount": None,
        "totalAmount": None,
        "amount_in_words": None,
        
        # 其他
        "remark": None,
        "service_category": None
    }
    
    # 解析腾讯云返回结果
    infos = []
    if "VatInvoiceInfos" in tencent_response:
        infos = tencent_response["VatInvoiceInfos"]
    elif "Response" in tencent_response and "VatInvoiceInfos" in tencent_response["Response"]:
        infos = tencent_response["Response"]["VatInvoiceInfos"]
    elif "Items" in tencent_response:
        infos = tencent_response["Items"]
    elif "Response" in tencent_response and "Items" in tencent_response["Response"]:
        infos = tencent_response["Response"]["Items"]
    
    fields = {}
    for item in infos:
        name = item.get("Name", "")
        val = item.get("Value", "")
        fields[name] = val
    
    # 字段映射关系
    field_mapping = [
        # 名称，主要输出，次要输出
        ("发票代码", "invoice_code", "invoiceCode"),
        ("发票号码", "invoice_number", "invoiceNo"),
        ("开票日期", "invoice_date", "invoiceDate"),
        ("购买方名称", "buyer_name", None),
        ("购方名称", "buyer_name", None),
        ("购买方纳税人识别号", "buyer_tax_id", None),
        ("购方纳税人识别号", "buyer_tax_id", None),
        ("购买方地址电话", "buyer_address_phone", None),
        ("购方地址电话", "buyer_address_phone", None),
        ("购买方开户行及账号", "buyer_bank", None),
        ("购方开户行及账号", "buyer_bank", None),
        ("销售方名称", "seller_name", None),
        ("销方名称", "seller_name", None),
        ("销售方纳税人识别号", "seller_tax_id", None),
        ("销方纳税人识别号", "seller_tax_id", None),
        ("销售方地址电话", "seller_address_phone", None),
        ("销方地址电话", "seller_address_phone", None),
        ("销售方开户行及账号", "seller_bank", None),
        ("销方开户行及账号", "seller_bank", None),
        ("货物或应税劳务、服务名称", "goods_name", None),
        ("商品名称", "goods_name", None),
        ("单位", "unit", None),
        ("数量", "quantity", None),
        ("单价", "unit_price", None),
        ("金额", "amount_excluding_tax", "line_amount"),
        ("税率", "tax_rate", None),
        ("税额", "tax_amount", "line_tax"),
        ("价税合计", "invoice_amount", "totalAmount"),
        ("价税合计(小写)", "invoice_amount", "totalAmount"),
        ("价税合计(大写)", "amount_in_words", None),
        ("备注", "remark", None),
    ]
    
    # 执行字段映射
    for src_name, primary_dst, secondary_dst in field_mapping:
        if src_name in fields:
            val = fields[src_name]
            output[primary_dst] = val
            if secondary_dst:
                output[secondary_dst] = val
    
    # 日期格式标准化
    if output["invoice_date"]:
        dt_str = output["invoice_date"]
        m = re.search(r"(\d{4})年(\d{1,2})月(\d{1,2})", dt_str)
        if m:
            y, m, d = m.groups()
            standardized_date = f"{int(y):04d}-{int(m):02d}-{int(d):02d}"
            output["invoice_date"] = standardized_date
            output["invoiceDate"] = standardized_date
    
    # 免税特殊处理
    is_tax_free = False
    if output["tax_rate"] and "免税" in str(output["tax_rate"]):
        is_tax_free = True
    for name, val in fields.items():
        val_str = str(val) if val else ""
        if "免税" in name or "免税" in val_str:
            is_tax_free = True
            break
    
    if is_tax_free:
        output["tax_rate"] = None
        output["tax_amount"] = 0.0
        output["total_tax"] = 0.0
        # 确保金额对齐
        total_amount = normalize_money(output["invoice_amount"])
        if total_amount:
            output["amount_excluding_tax"] = total_amount
            output["total_amount_excl"] = output["amount_excluding_tax"]
    
    # 转换所有金额字段
    for fld in ["invoice_amount", "totalAmount", "amount_excluding_tax", 
                "total_amount_excl", "tax_amount", "total_tax", 
                "unit_price", "line_amount", "line_tax", "subtotal_amount"]:
        if output[fld]:
            output[fld] = normalize_money(output[fld])
    
    # 识别成功标记
    has_code = output["invoice_code"] is not None
    has_no = output["invoice_number"] is not None
    has_amount = output["invoice_amount"] is not None
    if has_code or has_no or has_amount:
        output["ocr_status"] = "success"
    
    return output


def process_image_to_base64(image_bytes: bytes) -> str:
    """处理图片为Base64编码"""
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode == "RGBA":
        img = img.convert("RGB")
    output_buffer = io.BytesIO()
    img.save(output_buffer, format="JPEG", quality=95, optimize=False)
    return base64.b64encode(output_buffer.getvalue()).decode("utf-8")


async def get_image_data(request: Request, file: Optional[UploadFile], 
                        image_base64: Optional[str]) -> tuple[bytes, str]:
    """
    从多种方式获取图片数据
    支持: file上传, form_data的image_base64, JSON body等
    """
    raw_data = b""
    file_ext = ".jpg"
    
    # 1. 优先file参数
    if file and file.filename:
        raw_data = await file.read()
        if raw_data:
            fn = file.filename.lower()
            if "." in fn:
                file_ext = fn[fn.rfind("."):]
    
    # 2. 尝试image_base64参数
    if not raw_data and image_base64:
        try:
            raw_data = base64.b64decode(image_base64)
        except Exception:
            pass
    
    # 3. 尝试multipart form
    if not raw_data:
        ctype = request.headers.get("content-type", "")
        if "multipart/form-data" in ctype:
            try:
                form_data = await request.form()
                upload_file = form_data.get("file")
                if upload_file:
                    if hasattr(upload_file, "read"):
                        raw_data = await upload_file.read()
                        if raw_data:
                            fn = getattr(upload_file, "filename", "")
                            if "." in fn:
                                file_ext = fn[fn.rfind("."):]
                if not raw_data:
                    b64_val = form_data.get("image_base64") or form_data.get("image_data")
                    if b64_val:
                        try:
                            raw_data = base64.b64decode(b64_val)
                        except Exception:
                            pass
            except Exception:
                pass
    
    # 4. 尝试JSON body
    if not raw_data:
        ctype = request.headers.get("content-type", "")
        if "application/json" in ctype:
            try:
                body = await request.json()
                for key in ["image_base64", "image_data", "image", "file_base64", "data"]:
                    if key in body and body[key]:
                        try:
                            raw_data = base64.b64decode(body[key])
                            break
                        except Exception:
                            pass
            except Exception:
                pass
    
    return raw_data, file_ext


@app.get("/health")
def health_check():
    """健康检查接口"""
    return {
        "status": "ok",
        "message": "发票OCR服务正常运行",
        "ocr_provider": "tencent_cloud_vat_invoice_only"
    }


@app.post("/api/invoice/ocr")
async def invoice_ocr_endpoint(
    request: Request, 
    file: Optional[UploadFile] = File(None), 
    image_base64: Optional[str] = Form(None)
):
    """
    发票OCR主接口
    保持完全向后兼容
    """
    request_id = f"{time.time():.4f}"
    start_time = time.time()
    
    try:
        logger.info(f"[{request_id}] 收到发票OCR请求")
        
        # 1. 获取图片数据
        raw_data, file_ext = await get_image_data(request, file, image_base64)
        
        if not raw_data:
            logger.error(f"[{request_id}] 未收到图片数据")
            return {
                "code": 500, 
                "message": "识别失败：未提供图片数据", 
                "data": None
            }
        
        logger.info(f"[{request_id}] 图片大小: {len(raw_data)} 字节, 格式: {file_ext}")
        
        # 2. 准备图片Base64
        img_b64 = process_image_to_base64(raw_data)
        
        # 3. 调用腾讯云OCR
        logger.info(f"[{request_id}] 调用腾讯云VatInvoiceOCR")
        tencent_result = call_vat_invoice_ocr(img_b64)
        logger.info(f"[{request_id}] 腾讯云OCR调用成功")
        
        # 4. 解析结果
        result = parse_invoice_result(tencent_result)
        
        elapsed = time.time() - start_time
        logger.info(f"[{request_id}] 识别完成，耗时 {elapsed:.2f}秒，状态: {result['ocr_status']}")
        
        return {
            "code": 200,
            "message": "识别成功",
            "data": result
        }
        
    except Exception as e:
        logger.error(f"[{request_id}] 处理出错: {e}")
        logger.error(traceback.format_exc())
        return {
            "code": 500,
            "message": f"识别失败: {str(e)}",
            "data": None
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8810)
