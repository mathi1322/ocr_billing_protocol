-- OCR Billing App — initial schema
-- Run in Supabase Dashboard -> SQL Editor, or `supabase db push` with the CLI.

create table if not exists bills (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id),
    status text not null default 'uploaded'
        check (status in ('uploaded','processing','extracted','needs_review','approved','rejected')),
    source_file_key text not null,
    source_filename text,
    mime_type text,

    -- denormalized headline fields (kept in sync from extraction_json on write)
    vendor_name text,
    invoice_number text,
    invoice_date date,
    due_date date,
    currency text,
    subtotal numeric,
    tax_amount numeric,
    total_amount numeric,

    extraction_json jsonb,
    confidence_score numeric,
    flagged_fields jsonb default '[]',
    winning_provider text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists bill_line_items (
    id uuid primary key default gen_random_uuid(),
    bill_id uuid not null references bills(id) on delete cascade,
    description text not null,
    quantity numeric,
    unit_price numeric,
    amount numeric not null,
    position int not null default 0
);

create table if not exists extraction_attempts (
    id uuid primary key default gen_random_uuid(),
    bill_id uuid not null references bills(id) on delete cascade,
    provider text not null,
    model text,
    latency_ms int,
    input_tokens int,
    output_tokens int,
    validation_score numeric,
    validation_errors jsonb,
    error text,
    raw_response jsonb,
    created_at timestamptz not null default now()
);

create table if not exists audit_log (
    id uuid primary key default gen_random_uuid(),
    bill_id uuid not null references bills(id) on delete cascade,
    user_id uuid references auth.users(id),
    action text not null,
    diff jsonb,
    created_at timestamptz not null default now()
);

create index if not exists bills_status_idx on bills(status);
create index if not exists bills_user_idx on bills(user_id);
create index if not exists attempts_bill_idx on extraction_attempts(bill_id);

-- Row-level security: users see only their own bills.
-- The backend uses the service-role key and bypasses RLS.
alter table bills enable row level security;
alter table bill_line_items enable row level security;
alter table extraction_attempts enable row level security;
alter table audit_log enable row level security;

create policy "own bills" on bills
    for select using (auth.uid() = user_id);
create policy "own line items" on bill_line_items
    for select using (exists (select 1 from bills b where b.id = bill_id and b.user_id = auth.uid()));

-- Private storage bucket for original documents
insert into storage.buckets (id, name, public)
values ('bills', 'bills', false)
on conflict (id) do nothing;
