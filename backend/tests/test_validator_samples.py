"""Golden-value tests for the validation layer, built from four real invoices:

1. OpenAI (US SaaS)      — tax-exclusive, IGST on top
2. TEAM10x (Indian GST)  — TAX-INCLUSIVE pricing, CGST+SGST split
3. Joyalukkas (jeweller) — tax-exclusive + ROUND-OFF settlement
4. Nykaa (retail POS)    — tax-inclusive + invoice-level DISCOUNT

These encode the printed numbers from the actual documents. If the validator
rejects any of them, real invoices would be falsely routed to fallback/review.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.schemas.bill import ExtractedBill, LineItem, TaxLine
from app.services.validator import validate_extraction


def test_openai_invoice_tax_exclusive():
    bill = ExtractedBill(
        vendor_name="OpenAI OpCo, LLC",
        vendor_tax_id="9925USA29095OS3",
        bill_to_name="Living Fantasy",
        bill_to_address="Heritage Apartment, Puliakulam, Coimbatore 641045, Tamil Nadu, India",
        invoice_number="6MVNSM8I-0002",
        invoice_date="2026-07-14",
        due_date="2026-07-14",
        currency="USD",
        line_items=[LineItem(description="OpenAI API usage credit", quantity=1, unit_price=5.0, amount=5.0)],
        subtotal=5.00,
        tax_inclusive=False,
        tax_amount=0.90,
        tax_breakdown=[TaxLine(name="IGST", rate=18, amount=0.90)],
        total_amount=5.90,
    )
    result = validate_extraction(bill)
    assert result.errors == [], result.errors
    assert result.score >= 0.85


def test_team10x_invoice_tax_inclusive_cgst_sgst():
    bill = ExtractedBill(
        vendor_name="TEAM10x TRADING",
        vendor_tax_id="33BHUPR0468P1ZF",
        bill_to_name="Ms. Parvatha Varthini S EGM579",
        invoice_number="TEAM10x/26-27/6",
        invoice_date="2026-05-29",
        due_date="2026-06-05",
        currency="INR",
        line_items=[
            LineItem(
                description="Training charges - Equity and F&O Trading",
                hsn_sac="999293",
                amount=8000.00,
            )
        ],
        subtotal=8000.00,           # printed as "Sub Total (Tax Inclusive)"
        tax_inclusive=True,
        tax_amount=1220.34,
        tax_breakdown=[
            TaxLine(name="CGST9", rate=9, amount=610.17),
            TaxLine(name="SGST9", rate=9, amount=610.17),
        ],
        total_amount=8000.00,       # equals subtotal because tax is inside
    )
    result = validate_extraction(bill)
    assert result.errors == [], result.errors


def test_joyalukkas_invoice_round_off():
    bill = ExtractedBill(
        vendor_name="JOYALUKKAS INDIA LIMITED",
        vendor_tax_id="33AABCJ1087G1ZU",
        bill_to_name="PARVATHA VARTHINI S",
        invoice_number="IV25CBH187039482",
        invoice_date="2026-01-09",
        currency="INR",
        line_items=[
            LineItem(description="SILVERCHAIN_925_MRP", hsn_sac="71131130", quantity=1, amount=1991.27)
        ],
        subtotal=1991.27,           # taxable value
        tax_inclusive=False,
        tax_amount=59.74,
        tax_breakdown=[
            TaxLine(name="CGST", rate=1.5, amount=29.87),
            TaxLine(name="SGST", rate=1.5, amount=29.87),
        ],
        round_off=-1.01,            # 2,051.01 settled as 2,050.00
        total_amount=2050.00,
    )
    result = validate_extraction(bill)
    assert result.errors == [], result.errors


def test_nykaa_invoice_tax_inclusive_with_discount():
    bill = ExtractedBill(
        vendor_name="FSN BRANDS MARKETING PVT. LTD.",
        vendor_tax_id="33AACCF5505E1Z6",
        invoice_number="N112026070400056",
        invoice_date="2026-07-04",
        currency="INR",
        line_items=[
            LineItem(description="Nykaa Envelope", quantity=1, unit_price=4.25, amount=4.25),
            LineItem(
                description="Wanderlust Dreaming of Paris Fruity Long lasting Perfume",
                quantity=1,
                unit_price=349.0,
                amount=296.65,
            ),
        ],
        subtotal=301.00,            # printed SUBTOTAL (MRP retail, tax inside)
        tax_inclusive=True,
        tax_amount=45.25,           # "Tax Amount (inc.)"
        tax_breakdown=[
            TaxLine(name="CGST", rate=9, amount=22.63),
            TaxLine(name="SGST", rate=9, amount=22.63),
        ],
        discount_amount=4.25,       # "Other Discount"
        total_amount=297.00,        # NET PAYABLE (296.75 rounded)
    )
    result = validate_extraction(bill)
    assert result.errors == [], result.errors


def test_broken_math_is_rejected():
    """A genuinely wrong extraction must still fail — tolerances can't be so loose
    that bad numbers slip through."""
    bill = ExtractedBill(
        vendor_name="Bogus Corp",
        invoice_number="X-1",
        invoice_date="2026-07-01",
        currency="INR",
        line_items=[LineItem(description="Widget", amount=100.0)],
        subtotal=100.0,
        tax_inclusive=False,
        tax_amount=18.0,
        total_amount=250.0,  # nonsense: should be ~118
    )
    result = validate_extraction(bill)
    assert any("money identity" in e for e in result.errors)
    assert result.score < 0.85
