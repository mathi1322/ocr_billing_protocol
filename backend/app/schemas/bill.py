"""Canonical bill schema — the single source of truth for extraction.

The same JSON schema (via structured outputs) is sent to both OpenAI and
Claude, so every extraction — whichever provider produced it — parses into
the same shape. Designed against real-world samples including Indian GST
invoices (CGST/SGST/IGST splits, tax-inclusive pricing, round-off, HSN/SAC).
"""

from pydantic import BaseModel, Field


class LineItem(BaseModel):
    description: str
    hsn_sac: str | None = Field(default=None, description="HSN/SAC code if printed (Indian GST)")
    quantity: float | None = None
    unit_price: float | None = None
    amount: float


class TaxLine(BaseModel):
    name: str = Field(description="Tax component name as printed, e.g. CGST, SGST, IGST, VAT")
    rate: float | None = Field(default=None, description="Percentage, e.g. 9 for 9%")
    amount: float


class ExtractedBill(BaseModel):
    vendor_name: str
    vendor_address: str | None = None
    vendor_tax_id: str | None = Field(default=None, description="Vendor GSTIN / VAT / tax ID")
    bill_to_name: str | None = Field(
        default=None, description="Customer / recipient the bill is addressed to"
    )
    bill_to_address: str | None = None
    bill_to_tax_id: str | None = Field(default=None, description="Customer's GSTIN / VAT / tax ID")
    invoice_number: str
    invoice_date: str = Field(description="ISO 8601 date, e.g. 2026-07-14")
    due_date: str | None = None
    currency: str = Field(description="ISO 4217 code, e.g. INR, USD")
    line_items: list[LineItem]
    subtotal: float | None = Field(
        default=None, description="Sum of line items as printed (before invoice-level discount)"
    )
    discount_amount: float | None = Field(
        default=None, description="Invoice-level discount as a positive number"
    )
    tax_inclusive: bool = Field(
        default=False,
        description=(
            "True when line prices/subtotal already INCLUDE tax "
            "(e.g. 'Sub Total (Tax Inclusive)', MRP-based retail invoices)"
        ),
    )
    tax_amount: float | None = Field(
        default=None, description="Total tax (sum of all components)"
    )
    tax_breakdown: list[TaxLine] = Field(
        default_factory=list,
        description="Individual tax components as printed, e.g. CGST 9% + SGST 9%",
    )
    round_off: float | None = Field(
        default=None,
        description="Rounding adjustment, signed (e.g. -1.01 when ₹2,051.01 is settled as ₹2,050)",
    )
    total_amount: float = Field(description="Final invoice total / net payable")
    payment_terms: str | None = None
    confidence_notes: str | None = Field(
        default=None,
        description="Fields that were unreadable, guessed, or ambiguous in the source document",
    )


class ValidationResult(BaseModel):
    score: float
    errors: list[str]
    flagged_fields: list[str]

    @property
    def passed(self) -> bool:
        return not self.errors
