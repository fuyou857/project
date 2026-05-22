"""腾讯云OCR配置层"""
import os
from typing import Optional, Set
from dotenv import load_dotenv

load_dotenv()


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    raw = raw.split("#", 1)[0].strip()
    if not raw:
        return default
    try:
        return int(raw.split()[0])
    except ValueError:
        return default


def _parse_allowed_extensions(spec: Optional[str]) -> Set[str]:
    if not spec or not spec.strip():
        return {".pdf", ".jpg", ".jpeg", ".png", ".ofd"}
    head = spec.strip().split("#", 1)[0].strip()
    out: Set[str] = set()
    for p in head.split(","):
        t = p.strip().lower()
        if not t:
            continue
        if not t.startswith("."):
            t = "." + t
        out.add(t)
    return out if out else {".pdf", ".jpg", ".jpeg", ".png", ".ofd"}


class TencentCloudConfig:
    SECRET_ID = os.getenv("TENCENTCLOUD_SECRET_ID", "")
    SECRET_KEY = os.getenv("TENCENTCLOUD_SECRET_KEY", "")
    REGION = os.getenv("TENCENTCLOUD_REGION", "ap-guangzhou")

    REQUEST_TIMEOUT = _env_int("OCR_REQUEST_TIMEOUT", 60)
    RETRY_TIMES = _env_int("OCR_RETRY_TIMES", 3)
    MAX_IMAGE_SIZE = _env_int("OCR_MAX_IMAGE_SIZE", 4194304)

    @classmethod
    def validate(cls) -> tuple:
        if not cls.SECRET_ID:
            return False, "TENCENTCLOUD_SECRET_ID 未配置"
        if not cls.SECRET_KEY:
            return False, "TENCENTCLOUD_SECRET_KEY 未配置"
        if not cls.REGION:
            return False, "TENCENTCLOUD_REGION 未配置"
        return True, "配置验证通过"


class AppConfig:
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = _env_int("PORT", 8810)
    MAX_FILE_SIZE = _env_int("MAX_FILE_SIZE", 12 * 1024 * 1024)
    OCR_PROCESS_TIMEOUT_SEC = _env_int("OCR_PROCESS_TIMEOUT_SEC", 120)
    OCR_MAX_PDF_PAGES = _env_int("OCR_MAX_PDF_PAGES", 5)
    OCR_PDF_ZOOM = float(os.getenv("OCR_PDF_ZOOM", "1.5"))
    ALLOWED_EXT = _parse_allowed_extensions(os.getenv("ALLOWED_EXTENSIONS"))


def get_cors_origins() -> list:
    raw = (os.getenv("CORS_ORIGINS") or "*").strip()
    if not raw or raw == "*":
        return ["*"]
    origins = [x.strip() for x in raw.split(",") if x.strip()]
    non_wild = [o for o in origins if o != "*"]
    return non_wild if non_wild else ["*"]
