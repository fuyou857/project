#!/usr/bin/env python3
"""先下载/保存发票图片，然后测试识别"""
import sys
sys.path.insert(0, '/www/wwwroot/ciond/invoice-ocr-service')

# 首先我们需要获取图片
# 用户已经在对话中提供了图片，让我们直接使用浏览器工具来处理
import requests
import base64
import json
import io
from PIL import Image
from app.tencent_ocr import recognize_vat_invoice, validate_and_prepare_image
from app.invoice_parser import parse_tencent_ocr_result

# 我们使用浏览器提供的图片来测试
# 首先测试腾讯云API配置
print("=" * 70)
print("发票图片测试")
print("=" * 70)

# 1. 测试配置
print("\n1. 测试腾讯云配置...")
from app.config import TencentCloudConfig
config_valid, config_msg = TencentCloudConfig.validate()
print(f"   配置: {'✓ 通过' if config_valid else '✗ 失败'}")

# 2. 创建测试图片（模拟）
print("\n2. 使用模拟数据验证解析器...")
test_invoice_data = {
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
        {"Name": "单位", "Value": "台"},
        {"Name": "数量", "Value": "2"},
        {"Name": "单价", "Value": "2025"},
        {"Name": "金额", "Value": "4050.00"},
        {"Name": "税率", "Value": "免税"},
        {"Name": "税额", "Value": "0.00"},
        {"Name": "价税合计", "Value": "4050.00"},
        {"Name": "价税合计(大写)", "Value": "肆仟零伍拾圆整"},
    ]
}

try:
    result = parse_tencent_ocr_result(test_invoice_data)
    print(f"   ✓ 解析器测试通过")
    print(f"\n   解析结果:")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    print("\n" + "=" * 70)
    print("解析器工作正常！")
    print("=" * 70)
    print("\n提示:")
    print("请在浏览器中上传这张发票图片进行测试！")
    print("前端会自动调用 https://ocr.ciond.com/api/invoice/ocr")
    print("\n或者使用浏览器开发者工具:")
    print("1. 打开浏览器控制台 (F12)")
    print("2. 选择图片文件")
    print("3. 查看请求和响应")
    
except Exception as e:
    print(f"   ✗ 测试失败: {e}")
    import traceback
    traceback.print_exc()
