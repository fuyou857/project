"""OFD 转 OpenCV BGR 图像：优先解压内嵌图片；easyofd 仅在 ENABLE_EASYOFD=1 时启用。"""
import io
import os
import zipfile
from typing import List

import numpy as np

from app.pdf_utils import image_bytes_to_bgr, pdf_bytes_to_images

def _max_pages() -> int:
    try:
        return int((os.getenv("OCR_MAX_PDF_PAGES") or "5").split()[0])
    except ValueError:
        return 5


OCR_MAX_PAGES = _max_pages()


def _images_from_ofd_zip(ofd_bytes: bytes) -> List[np.ndarray]:
    images: List[np.ndarray] = []
    try:
        with zipfile.ZipFile(io.BytesIO(ofd_bytes)) as zf:
            for info in zf.infolist():
                if info.is_dir():
                    continue
                name = info.filename.lower()
                if not name.endswith((".png", ".jpg", ".jpeg", ".bmp")):
                    continue
                try:
                    images.append(image_bytes_to_bgr(zf.read(info.filename)))
                except ValueError:
                    continue
    except zipfile.BadZipFile:
        return []
    return images


def _images_from_easyofd(ofd_bytes: bytes) -> List[np.ndarray]:
    try:
        from easyofd.ofd import OFD  # type: ignore
    except ImportError:
        return []

    ofd = OFD()
    read_fn = getattr(ofd, "read", None)
    if not callable(read_fn):
        return []

    for fmt in ("bytes", "binary"):
        try:
            read_fn(ofd_bytes, fmt=fmt)
            break
        except TypeError:
            try:
                read_fn(ofd_bytes)
                break
            except Exception:
                continue
        except Exception:
            continue
    else:
        return []

    for pdf_attr in ("pdf", "to_pdf"):
        fn = getattr(ofd, pdf_attr, None)
        if not callable(fn):
            continue
        try:
            pdf_bytes = fn()
            if isinstance(pdf_bytes, (bytes, bytearray)) and pdf_bytes:
                return pdf_bytes_to_images(bytes(pdf_bytes))
        except Exception:
            continue

    for img_attr in ("to_jpg", "to_jpeg", "to_image", "images"):
        fn = getattr(ofd, img_attr, None)
        if callable(fn):
            try:
                out = fn()
            except Exception:
                continue
        else:
            out = fn
        if not out:
            continue
        if isinstance(out, list):
            result: List[np.ndarray] = []
            for item in out:
                if isinstance(item, np.ndarray):
                    result.append(item)
                elif isinstance(item, (bytes, bytearray)):
                    try:
                        result.append(image_bytes_to_bgr(bytes(item)))
                    except ValueError:
                        continue
            if result:
                return result
    return []


def ofd_bytes_to_images(ofd_bytes: bytes) -> List[np.ndarray]:
    images = _images_from_ofd_zip(ofd_bytes)
    if images:
        return images[:OCR_MAX_PAGES]

    enable_easy = (os.getenv("ENABLE_EASYOFD") or "").strip().lower() in ("1", "true", "yes", "on")
    if enable_easy:
        images = _images_from_easyofd(ofd_bytes)
        if images:
            return images[:OCR_MAX_PAGES]

    raise ValueError(
        "无法从 OFD 提取可识别图像，请导出为 PDF 或 JPG/PNG 后上传；"
        "若需服务端解析复杂 OFD，可安装 easyofd 并设置 ENABLE_EASYOFD=1"
    )
