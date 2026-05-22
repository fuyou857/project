#!/usr/bin/env python3
"""测试 PDF 处理功能"""
import sys
sys.path.insert(0, '/www/wwwroot/ciond/invoice-ocr-service')

from app.image_utils import pdf_bytes_to_images

# 测试 PDF 处理
print("测试 PDF 处理功能...")

# 创建一个最小的有效 PDF
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
(Test PDF for OCR) Tj
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
    images = pdf_bytes_to_images(test_pdf, zoom=1.5, max_pages=1)
    print(f"✓ PDF 处理成功！生成了 {len(images)} 张图片")
    for i, img_bytes in enumerate(images):
        print(f"  - 第 {i+1} 张图片: {len(img_bytes)} 字节")
except Exception as e:
    print(f"✗ PDF 处理失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\nPDF 处理功能测试通过！")
