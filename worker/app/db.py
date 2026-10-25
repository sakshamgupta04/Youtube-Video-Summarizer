import logging
import time
from supabase import create_client, Client

from app.config import settings

logger = logging.getLogger("echonotes.db")
_client: Client | None = None


def get_db() -> Client:
    """Return a singleton Supabase client."""
    global _client
    if _client is None:
        if not settings.supabase_url or not settings.supabase_service_key:
            logger.warning("Supabase URL or service key is empty in worker settings.")
        _client = create_client(settings.supabase_url, settings.supabase_service_key)
    return _client


def verify_db_connection(max_retries: int = 5, initial_backoff: float = 2.0) -> bool:
    """Verify database connectivity with exponential backoff retries on startup.
    
    Prevents crash on cold starts when free-tier Supabase or Hugging Face Space wakes up.
    """
    if not settings.supabase_url or not settings.supabase_service_key:
        logger.warning("Database configuration missing; skipping connection verification.")
        return False

    client = get_db()
    backoff = initial_backoff

    for attempt in range(1, max_retries + 1):
        try:
            logger.info(f"Checking Supabase connection (attempt {attempt}/{max_retries})...")
            # Quick lightweight query against items table
            client.table("items").select("id").limit(1).execute()
            logger.info("Supabase database connection established successfully.")
            return True
        except Exception as e:
            logger.warning(f"Database connection attempt {attempt} failed: {e}")
            if attempt < max_retries:
                logger.info(f"Retrying in {backoff:.1f}s...")
                time.sleep(backoff)
                backoff *= 2.0

    logger.error(f"Failed to connect to Supabase after {max_retries} attempts.")
    return False
