"""Summarization pipeline module using Map-Reduce with DistilBART-CNN.

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

# DistilBART maximum input tokens is 1024; chunk chapters exceeding 700 tokens
MAX_INPUT_TOKENS = 700
CHUNK_OVERLAP_TOKENS = 50


def get_device():
    """Determine PyTorch compute device."""
    import torch

    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


def load_summarizer_model() -> Tuple[Any, Any, Any]:
    """Load tokenizer and model into memory once."""
    global _model, _tokenizer, _device
    if _model is None or _tokenizer is None:
        import torch
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

        model_name = settings.summarizer_model
        logger.info(f"Loading summarizer model '{model_name}'...")

        try:
            from peft import PeftConfig, PeftModel
            try:
                peft_config = PeftConfig.from_pretrained(model_name)
                base_model_name = peft_config.base_model_name_or_path or "google/flan-t5-base"
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
    """Format and clean summary output."""
    if not text:
        return ""
    # Fix tokenized punctuation spacing (e.g. "word ." -> "word.")
    cleaned = re.sub(r'\s+([,.:;?!])', r'\1', text)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned


def summarize_block(
    text: str,
    max_new_tokens: int = 120,
    min_new_tokens: int = 25,
    num_beams: int = 2,
) -> str:
    """Summarize a single coherent text block (<= 700 tokens) using the Seq2Seq model."""
    clean_text = text.strip()
    if not clean_text:
        return ""

    words = clean_text.split()
    if len(words) < 20:
        return clean_text

    import torch

    model, tokenizer, device = get_summarizer()

    raw_inputs = tokenizer(
        clean_text,
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
    effective_max = min(max_new_tokens, max(25, int(input_tokens * 0.7)))
    effective_min = min(min_new_tokens, max(10, int(effective_max * 0.4)))

    with torch.inference_mode():
        output_ids = model.generate(
            input_ids=inputs["input_ids"],
            attention_mask=inputs.get("attention_mask"),
            max_new_tokens=effective_max,
            min_new_tokens=effective_min,
            num_beams=num_beams,
            early_stopping=True,
            no_repeat_ngram_size=3,
            forced_bos_token_id=0,
            length_penalty=1.5,
        )

    raw_summary = tokenizer.decode(output_ids[0], skip_special_tokens=True)
    return clean_summary_text(raw_summary)


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
        return summarize_block(chunks[0], max_new_tokens=130, min_new_tokens=30)

    # Sub-chunk summarization (Map)
    sub_summaries = [
        summarize_block(c, max_new_tokens=80, min_new_tokens=20)
        for c in chunks
        if c.strip()
    ]
    combined_sub = " ".join(s for s in sub_summaries if s)

    # Combine sub-summaries (Reduce)
    return summarize_block(combined_sub, max_new_tokens=140, min_new_tokens=35)


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

        # If chapter text is empty (rare edge case), fallback to segment text
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

    # Reduce step: Summarize chapter summaries into one overall summary
    logger.info("Running Reduce step for overall summary...")
    chapter_summaries_list = [
        ch["summary"] for ch in updated_chapters if ch.get("summary")
    ]

    if not chapter_summaries_list:
        overall_summary = ""
    elif len(chapter_summaries_list) == 1:
        overall_summary = chapter_summaries_list[0]
    else:
        combined_summaries = " ".join(chapter_summaries_list)
        # Summarize the combined chapter summaries
        overall_summary = summarize_block(
            combined_summaries,
            max_new_tokens=180,
            min_new_tokens=50,
            num_beams=3,
        )

    logger.info(f"Overall summary generated ({len(overall_summary.split())} words).")
    return updated_chapters, overall_summary
