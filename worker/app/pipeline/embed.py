"""Embedding module using sentence-transformers (all-MiniLM-L6-v2, 384 dimensions).

Generates vector representations for chunks, search queries, and chapter boundary detection.
"""

from __future__ import annotations

import logging
from typing import Sequence
import numpy as np

logger = logging.getLogger("echonotes.embed")

_model = None
MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDING_DIM = 384


def get_embed_model():
    """Return cached SentenceTransformer model instance."""
    global _model
    if _model is None:
        logger.info(f"Loading SentenceTransformer '{MODEL_NAME}'...")
        from sentence_transformers import SentenceTransformer

        _model = SentenceTransformer(MODEL_NAME, device="cpu")
        logger.info(f"SentenceTransformer '{MODEL_NAME}' loaded successfully.")
    return _model


def embed_text(text: str) -> list[float]:
    """Generate a single 384-dimensional normalized embedding vector."""
    model = get_embed_model()
    vec = model.encode(text, convert_to_numpy=True, normalize_embeddings=True)
    return [round(float(x), 6) for x in vec.tolist()]


def embed_texts(texts: Sequence[str], batch_size: int = 32) -> list[list[float]]:
    """Generate 384-dimensional normalized embeddings for a batch of texts."""
    if not texts:
        return []

    model = get_embed_model()
    vecs = model.encode(
        list(texts),
        batch_size=batch_size,
        show_progress_bar=False,
        convert_to_numpy=True,
        normalize_embeddings=True,
    )
    return [[round(float(x), 6) for x in row.tolist()] for row in vecs]
