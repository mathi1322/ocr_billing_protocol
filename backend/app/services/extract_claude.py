"""Fallback extractor — Anthropic Claude with structured outputs.

Claude reads PDFs natively (base64 document block), so scanned PDFs go in
whole rather than page-by-page. Image uploads go in as image blocks.
"""

import base64

import anthropic

from app.config import get_settings
from app.schemas.bill import ExtractedBill
from app.services.normalize import NormalizedDoc
from app.services.prompts import EXTRACTION_SYSTEM_PROMPT as SYSTEM_PROMPT


def extract_with_claude(doc: NormalizedDoc) -> ExtractedBill:
    settings = get_settings()
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    content: list[dict] = []
    if doc.pdf_bytes is not None:
        content.append(
            {
                "type": "document",
                "source": {
                    "type": "base64",
                    "media_type": "application/pdf",
                    "data": base64.b64encode(doc.pdf_bytes).decode(),
                },
            }
        )
    else:
        for page in doc.page_images:
            content.append(
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/jpeg",
                        "data": base64.b64encode(page).decode(),
                    },
                }
            )
    content.append({"type": "text", "text": "Extract the billing data from this document."})

    response = client.messages.parse(
        model=settings.anthropic_model,
        max_tokens=16000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": content}],
        output_format=ExtractedBill,
    )
    if response.parsed_output is None:
        raise ValueError("Claude returned no parseable structured output")
    return response.parsed_output
