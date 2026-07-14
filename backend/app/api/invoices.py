"""Invoices API — Phase 1 vertical slice.

Upload runs the pipeline inline for now; Phase 2 moves it onto the RQ worker
with an SSE progress stream.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile

from app.config import get_settings
from app.deps import get_current_user_id, get_supabase_admin
from app.services.normalize import UnsupportedFormatError, normalize
from app.services.pipeline import run_pipeline

router = APIRouter(prefix="/api/invoices", tags=["invoices"])

MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB


@router.post("")
async def upload_invoice(file: UploadFile, user_id: str = Depends(get_current_user_id)):
    settings = get_settings()
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File exceeds the 25 MB limit")

    try:
        doc = normalize(data, file.content_type or "", settings.extraction_max_pages)
    except UnsupportedFormatError as exc:
        raise HTTPException(415, str(exc)) from exc

    invoice_id = str(uuid.uuid4())
    supabase = get_supabase_admin()

    # Keep the original for the review UI
    storage_key = f"{invoice_id}/{file.filename}"
    supabase.storage.from_(settings.storage_bucket).upload(
        storage_key, data, {"content-type": file.content_type or "application/octet-stream"}
    )

    result = run_pipeline(doc)

    record = {
        "id": invoice_id,
        "user_id": user_id,
        "status": result.status,
        "source_file_key": storage_key,
        "source_filename": file.filename,
        "mime_type": file.content_type,
        "extraction_json": result.bill.model_dump() if result.bill else None,
        "confidence_score": result.validation.score if result.validation else None,
        "flagged_fields": result.validation.flagged_fields if result.validation else [],
        "winning_provider": result.winning_provider,
    }
    if result.bill:
        b = result.bill
        # Every extracted field gets its own column for listing/filtering/reporting
        record.update(
            {
                "vendor_name": b.vendor_name,
                "vendor_address": b.vendor_address,
                "vendor_tax_id": b.vendor_tax_id,
                "bill_to_name": b.bill_to_name,
                "bill_to_address": b.bill_to_address,
                "bill_to_tax_id": b.bill_to_tax_id,
                "invoice_number": b.invoice_number,
                "invoice_date": b.invoice_date,
                "due_date": b.due_date,
                "currency": b.currency,
                "subtotal": b.subtotal,
                "tax_inclusive": b.tax_inclusive,
                "tax_breakdown": [t.model_dump() for t in b.tax_breakdown],
                "tax_amount": b.tax_amount,
                "discount_amount": b.discount_amount,
                "round_off": b.round_off,
                "total_amount": b.total_amount,
                "payment_terms": b.payment_terms,
            }
        )

    try:
        supabase.table("invoices").insert(record).execute()
    except Exception as exc:
        if "PGRST205" in str(exc):
            raise HTTPException(
                503,
                "Database schema not initialized or outdated. Run the SQL files in "
                "supabase/migrations/ (0001 then 0002) in the Supabase Dashboard, then retry.",
            ) from exc
        raise

    if result.bill and result.bill.line_items:
        supabase.table("invoice_line_items").insert(
            [
                {
                    "invoice_id": invoice_id,
                    "description": li.description,
                    "hsn_sac": li.hsn_sac,
                    "quantity": li.quantity,
                    "unit_price": li.unit_price,
                    "amount": li.amount,
                    "position": i,
                }
                for i, li in enumerate(result.bill.line_items)
            ]
        ).execute()

    for a in result.attempts:
        supabase.table("extraction_attempts").insert(
            {
                "invoice_id": invoice_id,
                "provider": a.provider,
                "latency_ms": a.latency_ms,
                "validation_score": a.validation.score if a.validation else None,
                "validation_errors": a.validation.errors if a.validation else None,
                "error": a.error,
            }
        ).execute()

    return record


@router.get("")
async def list_invoices(
    user_id: str = Depends(get_current_user_id),
    status: str | None = Query(default=None),
    q: str | None = Query(default=None, description="Search vendor, bill-to, or invoice number"),
    limit: int = Query(default=100, le=500),
):
    supabase = get_supabase_admin()
    query = (
        supabase.table("invoices")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
    )
    if status:
        query = query.eq("status", status)
    if q:
        pattern = f"%{q}%"
        query = query.or_(
            f"vendor_name.ilike.{pattern},bill_to_name.ilike.{pattern},invoice_number.ilike.{pattern}"
        )
    return query.execute().data


@router.get("/{invoice_id}")
async def get_invoice(invoice_id: str, user_id: str = Depends(get_current_user_id)):
    settings = get_settings()
    supabase = get_supabase_admin()
    res = (
        supabase.table("invoices")
        .select("*")
        .eq("id", invoice_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(404, "Invoice not found")
    invoice = res.data[0]
    line_items = (
        supabase.table("invoice_line_items")
        .select("*")
        .eq("invoice_id", invoice_id)
        .order("position")
        .execute()
    )
    file_url = None
    if invoice.get("source_file_key"):
        try:
            signed = supabase.storage.from_(settings.storage_bucket).create_signed_url(
                invoice["source_file_key"], 3600
            )
            file_url = signed.get("signedURL") or signed.get("signedUrl")
        except Exception:
            file_url = None
    return {**invoice, "line_items": line_items.data, "file_url": file_url}
