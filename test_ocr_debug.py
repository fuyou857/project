#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""测试腾讯云OCR识别真实发票"""

import sys
import json

sys.path.insert(0, '/www/wwwroot/ciond/invoice-ocr-service')

from app.invoice_parser import parse_tencent_ocr_result

# 根据用户提供的真实发票图片生成模拟数据
real_invoice_data = {
    "RequestId": "test-real-invoice",
    "VatInvoiceInfos": [
        {"Name": "发票代码", "Value": "042002100411"},
        {"Name": "发票号码", "Value": "73870100"},
        {"Name": "开票日期", "Value": "2022年09月29日"},
        {"Name": "购买方名称", "Value": "湖北公源建设工程有限公司张湾分公司"},
        {"Name": "购买方纳税人识别号", "Value": "91420300MA49L6L23C"},
        {"Name": "购买方地址电话", "Value": "湖北省十堰市张湾区车城道街道公园路57号2-2"},
        {"Name": "购买方开户行及账号", "Value": "中信银行股份有限公司十堰分行 8111501010800781889"},
        {"Name": "销售方名称", "Value": "十堰精维信息科技有限公司"},
        {"Name": "销售方纳税人识别号", "Value": "91420300MA489L6C4P"},
        {"Name": "销售方地址电话", "Value": "十堰市张湾区天麟泰弘广场2楼A区13号189 8690 1728"},
        {"Name": "销售方开户行及账号", "Value": "工商银行十堰六堰支行1810000109200465494"},
        {"Name": "货物或应税劳务、服务名称", "Value": "*电子计算机*电脑"},
        {"Name": "规格型号", "Value": ""},
        {"Name": "单位", "Value": "台"},
        {"Name": "数量", "Value": "2"},
        {"Name": "单价", "Value": "2025"},
        {"Name": "金额", "Value": "4050.00"},
        {"Name": "税率", "Value": "免税"},
        {"Name": "税额", "Value": "0.00"},
        {"Name": "价税合计", "Value": "4050.00"},
        {"Name": "价税合计(大写)", "Value": "肆仟零伍拾圆整"},
        {"Name": "备注", "Value": ""},
    ]
}

print("=" * 70)
print("测试发票识别 - 湖北增值税电子普通发票")
print("=" * 70)

print("\n【腾讯云OCR原始返回】")
print(json.dumps(real_invoice_data, ensure_ascii=False, indent=2))

print("\n" + "=" * 70)
print("【解析结果】")
print("=" * 70)

# 添加调试：检查解析器内部的raw_fields
from app.invoice_parser import TencentCloudInvoiceParser
parser = TencentCloudInvoiceParser(real_invoice_data)
print("\n【调试信息 - raw_fields】")
for k, v in parser.raw_fields.items():
    print(f"  {repr(k)}: {repr(v)}")

result = parse_tencent_ocr_result(real_invoice_data, "vat_invoice")
print(json.dumps(result, ensure_ascii=False, indent=2))

print("\n" + "=" * 70)
print("【字段校验结果】")
print("=" * 70)

# 验证关键字段
check_list = [
    ("发票代码", result.get("invoice_code"), "042002100411"),
    ("发票号码", result.get("invoice_number"), "73870100"),
    ("开票日期", result.get("invoice_date"), "2022-09-29"),
    ("购买方名称", result.get("buyer_name"), "湖北公源建设工程有限公司张湾分公司"),
    ("购买方税号", result.get("buyer_tax_id"), "91420300MA49L6L23C"),
    ("销售方名称", result.get("seller_name"), "十堰精维信息科技有限公司"),
    ("销售方税号", result.get("seller_tax_id"), "91420300MA489L6C4P"),
    ("商品名称", result.get("goods_name"), "*电子计算机*电脑"),
    ("税率", result.get("tax_rate"), None),  # 免税应为None
    ("税额", result.get("tax_amount"), 0.0),
    ("不含税金额", result.get("amount_excluding_tax"), 4050.0),
    ("价税合计", result.get("invoice_amount"), 4050.0),
    ("价税合计大写", result.get("amount_in_words"), "肆仟零伍拾圆整"),
    ("数量", result.get("quantity"), "2"),
    ("单价", result.get("unit_price"), "2025.00"),
    ("单位", result.get("unit"), "台"),
    ("发票类型", result.get("ocr_invoice_type_label"), "普通发票"),
    ("识别状态", result.get("ocr_status"), "success"),
]

all_pass = True
for field_name, actual, expected in check_list:
    status = "✓ PASS" if actual == expected else f"✗ FAIL (期望: {expected}, 实际: {actual})"
    if actual != expected:
        all_pass = False
    print(f"  {field_name}: {status}")

print("\n" + "=" * 70)
print("【价税分离校验】")
print("=" * 70)
if result.get("warnings"):
    print(f"  ⚠️  警告: {result['warnings']}")
else:
    print("  ✓ 价税分离校验通过")

print("\n" + "=" * 70)
if all_pass:
    print("✅ 所有字段校验通过！识别成功！")
else:
    print("❌ 部分字段校验失败，请检查映射逻辑")
print("=" * 70)