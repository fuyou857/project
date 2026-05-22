#!/usr/bin/env python3
"""测试腾讯云OCR API调用，检查密钥是否正常工作"""
import sys
sys.path.insert(0, '/www/wwwroot/ciond/invoice-ocr-service')

import json
import base64
from app.tencent_ocr import recognize_vat_invoice, validate_and_prepare_image
from app.config import TencentCloudConfig

def test_tencent_ocr():
    print("=" * 70)
    print("腾讯云OCR API测试")
    print("=" * 70)
    
    # 1. 检查配置
    print("\n1. 检查腾讯云配置...")
    print(f"   SECRET_ID: {TencentCloudConfig.SECRET_ID[:10]}...")
    print(f"   SECRET_KEY: {TencentCloudConfig.SECRET_KEY[:10]}...")
    print(f"   REGION: {TencentCloudConfig.REGION}")
    
    config_valid, config_msg = TencentCloudConfig.validate()
    print(f"   配置验证: {'✓ 通过' if config_valid else '✗ 失败'} - {config_msg}")
    
    if not config_valid:
        return False
    
    # 2. 创建一个简单的测试图片（非常小的图片）
    print("\n2. 创建测试图片...")
    try:
        from PIL import Image
        import io
        
        # 创建一个简单的测试图片
        img = Image.new('RGB', (100, 100), color=(255, 255, 255))
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='JPEG')
        test_image = img_bytes.getvalue()
        
        print(f"   ✓ 测试图片创建成功，大小: {len(test_image)} 字节")
        
    except Exception as e:
        print(f"   ✗ 创建测试图片失败: {e}")
        return False
    
    # 3. 测试图片准备
    print("\n3. 测试图片准备...")
    try:
        image_base64, img_type = validate_and_prepare_image(test_image)
        print(f"   ✓ 图片准备成功")
        print(f"   - 类型: {img_type}")
        print(f"   - Base64长度: {len(image_base64)}")
    except Exception as e:
        print(f"   ✗ 图片准备失败: {e}")
        return False
    
    # 4. 测试腾讯云API调用
    print("\n4. 测试腾讯云VatInvoiceOCR API调用...")
    try:
        result = recognize_vat_invoice(image_base64)
        print(f"   ✓ API调用成功")
        print(f"   - 响应类型: {type(result)}")
        print(f"   - 响应内容:")
        print(json.dumps(result, indent=2, ensure_ascii=False))
        
        # 检查响应结构
        if "VatInvoiceInfos" in result:
            print(f"\n   - VatInvoiceInfos 数量: {len(result['VatInvoiceInfos'])}")
            for item in result['VatInvoiceInfos']:
                print(f"     {item.get('Name', '')}: {item.get('Value', '')}")
        
    except Exception as e:
        print(f"   ✗ API调用失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    print("\n" + "=" * 70)
    print("测试完成")
    print("=" * 70)
    return True

if __name__ == "__main__":
    test_tencent_ocr()
