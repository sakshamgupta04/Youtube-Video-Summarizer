"""Unit tests for Phase 6 summarization pipeline."""

from unittest.mock import MagicMock, patch
import pytest

from app.pipeline.summarize import (
    clean_summary_text,
    chunk_long_text,
    summarize_chapters_and_overall,
    summarize_block,
)


def test_clean_summary_text():
    assert clean_summary_text("Hello world . How are you ?") == "Hello world. How are you?"
    assert clean_summary_text("  Spaced   out   sentence . ") == "Spaced out sentence."
    assert clean_summary_text("") == ""


def test_chunk_long_text_short():
    text = "This is a brief text that does not need chunking."
    chunks = chunk_long_text(text, max_tokens=700)
    assert len(chunks) == 1
    assert chunks[0] == text


def test_chunk_long_text_splits_sentences():
    # Long text of multiple sentences
    sentences = [f"This is sentence number {i} discussing open source AI models." for i in range(50)]
    long_text = " ".join(sentences)

    chunks = chunk_long_text(long_text, max_tokens=100)
    assert len(chunks) > 1
    # Verify all text is preserved across chunks
    combined = " ".join(chunks)
    for s in sentences:
        assert s in combined


@patch("app.pipeline.summarize.get_summarizer")
def test_summarize_block_mocked(mock_get_summarizer):
    mock_model = MagicMock()
    mock_tokenizer = MagicMock()
    mock_device = MagicMock()

    mock_tokenizer.return_value = {
        "input_ids": MagicMock(shape=[1, 50]),
        "attention_mask": MagicMock(),
    }
    mock_tokenizer.decode.return_value = " This is a summarized test output . "
    mock_model.generate.return_value = [[1, 2, 3]]
    mock_get_summarizer.return_value = (mock_model, mock_tokenizer, mock_device)

    sample_text = " ".join(["EchoNotes summarizer processes lectures and podcasts locally."] * 5)
    summary = summarize_block(sample_text)

    assert summary == "This is a summarized test output."
    assert mock_model.generate.called


@patch("app.pipeline.summarize.summarize_chapter_text")
@patch("app.pipeline.summarize.summarize_block")
def test_summarize_chapters_and_overall_map_reduce(mock_summarize_block, mock_summarize_chapter):
    mock_summarize_chapter.side_effect = [
        "Summary for chapter 1 regarding introduction.",
        "Summary for chapter 2 regarding backpropagation.",
    ]
    mock_summarize_block.return_value = "Overall summary uniting neural networks and backpropagation."

    segments = [
        {"start": 0.0, "end": 10.0, "text": "Welcome to deep learning lecture."},
        {"start": 10.0, "end": 20.0, "text": "We start with artificial neurons."},
        {"start": 120.0, "end": 130.0, "text": "Now we move to gradient descent."},
        {"start": 130.0, "end": 140.0, "text": "Backpropagation computes gradients using the chain rule."},
    ]
    chapters = [
        {"start": 0.0, "end": 120.0, "title": "Introduction To Neurons", "summary": ""},
        {"start": 120.0, "end": 240.0, "title": "Gradient Descent Optimization", "summary": ""},
    ]

    updated_chapters, overall_summary = summarize_chapters_and_overall(
        segments=segments,
        chapters=chapters,
        has_timestamps=True,
    )

    assert len(updated_chapters) == 2
    assert updated_chapters[0]["summary"] == "Summary for chapter 1 regarding introduction."
    assert updated_chapters[1]["summary"] == "Summary for chapter 2 regarding backpropagation."
    assert overall_summary == "Overall summary uniting neural networks and backpropagation."


def test_summarize_chapters_empty_fallback():
    segments = [{"start": 0.0, "end": 5.0, "text": "Hello world"}]
    updated_chapters, overall_summary = summarize_chapters_and_overall(
        segments=segments,
        chapters=[],
        has_timestamps=True,
    )
    assert updated_chapters == []
    # Very short text returns itself
    assert "Hello world" in overall_summary
