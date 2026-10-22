"""Supabase client for the worker (uses service-role key to bypass RLS)."""

from supabase import create_client, Client

from app.config import settings

_client: Client | None = None


def get_db() -> Client:
    """Return a singleton Supabase client."""
    global _client
    if _client is None:
        _client = create_client(settings.supabase_url, settings.supabase_service_key)
    return _client
