"""Smoke test: generate a sample invoice image, extract it with the real
pipeline (OpenAI primary), and run the validation layer on the result.

Usage:  .venv/bin/python scripts/smoke_extract.py [path/to/bill.pdf|jpg|png]
Without an argument it generates a synthetic invoice so the expected values
are known and checkable.
"""

import io
import json
import mimetypes
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from PIL import Image, ImageDraw

from app.services.normalize import normalize
from app.services.pipeline import run_pipeline

EXPECTED = {
    "vendor_name": "Acme Office Supplies Pvt Ltd",
    "invoice_number": "INV-2026-0042",
    "invoice_date": "2026-07-01",
    "currency": "INR",
    "subtotal": 1250.00,
    "tax_amount": 225.00,
    "total_amount": 1475.00,
}


def make_sample_invoice() -> bytes:
    img = Image.new("RGB", (1240, 1550), "white")
    d = ImageDraw.Draw(img)

    def text(xy, s, size=28, bold=False):
        try:
            from PIL import ImageFont

            font = ImageFont.load_default(size=size)
        except Exception:
            font = None
        d.text(xy, s, fill="black", font=font)

    text((80, 60), "Acme Office Supplies Pvt Ltd", size=44)
    text((80, 120), "12 MG Road, Bengaluru, KA 560001", size=24)
    text((80, 155), "GSTIN: 29ABCDE1234F1Z5", size=24)

    text((80, 240), "TAX INVOICE", size=36)
    text((80, 300), "Invoice No: INV-2026-0042", size=26)
    text((80, 340), "Invoice Date: 01-Jul-2026", size=26)
    text((80, 380), "Due Date: 31-Jul-2026", size=26)
    text((80, 420), "Payment Terms: Net 30", size=26)

    text((80, 500), "Description                              Qty     Unit Price      Amount", size=26)
    d.line((80, 540, 1160, 540), fill="black", width=2)
    text((80, 560), "A4 Paper Ream (500 sheets)                10        45.00        450.00", size=26)
    text((80, 600), "Ballpoint Pens (box of 50)                 4       125.00        500.00", size=26)
    text((80, 640), "Stapler Heavy Duty                         2       150.00        300.00", size=26)
    d.line((80, 690, 1160, 690), fill="black", width=2)

    text((700, 730), "Subtotal:      INR 1,250.00", size=28)
    text((700, 775), "GST (18%):     INR   225.00", size=28)
    text((700, 830), "TOTAL:         INR 1,475.00", size=34)

    text((80, 950), "Thank you for your business!", size=24)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def main() -> None:
    if len(sys.argv) > 1:
        path = Path(sys.argv[1])
        data = path.read_bytes()
        mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        expected = None
        print(f"Extracting from {path} ({mime})")
    else:
        data = make_sample_invoice()
        mime = "image/png"
        expected = EXPECTED
        print("Extracting from generated sample invoice (PNG)")

    doc = normalize(data, mime)
    result = run_pipeline(doc)

    print(f"\nstatus            : {result.status}")
    print(f"winning provider  : {result.winning_provider}")
    for a in result.attempts:
        score = f"{a.validation.score:.2f}" if a.validation else "-"
        print(f"  attempt [{a.provider}] latency={a.latency_ms}ms score={score} error={a.error}")

    if result.bill is None:
        print("\nNo extraction produced — see errors above.")
        sys.exit(1)

    print("\nExtracted bill:")
    print(json.dumps(result.bill.model_dump(), indent=2))

    if result.validation:
        print(f"\nvalidation score  : {result.validation.score:.2f}")
        print(f"validation errors : {result.validation.errors or 'none'}")
        print(f"flagged fields    : {result.validation.flagged_fields or 'none'}")

    if expected:
        print("\nField check vs known values:")
        ok = True
        for field, want in expected.items():
            got = getattr(result.bill, field)
            match = (abs(got - want) < 0.01) if isinstance(want, float) else (got == want)
            ok &= match
            print(f"  {'PASS' if match else 'FAIL'}  {field}: got {got!r}, expected {want!r}")
        sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
