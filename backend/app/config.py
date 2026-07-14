from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# .env lives at the repo root (one level above backend/)
ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, env_file_encoding="utf-8", extra="ignore")

    # Supabase
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    supabase_secret_key: str = ""
    database_url: str = ""  # needed only for Alembic migrations

    # AI providers
    openai_api_key: str = ""
    openai_model: str = "gpt-4.1"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-opus-4-8"

    # Extraction / validation tuning
    extraction_accept_threshold: float = 0.85
    extraction_fallback_threshold: float = 0.5
    extraction_max_pages: int = 20

    # Infra
    redis_url: str = "redis://localhost:6379/0"
    storage_bucket: str = "bills"


@lru_cache
def get_settings() -> Settings:
    return Settings()
