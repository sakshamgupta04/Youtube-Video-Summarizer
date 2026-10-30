"""Summarization pipeline module using Map-Reduce with DistilBART-CNN or Flan-T5 LoRA.

Per PROJECT_RULES.md (Section 5 & 8):
- Map step: Summarize each chapter (input at most ~700 tokens, split into chunks if longer).
- Reduce step: Summarize the chapter summaries into one overall summary.
- Model is loaded once at worker start, configured via `settings.summarizer_model`.
"""

from __future__ import annotations

import logging
import os
import re
from typing import Any, Tuple

from app.config import settings
from app.pipeline.transcribe import Segment

logger = logging.getLogger("echonotes.summarize")

_model = None
_tokenizer = None
_device = None
_is_t5_model = False

# DistilBART maximum input tokens is 1024; chunk chapters exceeding 700 tokens
MAX_INPUT_TOKENS = 700
CHUNK_OVERLAP_TOKENS = 50

# Speech filler cleanup before summarization
TRANSCRIPT_CLEANUP_REGEX = re.compile(
    r"\b(um|uh|you know|sort of|kind of|i mean|basically|like,|so yeah|alright)\b",
    re.IGNORECASE,
)


def get_device():
    """Determine PyTorch compute device."""
    import torch

    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


def load_summarizer_model() -> Tuple[Any, Any, Any]:
    """Load tokenizer and model into memory once."""
    global _model, _tokenizer, _device, _is_t5_model
    if _model is None or _tokenizer is None:
        import torch
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

        model_name = settings.summarizer_model
        logger.info(f"Loading summarizer model '{model_name}'...")
        _is_t5_model = "t5" in model_name.lower()

        try:
            from peft import PeftConfig, PeftModel
            try:
                peft_config = PeftConfig.from_pretrained(model_name)
                base_model_name = peft_config.base_model_name_or_path or "google/flan-t5-base"
                _is_t5_model = "t5" in base_model_name.lower()
                logger.info(f"Detected PEFT adapter. Loading base model '{base_model_name}'...")
                _tokenizer = AutoTokenizer.from_pretrained(base_model_name)
                base_model = AutoModelForSeq2SeqLM.from_pretrained(base_model_name)
                _model = PeftModel.from_pretrained(base_model, model_name)
                logger.info(f"Loaded PEFT/LoRA adapter '{model_name}'.")
            except Exception:
                _tokenizer = AutoTokenizer.from_pretrained(model_name)
                _model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
        except ImportError:
            _tokenizer = AutoTokenizer.from_pretrained(model_name)
            _model = AutoModelForSeq2SeqLM.from_pretrained(model_name)

        _device = get_device()
        _model.to(_device)
        _model.eval()

        if _device.type == "cpu":
            num_threads = min(4, os.cpu_count() or 1)
            torch.set_num_threads(num_threads)

        logger.info(f"Summarizer model '{model_name}' loaded successfully on {_device}.")

    return _model, _tokenizer, _device


def get_summarizer() -> Tuple[Any, Any, Any]:
    """Retrieve singleton model and tokenizer instance."""
    return load_summarizer_model()


def clean_summary_text(text: str) -> str:
    """Format, clean, and deduplicate summary output with complete sentence boundaries."""
    if not text:
        return ""
    # Fix tokenized punctuation spacing (e.g. "word ." -> "word.")
    cleaned = re.sub(r'\s+([,.:;?!])', r'\1', text)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()

    # If the summary ends abruptly without a terminal punctuation mark,
    # trim back to the last complete sentence to guarantee clean grammar.
    if cleaned and cleaned[-1] not in ".!?":
        last_punct = max(cleaned.rfind("."), cleaned.rfind("!"), cleaned.rfind("?"))
        if last_punct > 20:
            cleaned = cleaned[: last_punct + 1].strip()
        else:
            cleaned += "."

    # Remove duplicated consecutive sentences
    sentences = re.split(r'(?<=[.!?])\s+', cleaned)
    seen_sents = set()
    deduped_sents = []
    for s in sentences:
        s_norm = re.sub(r'[^\w]', '', s.lower())
        if s_norm and s_norm not in seen_sents:
            seen_sents.add(s_norm)
            deduped_sents.append(s)

    return " ".join(deduped_sents)


def preprocess_transcript_for_summary(text: str) -> str:
    """Clean conversational fillers and repeated tokens to maximize context window value."""
    # Remove filler words
    cleaned = TRANSCRIPT_CLEANUP_REGEX.sub(" ", text)
    # Remove repeated adjacent words (e.g. "the the", "we we")
    cleaned = re.sub(r'\b(\w+)(?:\s+\1\b)+', r'\1', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned


def summarize_block(
    text: str,
    max_new_tokens: int = 130,
    min_new_tokens: int = 25,
    num_beams: int = 2,
) -> str:
    """Summarize a single coherent text block (<= 700 tokens) using the Seq2Seq model."""
    clean_text = preprocess_transcript_for_summary(text)
    if not clean_text:
        return ""

    words = clean_text.split()
    if len(words) < 20:
        return clean_summary_text(clean_text)

    import torch

    model, tokenizer, device = get_summarizer()

    # Format input with instruction conditioning if using T5 / Flan-T5
    is_t5 = "t5" in getattr(model, "name_or_path", "").lower() or _is_t5_model
    if is_t5:
        input_prompt = f"Summarize the key concepts and findings from this lecture excerpt:\n\n{clean_text}"
    else:
        input_prompt = clean_text

    raw_inputs = tokenizer(
        input_prompt,
        return_tensors="pt",
        truncation=True,
        max_length=1024,
    )
    if hasattr(raw_inputs, "to"):
        inputs = raw_inputs.to(device)
    else:
        inputs = {k: (v.to(device) if hasattr(v, "to") else v) for k, v in raw_inputs.items()}

    input_tokens = inputs["input_ids"].shape[1]

    # Dynamically scale generation bounds for shorter inputs
    effective_max = min(max_new_tokens, max(30, int(input_tokens * 0.7)))
    effective_min = min(min_new_tokens, max(10, int(effective_max * 0.35)))

    gen_kwargs: dict[str, Any] = {
        "input_ids": inputs["input_ids"],
        "attention_mask": inputs.get("attention_mask"),
        "max_new_tokens": effective_max,
        "min_new_tokens": effective_min,
        "num_beams": num_beams,
        "early_stopping": True,
        "no_repeat_ngram_size": 3,
        "repetition_penalty": 1.2,
        "length_penalty": 1.2,
    }

    # Only set forced_bos_token_id for models where BOS is configured (e.g. BART <s>), not T5
    if not is_t5 and hasattr(model.config, "bos_token_id") and model.config.bos_token_id is not None:
        gen_kwargs["forced_bos_token_id"] = model.config.bos_token_id

    with torch.inference_mode():
        output_ids = model.generate(**gen_kwargs)

    raw_summary = tokenizer.decode(output_ids[0], skip_special_tokens=True)
    summary = clean_summary_text(raw_summary)

    # Fallback guardrail: If model produces an empty or degenerate summary,
    # extract the first 2 clear sentences from the clean text.
    if len(summary.split()) < 5:
        sentences = re.split(r'(?<=[.!?])\s+', clean_text)
        fallback_sents = [s.strip() for s in sentences if len(s.split()) >= 6][:2]
        summary = " ".join(fallback_sents)
        if summary and not summary.endswith("."):
            summary += "."

    return summary


def chunk_long_text(text: str, max_tokens: int = MAX_INPUT_TOKENS) -> list[str]:
    """Split long text into token-bounded chunks respecting sentence boundaries."""
    _, tokenizer, _ = get_summarizer()
    words = text.split()
    if not words:
        return []

    # Fast initial estimation: ~1.3 tokens per word
    if len(words) * 1.3 < max_tokens:
        return [text]

    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks: list[str] = []
    current_sentences: list[str] = []
    current_tokens = 0

    for sentence in sentences:
        s_tokens = len(tokenizer.encode(sentence, add_special_tokens=False))
        if current_tokens + s_tokens > max_tokens and current_sentences:
            chunks.append(" ".join(current_sentences))
            current_sentences = [sentence]
            current_tokens = s_tokens
        else:
            current_sentences.append(sentence)
            current_tokens += s_tokens

    if current_sentences:
        chunks.append(" ".join(current_sentences))

    return chunks or [text]


def summarize_chapter_text(text: str) -> str:
    """Summarize chapter text, splitting into sub-chunks if longer than MAX_INPUT_TOKENS."""
    chunks = chunk_long_text(text, max_tokens=MAX_INPUT_TOKENS)

    if len(chunks) == 1:
        return summarize_block(chunks[0], max_new_tokens=140, min_new_tokens=30, num_beams=2)

    # Sub-chunk summarization (Map)
    sub_summaries = [
        summarize_block(c, max_new_tokens=85, min_new_tokens=20, num_beams=2)
        for c in chunks
        if c.strip()
    ]
    combined_sub = " ".join(s for s in sub_summaries if s)

    # Combine sub-summaries (Reduce)
    return summarize_block(combined_sub, max_new_tokens=150, min_new_tokens=35, num_beams=3)


def summarize_chapters_and_overall(
    segments: list[Segment],
    chapters: list[dict[str, Any]],
    has_timestamps: bool = True,
) -> tuple[list[dict[str, Any]], str]:
    """Map-reduce summarization pipeline for an item:

    1. Map: Summarize each individual chapter.
    2. Reduce: Summarize the set of chapter summaries into an overall summary.
    """
    if not chapters:
        # Fallback if no chapters detected: summarize full transcript directly
        full_text = " ".join(s.get("text", "") for s in segments).strip()
        overall = summarize_chapter_text(full_text)
        return [], overall

    # Map segments to chapters
    num_chapters = len(chapters)
    updated_chapters: list[dict[str, Any]] = []

    for i, ch in enumerate(chapters):
        ch_start = float(ch.get("start", 0.0))
        ch_end = float(ch.get("end", 0.0))

        if has_timestamps:
            # Include segments in [start, end)
            is_last = (i == num_chapters - 1)
            matching_segs = [
                s for s in segments
                if (s.get("start", 0.0) >= ch_start)
                and (s.get("start", 0.0) < ch_end or is_last)
            ]
        else:
            # For untimed text: divide segments evenly across chapters
            total_segs = len(segments)
            seg_start_idx = int((i / num_chapters) * total_segs)
            seg_end_idx = int(((i + 1) / num_chapters) * total_segs)
            matching_segs = segments[seg_start_idx:seg_end_idx]

        chapter_text = " ".join(s.get("text", "") for s in matching_segs).strip()

        # If chapter text is empty (rare edge case), fallback to segment text or title
        if not chapter_text:
            chapter_text = ch.get("title", "")

        logger.info(f"Summarizing Chapter {i + 1}/{num_chapters}: '{ch.get('title')}' ({len(chapter_text.split())} words)")
        chapter_summary = summarize_chapter_text(chapter_text)

        updated_chapters.append(
            {
                **ch,
                "summary": chapter_summary,
            }
        )

    # Reduce step: Summarize chapter summaries into one cohesive Executive Summary
    logger.info("Running Reduce step for overall executive summary...")
    chapter_summaries_list = [
        ch["summary"] for ch in updated_chapters if ch.get("summary")
    ]

    if not chapter_summaries_list:
        overall_summary = ""
    elif len(chapter_summaries_list) == 1:
        overall_summary = chapter_summaries_list[0]
    else:
        combined_summaries = " ".join(chapter_summaries_list)
        # Summarize the combined chapter summaries into an executive synthesis
        overall_summary = summarize_block(
            combined_summaries,
            max_new_tokens=190,
            min_new_tokens=55,
            num_beams=3,
        )

    logger.info(f"Overall summary generated ({len(overall_summary.split())} words).")
    return updated_chapters, overall_summary
