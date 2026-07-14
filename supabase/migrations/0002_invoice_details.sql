-- 0002: readable table names + full vendor/bill-to detail columns
-- Run AFTER 0001, in Supabase Dashboard -> SQL Editor. Existing rows are preserved.

-- ── Rename tables ────────────────────────────────────────────────
alter table bills rename to invoices;
alter table bill_line_items rename to invoice_line_items;

alter table invoice_line_items rename column bill_id to invoice_id;
alter table extraction_attempts rename column bill_id to invoice_id;
alter table audit_log rename column bill_id to invoice_id;

-- ── Vendor details (issuer of the invoice) ───────────────────────
alter table invoices
    add column if not exists vendor_address text,
    add column if not exists vendor_tax_id text;          -- GSTIN / VAT / tax ID

-- ── Bill-to details (customer the invoice is addressed to) ───────
alter table invoices
    add column if not exists bill_to_name text,
    add column if not exists bill_to_address text,
    add column if not exists bill_to_tax_id text;

-- ── Money details from real-world (incl. Indian GST) invoices ────
alter table invoices
    add column if not exists tax_inclusive boolean not null default false,
    add column if not exists tax_breakdown jsonb not null default '[]',  -- [{name,rate,amount}]
    add column if not exists discount_amount numeric,
    add column if not exists round_off numeric,
    add column if not exists payment_terms text;

-- ── Line item detail ─────────────────────────────────────────────
alter table invoice_line_items
    add column if not exists hsn_sac text;                -- HSN/SAC code (Indian GST)

-- ── Refresh RLS policy names for readability ─────────────────────
drop policy if exists "own bills" on invoices;
drop policy if exists "own line items" on invoice_line_items;

create policy "own invoices" on invoices
    for select using (auth.uid() = user_id);
create policy "own invoice line items" on invoice_line_items
    for select using (
        exists (select 1 from invoices i where i.id = invoice_id and i.user_id = auth.uid())
    );
