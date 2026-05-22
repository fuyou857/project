"""腾讯云OCR请求层 - 仅使用VatInvoiceOCR接口"""
import base64
import io
import json
import logging
import time
from typing import Any, Dict, Optional, Tuple

from PIL import Image

from app.config import TencentCloudConfig

logger = logging.getLogger("tencent-ocr")


class TencentCloudOcrClient:
    """腾讯云OCR客户端 - 仅使用VatInvoiceOCR接口"""

    def __init__(self):
        self._client = None
        self._init_client()

    def _init_client(self):
        """初始化腾讯云OCR客户端"""
        try:
            from tencentcloud.common import credential
            from tencentcloud.common.profile.client_profile import ClientProfile
            from tencentcloud.common.profile.http_profile import HttpProfile
            from tencentcloud.common.common_client import CommonClient

            cred = credential.Credential(
                TencentCloudConfig.SECRET_ID,
                TencentCloudConfig.SECRET_KEY
            )

            http_profile = HttpProfile()
            http_profile.endpoint = "ocr.tencentcloudapi.com"
            http_profile.reqTimeout = TencentCloudConfig.REQUEST_TIMEOUT

            client_profile = ClientProfile()
            client_profile.httpProfile = http_profile
            client_profile.signMethod = "TC3-HMAC-SHA256"

            self._client = CommonClient("ocr", "2018-11-19", cred, "", profile=client_profile)
            logger.info("腾讯云OCR客户端初始化成功 - 仅使用VatInvoiceOCR接口")

        except Exception as e:
            logger.error(f"腾讯云OCR客户端初始化失败: {e}")
            raise

    def call_vat_invoice_ocr(self, image_base64: str) -> Dict[str, Any]:
        """
        调用腾讯云增值税发票OCR接口（VatInvoiceOCR）

        Args:
            image_base64: 图片的base64编码

        Returns:
            API响应结果

        Raises:
            Exception: API调用失败时抛出异常
        """
        from tencentcloud.common.exception.tencent_cloud_sdk_exception import TencentCloudSDKException

        params = {"ImageBase64": image_base64}

        for attempt in range(TencentCloudConfig.RETRY_TIMES):
            try:
                resp = self._client.call_json("VatInvoiceOCR", params)
                result = json.loads(resp) if isinstance(resp, str) else resp
                logger.info(f"VatInvoiceOCR调用成功 (尝试次数: {attempt + 1})")
                return result

            except TencentCloudSDKException as e:
                logger.warning(f"第{attempt + 1}次尝试失败: {e}")
                if attempt < TencentCloudConfig.RETRY_TIMES - 1:
                    time.sleep(1)
                else:
                    logger.error(f"VatInvoiceOCR调用失败，已重试{TencentCloudConfig.RETRY_TIMES}次")
                    raise

            except Exception as e:
                logger.error(f"VatInvoiceOCR请求异常: {e}")
                raise


_ocr_client: Optional[TencentCloudOcrClient] = None


def get_ocr_client() -> TencentCloudOcrClient:
    """获取OCR客户端单例"""
    global _ocr_client
    if _ocr_client is None:
        _ocr_client = TencentCloudOcrClient()
    return _ocr_client


def compress_image(image_bytes: bytes, max_size: int = 2097152, min_quality: int = 30) -> bytes:
    """压缩图片到指定大小"""
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
        logger.warning(f"图片压缩失败: {e}")
        return image_bytes


def validate_and_prepare_image(image_bytes: bytes) -> Tuple[str, str]:
    """
    验证并准备图片用于OCR - 禁用压缩以保持图片质量

    Returns:
        (base64_string, image_type)
    """
    try:
        img = Image.open(io.BytesIO(image_bytes))
        logger.info(f"原始图片格式: {img.format}, 尺寸: {img.size}, 模式: {img.mode}")

        # 直接使用原始图片，不进行压缩
        img_type = img.format or "PNG"
        
        # 如果是PNG格式，保持原样，不转换格式
        output = io.BytesIO()
        if img.mode == "RGBA":
            # RGBA转换为RGB但保持高质量
            img_rgb = img.convert("RGB")
            img_rgb.save(output, format="JPEG", quality=100, optimize=False)
            img_type = "JPEG"
        else:
            # 保持原有格式
            img.save(output, format=img_type, quality=100, optimize=False)
        
        processed_bytes = output.getvalue()
        logger.info(f"处理后图片大小: {len(processed_bytes)} 字节")

        base64_str = base64.b64encode(processed_bytes).decode("utf-8")
        return base64_str, img_type

    except Exception as e:
        logger.error(f"图片验证和准备失败: {e}")
        raise ValueError(f"无法识别图片格式: {e}")


def recognize_vat_invoice(image_base64: str) -> Dict[str, Any]:
    """识别增值税发票（仅使用VatInvoiceOCR接口）"""
    client = get_ocr_client()
    return client.call_vat_invoice_ocr(image_base64)


def process_single_image(image_bytes: bytes) -> Dict[str, Any]:
    """
    处理单张图片的OCR识别 - 仅使用VatInvoiceOCR接口

    Returns:
        {
            "success": bool,
            "data": dict,  # 腾讯云原始响应
            "error": str   # 失败时的错误信息
        }
    """
    try:
        logger.debug(f"开始处理图片，大小: {len(image_bytes)} 字节")
        image_base64, img_type = validate_and_prepare_image(image_bytes)
        logger.debug(f"图片准备完成，类型: {img_type}")

        result = recognize_vat_invoice(image_base64)
        logger.info(f"增值税发票识别成功")
        return {
            "success": True,
            "data": result
        }

    except ValueError as e:
        logger.error(f"图片格式错误: {e}")
        return {
            "success": False,
            "error": f"图片格式错误: {e}"
        }
    except Exception as e:
        logger.error(f"增值税发票识别失败: {e}")
        return {
            "success": False,
            "error": str(e)
        }
