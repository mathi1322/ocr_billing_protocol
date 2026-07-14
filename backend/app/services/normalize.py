"""Format normalization — turn any supported upload into model-ready inputs.

Output contract (`NormalizedDoc`):
- `pdf_bytes` — set when the source is (or was converted to) a PDF.
  Claude consumes this directly as a base64 document block.
- `page_images` — JPEG bytes per page. OpenAI consumes these as image inputs.
"""

import io
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

import pillow_heif
from pdf2image import convert_from_bytes
from PIL import Image, ImageOps

pillow_heif.register_heif_opener()

MAX_LONG_EDGE = 2576  # matches current vision-model native resolution limits
JPEG_QUALITY = 90

IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
PDF_TYPES = {"application/pdf"}
WORD_TYPES = {
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
SUPPORTED_TYPES = IMAGE_TYPES | PDF_TYPES | WORD_TYPES


class UnsupportedFormatError(Exception):
    pass


@dataclass
class NormalizedDoc:
    page_images: list[bytes] = field(default_factory=list)  # JPEG per page
    pdf_bytes: bytes | None = None
    page_count: int = 0


def _prepare_image(img: Image.Image) -> bytes:
    img = ImageOps.exif_transpose(img)  # apply camera rotation
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    long_edge = max(img.size)
    if long_edge > MAX_LONG_EDGE:
        scale = MAX_LONG_EDGE / long_edge
        img = img.resize((round(img.width * scale), round(img.height * scale)))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=JPEG_QUALITY)
    return buf.getvalue()


def _word_to_pdf(data: bytes, suffix: str) -> bytes:
    """Convert DOC/DOCX to PDF via headless LibreOffice."""
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / f"input{suffix}"
        src.write_bytes(data)
        subprocess.run(
            ["libreoffice", "--headless", "--convert-to", "pdf", "--outdir", tmp, str(src)],
            check=True,
            capture_output=True,
            timeout=120,
        )
        return (Path(tmp) / f"input.pdf").read_bytes()


def normalize(data: bytes, mime_type: str, max_pages: int = 20) -> NormalizedDoc:
    if mime_type not in SUPPORTED_TYPES:
        raise UnsupportedFormatError(
            f"Unsupported file type {mime_type!r}. Supported: PDF, JPEG/PNG/WEBP/HEIC, DOC/DOCX."
        )

    if mime_type in WORD_TYPES:
        suffix = ".docx" if mime_type.endswith("document") else ".doc"
        data = _word_to_pdf(data, suffix)
        mime_type = "application/pdf"

    if mime_type in PDF_TYPES:
        pages = convert_from_bytes(data, dpi=200)
        if len(pages) > max_pages:
            raise UnsupportedFormatError(
                f"Document has {len(pages)} pages; the limit is {max_pages}."
            )
        return NormalizedDoc(
            page_images=[_prepare_image(p) for p in pages],
            pdf_bytes=data,
            page_count=len(pages),
        )

    # Single image
    img = Image.open(io.BytesIO(data))
    return NormalizedDoc(page_images=[_prepare_image(img)], page_count=1)
