"""Primary extractor — OpenAI vision with structured outputs."""

import base64

from openai import OpenAI

from app.config import get_settings
from app.schemas.bill import ExtractedBill
from app.services.normalize import NormalizedDoc
from app.services.prompts import EXTRACTION_SYSTEM_PROMPT as SYSTEM_PROMPT


def extract_with_openai(doc: NormalizedDoc) -> ExtractedBill:
    settings = get_settings()
    client = OpenAI(api_key=settings.openai_api_key)

    content: list[dict] = [
        {"type": "text", "text": "Extract the billing data from this document."}
    ]
    for page in doc.page_images:
        b64 = base64.b64encode(page).decode()
        content.append(
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}}
        )

    completion = client.beta.chat.completions.parse(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": content},
        ],
        response_format=ExtractedBill,
    )
    parsed = completion.choices[0].message.parsed
    if parsed is None:
        raise ValueError("OpenAI returned no parseable structured output")
    return parsed
