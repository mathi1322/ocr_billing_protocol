from functools import lru_cache

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import Client, create_client

from app.config import get_settings

_bearer = HTTPBearer(auto_error=False)


@lru_cache
def get_supabase_admin() -> Client:
    """Service-role client — backend only, bypasses RLS. Never expose to the browser."""
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> str:
    """Verify the Supabase access token sent by the frontend and return the user id."""
    if credentials is None:
        raise HTTPException(401, "Not authenticated")
    try:
        res = get_supabase_admin().auth.get_user(credentials.credentials)
    except Exception as exc:
        raise HTTPException(401, "Invalid or expired session") from exc
    if res is None or res.user is None:
        raise HTTPException(401, "Invalid or expired session")
    return res.user.id
