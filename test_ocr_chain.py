#!/usr/bin/env python3
"""
完整的 OCR 服务链路测试
"""
import requests
import json
import sys

def test_ocr_chain():
    print("=" * 70)
    print("OCR 服务链路测试")
    print("=" * 70)
    
    # 1. 测试健康检查
    print("\n1. 测试后端服务健康检查...")
    try:
        health_url = "http://localhost:8810/health"
        response = requests.get(health_url, timeout=5)
        print(f"   ✓ 健康检查成功")
        print(f"   - 响应: {response.json()}")
    except Exception as e:
        print(f"   ✗ 健康检查失败: {e}")
        return False
    
    # 2. 测试真实的增值税发票识别
    print("\n2. 测试发票识别（使用模拟数据）...")
    print("   注意：使用测试PDF，无法识别真实发票信息")
    print("   请使用真实的增值税发票图片进行测试")
    
    # 创建一个真实的测试发票数据
    test_invoice_data = {
        "RequestId": "test-real-invoice",
        "VatInvoiceInfos": [
            {"Name": "发票代码", "Value": "042002100411"},
            {"Name": "发票号码", "Value": "73870100"},
            {"Name": "开票日期", "Value": "2022年09月29日"},
            {"Name": "购买方名称", "Value": "湖北公源建设工程有限公司张湾分公司"},
            {"Name": "购买方纳税人识别号", "Value": "91420300MA49L6L23C"},
            {"Name": "货物或应税劳务、服务名称", "Value": "*电子计算机*电脑"},
            {"Name": "税率", "Value": "免税"},
            {"Name": "税额", "Value": "0.00"},
            {"Name": "金额", "Value": "4050.00"},
            {"Name": "价税合计", "Value": "4050.00"},
            {"Name": "价税合计(大写)", "Value": "肆仟零伍拾圆整"},
        ]
    }
    
    # 3. 测试解析器
    print("\n3. 测试发票解析器...")
    try:
        sys.path.insert(0, '/www/wwwroot/ciond/invoice-ocr-service')
        from app.invoice_parser import parse_tencent_ocr_result
        
        parsed = parse_tencent_ocr_result(test_invoice_data, "vat_invoice")
        
        print(f"   ✓ 解析成功")
        print(f"   - 发票代码: {parsed.get('invoice_code')}")
        print(f"   - 发票号码: {parsed.get('invoice_number')}")
        print(f"   - 购买方: {parsed.get('buyer_name')}")
        print(f"   - 税率: {parsed.get('tax_rate')}")
        print(f"   - 识别状态: {parsed.get('ocr_status')}")
        
        if parsed.get('warnings'):
            print(f"   - 警告: {parsed.get('warnings')}")
        
    except Exception as e:
        print(f"   ✗ 解析失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # 4. 检查前端配置
    print("\n4. 前端配置检查...")
    print("   前端 OCR 服务地址配置:")
    print("   - 默认地址: https://ocr.ciond.com/api/invoice/ocr")
    print("   - 如果配置了环境变量，会优先使用环境变量")
    print("   - 检查浏览器控制台日志，应该显示 '[invoiceOcr] POST (Tencent Cloud)'")
    
    # 5. 排查建议
    print("\n5. 排查建议...")
    print("   如果识别失败，请检查：")
    print("   a) 上传的是否是真实的增值税发票（不是收据或其他文件）")
    print("   b) 发票图片是否清晰可读")
    print("   c) 发票是否是支持的格式（JPG、PNG、PDF）")
    print("   d) 文件大小是否超过 12MB")
    print("   e) 打开浏览器控制台（F12），检查网络请求和日志")
    print("   f) 检查浏览器控制台是否有 '[invoiceOcr] POST (Tencent Cloud)' 日志")
    
    print("\n" + "=" * 70)
    print("测试完成")
    print("=" * 70)
    return True

if __name__ == "__main__":
    test_ocr_chain()
