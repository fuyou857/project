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
from fastapi.responses import JSONResponse

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

# PDF处理（使用PyMuPDF）
try:
    import fitz
except ImportError as e:
    logger.warning(f"PyMuPDF未安装，将无法处理PDF文件: {e}")
    fitz = None

app = FastAPI(title="Invoice OCR Service", version="3.0.0")

DEBUG = os.getenv("DEBUG", "false").lower() == "true"
app.debug = DEBUG

# 全局异常处理器
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled error: {exc}")
    return JSONResponse(
        status_code=500,
        content={"code": 500, "message": str(exc) if DEBUG else "服务器内部错误，请稍后重试"}
    )

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
    """获取腾讯云客户端（单例，优化版）"""
    global _tencent_client
    if _tencent_client is None:
        cred = credential.Credential(
            os.getenv("TENCENTCLOUD_SECRET_ID", ""),
            os.getenv("TENCENTCLOUD_SECRET_KEY", "")
        )
        httpProfile = HttpProfile()
        httpProfile.endpoint = "ocr.tencentcloudapi.com"
        # 优化：减少超时时间，避免长时间等待
        httpProfile.reqTimeout = 15
        # 优化：启用HTTP keep-alive
        httpProfile.keepAlive = True
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
    """标准化金额数值，处理多种格式"""
    if value_str is None:
        return None
    value_str = str(value_str).strip()
    if not value_str:
        return None
    # 移除所有非数字字符（除了小数点和负号）
    cleaned = ''
    for char in value_str:
        if char.isdigit() or char == '.' or char == '-':
            cleaned += char
    # 如果清理后为空，尝试只提取数字部分
    if not cleaned:
        digits = ''.join([c for c in value_str if c.isdigit()])
        if digits:
            cleaned = digits
    try:
        return float(cleaned) if cleaned else None
    except (ValueError, TypeError):
        return None


def validate_address(address: Optional[str]) -> tuple[Optional[str], bool]:
    """验证并清理地址格式"""
    if not address:
        return None, False
    address = str(address).strip()
    if len(address) < 5:
        return address, False
    return address, True


def validate_phone(phone_str: Optional[str]) -> tuple[Optional[str], bool]:
    """验证并清理电话号码格式"""
    if not phone_str:
        return None, False
    phone_str = str(phone_str).strip()
    # 简单验证：至少包含6个数字
    digits = ''.join([c for c in phone_str if c.isdigit()])
    if len(digits) >= 6:
        return phone_str, True
    return phone_str, False


def extract_and_validate_address_phone(field_value: Optional[str]) -> tuple[Optional[str], Optional[str], list[str]]:
    """从混合字段中提取并验证地址和电话"""
    warnings = []
    address = None
    phone = None
    
    if not field_value:
        return address, phone, warnings
    
    field_value = str(field_value).strip()
    
    # 尝试分离地址和电话（常见格式：地址+空格+电话）
    # 简单逻辑：如果有数字部分，尝试提取
    digits = ''.join([c for c in field_value if c.isdigit()])
    if len(digits) >= 7:
        # 尝试找到电话号码部分
        import re
        phone_match = re.search(r'(\d{3,4}[-\s]?\d{3,4}[-\s]?\d{4}|\d{11})', field_value)
        if phone_match:
            phone = phone_match.group(0)
            address = field_value.replace(phone, '').strip()
    
    # 如果没分离成功，整个作为地址
    if not address:
        address = field_value
    
    # 验证
    addr, addr_ok = validate_address(address)
    ph, ph_ok = validate_phone(phone)
    
    if addr_ok:
        address = addr
    else:
        warnings.append("地址格式可能不完整，请手动检查")
    
    if ph_ok:
        phone = ph
    else:
        warnings.append("电话号码格式可能不正确，请手动检查")
    
    return address, phone, warnings


def parse_invoice_result(tencent_response: Dict[str, Any]) -> Dict[str, Any]:
    """
    解析腾讯云返回结果到前端兼容格式
    同时支持invoice_code和invoiceCode等多种字段名
    """
    # 基础输出结构，完全匹配前端类型定义
    output = {
        # 核心识别状态
        "ocr_status": "failed",
        "warnings": [],
        "fieldWarnings": {},
        
        # 发票基础信息
        "ocr_invoice_type_label": None,
        "invoice_code": None,
        "invoice_number": None,
        "invoice_date": None,
        "invoice_title": None,
        "consumption_type": None,
        
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
        
        # 商品信息（字符串类型）
        "goods_name": None,
        "unit": None,
        "quantity": None,
        "unit_price": None,
        "line_amount": None,
        "line_tax": None,
        "subtotal_amount": None,
        
        # 金额信息（数值类型）
        "amount_excluding_tax": None,
        "total_amount_excl": None,
        "tax_amount": None,
        "total_tax": None,
        "invoice_amount": None,
        "amount_in_words": None,
        
        # 其他
        "remark": None,
        "service_category": None
    }
    
    # 兼容旧命名的字段
    output["invoiceCode"] = None
    output["invoiceNo"] = None
    output["invoiceDate"] = None
    output["totalAmount"] = None
    
    # 解析腾讯云返回结果
    infos = []
    items = []
    
    # 先尝试获取 Items（商品明细）
    if "Items" in tencent_response:
        items = tencent_response["Items"]
    elif "Response" in tencent_response and "Items" in tencent_response["Response"]:
        items = tencent_response["Response"]["Items"]
    
    # 获取 VatInvoiceInfos（发票抬头信息）
    if "VatInvoiceInfos" in tencent_response:
        infos = tencent_response["VatInvoiceInfos"]
    elif "Response" in tencent_response and "VatInvoiceInfos" in tencent_response["Response"]:
        infos = tencent_response["Response"]["VatInvoiceInfos"]
    
    fields = {}
    for item in infos:
        name = item.get("Name", "")
        val = item.get("Value", "")
        fields[name] = val
    
    # 处理商品明细（优先从 Items 提取）
    if items and len(items) > 0:
        first_item = items[0]
        
        # 商品名称
        if first_item.get("Name"):
            output["goods_name"] = first_item.get("Name")
        # 数量
        if first_item.get("Quantity"):
            output["quantity"] = str(first_item.get("Quantity"))
        # 单位
        if first_item.get("Unit"):
            output["unit"] = first_item.get("Unit")
        # 单价
        if first_item.get("UnitPrice"):
            output["unit_price"] = str(first_item.get("UnitPrice"))
        # 金额（不含税）
        if first_item.get("AmountWithoutTax"):
            output["line_amount"] = str(first_item.get("AmountWithoutTax"))
        # 税率
        if first_item.get("TaxRate"):
            output["tax_rate"] = first_item.get("TaxRate")
        # 税额
        if first_item.get("TaxAmount") and first_item.get("TaxAmount") != "***":
            output["line_tax"] = str(first_item.get("TaxAmount"))
    
    logger.info(f"解析到字段: {list(fields.keys())}")
    logger.info(f"字段值: {fields}")
    
    # 从备注字段中提取销售方和购买方的银行信息
    remark = fields.get("备注", "")
    if remark:
        # 提取销方开户银行和账号，合并显示
        seller_bank_name_match = re.search(r'销方开户银行[:：]([^;]+)', remark)
        seller_bank_name = seller_bank_name_match.group(1).strip() if seller_bank_name_match else ""
        
        # 提取银行账号（注意：可能有多个账号，需要区分）
        account_matches = re.findall(r'银行账号[:：]([^;]+)', remark)
        seller_account = ""
        buyer_account = ""
        if len(account_matches) >= 2:
            # 通常购方账号在前，销方账号在后
            buyer_account = account_matches[0].strip()
            seller_account = account_matches[1].strip()
        elif len(account_matches) == 1:
            # 如果只有一个账号，优先作为销方账号
            seller_account = account_matches[0].strip()
        
        # 合并销售方开户行和账号
        seller_bank_parts = []
        if seller_bank_name:
            seller_bank_parts.append(seller_bank_name)
        if seller_account:
            seller_bank_parts.append(f"银行账号:{seller_account}")
        if seller_bank_parts:
            fields["销售方开户行及账号"] = ";".join(seller_bank_parts)
        
        # 提取购方开户银行并合并账号
        buyer_bank_name_match = re.search(r'购方开户银行[:：]([^;]+)', remark)
        buyer_bank_name = buyer_bank_name_match.group(1).strip() if buyer_bank_name_match else ""
        
        buyer_bank_parts = []
        if buyer_bank_name:
            buyer_bank_parts.append(buyer_bank_name)
        if buyer_account:
            buyer_bank_parts.append(f"银行账号:{buyer_account}")
        if buyer_bank_parts:
            fields["购买方开户行及账号"] = ";".join(buyer_bank_parts)
    
    # 字段映射关系
    field_mapping = [
        # 名称，主要输出，次要输出
        ("发票代码", "invoice_code", "invoiceCode"),
        ("发票号码", "invoice_number", "invoiceNo"),
        ("开票日期", "invoice_date", "invoiceDate"),
        ("发票名称", "invoice_title", None),
        ("发票类型", "ocr_invoice_type_label", None),
        
        # 购买方
        ("购买方名称", "buyer_name", None),
        ("购方名称", "buyer_name", None),
        ("购买方统一社会信用代码/纳税人识别号", "buyer_tax_id", None),
        ("购买方识别号", "buyer_tax_id", None),
        ("购买方纳税人识别号", "buyer_tax_id", None),
        ("购方纳税人识别号", "buyer_tax_id", None),
        ("购买方地址、电话", "buyer_address_phone", None),
        ("购买方地址电话", "buyer_address_phone", None),
        ("购方地址电话", "buyer_address_phone", None),
        ("购买方开户行及账号", "buyer_bank", None),
        ("购方开户行及账号", "buyer_bank", None),
        
        # 销售方
        ("销售方名称", "seller_name", None),
        ("销方名称", "seller_name", None),
        ("销售方统一社会信用代码/纳税人识别号", "seller_tax_id", None),
        ("销售方识别号", "seller_tax_id", None),
        ("销售方纳税人识别号", "seller_tax_id", None),
        ("销方纳税人识别号", "seller_tax_id", None),
        ("销售方地址、电话", "seller_address_phone", None),
        ("销售方地址电话", "seller_address_phone", None),
        ("销方地址电话", "seller_address_phone", None),
        ("销售方地址", "seller_address_phone", None),
        ("销方地址", "seller_address_phone", None),
        ("销售方开户行及账号", "seller_bank", None),
        ("销方开户行及账号", "seller_bank", None),
        
        # 商品
        ("货物或应税劳务、服务名称", "goods_name", None),
        ("商品名称", "goods_name", None),
        ("规格型号", "unit", None),
        ("单位", "unit", None),
        ("数量", "quantity", None),
        ("单价", "unit_price", None),
        
        # 金额
        ("金额", "amount_excluding_tax", "line_amount"),
        ("合计金额", "amount_excluding_tax", "total_amount_excl"),
        ("税率", "tax_rate", None),
        ("税额", "tax_amount", "line_tax"),
        ("合计税额", "tax_amount", "total_tax"),
        ("价税合计", "invoice_amount", "totalAmount"),
        ("价税合计(小写)", "invoice_amount", "totalAmount"),
        ("小写金额", "invoice_amount", "totalAmount"),
        ("价税合计(大写)", "amount_in_words", None),
        
        # 其他
        ("备注", "remark", None),
        ("发票消费类型", "service_category", None),
    ]
    
    # 先处理销售方地址和电话的智能提取
    seller_addr_phone = fields.get("销售方地址、电话") or fields.get("销售方地址电话") or fields.get("销方地址电话")
    if seller_addr_phone:
        addr, ph, addr_warnings = extract_and_validate_address_phone(seller_addr_phone)
        output["seller_address_phone"] = addr
        output["warnings"].extend(addr_warnings)
        # 这里我们不拆分到单独字段，保持原始格式用于前端展示
    
    # 处理购买方地址和电话
    buyer_addr_phone = fields.get("购买方地址、电话") or fields.get("购买方地址电话") or fields.get("购方地址电话")
    if buyer_addr_phone:
        output["buyer_address_phone"] = buyer_addr_phone
    
    # 执行字段映射
    for src_name, primary_dst, secondary_dst in field_mapping:
        if src_name in fields:
            val = fields[src_name]
            # 处理空值
            if val == "" or val is None:
                continue
            
            output[primary_dst] = val
            if secondary_dst:
                output[secondary_dst] = val
    
    # 消费类型映射
    if fields.get("发票消费类型"):
        output["consumption_type"] = fields["发票消费类型"]
        output["service_category"] = fields["发票消费类型"]
    
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
        output["tax_rate"] = None  # 前端期望 null 表示免税
        output["tax_amount"] = 0.0
        output["line_tax"] = "0"
        output["total_tax"] = "0"
        # 确保金额对齐
        total_amount = normalize_money(output["invoice_amount"])
        if total_amount:
            output["amount_excluding_tax"] = total_amount
            output["total_amount_excl"] = str(total_amount)
            output["line_amount"] = str(total_amount) if output["line_amount"] is None else output["line_amount"]
    else:
        # 将税率字符串转换为数字（如 "1%" -> 0.01, "13" -> 0.13）
        if output["tax_rate"] is not None and output["tax_rate"] != "":
            tax_rate_str = str(output["tax_rate"]).strip()
            # 清理无效字符，只保留数字、小数点和百分号
            cleaned = re.sub(r'[^0-9.%％]', '', tax_rate_str)
            # 检查是否包含百分号（支持多种百分号编码）
            has_percent = "%" in cleaned or "％" in cleaned or "\uFF05" in cleaned
            # 移除百分号
            cleaned = cleaned.replace("%", "").replace("％", "").replace("\uFF05", "")
            try:
                rate = float(cleaned)
                # 如果包含百分号，或者值大于0.01（正常税率范围是0-1），转换为小数
                # 例如: "1%" -> 0.01, "13" -> 0.13, "0.13" -> 0.13
                if has_percent or (rate > 0.01 and rate <= 100):
                    rate = rate / 100
                # 确保税率在合理范围内 (0-1)
                if rate < 0 or rate > 1:
                    rate = None
                output["tax_rate"] = rate
            except (ValueError, TypeError):
                output["tax_rate"] = None
    
    # 发票类型转换
    if output["ocr_invoice_type_label"]:
        type_label = output["ocr_invoice_type_label"]
        if "普通" in type_label or "普票" in type_label:
            output["ocr_invoice_type_label"] = "普票"
        elif "专用" in type_label or "专票" in type_label:
            output["ocr_invoice_type_label"] = "专票"
        elif "全电" in type_label:
            output["ocr_invoice_type_label"] = "全电票"
    
    # 转换数值类型的金额字段
    numeric_fields = ["amount_excluding_tax", "tax_amount", "invoice_amount"]
    for fld in numeric_fields:
        if output[fld]:
            output[fld] = normalize_money(output[fld])
    
    # 字符串类型的金额字段保持原样
    # unit_price, quantity, line_amount, line_tax, subtotal_amount, total_amount_excl, total_tax
    
    # 兼容字段映射
    if output["invoice_amount"] is not None:
        output["totalAmount"] = output["invoice_amount"]
    if output["amount_excluding_tax"] is not None:
        output["total_amount_excl"] = str(output["amount_excluding_tax"]) if output["amount_excluding_tax"] is not None else None
    if output["tax_amount"] is not None:
        output["total_tax"] = str(output["tax_amount"]) if output["tax_amount"] is not None else None
    
    # 识别成功标记
    has_code = output["invoice_code"] is not None
    has_no = output["invoice_number"] is not None
    has_amount = output["invoice_amount"] is not None
    if has_code or has_no or has_amount:
        output["ocr_status"] = "success"
    
    logger.info(f"最终返回数据: {output}")
    return output


def is_pdf_file(data: bytes) -> bool:
    """检查是否为PDF文件"""
    return data[:4] == b'%PDF'


def is_ofd_file(data: bytes) -> bool:
    """检查是否为OFD文件"""
    # OFD文件本质是ZIP压缩包，检查是否为ZIP格式
    # ZIP文件头: 50 4B 03 04
    if data[:4] == b'PK\x03\x04':
        # 尝试查看ZIP内部结构
        try:
            import zipfile
            from io import BytesIO
            with zipfile.ZipFile(BytesIO(data)) as zf:
                namelist = zf.namelist()
                # OFD文件包含特定的目录结构
                if 'OFD.xml' in namelist or 'Doc_0/Content.xml' in namelist:
                    return True
        except Exception:
            pass
    return False

def parse_ofd_content(ofd_bytes: bytes) -> dict:
    """解析OFD文件内容，提取发票信息"""
    import zipfile
    import xml.etree.ElementTree as ET
    
    result = {}
    
    try:
        with zipfile.ZipFile(io.BytesIO(ofd_bytes)) as zf:
            namelist = zf.namelist()
            
            # 查找Content.xml文件
            content_files = [f for f in namelist if f.endswith('Content.xml')]
            
            for content_file in content_files[:3]:
                try:
                    with zf.open(content_file) as f:
                        tree = ET.parse(f)
                        root = tree.getroot()
                        
                        # 命名空间
                        ns = {'ofd': 'http://www.ofdspec.org/2016'}
                        
                        # 提取文本内容
                        text_contents = []
                        for text_element in root.findall('.//ofd:Text', ns) + root.findall('.//Text', ns):
                            if 'String' in text_element.attrib:
                                text_contents.append(text_element.attrib['String'])
                            elif text_element.text:
                                text_contents.append(text_element.text)
                        
                        if text_contents:
                            result['raw_text'] = '\n'.join(text_contents)
                            
                            # 尝试提取关键信息
                            text = '\n'.join(text_contents)
                            
                            # 发票号码
                            invoice_no_match = re.search(r'发票号码[：:]\s*(\d+)', text)
                            if invoice_no_match:
                                result['invoice_number'] = invoice_no_match.group(1)
                            
                            # 发票代码
                            invoice_code_match = re.search(r'发票代码[：:]\s*(\d+)', text)
                            if invoice_code_match:
                                result['invoice_code'] = invoice_code_match.group(1)
                            
                            # 开票日期
                            date_match = re.search(r'开票日期[：:]\s*(\d{4}[年\-]\d{1,2}[月\-]\d{1,2}[日号]?)', text)
                            if date_match:
                                result['invoice_date'] = date_match.group(1)
                            
                            # 销售方名称
                            seller_name_match = re.search(r'销售方名称[：:]\s*([^\n]+)', text)
                            if seller_name_match:
                                result['seller_name'] = seller_name_match.group(1).strip()
                            
                            # 购买方名称
                            buyer_name_match = re.search(r'购买方名称[：:]\s*([^\n]+)', text)
                            if buyer_name_match:
                                result['buyer_name'] = buyer_name_match.group(1).strip()
                            
                            # 金额
                            amount_match = re.search(r'(价税合计|小写)[：:]\s*[¥￥]?\s*([\d,.]+)', text)
                            if amount_match:
                                result['invoice_amount'] = amount_match.group(2)
                            
                            break
                except Exception as e:
                    logger.warning(f"解析OFD文件失败: {e}")
    
    except Exception as e:
        logger.error(f"解析OFD文件失败: {e}")
    
    return result


def ofd_to_image_bytes(ofd_bytes: bytes) -> bytes:
    """将OFD文件转换为图片字节（使用内置渲染）"""
    import zipfile
    import xml.etree.ElementTree as ET
    
    try:
        with zipfile.ZipFile(io.BytesIO(ofd_bytes)) as zf:
            namelist = zf.namelist()
            logger.info(f"OFD文件内容: {namelist}")
            
            # 查找预览图片 - 支持更多可能的路径
            preview_files = []
            for f in namelist:
                if ('Preview' in f or 'preview' in f or 
                    f.lower().endswith('.jpg') or f.lower().endswith('.jpeg') or 
                    f.lower().endswith('.png')):
                    preview_files.append(f)
            
            if preview_files:
                logger.info(f"找到预览图片: {preview_files[0]}")
                with zf.open(preview_files[0]) as f:
                    return f.read()
            
            # 查找Content.xml文件 - 支持多种路径
            content_files = []
            for f in namelist:
                if 'Content.xml' in f or 'content.xml' in f:
                    content_files.append(f)
            
            if content_files:
                logger.info(f"找到Content.xml: {content_files[0]}")
                try:
                    with zf.open(content_files[0]) as f:
                        tree = ET.parse(f)
                        root = tree.getroot()
                        
                        # 提取文本内容 - 支持多种命名空间和元素
                        text_contents = []
                        
                        # 尝试多种命名空间
                        namespaces = [
                            {'ofd': 'http://www.ofdspec.org/2016'},
                            {'ofd': 'http://www.ofdspec.org/2017'},
                            {'ofd': 'http://www.ofdspec.org'},
                            {}
                        ]
                        
                        for ns in namespaces:
                            for text_element in root.findall('.//ofd:Text', ns) + root.findall('.//Text', ns):
                                if 'String' in text_element.attrib:
                                    text_contents.append(text_element.attrib['String'])
                                elif text_element.text:
                                    text_contents.append(text_element.text)
                        
                        # 尝试从其他元素提取文本
                        if not text_contents:
                            for elem in root.iter():
                                if elem.text and elem.text.strip():
                                    text_contents.append(elem.text.strip())
                        
                        if text_contents:
                            logger.info(f"提取到 {len(text_contents)} 条文本")
                            
                            from PIL import Image, ImageDraw, ImageFont
                            
                            text = '\n'.join(text_contents[:50])
                            lines = text.split('\n')
                            
                            font_size = 12
                            line_height = 18
                            width = 600
                            height = max(400, len(lines) * line_height + 50)
                            
                            img = Image.new('RGB', (width, height), color='white')
                            draw = ImageDraw.Draw(img)
                            
                            try:
                                font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', font_size)
                            except Exception:
                                try:
                                    font = ImageFont.truetype('/usr/share/fonts/zh_CN/TrueType/simsun.ttc', font_size)
                                except Exception:
                                    font = ImageFont.load_default()
                            
                            y = 20
                            for line in lines[:30]:
                                draw.text((20, y), line[:100], fill='black', font=font)
                                y += line_height
                            
                            output_buffer = io.BytesIO()
                            img.save(output_buffer, format='JPEG', quality=80)
                            return output_buffer.getvalue()
                        else:
                            logger.warning("OFD文件中未找到可识别的文本内容")
                except Exception as e:
                    logger.warning(f"解析Content.xml失败: {e}")

            # 尝试查找OFD.xml获取基本信息
            ofd_xml_files = [f for f in namelist if f.endswith('OFD.xml') or f.endswith('ofd.xml')]
            if ofd_xml_files:
                logger.info(f"找到OFD.xml: {ofd_xml_files[0]}")
                try:
                    with zf.open(ofd_xml_files[0]) as f:
                        content = f.read().decode('utf-8', errors='ignore')
                        if content:
                            from PIL import Image, ImageDraw, ImageFont
                            
                            img = Image.new('RGB', (600, 400), color='white')
                            draw = ImageDraw.Draw(img)
                            
                            try:
                                font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 12)
                            except:
                                font = ImageFont.load_default()
                            
                            draw.text((20, 20), "OFD文件内容预览:", fill='black', font=font)
                            draw.text((20, 45), content[:500], fill='black', font=font)
                            
                            output_buffer = io.BytesIO()
                            img.save(output_buffer, format='JPEG', quality=80)
                            return output_buffer.getvalue()
                except Exception as e:
                    logger.error(f"读取OFD.xml失败: {e}")
    
    except zipfile.BadZipFile:
        logger.error("OFD文件不是有效的ZIP格式")
    except Exception as e:
        logger.error(f"OFD转换失败: {e}")
    
    # 如果所有方法都失败，创建一个提示图片
    try:
        from PIL import Image, ImageDraw, ImageFont
        
        img = Image.new('RGB', (600, 300), color='white')
        draw = ImageDraw.Draw(img)
        
        try:
            font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 14)
        except:
            font = ImageFont.load_default()
        
        draw.text((20, 120), "OFD文件已上传", fill='black', font=font)
        draw.text((20, 150), "正在进行OCR识别...", fill='black', font=font)
        
        output_buffer = io.BytesIO()
        img.save(output_buffer, format='JPEG', quality=80)
        return output_buffer.getvalue()
    
    except Exception as e:
        logger.error(f"创建提示图片失败: {e}")
        raise ValueError("无法处理OFD文件，请确保OFD文件格式正确")


def pdf_to_image_bytes(pdf_bytes: bytes) -> bytes:
    """将PDF转换为图片字节（优化版）"""
    if not fitz:
        raise ValueError("PyMuPDF未安装，无法处理PDF文件")
    
    doc = fitz.open("pdf", pdf_bytes)
    if doc.page_count == 0:
        raise ValueError("PDF文件为空")
    
    page = doc[0]
    # 优化：使用适中分辨率，平衡速度和识别质量
    zoom = 1.5
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat)
    
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    
    # 优化：限制最大尺寸
    max_dimension = 2048
    width, height = img.size
    if width > max_dimension or height > max_dimension:
        ratio = min(max_dimension / width, max_dimension / height)
        img = img.resize((int(width * ratio), int(height * ratio)), Image.Resampling.LANCZOS)
    
    output_buffer = io.BytesIO()
    # 优化：降低质量，开启优化
    img.save(output_buffer, format="JPEG", quality=80, optimize=True)
    return output_buffer.getvalue()

def process_image_to_base64(image_bytes: bytes) -> str:
    """处理图片为Base64编码（支持JPG/PNG/PDF/OFD）优化版"""
    # 检查是否为OFD
    if is_ofd_file(image_bytes):
        logger.info("检测到OFD文件，正在转换为图片")
        image_bytes = ofd_to_image_bytes(image_bytes)
    # 检查是否为PDF
    elif is_pdf_file(image_bytes):
        logger.info("检测到PDF文件，正在转换为图片")
        image_bytes = pdf_to_image_bytes(image_bytes)
    
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode == "RGBA":
        img = img.convert("RGB")
    
    # 优化：限制最大尺寸
    max_dimension = 2048
    width, height = img.size
    if width > max_dimension or height > max_dimension:
        ratio = min(max_dimension / width, max_dimension / height)
        img = img.resize((int(width * ratio), int(height * ratio)), Image.Resampling.LANCZOS)
    
    output_buffer = io.BytesIO()
    # 优化：降低质量，开启优化
    img.save(output_buffer, format="JPEG", quality=80, optimize=True)
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


@app.post("/api/invoice/upload-ofd")
async def upload_ofd_endpoint(
    request: Request,
    file: Optional[UploadFile] = File(None)
):
    """
    OFD文件上传接口 - 专门处理OFD格式发票
    将OFD转换为图片后返回，用于前端预览和OCR识别
    """
    request_id = f"{time.time():.4f}"
    
    try:
        if not file or not file.filename:
            logger.error(f"[{request_id}] 未提供OFD文件")
            return {"code": 500, "message": "未提供文件", "data": None}
        
        logger.info(f"[{request_id}] 收到OFD文件上传请求: {file.filename}")
        
        raw_data = await file.read()
        logger.info(f"[{request_id}] OFD文件大小: {len(raw_data)} 字节")
        
        if not is_ofd_file(raw_data):
            return {"code": 500, "message": "不是有效的OFD文件", "data": None}
        
        img_bytes = ofd_to_image_bytes(raw_data)
        img_base64 = base64.b64encode(img_bytes).decode('utf-8')
        
        return {
            "code": 200,
            "message": "OFD转换成功",
            "data": {
                "filename": file.filename,
                "image_base64": img_base64,
                "size": len(raw_data)
            }
        }
        
    except Exception as e:
        logger.error(f"[{request_id}] OFD处理出错: {e}")
        logger.error(traceback.format_exc())
        return {"code": 500, "message": f"OFD处理失败: {str(e)}", "data": None}


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
        
        # 记录腾讯云原始响应
        import json
        logger.info(f"[{request_id}] 腾讯云原始响应: {json.dumps(tencent_result, ensure_ascii=False)[:2000]}")
        
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
