"""Invoices API — Phase 1 vertical slice.

Upload runs the pipeline inline for now; Phase 2 moves it onto the RQ worker
with an SSE progress stream.
"""

import csv
import hashlib
import io
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from openpyxl import Workbook

from app.config import get_settings
from app.deps import get_current_user_id, get_supabase_admin
from app.services.normalize import UnsupportedFormatError, normalize
from app.services.pipeline import run_pipeline

router = APIRouter(prefix="/api/invoices", tags=["invoices"])

MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB


@router.post("")
async def upload_invoice(
    file: UploadFile,
    user_id: str = Depends(get_current_user_id),
    force: bool = Query(default=False, description="Re-extract even if the same file exists"),
):
    settings = get_settings()
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File exceeds the 25 MB limit")

    supabase = get_supabase_admin()

    # Gate 1 — dedup: same bytes already extracted for this user? Tell the
    # client (409) so it can ask the user; only force=true proceeds and spends.
    content_hash = hashlib.sha256(data).hexdigest()
    if not force:
        existing = (
            supabase.table("invoices")
            .select("id, vendor_name, invoice_number, invoice_date")
            .eq("user_id", user_id)
            .eq("content_hash", content_hash)
            .limit(1)
            .execute()
        )
        if existing.data:
            ex = existing.data[0]
            raise HTTPException(
                409,
                detail={
                    "code": "duplicate_file",
                    "existing_id": ex["id"],
                    "vendor_name": ex.get("vendor_name"),
                    "invoice_number": ex.get("invoice_number"),
                    "invoice_date": ex.get("invoice_date"),
                },
            )

    # Gate 2 — daily extraction cap: protects the AI budget from retry loops
    # and runaway accounts.
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    used_today = (
        supabase.table("invoices")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .gte("created_at", today_start.isoformat())
        .execute()
    ).count or 0
    if used_today >= settings.extraction_daily_limit:
        raise HTTPException(
            429,
            f"Daily extraction limit reached ({settings.extraction_daily_limit}/day). "
            "Try again tomorrow or raise EXTRACTION_DAILY_LIMIT.",
        )

    try:
        doc = normalize(data, file.content_type or "", settings.extraction_max_pages)
    except UnsupportedFormatError as exc:
        raise HTTPException(415, str(exc)) from exc

    invoice_id = str(uuid.uuid4())

    # Keep the original for the review UI
    storage_key = f"{invoice_id}/{file.filename}"
    supabase.storage.from_(settings.storage_bucket).upload(
        storage_key, data, {"content-type": file.content_type or "application/octet-stream"}
    )

    result = run_pipeline(doc)

    record = {
        "id": invoice_id,
        "user_id": user_id,
        "content_hash": content_hash,
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


def _filtered_invoices_query(
    user_id: str,
    status: str | None,
    q: str | None,
    date_from: str | None,
    date_to: str | None,
    limit: int,
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
    if date_from:
        query = query.gte("invoice_date", date_from)
    if date_to:
        query = query.lte("invoice_date", date_to)
    return query


@router.get("")
async def list_invoices(
    user_id: str = Depends(get_current_user_id),
    status: str | None = Query(default=None),
    q: str | None = Query(default=None, description="Search vendor, bill-to, or invoice number"),
    date_from: str | None = Query(default=None, description="Invoice date >= (YYYY-MM-DD)"),
    date_to: str | None = Query(default=None, description="Invoice date <= (YYYY-MM-DD)"),
    limit: int = Query(default=100, le=500),
):
    return _filtered_invoices_query(user_id, status, q, date_from, date_to, limit).execute().data


EXPORT_COLUMNS = [
    ("invoice_number", "Invoice #"),
    ("invoice_date", "Date"),
    ("due_date", "Due date"),
    ("vendor_name", "Supplier"),
    ("vendor_tax_id", "Supplier tax ID"),
    ("bill_to_name", "Customer"),
    ("bill_to_tax_id", "Customer tax ID"),
    ("currency", "Currency"),
    ("subtotal", "Subtotal"),
    ("discount_amount", "Discount"),
    ("tax_amount", "Tax"),
    ("tax_inclusive", "Tax inclusive"),
    ("round_off", "Round off"),
    ("total_amount", "Total"),
    ("status", "Status"),
    ("confidence_score", "Confidence"),
    ("winning_provider", "Extracted by"),
    ("source_filename", "Source file"),
    ("created_at", "Uploaded at"),
]

ITEM_COLUMNS = [
    ("invoice_number", "Invoice #"),
    ("vendor_name", "Supplier"),
    ("description", "Description"),
    ("hsn_sac", "HSN/SAC"),
    ("quantity", "Qty"),
    ("unit_price", "Unit price"),
    ("amount", "Amount"),
]


@router.get("/export")
async def export_invoices(
    user_id: str = Depends(get_current_user_id),
    format: str = Query(default="csv", pattern="^(csv|xlsx)$"),
    status: str | None = Query(default=None),
    q: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
):
    """Download all (filtered) invoices as CSV, or as an Excel workbook with
    a second sheet for line items. Opens directly in Excel / Google Sheets."""
    supabase = get_supabase_admin()
    invoices = (
        _filtered_invoices_query(user_id, status, q, date_from, date_to, limit=1000)
        .execute()
        .data
    )

    ids = [inv["id"] for inv in invoices]
    items = (
        supabase.table("invoice_line_items")
        .select("*")
        .in_("invoice_id", ids)
        .order("position")
        .execute()
        .data
        if ids
        else []
    )
    by_id = {inv["id"]: inv for inv in invoices}
    items_by_invoice: dict[str, list[dict]] = {}
    for item in items:
        items_by_invoice.setdefault(item["invoice_id"], []).append(item)

    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    if format == "csv":
        # Flat format: one row per line item, invoice columns repeated on each
        # row (pivot-friendly). Invoices without items still get one row.
        item_cols = [
            ("description", "Item description"),
            ("hsn_sac", "Item HSN/SAC"),
            ("quantity", "Item qty"),
            ("unit_price", "Item unit price"),
            ("amount", "Item amount"),
        ]
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(
            [label for _, label in EXPORT_COLUMNS] + [label for _, label in item_cols]
        )
        for inv in invoices:
            inv_values = [inv.get(key) for key, _ in EXPORT_COLUMNS]
            inv_items = items_by_invoice.get(inv["id"], [])
            if inv_items:
                for item in inv_items:
                    writer.writerow(inv_values + [item.get(key) for key, _ in item_cols])
            else:
                writer.writerow(inv_values + [None] * len(item_cols))
        return StreamingResponse(
            iter([buf.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="invoices-{stamp}.csv"'},
        )

    # xlsx — invoices sheet + line items sheet

    wb = Workbook()
    ws = wb.active
    ws.title = "Invoices"
    ws.append([label for _, label in EXPORT_COLUMNS])
    for inv in invoices:
        ws.append([inv.get(key) for key, _ in EXPORT_COLUMNS])

    ws_items = wb.create_sheet("Line items")
    ws_items.append([label for _, label in ITEM_COLUMNS])
    for item in items:
        parent = by_id.get(item["invoice_id"], {})
        row = {**item, "invoice_number": parent.get("invoice_number"),
               "vendor_name": parent.get("vendor_name")}
        ws_items.append([row.get(key) for key, _ in ITEM_COLUMNS])

    out = io.BytesIO()
    wb.save(out)
    out.seek(0)
    return StreamingResponse(
        out,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="invoices-{stamp}.xlsx"'},
    )


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
