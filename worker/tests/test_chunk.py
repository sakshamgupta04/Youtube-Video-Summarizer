"""Tests for chunking module (pipeline/chunk.py)."""

import pytest
from app.pipeline.chunk import create_chunks


def test_create_chunks_groups_segments():
    # 12 segments of 10s each = 120s total
    segments = [
        {"start": float(i * 10), "end": float((i + 1) * 10), "text": f"Sentence {i} with some content."}
        for i in range(12)
    ]

    chunks = create_chunks(segments, target_segments_per_chunk=5, max_duration_sec=60.0)

    # 12 segments with target 5 per chunk should produce roughly 3 chunks (5, 5, 2)
    assert len(chunks) == 3
    assert chunks[0]["start_sec"] == 0.0
    assert "Sentence 0" in chunks[0]["text"]
    assert "Sentence 4" in chunks[0]["text"]

    assert chunks[1]["start_sec"] == 50.0
    assert "Sentence 5" in chunks[1]["text"]

    assert chunks[2]["start_sec"] == 100.0
    assert "Sentence 11" in chunks[2]["text"]


def test_create_chunks_empty():
    assert create_chunks([]) == []


def test_create_chunks_forces_max_duration():
    # 2 segments with huge duration span (70s)
    segments = [
        {"start": 0.0, "end": 40.0, "text": "Long segment one."},
        {"start": 40.0, "end": 80.0, "text": "Long segment two."},
        {"start": 80.0, "end": 90.0, "text": "Segment three."},
    ]

    chunks = create_chunks(segments, target_segments_per_chunk=10, max_duration_sec=60.0)
    assert len(chunks) >= 2
