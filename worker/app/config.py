from pathlib import Path
from pydantic_settings import BaseSettings

_WORKER_DIR = Path(__file__).resolve().parent.parent
_ENV_FILE = _WORKER_DIR / ".env"


class Settings(BaseSettings):
    """All config comes from .env or environment variables."""

    supabase_url: str = ""
    supabase_service_key: str = ""
    poll_interval_sec: int = 5
    max_duration_sec: int = 5400  # 90 minutes
    max_upload_mb: int = 50
    worker_secret: str = "echonotes-shared-secret-key-384"
    summarizer_model: str = "sshleifer/distilbart-cnn-12-6"
    enable_background_loop: bool = True

    model_config = {
        "env_file": [str(_ENV_FILE), ".env"],
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()
