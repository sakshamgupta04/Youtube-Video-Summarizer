"""Chapter segmentation module based on semantic boundary detection and KeyBERT.

Per PROJECT_RULES.md:
- Embeds windows of segments and computes cosine similarity between adjacent neighbors.
- Places a chapter boundary where similarity drops sharply.
- Enforces a minimum of 2 minutes (120s) per chapter (or ~10 windows for untimed text).
- Titles each chapter with the top KeyBERT keyphrase.
Output format: [{start: float, end: float, title: str, summary: str}]
"""

from __future__ import annotations

import logging
from typing import TypedDict
import numpy as np

from app.pipeline.transcribe import Segment
from app.pipeline.embed import embed_texts

logger = logging.getLogger("echonotes.chapters")

_keybert_model = None
MIN_CHAPTER_DURATION_SEC = 120.0  # 2 minutes minimum per chapter
MIN_WINDOWS_FOR_TEXT = 6


class Chapter(TypedDict):
    start: float
    end: float
    title: str
    summary: str


def get_keybert_model():
    """Return cached KeyBERT model instance."""
    global _keybert_model
    if _keybert_model is None:
        logger.info("Loading KeyBERT model...")
        from keybert import KeyBERT
        from app.pipeline.embed import get_embed_model

        # Reuse our existing SentenceTransformer model so we don't load twice!
        embed_model = get_embed_model()
        _keybert_model = KeyBERT(model=embed_model)
        logger.info("KeyBERT loaded successfully.")
    return _keybert_model


def extract_chapter_title(text: str, default_title: str = "Chapter") -> str:
    """Extract top descriptive keyphrase for a chapter using KeyBERT."""
    if not text.strip():
        return default_title

    try:
        kw_model = get_keybert_model()
        keywords = kw_model.extract_keywords(
            text,
            keyphrase_ngram_range=(1, 3),
            stop_words="english",
            use_mmr=True,
            diversity=0.4,
            top_n=1,
        )
        if keywords and keywords[0][0]:
            raw_title = keywords[0][0].strip()
            # Title case nicely
            return " ".join(word.capitalize() for word in raw_title.split())
    except Exception as e:
        logger.warning(f"KeyBERT title extraction error: {e}")

    return default_title


def detect_chapters(
    segments: list[Segment],
    has_timestamps: bool = True,
) -> list[Chapter]:
    """Segment a transcript into semantic chapters with KeyBERT titles.

    Args:
        segments: List of transcript segments.
        has_timestamps: Whether the segments have valid audio/video timestamps.

    Returns:
        List of chapter dictionaries: [{start, end, title, summary}].
    """
    if not segments:
        return []

    total_duration = segments[-1]["end"] if has_timestamps else float(len(segments))

    # If the total duration is short (< 3 minutes), treat as a single chapter
    if has_timestamps and total_duration < 180.0:
        full_text = " ".join(s["text"] for s in segments)
        title = extract_chapter_title(full_text, default_title="Overview")
        return [
            {
                "start": segments[0]["start"],
                "end": segments[-1]["end"],
                "title": title,
                "summary": "",
            }
        ]

    # 1. Group segments into small semantic windows (approx 3-5 segments each)
    window_size = 4
    windows: list[dict] = []
    for i in range(0, len(segments), window_size):
        chunk_segs = segments[i : i + window_size]
        w_text = " ".join(s["text"] for s in chunk_segs).strip()
        if w_text:
            windows.append(
                {
                    "start": chunk_segs[0]["start"],
                    "end": chunk_segs[-1]["end"],
                    "text": w_text,
                    "seg_index": i,
                }
            )

    if len(windows) <= 1:
        full_text = " ".join(s["text"] for s in segments)
        title = extract_chapter_title(full_text, default_title="Overview")
        return [
            {
                "start": segments[0]["start"],
                "end": segments[-1]["end"],
                "title": title,
                "summary": "",
            }
        ]

    # 2. Embed all windows
    embeddings = embed_texts([w["text"] for w in windows])
    emb_matrix = np.array(embeddings)

    # 3. Compute cosine similarities between consecutive windows
    similarities: list[float] = []
    for i in range(len(emb_matrix) - 1):
        # Embeddings are normalized, dot product = cosine similarity
        sim = float(np.dot(emb_matrix[i], emb_matrix[i + 1]))
        similarities.append(sim)

    # 4. Place boundaries at similarity drops subject to minimum duration constraint
    boundaries: list[int] = [0]  # Window indices of chapter starts
    last_boundary_time = windows[0]["start"]
    last_boundary_idx = 0

    mean_sim = float(np.mean(similarities)) if similarities else 0.5
    std_sim = float(np.std(similarities)) if similarities else 0.1
    drop_threshold = mean_sim - (0.5 * std_sim)

    for i, sim in enumerate(similarities):
        current_window = windows[i + 1]
        time_elapsed = (
            current_window["start"] - last_boundary_time
            if has_timestamps
            else (i + 1 - last_boundary_idx) * 30
        )
        min_allowed = MIN_CHAPTER_DURATION_SEC if has_timestamps else 120.0

        if sim < drop_threshold and time_elapsed >= min_allowed:
            boundaries.append(i + 1)
            last_boundary_time = current_window["start"]
            last_boundary_idx = i + 1

    # Always ensure last chapter extends to the end
    chapters: list[Chapter] = []
    for b_idx in range(len(boundaries)):
        start_w = boundaries[b_idx]
        end_w = boundaries[b_idx + 1] if b_idx + 1 < len(boundaries) else len(windows)

        chapter_windows = windows[start_w:end_w]
        chapter_text = " ".join(w["text"] for w in chapter_windows).strip()

        start_time = chapter_windows[0]["start"]
        end_time = chapter_windows[-1]["end"]

        # Title via KeyBERT
        fallback = "Introduction" if b_idx == 0 else f"Section {b_idx + 1}"
        title = extract_chapter_title(chapter_text, default_title=fallback)

        chapters.append(
            {
                "start": round(start_time, 2),
                "end": round(end_time, 2),
                "title": title,
                "summary": "",
            }
        )

    return chapters
