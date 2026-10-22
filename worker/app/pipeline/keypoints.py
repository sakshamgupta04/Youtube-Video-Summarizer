"""Key points extraction module using embedding centrality and MMR.

Per PROJECT_RULES.md:
For each chapter or segment group, picks the 2 to 3 most central sentences
using embeddings cosine similarity / MMR ranking.
Output: list of strings (e.g. ["Point 1...", "Point 2..."])
"""

from __future__ import annotations

import logging
import re
import numpy as np

from app.pipeline.transcribe import Segment
from app.pipeline.chapters import Chapter
from app.pipeline.embed import embed_texts, embed_text

logger = logging.getLogger("echonotes.keypoints")

SENTENCE_SPLIT_REGEX = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9])")


def split_into_sentences(text: str) -> list[str]:
    """Split text into clean candidate sentences."""
    normalized = re.sub(r"\s+", " ", text).strip()
    raw_sentences = SENTENCE_SPLIT_REGEX.split(normalized)
    valid: list[str] = []
    for s in raw_sentences:
        clean = s.strip()
        # Filter out very short or degenerate fragments
        if len(clean) >= 15 and len(clean.split()) >= 3:
            valid.append(clean)
    return valid


def select_central_sentences(
    sentences: list[str],
    top_k: int = 3,
    diversity: float = 0.5,
) -> list[str]:
    """Select the top-k most central and non-redundant sentences using Maximal Marginal Relevance (MMR)."""
    if not sentences:
        return []
    if len(sentences) <= top_k:
        return sentences

    # Embed sentences and entire document context
    doc_text = " ".join(sentences)
    doc_embedding = np.array(embed_text(doc_text))
    sentence_embeddings = np.array(embed_texts(sentences))

    # Compute similarity to document center (relevance)
    relevance_scores = np.dot(sentence_embeddings, doc_embedding)

    selected_indices: list[int] = [int(np.argmax(relevance_scores))]

    while len(selected_indices) < min(top_k, len(sentences)):
        remaining_indices = [
            i for i in range(len(sentences)) if i not in selected_indices
        ]
        best_score = -float("inf")
        best_idx = remaining_indices[0]

        for idx in remaining_indices:
            # Relevance to document
            rel = relevance_scores[idx]
            # Redundancy: max similarity to already selected sentences
            sim_to_selected = max(
                float(np.dot(sentence_embeddings[idx], sentence_embeddings[s]))
                for s in selected_indices
            )
            # MMR formula
            mmr_score = (1 - diversity) * rel - diversity * sim_to_selected

            if mmr_score > best_score:
                best_score = mmr_score
                best_idx = idx

        selected_indices.append(best_idx)

    # Sort selected sentences in chronological order of appearance
    selected_indices.sort()
    return [sentences[i] for i in selected_indices]


def extract_key_points(
    segments: list[Segment],
    chapters: list[Chapter] | None = None,
    max_total_points: int = 10,
) -> list[str]:
    """Extract 2 to 3 central key points per chapter across the transcript.

    Args:
        segments: List of transcript segments.
        chapters: Optional pre-computed chapters.
        max_total_points: Maximum points to return overall.

    Returns:
        List of bullet-point strings.
    """
    if not segments:
        return []

    all_key_points: list[str] = []

    # If chapters provided, extract 2-3 per chapter
    if chapters and len(chapters) > 1:
        for chapter in chapters:
            c_start = chapter["start"]
            c_end = chapter["end"]
            chapter_segs = [
                s
                for s in segments
                if (s["start"] >= c_start and s["start"] <= c_end)
                or (s["end"] >= c_start and s["end"] <= c_end)
            ]
            c_text = " ".join(s["text"] for s in chapter_segs)
            sentences = split_into_sentences(c_text)
            points = select_central_sentences(sentences, top_k=2)
            all_key_points.extend(points)
    else:
        # Single chapter or short transcript
        full_text = " ".join(s["text"] for s in segments)
        sentences = split_into_sentences(full_text)
        all_key_points = select_central_sentences(sentences, top_k=min(5, max_total_points))

    # Deduplicate while preserving order
    seen = set()
    deduped: list[str] = []
    for p in all_key_points:
        clean_p = p.strip()
        if clean_p and clean_p not in seen:
            seen.add(clean_p)
            deduped.append(clean_p)
            if len(deduped) >= max_total_points:
                break

    return deduped
