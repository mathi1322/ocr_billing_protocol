# OCR Billing App — Full Project Plan

A web + mobile-responsive application that accepts billing documents in many formats (PDF, photos, Word, scans), extracts structured billing data using AI vision models — **OpenAI (ChatGPT) as the primary extractor, Anthropic Claude as the fallback** — with a validation layer that decides when to fall back, and a review UI for humans to confirm/correct results.

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend — Next.js PWA (responsive: desktop / tablet / phone)│
│  Upload → Processing status → Review & correct → Dashboard    │
└──────────────────────┬──────────────────────────────────────┘
                       │ REST (JSON) + file upload
┌──────────────────────▼──────────────────────────────────────┐
│  Backend — FastAPI (Python)                                  │
│                                                               │
│  1. Ingestion      : accept file, detect type, store          │
│  2. Normalization  : any format → page images / PDF           │
│  3. Extraction     : OpenAI vision (primary)                  │
│  4. Validation     : schema + business rules + confidence     │
│  5. Fallback       : Claude (claude-opus-4-8) if validation   │
│                      fails or confidence is low               │
│  6. Persistence    : PostgreSQL (bills, line items, audit)    │
└──────────────────────┬──────────────────────────────────────┘
                       │
        Supabase (Postgres + Auth + Storage)  +  Redis (queue)
```

---

## 2. Tech Stack

### Frontend
| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (React 19) + TypeScript** | One codebase, SSR for fast loads, easy API proxying |
| Styling | **Tailwind CSS + shadcn/ui** | Fast to build a polished, consistent, responsive UI |
| Mobile | **Responsive PWA** (installable, camera capture via `<input capture>`) | Covers "web and mobile" without maintaining a second native codebase. If a store-listed native app is needed later, wrap with Capacitor. |
| State/data | TanStack Query (server state) + Zustand (UI state) | Simple, standard |
| File upload | react-dropzone + chunked upload for large files | Drag-drop on desktop, camera/gallery on mobile |
| Charts (dashboard) | Recharts | Spend-by-vendor, monthly totals |

### Backend
| Concern | Choice | Why |
|---|---|---|
| API framework | **FastAPI (Python 3.12)** | Best ecosystem for document wrangling; async; auto OpenAPI docs |
| File conversion | `pypdf` / `pdf2image` (PDF), `Pillow` (images, HEIC via `pillow-heif`), `python-docx` + LibreOffice headless (Word → PDF) | Normalize every input to page images or PDF |
| Job queue | **Redis + RQ** (upgrade path: Celery) | Extraction takes seconds-to-minutes; must be async with status polling/SSE |
| Database | **Supabase Postgres** (SQLAlchemy 2 + Alembic against the same DB) | Managed Postgres; JSONB keeps raw extraction; dashboard for free admin views |
| File storage | **Supabase Storage** (`bills` bucket) | Signed URLs for document preview built in |
| Auth | **Supabase Auth** (email/password + OAuth) | Frontend authenticates with Supabase; FastAPI verifies the Supabase JWT |
| Config | `pydantic-settings` reading `.env` | Typed, validated env config |
| Deployment | Docker Compose (dev) → containers on Fly.io/Railway/AWS | |

### AI Providers
| Role | Provider / Model | Notes |
|---|---|---|
| **Primary extraction** | OpenAI vision model — set via `OPENAI_MODEL` env (e.g. a current GPT-4.1/GPT-5-class vision model) | Structured Outputs (JSON schema) so the response always parses |
| **Fallback extraction** | Anthropic **`claude-opus-4-8`** — set via `ANTHROPIC_MODEL` env | Native PDF document input (base64, no beta header) + structured outputs via `output_config.format` |
| Pricing reference (Claude, per 1M tokens) | Opus 4.8: $5 in / $25 out · Sonnet 5: $3/$15 ($2/$10 intro through 2026-08-31) · Haiku 4.5: $1/$5 | If fallback volume gets high and cost matters, `claude-sonnet-5` is the cheaper switch — one env var change |

Both model IDs live in env vars so you can upgrade models without code changes.

---

## 3. Extraction Pipeline (the core)

### 3.1 Canonical bill schema (single source of truth)

Defined once as a Pydantic model; the same JSON schema is sent to **both** providers as a structured-output constraint:

```python
class LineItem(BaseModel):
    description: str
    quantity: float | None
    unit_price: float | None
    amount: float

class ExtractedBill(BaseModel):
    vendor_name: str
    vendor_address: str | None
    vendor_tax_id: str | None          # GSTIN etc.
    invoice_number: str
    invoice_date: str                  # ISO 8601
    due_date: str | None
    currency: str                      # ISO 4217
    line_items: list[LineItem]
    subtotal: float | None
    tax_amount: float | None
    total_amount: float
    payment_terms: str | None
    confidence_notes: str | None      # model self-reports unreadable fields
```

### 3.2 Pipeline flow

```
Upload ──► Normalize ──► Extract (OpenAI) ──► VALIDATE ──┬─ pass ──► Save (status: extracted)
                                                          │
                                                          └─ fail ──► Extract (Claude) ──► VALIDATE ─┬─ pass ─► Save
                                                                                                      │
                                                                                                      └─ fail ─► status: needs_review
```

Every attempt (provider, model, latency, tokens, validation result) is recorded in an `extraction_attempts` audit table — so you can measure which provider wins over time.

### 3.3 Validation layer (decides when to fall back)

Three tiers, all cheap and deterministic:

1. **Schema validation** — response must parse into `ExtractedBill` (structured outputs make this nearly guaranteed, but guard anyway).
2. **Business rules** — the OCR-quality signal:
   - `sum(line_items.amount) ≈ subtotal` (±1% tolerance for rounding)
   - `subtotal + tax_amount ≈ total_amount`
   - `invoice_date` parses and is not in the future / not >10 years old
   - `total_amount > 0`, currency is a valid ISO code
   - required fields non-empty (`vendor_name`, `invoice_number`, `total_amount`)
3. **Confidence scoring** — weighted score from rule results + count of null critical fields + `confidence_notes` flags. Thresholds (env-tunable):
   - `score ≥ 0.85` → accept
   - `0.5 ≤ score < 0.85` → accept but flag fields for review
   - `score < 0.5` → **fall back to Claude**, keep the better-scoring result

If both providers fail validation, the bill lands in **needs_review** with both extractions shown side-by-side in the UI.

### 3.4 Format normalization matrix

| Input | Handling |
|---|---|
| PDF (digital or scanned) | Send directly (OpenAI: page images via `pdf2image`; Claude: native base64 PDF document block) |
| JPG / PNG / WEBP / HEIC | HEIC→JPEG convert, auto-rotate via EXIF, downscale to ≤2576px long edge, send as image |
| DOCX / DOC | LibreOffice headless → PDF → pipeline above |
| Multi-page bills | Extract per document (models handle multi-page PDFs); cap pages, warn on >20 pages |
| Unsupported (xlsx, txt…) | Rejected at upload with a clear message (extendable later) |

---

## 4. Environment & Secrets

`.env` (git-ignored) + committed `.env.example`:

```bash
# --- Supabase ---
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=...            # frontend-safe (RLS enforced)
SUPABASE_SERVICE_ROLE_KEY=...    # backend only — bypasses RLS, never ship to browser
DATABASE_URL=postgresql+asyncpg://...   # direct connection for Alembic migrations

# --- AI providers ---
OPENAI_API_KEY=sk-...
OPENAI_MODEL=<current vision model>
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-opus-4-8

# --- Fallback / validation tuning ---
EXTRACTION_ACCEPT_THRESHOLD=0.85
EXTRACTION_FALLBACK_THRESHOLD=0.5
EXTRACTION_MAX_PAGES=20

# --- Infra ---
REDIS_URL=redis://localhost:6379/0
STORAGE_BUCKET=bills
```

Loaded through one typed `Settings` class (`pydantic-settings`); the app refuses to boot if a required key is missing. Keys never reach the frontend — all AI calls are server-side.

---

## 5. Database Schema (core tables)

```
users(id, email, password_hash, role, created_at)

bills(id, user_id, status, source_file_key, source_filename, mime_type,
      vendor_name, invoice_number, invoice_date, due_date, currency,
      subtotal, tax_amount, total_amount,
      extraction_json JSONB,          -- full ExtractedBill
      confidence_score, flagged_fields JSONB,
      winning_provider,               -- 'openai' | 'anthropic' | 'manual'
      created_at, updated_at)
   status: uploaded → processing → extracted → needs_review → approved / rejected

bill_line_items(id, bill_id, description, quantity, unit_price, amount, position)

extraction_attempts(id, bill_id, provider, model, latency_ms,
                    input_tokens, output_tokens, validation_score,
                    validation_errors JSONB, raw_response JSONB, created_at)

audit_log(id, bill_id, user_id, action, diff JSONB, created_at)
```

---

## 6. API Endpoints

```
POST   /api/auth/login | /register
POST   /api/bills                    # multipart upload → returns bill_id, enqueues job
GET    /api/bills                    # list w/ filters (status, vendor, date range) + pagination
GET    /api/bills/{id}               # detail incl. extraction + flagged fields
GET    /api/bills/{id}/events        # SSE stream: processing progress
GET    /api/bills/{id}/file          # signed URL / stream original for preview
PATCH  /api/bills/{id}               # human corrections (writes audit_log)
POST   /api/bills/{id}/approve
POST   /api/bills/{id}/reextract     # force re-run, optionally pin provider
GET    /api/dashboard/summary        # totals, spend by vendor/month, review queue size
GET    /api/admin/extraction-stats   # provider win-rate, avg confidence, cost
```

---

## 7. UI Design ("impressive" without being gimmicky)

**Design language:** clean fintech look — off-white surface, one strong accent color, generous whitespace, card-based layout, subtle motion (Framer Motion for state transitions), dark mode via `prefers-color-scheme`. Distinctive typeface pairing (e.g., a geometric sans for UI + tabular numerals for money).

### Screens
1. **Upload** — full-screen drag-drop zone; on mobile: big "Snap a bill" camera button + gallery picker. Multi-file. Each file becomes a card with live status.
2. **Processing** — per-bill animated pipeline stepper: *Uploaded → Reading → Extracting (OpenAI) → Validating → [Retrying with Claude] → Done*. Driven by SSE, no page refreshes.
3. **Review (the money screen)** — split view: original document (zoom/pan, page thumbnails) on the left; extracted form on the right. Flagged/low-confidence fields highlighted amber; validation errors (e.g. "line items don't sum to subtotal") shown inline; line-item table editable. On mobile it collapses to tabs (Document / Data). Approve / Reject / Re-extract actions.
4. **Bills list** — filterable, searchable table (cards on mobile) with status chips, vendor, totals; bulk approve.
5. **Dashboard** — monthly spend chart, top vendors, review-queue count, provider stats (OpenAI vs Claude win-rate & cost).
6. **Settings** — thresholds, default currency, API usage view.

---

## 8. Project Structure

```
ocr_billing_protocol/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py              # pydantic-settings
│   │   ├── models/                # SQLAlchemy
│   │   ├── schemas/               # Pydantic incl. ExtractedBill
│   │   ├── api/                   # routers
│   │   ├── services/
│   │   │   ├── normalize.py       # format → images/PDF
│   │   │   ├── extract_openai.py
│   │   │   ├── extract_claude.py
│   │   │   ├── validator.py       # rules + scoring
│   │   │   └── pipeline.py        # orchestrates + fallback
│   │   └── workers/               # RQ jobs
│   ├── alembic/
│   ├── tests/                     # incl. golden-file extraction tests
│   └── pyproject.toml
├── frontend/
│   ├── app/                       # Next.js app router
│   ├── components/
│   └── package.json
├── docker-compose.yml             # redis (DB/auth/storage come from Supabase)
├── .env.example
└── PLAN.md
```

---

## 9. Milestones

| Phase | Scope | Est. |
|---|---|---|
| **0. Scaffold** | Repos, Docker Compose, env config, DB migrations, auth skeleton | 1–2 days |
| **1. Core pipeline (vertical slice)** | Upload PDF/image → normalize → OpenAI extract → validate → store → view raw JSON | 3–4 days |
| **2. Fallback + validation hardening** | Claude fallback, confidence scoring, `extraction_attempts` audit, golden-file tests with ~20 sample bills | 2–3 days |
| **3. Review UI** | Split-view review screen, corrections + audit log, approve flow, SSE progress | 3–4 days |
| **4. Formats + mobile polish** | DOCX/HEIC support, camera capture, PWA manifest, responsive pass | 2–3 days |
| **5. Dashboard + admin** | Spend charts, provider stats, settings | 2 days |
| **6. Production hardening** | Rate limits, file-size/type validation, virus scan hook, S3, deploy, monitoring (Sentry) | 2–3 days |

---

## 10. Key Risks & Decisions to Confirm

1. **Native mobile app vs responsive PWA** — plan assumes PWA (one codebase). Confirm if app-store presence is required.
2. **OpenAI model choice** — vision model IDs change frequently; it's env-configured. Confirm which OpenAI tier/budget you want as default.
3. **Fallback cost control** — Opus 4.8 is the strongest fallback; if fallback volume is high, switch env to `claude-sonnet-5` ($2/$10 intro pricing) for ~60% savings.
4. **Multi-tenancy** — schema is single-org with users; confirm if this is a SaaS for many companies (adds `org_id` everywhere — cheap to add now, painful later).
5. **Data privacy** — bills contain financial data; both providers' API terms exclude training on API data, but confirm any compliance requirements (retention, region).
