#!/usr/bin/env python3
"""测试 PDF 文件上传到 OCR 服务"""
import requests
import sys
import os

def test_ocr_service():
    url = "http://localhost:8810/api/invoice/ocr"
    
    # 创建一个最小的 PDF 文件用于测试
    test_pdf = b"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
100 700 Td
(Test PDF) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000217 00000 n
trailer
<< /Size 5 /Root 1 0 R >>
startxref
309
%%EOF"""
    
    try:
        print(f"测试 OCR 服务...")
        print(f"URL: {url}")
        print(f"PDF 大小: {len(test_pdf)} 字节")
        
        files = {'file': ('test.pdf', test_pdf, 'application/pdf')}
        print(f"\n发送请求...")
        
        response = requests.post(url, files=files, timeout=60)
        print(f"响应状态码: {response.status_code}")
        
        try:
            result = response.json()
            print(f"\n响应结果:")
            print(f"  code: {result.get('code')}")
            print(f"  message: {result.get('message')}")
            print(f"  data: {result.get('data') is not None}")
            
            if result.get('data'):
                print(f"\n发票信息:")
                data = result.get('data')
                print(f"  发票代码: {data.get('invoice_code')}")
                print(f"  发票号码: {data.get('invoice_number')}")
                print(f"  识别状态: {data.get('ocr_status')}")
                
            return result
        except:
            print(f"\n响应内容（非JSON）: {response.text[:200]}")
            return None
            
    except requests.exceptions.Timeout:
        print("请求超时")
        return None
    except Exception as e:
        print(f"请求失败: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    test_ocr_service()
