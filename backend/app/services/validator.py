"""Validation layer — deterministic rules that decide whether an extraction
is trustworthy, needs review, or should trigger the Claude fallback.

Money identities handled (from real invoice samples):
- Tax-exclusive (classic):      subtotal + tax - discount + round_off = total
- Tax-inclusive (Indian GST /
  MRP retail):                  subtotal - discount + round_off = total
  (tax is informational — already inside the prices)
"""

from datetime import date, datetime, timedelta

from app.schemas.bill import ExtractedBill, ValidationResult

REL_TOLERANCE = 0.01  # 1% for rounding across many line items
ABS_TOLERANCE = 1.0   # ±1 currency unit — whole-rupee rounding is standard in India


def _close(a: float, b: float) -> bool:
    return abs(a - b) <= max(abs(b) * REL_TOLERANCE, ABS_TOLERANCE)


def validate_extraction(bill: ExtractedBill) -> ValidationResult:
    errors: list[str] = []
    flagged: list[str] = []

    # Required fields
    if not bill.vendor_name.strip():
        errors.append("vendor_name is empty")
    if not bill.invoice_number.strip():
        errors.append("invoice_number is empty")
    if bill.total_amount <= 0:
        errors.append("total_amount must be positive")

    # Date sanity
    try:
        d = datetime.fromisoformat(bill.invoice_date).date()
        today = date.today()
        if d > today + timedelta(days=1):
            errors.append("invoice_date is in the future")
        elif d < today - timedelta(days=365 * 10):
            errors.append("invoice_date is more than 10 years old")
    except ValueError:
        errors.append(f"invoice_date is not ISO 8601: {bill.invoice_date!r}")

    # Currency
    if len(bill.currency) != 3 or not bill.currency.isalpha():
        errors.append(f"currency is not a 3-letter ISO code: {bill.currency!r}")

    # Line items should sum to the printed subtotal
    if bill.line_items:
        items_sum = sum(li.amount for li in bill.line_items)
        reference = bill.subtotal if bill.subtotal is not None else bill.total_amount
        if not _close(items_sum, reference):
            errors.append(
                f"line items sum to {items_sum:.2f} but "
                f"{'subtotal' if bill.subtotal is not None else 'total'} is {reference:.2f}"
            )
    else:
        flagged.append("line_items")

    # Tax components should sum to the total tax
    if bill.tax_breakdown and bill.tax_amount is not None:
        components = sum(t.amount for t in bill.tax_breakdown)
        if not _close(components, bill.tax_amount):
            flagged.append("tax_breakdown")

    # The core money identity
    if bill.subtotal is not None:
        expected = bill.subtotal
        if not bill.tax_inclusive and bill.tax_amount is not None:
            expected += bill.tax_amount
        if bill.discount_amount is not None:
            expected -= bill.discount_amount
        if bill.round_off is not None:
            expected += bill.round_off
        if not _close(expected, bill.total_amount):
            label = "tax-inclusive" if bill.tax_inclusive else "tax-exclusive"
            errors.append(
                f"money identity failed ({label}): expected total ≈ {expected:.2f}, "
                f"got {bill.total_amount:.2f}"
            )

    # Soft signals
    if bill.confidence_notes:
        flagged.append("confidence_notes")
    for field in ("subtotal", "tax_amount", "due_date", "vendor_address", "bill_to_name"):
        if getattr(bill, field) is None:
            flagged.append(field)

    # Score: start at 1.0; hard errors dominate, flags nibble
    score = max(0.0, 1.0 - 0.3 * len(errors) - 0.05 * len(flagged))
    return ValidationResult(score=score, errors=errors, flagged_fields=flagged)
