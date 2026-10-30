"""Key points extraction module using embedding centrality, informativeness scoring, and MMR.

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

# Spoken disfluencies and conversational fillers to clean from bullet points
FILLER_REGEX = re.compile(
    r"\b(um|uh|you know|sort of|kind of|i mean|basically|like,|like|so yeah|right\?)\b",
    re.IGNORECASE,
)

# Common colloquial leading connectives that make bullet points look informal
LEADING_CONNECTIVES_REGEX = re.compile(
    r"^(and\s+so|and\s+then|and|so\s+basically|so|but\s+then|but|now\s+then|now|well|okay\s+so|okay|actually|right\s+now),?\s+",
    re.IGNORECASE,
)

# Meta-talk and administrative phrases to reject
META_TALK_PATTERNS = re.compile(
    r"\b(welcome to|like and subscribe|leave a comment|turn on notifications|can you hear me|can everyone see|next slide|previous slide|office hours|homework assignment|syllabus|in the last lecture|see you next time|thank you for watching|see you in the next)\b",
    re.IGNORECASE,
)


def clean_sentence_for_highlight(raw: str) -> str:
    """Clean spoken artifacts and format into a crisp executive highlight."""
    # 1. Strip fillers
    s = FILLER_REGEX.sub(" ", raw)
    # 2. Collapse whitespace
    s = re.sub(r"\s+", " ", s).strip()
    # 3. Strip leading informal connectives
    s = LEADING_CONNECTIVES_REGEX.sub("", s).strip()
    # 4. Capitalize first letter
    if s:
        s = s[0].upper() + s[1:]
    # 5. Ensure ends with terminal punctuation
    if s and not s[-1] in ".!?":
        s += "."
    return s


def split_into_sentences(text: str) -> list[str]:
    """Split text into clean candidate sentences with quality filtering."""
    normalized = re.sub(r"\s+", " ", text).strip()
    raw_sentences = SENTENCE_SPLIT_REGEX.split(normalized)
    valid: list[str] = []

    for s in raw_sentences:
        clean = clean_sentence_for_highlight(s)
        words = clean.split()

        # Quality filters:
        # - Must have sufficient length for substance (at least 3 words and 15 characters)
        # - Must not be a rambling run-on (under 60 words)
        # - Must not contain administrative meta-talk
        if len(words) < 3 or len(words) > 60 or len(clean) < 15:
            continue
        if META_TALK_PATTERNS.search(clean):
            continue

        valid.append(clean)

    return valid


def select_central_sentences(
    sentences: list[str],
    top_k: int = 3,
    diversity: float = 0.55,
) -> list[str]:
    """Select the top-k most central and non-redundant sentences using Maximal Marginal Relevance (MMR)."""
    if not sentences:
        return []
    if len(sentences) <= top_k:
        return sentences

    # Embed candidate sentences and the full contextual document
    doc_text = " ".join(sentences)
    doc_embedding = np.array(embed_text(doc_text))
    sentence_embeddings = np.array(embed_texts(sentences))

    # Compute similarity to document center (semantic centrality)
    centrality_scores = np.dot(sentence_embeddings, doc_embedding)

    # Multi-factor score: Centrality + Informativeness (penalize short generic phrases)
    informativeness = []
    for s in sentences:
        words = s.split()
        # Word length reward: 12-30 words is ideal for a highlight
        ideal_length_bonus = 1.15 if 10 <= len(words) <= 35 else 0.9
        # Capitalization/technical term indicator
        has_technical = 1.1 if any(len(w) > 7 for w in words) else 1.0
        informativeness.append(ideal_length_bonus * has_technical)

    relevance_scores = centrality_scores * np.array(informativeness)

    selected_indices: list[int] = [int(np.argmax(relevance_scores))]

    while len(selected_indices) < min(top_k, len(sentences)):
        remaining_indices = [
            i for i in range(len(sentences)) if i not in selected_indices
        ]
        best_score = -float("inf")
        best_idx = remaining_indices[0]

        for idx in remaining_indices:
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

    # If multiple chapters provided, extract 1-2 top highlights per chapter
    if chapters and len(chapters) > 1:
        points_per_chapter = max(1, min(3, max_total_points // len(chapters) + 1))
        for chapter in chapters:
            c_start = chapter["start"]
            c_end = chapter["end"]
            chapter_segs = [
                s
                for s in segments
                if (s.get("start", 0.0) >= c_start and s.get("start", 0.0) <= c_end)
                or (s.get("end", 0.0) >= c_start and s.get("end", 0.0) <= c_end)
            ]
            c_text = " ".join(s.get("text", "") for s in chapter_segs)
            sentences = split_into_sentences(c_text)
            if sentences:
                points = select_central_sentences(sentences, top_k=points_per_chapter)
                all_key_points.extend(points)
    else:
        # Single chapter or short transcript
        full_text = " ".join(s.get("text", "") for s in segments)
        sentences = split_into_sentences(full_text)
        all_key_points = select_central_sentences(
            sentences, top_k=min(5, max_total_points)
        )

    # Fallback if strict filtering was too aggressive
    if not all_key_points and segments:
        for seg in segments:
            txt = seg.get("text", "").strip()
            if len(txt.split()) >= 6:
                clean = clean_sentence_for_highlight(txt)
                all_key_points.append(clean)
                if len(all_key_points) >= min(3, max_total_points):
                    break

    # Deduplicate while preserving order
    seen = set()
    deduped: list[str] = []
    for p in all_key_points:
        clean_p = p.strip()
        norm_key = re.sub(r"[^\w]", "", clean_p.lower())
        if clean_p and norm_key not in seen:
            seen.add(norm_key)
            deduped.append(clean_p)
            if len(deduped) >= max_total_points:
                break

    return deduped
