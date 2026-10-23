import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.config import settings
from app.pipeline.embed import embed_text, embed_texts
from app.pipeline.summarize import load_summarizer_model

logger = logging.getLogger("echonotes.worker")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Preload models on worker start so they are loaded once and ready for inference."""
    logger.info("Initializing worker models...")
    try:
        load_summarizer_model()
    except Exception as e:
        logger.warning(f"Could not preload summarizer model at startup: {e}")
    yield


app = FastAPI(title="EchoNotes Worker", version="0.3.0", lifespan=lifespan)

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
async def health() -> dict[str, str]:
    """Simple liveness probe."""
    return {"status": "ok"}


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
