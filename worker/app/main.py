import logging
import os
import threading
import time
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.config import settings
from app.db import get_db, verify_db_connection
from app.pipeline.embed import embed_text, embed_texts
from app.pipeline.summarize import get_device, load_summarizer_model

logger = logging.getLogger("echonotes.worker")
_start_time = time.time()
_loop_thread: threading.Thread | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Preload models and initialize worker background loop with startup retry."""
    global _loop_thread
    logger.info("EchoNotes Worker starting up...")

    # 1. Verify database connection with retry on cold startup
    db_ok = verify_db_connection(max_retries=5, initial_backoff=1.5)
    if not db_ok:
        logger.warning("Database not immediately reachable. Worker will continue retrying in background.")

    # 2. Preload summarization model once into memory
    try:
        load_summarizer_model()
    except Exception as e:
        logger.warning(f"Could not preload summarizer model at startup: {e}")

    # 3. Spawn background queue processor loop if enabled (ideal for HF Spaces single-container deploy)
    if settings.enable_background_loop and os.environ.get("PYTEST_CURRENT_TEST") is None:
        from app.loop import run_loop

        logger.info("Spawning background queue polling worker thread...")
        _loop_thread = threading.Thread(target=run_loop, daemon=True, name="echonotes-queue-loop")
        _loop_thread.start()

    yield
    logger.info("EchoNotes Worker shutting down.")


app = FastAPI(
    title="EchoNotes Worker",
    version="0.3.0",
    description="Worker and embedding backend for EchoNotes summarizer.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class EmbedRequest(BaseModel):
    text: str | None = None
    texts: list[str] | None = None


class EmbedResponse(BaseModel):
    embedding: list[float] | None = None
    embeddings: list[list[float]] | None = None


@app.get("/health")
async def health() -> dict[str, Any]:
    """Rich liveness and readiness probe with database and model status."""
    db_status = "connected"
    try:
        if settings.supabase_url and settings.supabase_service_key:
            db = get_db()
            db.table("items").select("id").limit(1).execute()
        else:
            db_status = "unconfigured"
    except Exception as e:
        logger.warning(f"Health probe database check failed: {e}")
        db_status = "unreachable"

    try:
        device_str = str(get_device())
    except Exception:
        device_str = "cpu"

    uptime_sec = int(time.time() - _start_time)

    return {
        "status": "ok",
        "service": "echonotes-worker",
        "version": "0.3.0",
        "database": db_status,
        "model": settings.summarizer_model,
        "device": device_str,
        "uptime_seconds": uptime_sec,
        "background_loop": bool(_loop_thread and _loop_thread.is_alive()),
        "notice": "Free Hugging Face Spaces sleep when idle. First request triggers wake-up.",
    }


@app.post("/embed", response_model=EmbedResponse)
async def embed_endpoint(
    req: EmbedRequest,
    x_worker_secret: str | None = Header(default=None, alias="X-Worker-Secret"),
    authorization: str | None = Header(default=None),
) -> EmbedResponse:
    """Generate 384-dimensional sentence-transformers embeddings for search or analysis.

    Protected by shared secret header: X-Worker-Secret or Authorization: Bearer <secret>.
    """
    secret = x_worker_secret
    if not secret and authorization and authorization.startswith("Bearer "):
        secret = authorization.split("Bearer ")[-1].strip()

    if secret != settings.worker_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing worker secret.",
        )

    if req.text is not None:
        vec = embed_text(req.text)
        return EmbedResponse(embedding=vec)

    if req.texts is not None:
        vecs = embed_texts(req.texts)
        return EmbedResponse(embeddings=vecs)

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Must provide either 'text' or 'texts' field.",
    )
