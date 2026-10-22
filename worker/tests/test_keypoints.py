"""Tests for key points extraction using embedding centrality and MMR (pipeline/keypoints.py)."""

import pytest
from app.pipeline.keypoints import extract_key_points, split_into_sentences


def test_split_into_sentences():
    text = "First sentence is comprehensive. Second sentence explains vector search! Third is a question?"
    sentences = split_into_sentences(text)
    assert len(sentences) == 3


def test_extract_key_points():
    segments = [
        {"start": 0.0, "end": 15.0, "text": "Deep learning models are revolutionizing modern computer science applications worldwide."},
        {"start": 15.0, "end": 30.0, "text": "Supervised fine tuning allows models to align closely with human preferences and domain knowledge."},
        {"start": 30.0, "end": 45.0, "text": "Vector databases like pgvector index embeddings efficiently using hierarchical navigable small world graphs."},
        {"start": 45.0, "end": 60.0, "text": "Quantized inference on CPU ensures open-source models run cost-effectively without expensive cloud GPUs."},
    ]

    points = extract_key_points(segments, max_total_points=3)

    assert len(points) >= 2
    assert all(isinstance(p, str) and len(p) > 20 for p in points)
