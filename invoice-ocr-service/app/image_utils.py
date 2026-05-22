"""图片处理工具层：预处理、格式压缩、Base64转换（无OpenCV依赖）"""
import base64
import io
import logging
from typing import List, Tuple

from PIL import Image

from app.config import TencentCloudConfig

logger = logging.getLogger("image-utils")


def validate_image_size(image_bytes: bytes) -> Tuple[bool, str]:
    """验证图片大小是否超过限制"""
    size = len(image_bytes)
    max_size = TencentCloudConfig.MAX_IMAGE_SIZE
    if size > max_size:
        return False, f"图片大小 {size} 字节 超过限制 {max_size} 字节"
    return True, ""


def compress_image(image_bytes: bytes, max_size: int = 2097152, min_quality: int = 30) -> bytes:
    """
    压缩图片到指定大小以下

    Args:
        image_bytes: 原始图片字节
        max_size: 最大目标大小（默认2MB）
        min_quality: 最低质量（避免无限压缩）

    Returns:
        压缩后的图片字节
    """
    try:
        img = Image.open(io.BytesIO(image_bytes))

        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")

        output = io.BytesIO()

        quality = 95
        while quality >= min_quality:
            output.seek(0)
            output.truncate()
            img.save(output, format="JPEG", quality=quality, optimize=True)
            if output.tell() <= max_size:
                break
            quality -= 10

        if output.tell() > max_size and img.size[0] > 800:
            new_width = 800
            ratio = new_width / img.size[0]
            new_height = int(img.size[1] * ratio)
            img = img.resize((new_width, new_height), Image.LANCZOS)
            output.seek(0)
            output.truncate()
            img.save(output, format="JPEG", quality=min_quality, optimize=True)

        return output.getvalue()

    except Exception as e:
        logger.warning(f"图片压缩失败: {e}，使用原始图片")
        return image_bytes


def image_to_base64(image_bytes: bytes) -> str:
    """将图片字节转换为Base64字符串"""
    return base64.b64encode(image_bytes).decode("utf-8")


def pdf_bytes_to_images(raw: bytes, zoom: float = 1.5, max_pages: int = 5) -> List[bytes]:
    """将PDF字节转换为图像字节列表"""
    import fitz

    try:
        doc = fitz.open(stream=raw, filetype="pdf")
        images = []

        for page_num in range(min(len(doc), max_pages)):
            page = doc[page_num]
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat)
            img_data = pix.tobytes("png")

            # 转换为 JPEG 格式以减小大小
            img = Image.open(io.BytesIO(img_data))
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            
            output = io.BytesIO()
            img.save(output, format="JPEG", quality=85)
            img_bytes = output.getvalue()
            
            images.append(img_bytes)
            logger.info(f"PDF第{page_num + 1}页转换完成，尺寸: {img.size}，大小: {len(img_bytes)} 字节")

        doc.close()
        return images

    except Exception as e:
        logger.error(f"PDF解析失败: {e}")
        raise ValueError(f"PDF解析失败: {e}")


def ofd_bytes_to_images(raw: bytes, max_pages: int = 5) -> List[bytes]:
    """将OFD字节转换为图像字节列表"""
    import fitz

    try:
        doc = fitz.open(stream=raw, filetype="ofd")
        images = []

        for page_num in range(min(len(doc), max_pages)):
            page = doc[page_num]
            mat = fitz.Matrix(2.0, 2.0)
            pix = page.get_pixmap(matrix=mat)
            img_data = pix.tobytes("png")

            # 转换为 JPEG 格式
            img = Image.open(io.BytesIO(img_data))
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            
            output = io.BytesIO()
            img.save(output, format="JPEG", quality=85)
            img_bytes = output.getvalue()
            
            images.append(img_bytes)
            logger.info(f"OFD第{page_num + 1}页转换完成，尺寸: {img.size}，大小: {len(img_bytes)} 字节")

        doc.close()
        return images

    except Exception as e:
        logger.error(f"OFD解析失败: {e}")
        raise ValueError(f"OFD解析失败: {e}")


def prepare_image_for_ocr(raw: bytes) -> Tuple[str, str]:
    """
    准备图片用于OCR识别

    Returns:
        (base64_string, image_type)
    """
    img = Image.open(io.BytesIO(raw))

    is_valid, msg = validate_image_size(raw)
    if not is_valid:
        logger.info(f"图片超过限制，将进行压缩: {msg}")
        raw = compress_image(raw)

    img_type = img.format or "JPEG"
    if img_type.upper() in ("PNG",):
        img_rgba = img.convert("RGB")
        output = io.BytesIO()
        img_rgba.save(output, format="JPEG", quality=85)
        raw = output.getvalue()
        img_type = "JPEG"

    base64_str = image_to_base64(raw)
    return base64_str, img_type
