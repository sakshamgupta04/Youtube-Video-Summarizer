"""Chunking module – groups transcript segments into search-ready units.

Per PROJECT_RULES.md: Groups roughly 5 segments (approx 30 to 60 seconds) per chunk,
preserving the starting timestamp for semantic search alignment.
"""

from __future__ import annotations

from typing import TypedDict
from app.pipeline.transcribe import Segment


class Chunk(TypedDict):
    start_sec: float
    text: str


def create_chunks(
    segments: list[Segment],
    target_segments_per_chunk: int = 5,
    max_duration_sec: float = 60.0,
) -> list[Chunk]:
    """Group segments into cohesive chunks for embedding and semantic retrieval.

    Args:
        segments: List of timestamped or untimed segments.
        target_segments_per_chunk: Target number of segments per chunk (default 5).
        max_duration_sec: Maximum span in seconds before forcing a chunk boundary (default 60s).

    Returns:
        List of chunks with start_sec and combined text.
    """
    if not segments:
        return []

    chunks: list[Chunk] = []
    current_texts: list[str] = []
    current_start: float = segments[0]["start"]

    for i, seg in enumerate(segments):
        text = seg["text"].strip()
        if not text:
            continue

        if not current_texts:
            current_start = seg["start"]

        current_texts.append(text)

        # Check if we should flush the chunk
        span = seg["end"] - current_start
        reached_count = len(current_texts) >= target_segments_per_chunk
        reached_duration = span >= max_duration_sec and len(current_texts) >= 2

        if reached_count or reached_duration or i == len(segments) - 1:
            combined_text = " ".join(current_texts).strip()
            if combined_text:
                chunks.append(
                    {
                        "start_sec": round(current_start, 2),
                        "text": combined_text,
                    }
                )
            current_texts = []

    return chunks
