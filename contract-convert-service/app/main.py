"""自建合同文档转换：docx→pdf（LibreOffice）、PDF 合并、docxtpl 变量/图片、document.xml diff、PDF 页脚文字戳（非 CA）。"""
import base64
import difflib
import io
import os
import re
import subprocess
import tempfile
import zipfile
from typing import Any, Dict, List, Tuple

import httpx
import mammoth
from docx.shared import Mm
from docxtpl import DocxTemplate, InlineImage
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from PyPDF2 import PdfReader, PdfWriter
import fitz  # PyMuPDF

app = FastAPI(title="contract-convert-service", version="1.0.0")

DEBUG = os.environ.get("DEBUG", "false").lower() == "true"
app.debug = DEBUG

# 全局异常处理器
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import logging
    logger = logging.getLogger(__name__)
    logger.exception(f"Unhandled error: {exc}")
    return JSONResponse(
        status_code=500,
        content={"ok": False, "message": str(exc) if DEBUG else "服务器内部错误，请稍后重试"}
    )

SECRET = os.environ.get("CONTRACT_CONVERT_SECRET", "").strip()
MAX_DOWNLOAD_BYTES = int(os.environ.get("MAX_DOWNLOAD_BYTES", str(80 * 1024 * 1024)))
_LIBREOFFICE_BIN = "soffice"


def _assert_path_within_workdir(path: str, workdir: str) -> str:
    """解析路径并确保位于 workdir 内，防止路径穿越（供 subprocess 参数使用）。"""
    real_workdir = os.path.realpath(workdir)
    real_path = os.path.realpath(path)
    try:
        common = os.path.commonpath([real_workdir, real_path])
    except ValueError as e:
        raise HTTPException(400, "invalid path") from e
    if common != real_workdir:
        raise HTTPException(400, "invalid path")
    return real_path


def _check_secret(request: Request) -> None:
    if not SECRET:
        return
    got = (request.headers.get("x-contract-convert-secret") or "").strip()
    if got != SECRET:
        raise HTTPException(status_code=401, detail="X-Contract-Convert-Secret mismatch")


async def _download(url: str) -> bytes:
    # httpx<0.20 使用 allow_redirects（见 client.get），AsyncClient 无 follow_redirects 参数
    async with httpx.AsyncClient(timeout=300.0) as client:
        r = await client.get(url, allow_redirects=True)
        r.raise_for_status()
        body = r.content
    if len(body) > MAX_DOWNLOAD_BYTES:
        raise HTTPException(413, "file too large")
    return body


def _docx_to_pdf_lo(docx_bytes: bytes) -> bytes:
    with tempfile.TemporaryDirectory() as td:
        docx_path = os.path.join(td, "input.docx")
        with open(docx_path, "wb") as f:
            f.write(docx_bytes)
        safe_outdir = _assert_path_within_workdir(td, td)
        safe_docx = _assert_path_within_workdir(docx_path, td)
        cmd = [
            _LIBREOFFICE_BIN,
            "--headless",
            "--norestore",
            "--nologo",
            "--nolockcheck",
            "--convert-to",
            "pdf",
            "--outdir",
            safe_outdir,
            safe_docx,
        ]
        try:
            subprocess.run(
                cmd,
                check=True,
                capture_output=True,
                text=True,
                timeout=180,
                shell=False,
            )
        except subprocess.CalledProcessError as e:
            raise HTTPException(
                500,
                detail=f"LibreOffice failed: {e.stderr or e.stdout or str(e)}",
            ) from e
        except subprocess.TimeoutExpired as e:
            raise HTTPException(504, detail="LibreOffice timeout") from e
        base = os.path.splitext(os.path.basename(safe_docx))[0] + ".pdf"
        pdf_path = _assert_path_within_workdir(os.path.join(td, base), td)
        if not os.path.isfile(pdf_path):
            raise HTTPException(500, detail="PDF output missing after conversion")
        with open(pdf_path, "rb") as f:
            return f.read()


def _merge_pdfs(pdf_parts: List[bytes]) -> bytes:
    writer = PdfWriter()
    for part in pdf_parts:
        reader = PdfReader(io.BytesIO(part))
        for page in reader.pages:
            writer.add_page(page)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def _extract_document_xml(docx_bytes: bytes) -> str:
    try:
        zf = zipfile.ZipFile(io.BytesIO(docx_bytes))
    except zipfile.BadZipFile as e:
        raise HTTPException(400, "invalid docx zip") from e
    try:
        raw = zf.read("word/document.xml")
    except KeyError as e:
        raise HTTPException(400, "word/document.xml missing") from e
    finally:
        zf.close()
    return raw.decode("utf-8", errors="replace")


def _pretty_xml_for_diff(s: str) -> str:
    s = re.sub(r">\s*<", ">\n<", s)
    return s


def _normalize_fullwidth_punctuation_inside_jinja(text: str) -> str:
    """
    docxtpl 使用 Jinja2：将 {{ … }} / {% … %} 内的部分全角标点转为半角，减少 lexer 报错。

    注意：不得将全角冒号「：」转为半角「:」。半角冒号在 Jinja 的 {{ }} 中有语法含义，
    若变量名或说明里含「甲方：名称」等，转换后会变成「甲方:名称」并触发
    expected token 'end of print statement', got ':'。
    模板中变量名请避免使用半角冒号；若需中文冒号请保留全角「：」或改用下划线命名。
    """
    fw = str.maketrans(
        {
            "；": ";",
            "，": ",",
            "（": "(",
            "）": ")",
            "＝": "=",
            "！": "!",
            "？": "?",
            "｛": "{",
            "｝": "}",
            "［": "[",
            "］": "]",
        }
    )
    out: List[str] = []
    i = 0
    n = len(text)
    while i < n:
        if i + 2 <= n and text[i : i + 2] == "{{":
            close = "}}"
            start = i + 2
        elif i + 2 <= n and text[i : i + 2] == "{%":
            close = "%}"
            start = i + 2
        else:
            out.append(text[i])
            i += 1
            continue
        j = text.find(close, start)
        if j < 0:
            out.append(text[i:])
            break
        inner = text[start:j].translate(fw)
        out.append(text[i:start])
        out.append(inner)
        out.append(close)
        i = j + len(close)
    return "".join(out)


def _sanitize_ooxml_jinja_text_nodes(xml: str) -> str:
    """在 OOXML 文本节点内规范化 Jinja 片段（常见为 w:t；域代码用 w:instrText）。"""

    def repl_wt(m: re.Match) -> str:
        return m.group(1) + _normalize_fullwidth_punctuation_inside_jinja(m.group(2)) + m.group(3)

    xml = re.sub(r"(<w:t[^>]*>)([\s\S]*?)(</w:t>)", repl_wt, xml)
    xml = re.sub(
        r"(<w:instrText[^>]*>)([\s\S]*?)(</w:instrText>)",
        repl_wt,
        xml,
    )
    return xml


def _preprocess_docx_for_docxtpl(docx_bytes: bytes) -> bytes:
    """解压 docx，在 word 目录下各 xml 的文本节点中修正 Jinja 标点，再打包。"""
    try:
        zin = zipfile.ZipFile(io.BytesIO(docx_bytes), "r")
    except zipfile.BadZipFile:
        return docx_bytes
    zout = io.BytesIO()
    try:
        with zipfile.ZipFile(zout, "w", compression=zipfile.ZIP_DEFLATED) as zout_f:
            for info in zin.infolist():
                data = zin.read(info.filename)
                name = info.filename
                if (
                    name.startswith("word/")
                    and name.endswith(".xml")
                    and "/_rels/" not in name
                ):
                    try:
                        s = data.decode("utf-8")
                        s = _sanitize_ooxml_jinja_text_nodes(s)
                        data = s.encode("utf-8")
                    except UnicodeDecodeError:
                        pass
                zout_f.writestr(name, data, compress_type=zipfile.ZIP_DEFLATED)
    finally:
        zin.close()
    return zout.getvalue()


def _docx_to_html(docx_bytes: bytes) -> Tuple[str, List[Dict[str, Any]]]:
    """docx → HTML（mammoth），并从 HTML 中提取 {{…}} 占位符供前端与 variables_json 对齐。"""
    result = mammoth.convert_to_html(io.BytesIO(docx_bytes))
    html = result.value or ""
    variables: List[Dict[str, Any]] = []
    for i, match in enumerate(re.findall(r"\{\{([^\}]+)\}\}", html)):
        var_name = (match or "").strip()
        if not var_name:
            continue
        variables.append(
            {
                "id": f"var_{i}",
                "label": var_name,
                "placeholder": f"{{{{{var_name}}}}}",
                "kind": "text",
            }
        )
    return html, variables


def _stamp_pdf(pdf_bytes: bytes, lines: List[str]) -> bytes:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        page = doc[-1]
        y = page.rect.height - 28
        x = 40
        for line in reversed(lines):
            page.insert_text(
                fitz.Point(x, y),
                line,
                fontsize=8,
                color=(0.25, 0.25, 0.25),
            )
            y -= 11
        buf = io.BytesIO()
        doc.save(buf)
        return buf.getvalue()
    finally:
        doc.close()


def _fill_docx(
    template_bytes: bytes,
    variables: Dict[str, Any],
    image_bytes_map: Dict[str, bytes],
) -> bytes:
    # docxtpl==0.14.1 不支持 DocxTemplate(..., jinja_env=)；升级 docxtpl 后再考虑自定义 Jinja 环境
    with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as tmp_in:
        tmp_in.write(template_bytes)
        in_path = tmp_in.name
    out_path = in_path + ".out.docx"
    try:
        tpl = DocxTemplate(in_path)
        ctx: Dict[str, Any] = dict(variables)
        for key, img_bytes in image_bytes_map.items():
            ctx[key] = InlineImage(tpl, io.BytesIO(img_bytes), width=Mm(40))
        tpl.render(ctx)
        tpl.save(out_path)
        with open(out_path, "rb") as f:
            return f.read()
    finally:
        for p in (in_path, out_path):
            if os.path.isfile(p):
                try:
                    os.unlink(p)
                except OSError:
                    pass


@app.get("/health")
async def health() -> Dict[str, str]:
    return {"status": "ok", "service": "contract-convert"}


@app.post("/invoke")
async def invoke(request: Request) -> Response:
    _check_secret(request)
    try:
        body = await request.json()
    except Exception as e:
        raise HTTPException(400, "invalid json body") from e
    action = str(body.get("action") or "").strip()
    if not action:
        raise HTTPException(400, "missing action")

    if action == "docx_to_pdf":
        url = str(body.get("input_signed_url") or "").strip()
        if not url:
            raise HTTPException(400, "input_signed_url required")
        docx = await _download(url)
        pdf = _docx_to_pdf_lo(docx)
        return Response(content=pdf, media_type="application/pdf")

    if action == "merge_pdf":
        urls = body.get("input_signed_urls")
        if not isinstance(urls, list) or not urls:
            raise HTTPException(400, "input_signed_urls must be non-empty array")
        parts: List[bytes] = []
        for u in urls:
            if not isinstance(u, str) or not u.strip():
                raise HTTPException(400, "invalid url in input_signed_urls")
            parts.append(await _download(u.strip()))
        merged = _merge_pdfs(parts)
        return Response(content=merged, media_type="application/pdf")

    if action == "fill_docx":
        turl = str(body.get("template_signed_url") or "").strip()
        if not turl:
            raise HTTPException(400, "template_signed_url required")
        variables = body.get("variables")
        if variables is None:
            variables = {}
        if not isinstance(variables, dict):
            raise HTTPException(400, "variables must be object")
        img_urls = body.get("image_signed_urls")
        if img_urls is None:
            img_urls = {}
        if not isinstance(img_urls, dict):
            raise HTTPException(400, "image_signed_urls must be object")
        img_b64 = body.get("image_base64")
        if img_b64 is None:
            img_b64 = {}
        if not isinstance(img_b64, dict):
            raise HTTPException(400, "image_base64 must be object")
        template_bytes = await _download(turl)
        template_bytes = _preprocess_docx_for_docxtpl(template_bytes)
        img_map: Dict[str, bytes] = {}
        for k, v in img_urls.items():
            if not isinstance(k, str) or not k.strip():
                continue
            if not isinstance(v, str) or not v.strip():
                continue
            img_map[k.strip()] = await _download(v.strip())
        for k, v in img_b64.items():
            if not isinstance(k, str) or not k.strip():
                continue
            if not isinstance(v, str) or not v.strip():
                continue
            raw = v.strip()
            if "," in raw and raw.startswith("data:"):
                raw = raw.split(",", 1)[1]
            try:
                img_map[k.strip()] = base64.b64decode(raw, validate=False)
            except Exception as e:
                raise HTTPException(400, f"invalid base64 for image key {k!r}") from e
        try:
            out = _fill_docx(template_bytes, variables, img_map)
        except HTTPException:
            raise
        except Exception as e:
            msg = str(e)
            hint = ""
            if "end of print statement" in msg:
                hint = (
                    " 常见原因：占位符 {{…}} 内出现了半角冒号「:」（如误写了「键:值」样式）。"
                    "Jinja2 中「:」有特殊含义。请将 Word 模板变量改为不含半角冒号的名称，"
                    "推荐使用字母数字与下划线（如 party_a、签订日期），并与 variables_json 的 label 完全一致。"
                    "注意：不要在 {{ }} 里写「甲方：乙方」这种带冒号的说明性文案，冒号应放在占位符外。"
                )
            elif "unexpected" in msg.lower() and "：" in msg:
                hint = (
                    " 若错误与全角冒号「：」有关：请把变量名改为不含冒号或使用下划线，避免在 {{ }} 内使用易被误解析的标点。"
                )
            raise HTTPException(
                422,
                f"fill_docx 渲染失败：{e!s}。请核对 Word 模板中 {{变量}} 与 variables_json 的 label、以及图片占位是否齐全。{hint}",
            ) from e
        return Response(
            content=out,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )

    if action == "docx_diff":
        left = str(body.get("left_signed_url") or "").strip()
        right = str(body.get("right_signed_url") or "").strip()
        if not left or not right:
            raise HTTPException(400, "left_signed_url and right_signed_url required")
        lx = _pretty_xml_for_diff(_extract_document_xml(await _download(left)))
        rx = _pretty_xml_for_diff(_extract_document_xml(await _download(right)))
        diff_lines = list(
            difflib.unified_diff(
                lx.splitlines(),
                rx.splitlines(),
                fromfile="left/document.xml",
                tofile="right/document.xml",
                lineterm="",
            )
        )
        return JSONResponse(
            {
                "ok": True,
                "action": "docx_diff",
                "unified_diff": "\n".join(diff_lines),
                "line_count": len(diff_lines),
            }
        )

    if action == "pdf_stamp":
        url = str(body.get("input_signed_url") or "").strip()
        lines = body.get("lines")
        if not url:
            raise HTTPException(400, "input_signed_url required")
        if not isinstance(lines, list):
            raise HTTPException(400, "lines must be array")
        str_lines = [str(x) for x in lines if str(x).strip()]
        pdf_in = await _download(url)
        pdf_out = _stamp_pdf(pdf_in, str_lines)
        return Response(content=pdf_out, media_type="application/pdf")

    if action == "docx_to_html":
        url = str(body.get("input_signed_url") or "").strip()
        if not url:
            raise HTTPException(400, "input_signed_url required")
        docx = await _download(url)
        try:
            html, variables = _docx_to_html(docx)
        except Exception as e:
            raise HTTPException(422, f"docx_to_html 失败：{e!s}") from e
        return JSONResponse(
            {
                "ok": True,
                "action": "docx_to_html",
                "html": html,
                "variables": variables,
            }
        )

    if action == "capabilities":
        return JSONResponse(
            {
                "ok": True,
                "service": "contract-convert-service",
                "actions": [
                    "docx_to_pdf",
                    "merge_pdf",
                    "fill_docx",
                    "docx_diff",
                    "pdf_stamp",
                    "docx_to_html",
                ],
                "notes": {
                    "ca": "pdf_stamp 仅为页脚文字示意；法律效力 CA 请对接厂商/HSM。",
                    "word_binary_diff": "仅对比 word/document.xml 文本，非完整 OOXML 二进制 diff。",
                    "docx_to_html": "将 docx 转为 HTML 并提取 {{变量}}，供合同预览页使用。",
                },
            }
        )

    raise HTTPException(400, f"unknown action: {action}")
