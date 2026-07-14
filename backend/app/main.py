from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.invoices import router as invoices_router
from app.config import get_settings

app = FastAPI(title="OCR Billing API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(invoices_router)


@app.get("/api/health")
async def health():
    settings = get_settings()
    return {
        "status": "ok",
        "supabase_configured": bool(settings.supabase_url),
        "openai_configured": bool(settings.openai_api_key),
        "anthropic_configured": bool(settings.anthropic_api_key),
    }
