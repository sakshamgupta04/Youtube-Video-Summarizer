"""EchoNotes worker configuration — reads from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """All config comes from .env or environment variables."""

    supabase_url: str
    supabase_service_key: str
    poll_interval_sec: int = 5
    max_duration_sec: int = 5400  # 90 minutes
    max_upload_mb: int = 50
    worker_secret: str = "echonotes-shared-secret-key-384"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()  # type: ignore[call-arg]
