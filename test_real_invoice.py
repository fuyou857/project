#!/usr/bin/env python3
"""使用真实发票图片测试OCR识别"""
import sys
sys.path.insert(0, '/www/wwwroot/ciond/invoice-ocr-service')

import requests
import base64
import json
from PIL import Image
import io

# 1. 首先保存发票图片
print("=" * 70)
print("使用真实发票测试OCR识别")
print("=" * 70)

print("\n1. 检查服务器状态...")
try:
    health_response = requests.get("http://localhost:8810/health", timeout=5)
    print(f"   ✓ 服务器状态: {health_response.status_code}")
    print(f"   - {health_response.json()}")
except Exception as e:
    print(f"   ✗ 服务器连接失败: {e}")
    sys.exit(1)

print("\n2. 读取发票图片...")
# 我们假设发票图片已经存在，或者我们需要先保存它
# 由于用户已经提供了图片，让我先检查是否有测试图片
import os

invoice_image_path = "/www/wwwroot/ciond/test_invoice.png"

# 我们已经有图片了，现在开始测试
print("   图片已准备完成")

print("\n3. 准备图片数据...")
try:
    # 读取图片并准备数据
    img = Image.open(invoice_image_path)
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_byte_arr = img_byte_arr.getvalue()
    
    print(f"   ✓ 图片读取成功")
    print(f"   - 尺寸: {img.size}")
    print(f"   - 格式: {img.format}")
    print(f"   - 大小: {len(img_byte_arr)} 字节")
    
except Exception as e:
    print(f"   ✗ 图片读取失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n4. 调用OCR API进行识别...")
try:
    # 使用文件上传的方式
    files = {'file': ('invoice.png', img_byte_arr, 'image/png')}
    response = requests.post('http://localhost:8810/api/invoice/ocr', files=files, timeout=120)
    
    print(f"   ✓ API调用完成，状态码: {response.status_code}")
    
    result = response.json()
    print(f"\n   响应结果:")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    # 检查识别结果
    if result.get('code') == 200 and result.get('data'):
        print("\n   ✓ 识别成功！")
        data = result.get('data')
        
        print("\n   识别到的发票信息:")
        print(f"   - 发票代码: {data.get('invoice_code')}")
        print(f"   - 发票号码: {data.get('invoice_number')}")
        print(f"   - 开票日期: {data.get('invoice_date')}")
        print(f"   - 购买方: {data.get('buyer_name')}")
        print(f"   - 商品名称: {data.get('goods_name')}")
        print(f"   - 税率: {data.get('tax_rate')}")
        print(f"   - 税额: {data.get('tax_amount')}")
        print(f"   - 价税合计: {data.get('invoice_amount')}")
        print(f"   - 识别状态: {data.get('ocr_status')}")
        print(f"   - 警告信息: {data.get('warnings')}")
        
        print("\n" + "=" * 70)
        print("✓ OCR识别测试完成")
        print("=" * 70)
        
    else:
        print("\n   ✗ 识别失败！")
        print(f"   - 错误信息: {result.get('message')}")
        
except Exception as e:
    print(f"   ✗ OCR调用失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
