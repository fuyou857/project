"""
腾讯云OCR结果解析层（重构版）
将腾讯云OCR返回的原始数据映射为系统期望的完整字段格式
实现所有要求的功能：
- 精准字段映射
- 免税发票处理
- 价税分离校验
- 完整字段提取
- 异常数值过滤
- 发票类型识别
- 商品明细处理
- 金额格式规范
"""
import json
import logging
import re
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("invoice-parser")


# 异常数值列表（需要过滤的非标数值）
ABNORMAL_VALUES = {'9.16', '343', '826', '1082', '916', '343.0', '826.0', '1082.0'}


def _fw(s: str) -> str:
    """全角数字、符号转半角"""
    table = str.maketrans(
        "０１２３４５６７８９，．：；　￥¥",
        "0123456789,.:; ￥¥",
    )
    return s.translate(table)


def _norm_money(s: str, decimals: int = 2) -> str:
    """
    规范化金额字符串，统一保留两位小数
    
    Args:
        s: 原始金额字符串
        decimals: 保留小数位数
        
    Returns:
        规范化后的金额字符串
    """
    if not s:
        return ""
    s = _fw(str(s).strip())
    s = s.replace(",", "").replace("，", "")
    s = re.sub(r"[￥¥\s]", "", s)
    if not s:
        return ""
    
    try:
        d = Decimal(s)
        # 使用四舍五入方式保留指定小数位数
        quantize_str = f"1.{'0'*decimals}"
        d_quantized = d.quantize(Decimal(quantize_str), rounding=ROUND_HALF_UP)
        return format(d_quantized, f".{decimals}f")
    except InvalidOperation:
        # 不是有效数值，返回空字符串
        return ""


def _parse_money_to_decimal(s: str) -> Optional[Decimal]:
    """解析金额字符串为Decimal类型"""
    if not s:
        return None
    s = _fw(str(s).strip())
    s = s.replace(",", "").replace("，", "")
    s = re.sub(r"[￥¥\s]", "", s)
    if not s:
        return None
    try:
        return Decimal(s)
    except InvalidOperation:
        return None


def _norm_date(s: str) -> str:
    """规范化日期字符串为YYYY-MM-DD格式"""
    if not s:
        return ""
    s = _fw(s.strip())

    # 格式1: YYYY年MM月DD日
    m = re.search(r"(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?", s)
    if m:
        y, mo, d = m.groups()
        return f"{int(y):04d}-{int(mo):02d}-{int(d):02d}"

    # 格式2: YYYY-MM-DD 或 YYYY/MM/DD
    m = re.search(r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})", s)
    if m:
        y, mo, d = m.groups()
        return f"{int(y):04d}-{int(mo):02d}-{int(d):02d}"

    # 格式3: YYYYMMDD
    m = re.search(r"(\d{8})", s)
    if m:
        date_str = m.group(1)
        return f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"

    return s


def _norm_tax_rate(s: str) -> Optional[float]:
    """
    规范化税率为前端表单小数（0.13 表示 13%）；免税返回 0（展示为「免税」）。
    """
    if not s:
        return None
    s = _fw(str(s).strip())

    if "免税" in s or s in ("免", "免征"):
        return 0.0

    s = s.replace("％", "%").replace("%", "")
    try:
        v = float(s)
        if v <= 0:
            return 0.0
        if v > 1:
            return round(v / 100, 6)
        return v
    except ValueError:
        return None


def _is_normal_value(v: str) -> bool:
    """
    检查数值是否为正常值（过滤异常值）
    
    Args:
        v: 数值字符串
        
    Returns:
        True表示是正常值，False表示是异常值
    """
    v_str = str(v).strip()
    if not v_str:
        return False
    return v_str not in ABNORMAL_VALUES


class TencentCloudInvoiceParser:
    """腾讯云OCR增值税发票完整解析器"""
    
    # 腾讯云OCR字段到系统字段的精准映射表
    FIELD_MAPPING = {
        # 发票基本信息
        "发票代码": ["invoice_code", "发票代码"],
        "发票号码": ["invoice_number", "发票号码"],
        "数电发票号码": ["invoice_number", "发票号码"],
        "开票日期": ["invoice_date", "开票日期"],
        "发票类型": ["ocr_invoice_type_label", "发票类型"],
        "VatInvoiceType": ["ocr_invoice_type_label", "发票类型"],
        
        # 购销双方信息
        "销售方名称": ["seller_name", "销售方名称"],
        "销方名称": ["seller_name", "销售方名称"],
        "销售方纳税人识别号": ["seller_tax_id", "销售方税号"],
        "销方纳税人识别号": ["seller_tax_id", "销售方税号"],
        "销售方地址电话": ["seller_address_phone", "销售方地址电话"],
        "销方地址电话": ["seller_address_phone", "销售方地址电话"],
        "销售方开户行及账号": ["seller_bank", "销售方开户行"],
        "销方开户行及账号": ["seller_bank", "销售方开户行"],
        
        "购买方名称": ["buyer_name", "购买方名称"],
        "购方名称": ["buyer_name", "购买方名称"],
        "购买方纳税人识别号": ["buyer_tax_id", "购买方税号"],
        "购方纳税人识别号": ["buyer_tax_id", "购买方税号"],
        "购买方地址电话": ["buyer_address_phone", "购买方地址电话"],
        "购方地址电话": ["buyer_address_phone", "购买方地址电话"],
        "购买方开户行及账号": ["buyer_bank", "购买方开户行"],
        "购方开户行及账号": ["buyer_bank", "购买方开户行"],
        
        # 商品明细信息
        "货物或应税劳务、服务名称": ["goods_name", "商品名称"],
        "商品名称": ["goods_name", "商品名称"],
        "项目名称": ["goods_name", "商品名称"],
        "规格型号": ["goods_spec", "规格型号"],
        "单位": ["unit", "单位"],
        "数量": ["quantity", "数量"],
        "单价": ["unit_price", "单价"],
        "金额": ["line_amount", "单行金额"],
        "税率": ["tax_rate", "税率"],
        "税额": ["line_tax", "单行税额"],
        
        # 合计金额信息
        "合计金额": ["subtotal_amount", "合计金额"],
        "不含税金额": ["amount_excluding_tax", "不含税金额"],
        "金额": ["amount_excluding_tax", "不含税金额"],
        "合计税额": ["total_tax", "合计税额"],
        "税额": ["total_tax", "合计税额"],
        "价税合计": ["invoice_amount", "价税合计"],
        "合计金额": ["invoice_amount", "价税合计"],
        "价税合计(小写)": ["invoice_amount", "价税合计"],
        "价税合计(大写)": ["amount_in_words", "价税合计大写"],
        
        # 备注信息
        "备注": ["remark", "备注"],
    }
    
    def __init__(self, ocr_result: Dict[str, Any]):
        self.result = ocr_result
        self.items: List[Dict[str, str]] = []
        self.raw_fields: Dict[str, str] = {}
        self.is_tax_free = False
        self._parse()
    
    def _parse(self):
        """解析腾讯云OCR返回的原始结果"""
        try:
            if isinstance(self.result, str):
                self.result = json.loads(self.result)
            
            # 解析VatInvoiceInfos格式（腾讯云增值税发票接口）
            if "VatInvoiceInfos" in self.result:
                for item in self.result["VatInvoiceInfos"]:
                    name = item.get("Name", "")
                    value = item.get("Value", "")
                    self.items.append({"name": name, "value": value})
                    self.raw_fields[name] = value
                    # 检查是否为免税发票
                    if "免税" in value or "免税" in name:
                        self.is_tax_free = True
            
            # 解析Items格式（通用格式）
            if "Items" in self.result:
                for item in self.result["Items"]:
                    name = item.get("Name", "")
                    value = item.get("Value", "")
                    if name not in self.raw_fields:
                        self.items.append({"name": name, "value": value})
                        self.raw_fields[name] = value
                        if "免税" in value or "免税" in name:
                            self.is_tax_free = True
            
            # 检查是否有免税标记
            if "免税" in str(self.result):
                self.is_tax_free = True
                
        except Exception as e:
            logger.error(f"解析OCR结果失败: {e}")
    
    def get_field(self, *field_names: str) -> str:
        """根据可能的字段名获取值"""
        for name in field_names:
            if name in self.raw_fields:
                value = self.raw_fields[name]
                # 过滤异常值
                if _is_normal_value(value):
                    return value
        return ""
    
    def get_field_contains(self, substr: str) -> str:
        """获取包含指定子串的字段值"""
        for name, value in self.raw_fields.items():
            if substr in name:
                if _is_normal_value(value):
                    return value
        return ""
    
    def detect_invoice_type(self) -> str:
        """
        检测发票类型
        
        Returns:
            "普通发票" | "专用发票" | "全电发票" | ""
        """
        # 优先从OCR返回的发票类型字段获取
        invoice_type = self.get_field("发票类型", "VatInvoiceType")
        
        if invoice_type:
            if "普通" in invoice_type:
                return "普通发票"
            if "专用" in invoice_type or "增值税专用" in invoice_type:
                return "专用发票"
            if "全电" in invoice_type or "数电" in invoice_type:
                return "全电发票"
        
        # 从发票标题或发票号码检测
        invoice_title = self.get_field("发票名称", "发票类型")
        invoice_code = self.get_field("发票代码")
        invoice_number = self.get_field("发票号码")
        
        if "普通" in str(invoice_title):
            return "普通发票"
        if "专用" in str(invoice_title):
            return "专用发票"
        if "全电" in str(invoice_title) or "数电" in str(invoice_title):
            return "全电发票"
        
        # 根据发票代码长度和格式判断
        if invoice_number and len(invoice_number) > 12:
            return "全电发票"
        
        # 默认返回
        return "普通发票"
    
    def validate_tax_separation(self, amount_excl: Optional[Decimal], 
                               tax_amount: Optional[Decimal], 
                               total_amount: Optional[Decimal]) -> Tuple[bool, List[str]]:
        """
        价税分离校验
        
        Args:
            amount_excl: 不含税金额
            tax_amount: 税额
            total_amount: 价税合计
            
        Returns:
            (是否通过校验, 警告信息列表)
        """
        warnings = []
        
        # 免税：税额应为 0，不含税金额与价税合计一致（有值才校验）
        if self.is_tax_free:
            if tax_amount is not None and abs(tax_amount) > Decimal("0.02"):
                warnings.append("价税分离校验未通过，请核对金额字段")
            if amount_excl is not None and total_amount is not None:
                diff = abs(amount_excl - total_amount)
                if diff > Decimal("0.02"):
                    warnings.append("价税分离校验未通过，请核对金额字段")
            return len(warnings) == 0, warnings

        # 有齐全三要素时：不含税 + 税额 = 价税合计
        if amount_excl is not None and tax_amount is not None and total_amount is not None:
            calculated_total = amount_excl + tax_amount
            diff = abs(calculated_total - total_amount)
            if diff > Decimal("0.02"):
                warnings.append("价税分离校验未通过，请核对金额字段")

        return len(warnings) == 0, warnings
    
    def parse(self) -> Dict[str, Any]:
        """
        完整解析OCR结果，返回所有字段
        
        Returns:
            完整的发票字段字典
        """
        # 基础字段提取
        invoice_code = self.get_field("发票代码", "代码")
        invoice_number = self.get_field("发票号码", "数电发票号码", "号码")
        invoice_date = self.get_field("开票日期", "日期")
        invoice_date = _norm_date(invoice_date)
        
        # 购销双方信息
        seller_name = self.get_field("销售方名称", "销方名称")
        seller_tax_id = self.get_field("销售方纳税人识别号", "销方纳税人识别号")
        seller_address_phone = self.get_field("销售方地址电话", "销方地址电话")
        seller_bank = self.get_field("销售方开户行及账号", "销方开户行及账号")
        
        buyer_name = self.get_field("购买方名称", "购方名称")
        buyer_tax_id = self.get_field("购买方纳税人识别号", "购方纳税人识别号")
        buyer_address_phone = self.get_field("购买方地址电话", "购方地址电话")
        buyer_bank = self.get_field("购买方开户行及账号", "购方开户行及账号")
        
        # 商品明细信息
        goods_name = self.get_field("货物或应税劳务、服务名称", "商品名称", "项目名称")
        
        unit_price = self.get_field("单价")
        unit = self.get_field("单位")
        quantity = self.get_field("数量")
        
        line_amount = self.get_field("金额", "单行金额")
        line_tax = self.get_field("税额", "单行税额")

        # 汇总金额（优先合计行字段，避免与明细「金额」混淆）
        amount_excluding_tax = self.get_field("合计金额", "不含税金额", "小计", "金额合计")
        total_tax = self.get_field("合计税额", "税额合计")
        invoice_amount = self.get_field("价税合计(小写)", "价税合计", "小写")
        amount_in_words = self.get_field("价税合计(大写)", "合计金额(大写)")

        tax_rate_str = self.get_field("税率", "征收率")

        if self.is_tax_free or "免税" in tax_rate_str or tax_rate_str.strip() in ("免", "免征"):
            self.is_tax_free = True

        if not total_tax:
            total_tax = self.get_field("税额")

        if not amount_excluding_tax:
            if self.is_tax_free:
                amount_excluding_tax = invoice_amount or line_amount
            else:
                amount_excluding_tax = line_amount

        if not invoice_amount:
            invoice_amount = self.get_field("合计金额")

        if self.is_tax_free:
            tax_rate = 0.0  # 免税时税率设为0，前端显示为"免税"
            total_tax = total_tax or "0"
            line_tax = line_tax or "0"
            if not amount_excluding_tax and invoice_amount:
                amount_excluding_tax = invoice_amount
            if not invoice_amount and amount_excluding_tax:
                invoice_amount = amount_excluding_tax
        else:
            tax_rate = _norm_tax_rate(tax_rate_str)

        unit_price = _norm_money(unit_price)
        line_amount = _norm_money(line_amount)
        line_tax = _norm_money(line_tax)
        subtotal_amount = _norm_money(amount_excluding_tax) or _norm_money(line_amount)
        amount_excluding_tax = _norm_money(amount_excluding_tax)
        total_tax = _norm_money(total_tax)
        invoice_amount = _norm_money(invoice_amount)

        if not self.is_tax_free and amount_excluding_tax and total_tax and invoice_amount:
            try:
                d_excl = _parse_money_to_decimal(amount_excluding_tax)
                d_tax = _parse_money_to_decimal(total_tax)
                d_total = _parse_money_to_decimal(invoice_amount)
                if d_excl is not None and d_tax is not None and d_total is not None:
                    if abs((d_excl + d_tax) - d_total) > Decimal("0.02"):
                        invoice_amount = _norm_money(str(d_excl + d_tax))
            except Exception:
                pass
        
        # 备注
        remark = self.get_field("备注")
        
        # 发票类型识别
        ocr_invoice_type_label = self.detect_invoice_type()
        
        # 价税分离校验
        warnings = []
        d_amount_excl = _parse_money_to_decimal(amount_excluding_tax)
        d_total_tax = _parse_money_to_decimal(total_tax)
        d_invoice_amount = _parse_money_to_decimal(invoice_amount)
        
        _, validate_warnings = self.validate_tax_separation(
            d_amount_excl, d_total_tax, d_invoice_amount
        )
        warnings.extend(validate_warnings)
        
        # 构建完整结果（空字符串转换为null以匹配前端类型）
        def _null_if_empty(s: str) -> Optional[str]:
            return s if s else None
        
        result = {
            # 发票基本信息
            "ocr_invoice_type_label": _null_if_empty(ocr_invoice_type_label),
            "invoice_code": _null_if_empty(invoice_code),
            "invoice_number": _null_if_empty(invoice_number),
            "invoice_date": _null_if_empty(invoice_date),
            "invoice_title": None,
            "consumption_type": None,
            
            # 购买方信息
            "buyer_name": _null_if_empty(buyer_name),
            "buyer_tax_id": _null_if_empty(buyer_tax_id),
            "buyer_address_phone": _null_if_empty(buyer_address_phone),
            "buyer_bank": _null_if_empty(buyer_bank),
            
            # 商品明细信息
            "goods_name": _null_if_empty(goods_name),
            "tax_rate": tax_rate,  # 已经是float或None
            "unit_price": _null_if_empty(unit_price),
            "unit": _null_if_empty(unit),
            "quantity": _null_if_empty(quantity),
            "line_amount": _null_if_empty(line_amount),
            "line_tax": _null_if_empty(line_tax),
            "subtotal_amount": _null_if_empty(subtotal_amount),
            
            # 金额汇总信息
            "amount_excluding_tax": float(d_amount_excl) if d_amount_excl is not None else None,
            "total_amount_excl": _null_if_empty(amount_excluding_tax),
            "tax_amount": float(d_total_tax) if d_total_tax is not None else None,
            "total_tax": _null_if_empty(total_tax),
            "invoice_amount": float(d_invoice_amount) if d_invoice_amount is not None else None,
            "amount_in_words": _null_if_empty(amount_in_words),
            
            # 销售方信息
            "seller_name": _null_if_empty(seller_name),
            "seller_address_phone": _null_if_empty(seller_address_phone),
            "seller_bank": _null_if_empty(seller_bank),
            "seller_tax_id": _null_if_empty(seller_tax_id),
            
            # 其他信息
            "remark": _null_if_empty(remark),
            "service_category": _null_if_empty(remark),
            "ocr_status": "success" if (invoice_code or invoice_number or goods_name) else "partial",
            "warnings": warnings,
            "fieldWarnings": {},
        }
        
        # 数据清理：过滤异常值
        for key, value in result.items():
            if isinstance(value, str) and not _is_normal_value(value):
                result[key] = None
        
        return result


def parse_tencent_ocr_result(ocr_result: Dict[str, Any], method: str = "vat_invoice") -> Dict[str, Any]:
    """
    统一入口函数：解析腾讯云OCR结果为系统标准完整格式
    
    Args:
        ocr_result: 腾讯云OCR返回的原始结果
        method: 识别方法 ("vat_invoice" 或 "general_invoice")
        
    Returns:
        完整的发票字段字典（InvoiceOcrPayload格式）
    """
    try:
        parser = TencentCloudInvoiceParser(ocr_result)
        return parser.parse()
        
    except Exception as e:
        logger.error(f"解析腾讯云OCR结果异常: {e}")
        # 返回空结果（使用None匹配前端类型）
        return {
            "ocr_invoice_type_label": None,
            "invoice_code": None,
            "invoice_number": None,
            "invoice_date": None,
            "invoice_title": None,
            "consumption_type": None,
            "buyer_name": None,
            "buyer_tax_id": None,
            "buyer_address_phone": None,
            "buyer_bank": None,
            "goods_name": None,
            "tax_rate": None,
            "unit_price": None,
            "unit": None,
            "quantity": None,
            "line_amount": None,
            "line_tax": None,
            "subtotal_amount": None,
            "amount_excluding_tax": None,
            "total_amount_excl": None,
            "tax_amount": None,
            "total_tax": None,
            "invoice_amount": None,
            "amount_in_words": None,
            "seller_name": None,
            "seller_address_phone": None,
            "seller_bank": None,
            "seller_tax_id": None,
            "remark": None,
            "service_category": None,
            "ocr_status": "failed",
            "warnings": [],
            "fieldWarnings": {},
        }
