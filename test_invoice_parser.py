#!/usr/bin/env python3
"""测试发票识别完整流程"""
import sys
sys.path.insert(0, '/www/wwwroot/ciond/invoice-ocr-service')

import json
import requests
from app.invoice_parser import parse_tencent_ocr_result, TencentCloudInvoiceParser

# 模拟腾讯云返回的发票数据（基于用户上传的发票图片）
test_invoice_data = {
    "VatInvoiceInfos": [
        {"Name": "发票代码", "Value": "042002100411"},
        {"Name": "发票号码", "Value": "73870100"},
        {"Name": "开票日期", "Value": "2022年09月29日"},
        {"Name": "发票名称", "Value": "湖北增值税电子普通发票"},
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

def test_parser():
    print("=" * 70)
    print("发票解析器测试")
    print("=" * 70)
    
    print("\n1. 测试发票解析器初始化...")
    try:
        parser = TencentCloudInvoiceParser(test_invoice_data)
        print(f"   ✓ 解析器初始化成功")
        print(f"   - 解析字段数: {len(parser.raw_fields)}")
        print(f"   - 是否免税: {parser.is_tax_free}")
        
        # 打印解析的字段
        print("\n   解析的字段:")
        for name, value in parser.raw_fields.items():
            print(f"     {name}: {value}")
            
    except Exception as e:
        print(f"   ✗ 解析器初始化失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    print("\n2. 测试字段提取...")
    try:
        invoice_code = parser.get_field("发票代码")
        invoice_number = parser.get_field("发票号码")
        goods_name = parser.get_field("货物或应税劳务、服务名称", "商品名称")
        tax_rate = parser.get_field("税率")
        
        print(f"   ✓ 字段提取成功")
        print(f"   - 发票代码: {invoice_code}")
        print(f"   - 发票号码: {invoice_number}")
        print(f"   - 商品名称: {goods_name}")
        print(f"   - 税率: {tax_rate}")
        
    except Exception as e:
        print(f"   ✗ 字段提取失败: {e}")
        return False
    
    print("\n3. 测试完整解析...")
    try:
        result = parse_tencent_ocr_result(test_invoice_data)
        
        print(f"   ✓ 完整解析成功")
        print(f"\n   解析结果:")
        for key, value in result.items():
            print(f"     {key}: {value}")
            
        # 检查关键字段
        print("\n   关键字段验证:")
        print(f"     - 发票代码: {result.get('invoice_code')} {'✓' if result.get('invoice_code') else '✗'}")
        print(f"     - 发票号码: {result.get('invoice_number')} {'✓' if result.get('invoice_number') else '✗'}")
        print(f"     - 商品名称: {result.get('goods_name')} {'✓' if result.get('goods_name') else '✗'}")
        print(f"     - 税率: {result.get('tax_rate')} {'✓' if result.get('tax_rate') == 0 else '✗ (应为0表示免税)'}")
        print(f"     - 税额: {result.get('tax_amount')} {'✓' if result.get('tax_amount') == 0 else '✗ (应为0)'}")
        print(f"     - 价税合计: {result.get('invoice_amount')} {'✓' if result.get('invoice_amount') else '✗'}")
        print(f"     - 不含税金额: {result.get('amount_excluding_tax')} {'✓' if result.get('amount_excluding_tax') else '✗'}")
        print(f"     - 识别状态: {result.get('ocr_status')} {'✓' if result.get('ocr_status') == 'success' else '✗'}")
        print(f"     - 警告信息: {result.get('warnings')} {'✓' if len(result.get('warnings', [])) == 0 else '✗'}")
        
        return True
        
    except Exception as e:
        print(f"   ✗ 完整解析失败: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_parser()
    print("\n" + "=" * 70)
    print("测试完成" + (" ✓" if success else " ✗"))
    print("=" * 70)
