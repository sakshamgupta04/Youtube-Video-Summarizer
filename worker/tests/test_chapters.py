"""Tests for chapter segmentation and KeyBERT title generation (pipeline/chapters.py)."""

import pytest
from app.pipeline.chapters import detect_chapters, extract_chapter_title


def test_extract_chapter_title():
    text = (
        "In this section we explore deep reinforcement learning and policy gradients. "
        "Agents learn optimal policies through trial and error using reward feedback."
    )
    title = extract_chapter_title(text)
    assert title != "Chapter"
    assert len(title) > 0


def test_detect_chapters_multi_window():
    # Construct a simulated transcript spanning 8 minutes (480s)
    # Section A: 0-240s about Quantum Computing
    # Section B: 240-480s about Marine Biology
    segments = []
    # Section A
    for i in range(12):
        segments.append(
            {
                "start": float(i * 20),
                "end": float((i + 1) * 20),
                "text": "Quantum computing uses superposition and entanglement to solve intractable physics problems.",
            }
        )
    # Section B
    for i in range(12, 24):
        segments.append(
            {
                "start": float(i * 20),
                "end": float((i + 1) * 20),
                "text": "Marine biology examines ocean ecosystems, coral reefs, and hydrothermal vent creatures.",
            }
        )

    chapters = detect_chapters(segments, has_timestamps=True)

    assert len(chapters) >= 2
    # Verify first chapter starts at 0
    assert chapters[0]["start"] == 0.0
    # Verify last chapter ends at 480
    assert chapters[-1]["end"] == 480.0
    # Verify each chapter has a title
    for c in chapters:
        assert "title" in c
        assert len(c["title"]) > 0
        assert c["end"] > c["start"]
