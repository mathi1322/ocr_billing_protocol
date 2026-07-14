# OCR Billing App

Extracts structured data from bills (PDF, photos, Word) using OpenAI as the
primary extractor and Claude as the fallback, with a deterministic validation
layer deciding when to fall back. See [PLAN.md](PLAN.md) for the full design.

## Stack
- **Frontend**: Next.js 15 + Tailwind, responsive web + mobile — `frontend/`
- **Backend**: FastAPI — `backend/`
- **Data**: Supabase (Postgres + Auth + Storage)

## Setup

1. Copy `.env.example` → `.env` and fill in keys (Supabase, OpenAI, Anthropic).
2. Apply the DB schema: open Supabase Dashboard → SQL Editor and run each file
   in `supabase/migrations/` in order (tables, RLS policies, storage bucket).
3. System packages needed by the pipeline: `poppler-utils` (PDF→image) and
   `libreoffice` (Word→PDF).

```bash
# Backend
cd backend
uv venv .venv && uv pip install -e .
.venv/bin/uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev          # http://localhost:3000
```

## Smoke test the extraction pipeline

```bash
cd backend
.venv/bin/python scripts/smoke_extract.py                 # generated sample invoice
.venv/bin/python scripts/smoke_extract.py path/to/bill.pdf  # your own file
```

Prints the extraction attempts (provider, latency, validation score), the
extracted JSON, and a field-by-field check against known values.
