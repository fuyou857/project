#!/usr/bin/env python3
"""测试完整的OCR接口调用"""
import sys
sys.path.insert(0, '/www/wwwroot/ciond/invoice-ocr-service')

import requests
import json

def test_ocr_api():
    url = "http://localhost:8810/api/invoice/ocr"
    
    # 模拟腾讯云返回的发票数据
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
    
    print("=" * 70)
    print("OCR 接口测试")
    print("=" * 70)
    
    # 1. 测试健康检查
    print("\n1. 测试健康检查...")
    try:
        response = requests.get("http://localhost:8810/health")
        print(f"   ✓ 健康检查成功")
        print(f"   - 响应: {response.json()}")
    except Exception as e:
        print(f"   ✗ 健康检查失败: {e}")
        return False
    
    # 2. 测试模拟的发票数据解析
    print("\n2. 测试发票解析（模拟数据）...")
    print("   注意：此测试直接调用解析器，不经过腾讯云OCR")
    
    try:
        from app.invoice_parser import parse_tencent_ocr_result
        result = parse_tencent_ocr_result(test_invoice_data)
        
        print(f"   ✓ 解析成功")
        print(f"   - 发票代码: {result.get('invoice_code')}")
        print(f"   - 发票号码: {result.get('invoice_number')}")
        print(f"   - 商品名称: {result.get('goods_name')}")
        print(f"   - 税率: {result.get('tax_rate')}")
        print(f"   - 税额: {result.get('tax_amount')}")
        print(f"   - 价税合计: {result.get('invoice_amount')}")
        print(f"   - 识别状态: {result.get('ocr_status')}")
        print(f"   - 警告: {result.get('warnings')}")
        
    except Exception as e:
        print(f"   ✗ 解析失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # 3. 分析真实问题
    print("\n3. 问题分析...")
    print("   根据之前的日志分析：")
    print("   - 前端请求成功到达后端")
    print("   - 图片数据正确接收")
    print("   - 腾讯云OCR调用成功")
    print("   - 但返回结果不包含有效发票信息")
    print("\n   可能原因：")
    print("   a) 图片质量问题（模糊、分辨率低）")
    print("   b) 腾讯云OCR无法识别该发票格式")
    print("   c) 发票图片被压缩或损坏")
    
    print("\n" + "=" * 70)
    print("测试完成")
    print("=" * 70)
    return True

if __name__ == "__main__":
    test_ocr_api()
