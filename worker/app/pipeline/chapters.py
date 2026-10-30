"""Chapter segmentation module based on semantic boundary detection and KeyBERT.

Per PROJECT_RULES.md:
- Embeds windows of segments and computes cosine similarity between adjacent neighbors.
- Places a chapter boundary where similarity drops sharply using depth scoring.
- Enforces a minimum of 2 minutes (120s) per chapter (or ~10 windows for untimed text).
- Titles each chapter with the top KeyBERT keyphrase.
Output format: [{start: float, end: float, title: str, summary: str}]
"""

from __future__ import annotations

import logging
import re
from typing import TypedDict
import numpy as np

from app.pipeline.transcribe import Segment
from app.pipeline.embed import embed_texts

logger = logging.getLogger("echonotes.chapters")

_keybert_model = None
MIN_CHAPTER_DURATION_SEC = 120.0  # 2 minutes minimum per chapter
MAX_CHAPTER_DURATION_SEC = 900.0  # 15 minutes soft maximum per chapter
MIN_WINDOWS_FOR_TEXT = 6

# Conversational fillers and non-informative fragments to strip from title extraction
DISFLUENCY_PATTERNS = re.compile(
    r"\b(um|uh|you know|sort of|kind of|i mean|basically|like|so yeah|right|okay|well|actually|let's|today we)\b",
    re.IGNORECASE,
)

STOP_WORDS_EXTRA = {
    "going", "gonna", "wanna", "want", "know", "think", "thing", "things",
    "talking", "talk", "said", "says", "look", "looking", "see", "really",
    "pretty", "maybe", "kind", "sort", "mean", "lot", "lots", "welcome",
    "hello", "everybody", "guys", "video", "lecture", "slide", "class",
    "today", "next", "previous", "first", "second", "third", "chapter",
    "section", "part", "okay", "alright", "yeah", "yes", "sure",
}

TITLE_LOWERCASE_WORDS = {
    "a", "an", "the", "and", "but", "or", "for", "nor", "on", "at",
    "to", "from", "by", "with", "in", "of", "into", "onto", "via",
}


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


def format_title_case(raw_title: str) -> str:
    """Format string in clean, professional Title Case."""
    words = raw_title.strip().split()
    if not words:
        return "Overview"

    formatted_words: list[str] = []
    for i, word in enumerate(words):
        clean_word = re.sub(r"[^\w\-\/]", "", word)
        if not clean_word:
            continue
        lower_word = clean_word.lower()
        if i == 0 or lower_word not in TITLE_LOWERCASE_WORDS:
            formatted_words.append(lower_word.capitalize())
        else:
            formatted_words.append(lower_word)

    return " ".join(formatted_words) or "Overview"


def clean_transcript_for_keywords(text: str) -> str:
    """Strip speech fillers and boilerplate from transcript text."""
    cleaned = DISFLUENCY_PATTERNS.sub(" ", text)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def extract_chapter_title(text: str, default_title: str = "Chapter") -> str:
    """Extract top descriptive keyphrase for a chapter using KeyBERT with strict quality ranking."""
    clean_text = clean_transcript_for_keywords(text)
    if not clean_text or len(clean_text.split()) < 5:
        return default_title

    try:
        kw_model = get_keybert_model()
        candidates = kw_model.extract_keywords(
            clean_text,
            keyphrase_ngram_range=(1, 3),
            stop_words="english",
            use_mmr=True,
            diversity=0.5,
            top_n=6,
        )

        if not candidates:
            return default_title

        # Rank candidates favoring multi-word, high-signal technical phrases
        best_candidate: str | None = None
        best_score = -1.0

        for phrase, score in candidates:
            clean_p = phrase.strip()
            words = clean_p.lower().split()

            # Skip empty, pure digits, or single character phrases
            if not words or all(len(w) <= 2 for w in words):
                continue

            # Skip phrases made entirely of generic conversational fillers
            if all(w in STOP_WORDS_EXTRA for w in words):
                continue

            # Multi-word bonus (2-3 words make much clearer chapter titles)
            length_multiplier = 1.3 if len(words) in (2, 3) else 0.85
            # Non-stopword ratio
            content_ratio = sum(1 for w in words if w not in STOP_WORDS_EXTRA) / len(words)
            adjusted_score = score * length_multiplier * content_ratio

            if adjusted_score > best_score:
                best_score = adjusted_score
                best_candidate = clean_p

        if best_candidate:
            return format_title_case(best_candidate)

        # Fallback to first candidate if available
        if candidates and candidates[0][0]:
            return format_title_case(candidates[0][0])

    except Exception as e:
        logger.warning(f"KeyBERT title extraction error: {e}")

    return default_title


def compute_depth_scores(similarities: list[float], horizon: int = 3) -> list[float]:
    """Compute TextTiling / Choi C99 depth scores for transition valleys.

    A high depth score indicates a significant drop between two strong topical regions.
    """
    n = len(similarities)
    if n == 0:
        return []

    depths = [0.0] * n
    for i in range(n):
        cur_sim = similarities[i]

        # Left peak
        left_bound = max(0, i - horizon)
        left_peak = max(similarities[left_bound : i + 1]) if i >= left_bound else cur_sim

        # Right peak
        right_bound = min(n, i + 1 + horizon)
        right_peak = max(similarities[i:right_bound]) if right_bound > i else cur_sim

        # Depth score: average height of left and right peaks above current valley
        depth = 0.5 * ((left_peak - cur_sim) + (right_peak - cur_sim))
        depths[i] = max(0.0, depth)

    return depths


def detect_chapters(
    segments: list[Segment],
    has_timestamps: bool = True,
) -> list[Chapter]:
    """Segment a transcript into semantic chapters with KeyBERT titles using depth-scoring.

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
        full_text = " ".join(s.get("text", "") for s in segments)
        title = extract_chapter_title(full_text, default_title="Introduction & Overview")
        return [
            {
                "start": round(segments[0]["start"], 2),
                "end": round(segments[-1]["end"], 2),
                "title": title,
                "summary": "",
            }
        ]

    # 1. Group segments into time- or word-balanced semantic windows (~30-45s or 60-80 words)
    windows: list[dict] = []
    cur_segs: list[Segment] = []
    cur_words = 0
    cur_start = segments[0]["start"]

    target_window_duration = 35.0  # seconds
    target_window_words = 70

    for seg in segments:
        cur_segs.append(seg)
        words_in_seg = len(seg.get("text", "").split())
        cur_words += words_in_seg

        duration = (seg["end"] - cur_start) if has_timestamps else float(cur_words)
        duration_ready = duration >= target_window_duration if has_timestamps else (cur_words >= target_window_words)

        if duration_ready and cur_words >= 20:
            w_text = " ".join(s.get("text", "") for s in cur_segs).strip()
            if w_text:
                windows.append(
                    {
                        "start": cur_segs[0]["start"],
                        "end": cur_segs[-1]["end"],
                        "text": w_text,
                    }
                )
            cur_segs = []
            cur_words = 0
            cur_start = seg["end"]

    # Trailing segments
    if cur_segs:
        w_text = " ".join(s.get("text", "") for s in cur_segs).strip()
        if w_text:
            if windows:
                # If trailing is very short (< 15 words), merge with last window
                if cur_words < 15:
                    windows[-1]["text"] += " " + w_text
                    windows[-1]["end"] = cur_segs[-1]["end"]
                else:
                    windows.append(
                        {
                            "start": cur_segs[0]["start"],
                            "end": cur_segs[-1]["end"],
                            "text": w_text,
                        }
                    )
            else:
                windows.append(
                    {
                        "start": cur_segs[0]["start"],
                        "end": cur_segs[-1]["end"],
                        "text": w_text,
                    }
                )

    if len(windows) <= 1:
        full_text = " ".join(s.get("text", "") for s in segments)
        title = extract_chapter_title(full_text, default_title="Introduction & Overview")
        return [
            {
                "start": round(segments[0]["start"], 2),
                "end": round(segments[-1]["end"], 2),
                "title": title,
                "summary": "",
            }
        ]

    # 2. Embed all semantic windows
    embeddings = embed_texts([w["text"] for w in windows])
    emb_matrix = np.array(embeddings)

    # 3. Compute cosine similarities between consecutive windows
    similarities: list[float] = []
    for i in range(len(emb_matrix) - 1):
        # Embeddings are normalized, dot product = cosine similarity
        sim = float(np.dot(emb_matrix[i], emb_matrix[i + 1]))
        similarities.append(sim)

    # 4. Compute depth scores for transition valleys
    depth_scores = compute_depth_scores(similarities, horizon=3)

    # 5. Place boundaries using depth score ranking and minimum duration constraints
    min_allowed = MIN_CHAPTER_DURATION_SEC if has_timestamps else 120.0
    mean_depth = float(np.mean(depth_scores)) if depth_scores else 0.05
    min_depth_threshold = max(0.03, mean_depth * 0.7)

    # Candidate boundaries sorted by depth (strongest topic drops first)
    ranked_candidates = sorted(
        range(len(depth_scores)),
        key=lambda idx: depth_scores[idx],
        reverse=True,
    )

    chosen_boundaries: list[int] = [0]
    last_b_time = windows[0]["start"]

    # Greedy selection ensuring min duration
    candidates_to_add: list[int] = []
    for idx in ranked_candidates:
        if depth_scores[idx] >= min_depth_threshold:
            candidates_to_add.append(idx + 1)

    # Sort chronologically
    candidates_to_add.sort()

    # Filter by minimum duration
    for b_idx in candidates_to_add:
        w_time = windows[b_idx]["start"]
        time_elapsed = w_time - last_b_time if has_timestamps else (b_idx - chosen_boundaries[-1]) * 35
        remaining_time = total_duration - w_time if has_timestamps else (len(windows) - b_idx) * 35

        if time_elapsed >= min_allowed and remaining_time >= min_allowed:
            chosen_boundaries.append(b_idx)
            last_b_time = w_time

    # Sort boundaries in chronological order
    chosen_boundaries = sorted(list(set(chosen_boundaries)))

    # Construct final chapter objects
    chapters: list[Chapter] = []
    for b_pos in range(len(chosen_boundaries)):
        start_w = chosen_boundaries[b_pos]
        end_w = (
            chosen_boundaries[b_pos + 1]
            if b_pos + 1 < len(chosen_boundaries)
            else len(windows)
        )

        chapter_windows = windows[start_w:end_w]
        chapter_text = " ".join(w["text"] for w in chapter_windows).strip()

        start_time = chapter_windows[0]["start"]
        end_time = chapter_windows[-1]["end"]

        # If it's the last chapter, ensure end time matches transcript end
        if b_pos == len(chosen_boundaries) - 1:
            end_time = segments[-1]["end"]

        # Professional contextual fallbacks
        if b_pos == 0:
            fallback = "Introduction & Core Concepts"
        elif b_pos == len(chosen_boundaries) - 1 and len(chosen_boundaries) > 2:
            fallback = "Summary & Conclusion"
        else:
            fallback = f"Section {b_pos + 1}"

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
