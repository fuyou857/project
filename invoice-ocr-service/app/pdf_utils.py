"""PDF 转 OpenCV 可用的 BGR numpy 图（多页则返回多页列表）。"""
import os
from typing import List

import cv2
import fitz  # PyMuPDF
import numpy as np


def _env_float(name: str, default: float) -> float:
    raw = (os.getenv(name) or "").strip()
    if not raw:
        return default
    try:
        return float(raw.split()[0])
    except ValueError:
        return default


def _env_int(name: str, default: int) -> int:
    raw = (os.getenv(name) or "").strip()
    if not raw:
        return default
    try:
        return int(raw.split()[0])
    except ValueError:
        return default


def pdf_bytes_to_images(pdf_bytes: bytes, zoom: float | None = None, max_pages: int | None = None) -> List[np.ndarray]:
    """将 PDF 每页渲染为 BGR uint8 图像（默认最多 5 页，zoom 1.5，避免 OCR 超时）。"""
    zoom = zoom if zoom is not None else _env_float("OCR_PDF_ZOOM", 1.5)
    max_pages = max_pages if max_pages is not None else _env_int("OCR_MAX_PDF_PAGES", 5)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    images: List[np.ndarray] = []
    mat = fitz.Matrix(zoom, zoom)
    try:
        for i, page in enumerate(doc):
            if i >= max_pages:
                break
            pix = page.get_pixmap(matrix=mat, alpha=False)
            h, w = pix.height, pix.width
            arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(h, w, 3)
            # pix 为 RGB，转 BGR 用于后续处理
            bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
            images.append(bgr)
    finally:
        doc.close()
    return images


def image_bytes_to_bgr(data: bytes) -> np.ndarray:
    """JPEG/PNG 等 → BGR。"""
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("无法解码图片，请确认格式为 JPG/PNG/JPEG")
    return img
