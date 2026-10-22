"""Tests for file ingestion module (ingest/files.py)."""

import pytest
from app.ingest.files import (
    parse_file,
    parse_srt,
    parse_vtt,
    parse_plain_text,
)


SAMPLE_TXT = """Welcome to EchoNotes.
This is the first paragraph of the lecture notes.

This is the second paragraph. It covers key insights on open-source AI models and local processing.

Finally, the conclusion paragraph wrapping up the ideas.
"""

SAMPLE_MD = """# Introduction to Machine Learning

Machine learning is a subset of artificial intelligence. It focuses on training algorithms on data.

## Chapter 1: Supervised Learning

In supervised learning, models are trained on input-output pairs. Common examples include classification and regression.

## Chapter 2: Evaluation Metrics

Accuracy, precision, recall, and F1-score are standard metrics.
"""

SAMPLE_SRT = """1
00:00:01,000 --> 00:00:04,500
Hello everyone and welcome back to the course.

2
00:00:05,200 --> 00:00:09,800
Today we are going to talk about speech to text models.

3
00:00:10,000 --> 00:00:14,250
Specifically, we will explore faster-whisper on CPU.
"""

SAMPLE_VTT = """WEBVTT - EchoNotes Test

00:00:01.500 --> 00:00:05.000
Welcome to this podcast episode.

00:00:05.800 --> 00:00:11.200
We are discussing embeddings with sentence-transformers.

00:00:12.000 --> 00:00:16.400
The 384-dimensional vectors represent deep semantic meaning.
"""


def test_parse_plain_text():
    segments = parse_plain_text(SAMPLE_TXT)
    assert len(segments) == 3
    assert segments[0]["start"] == 0.0
    assert segments[0]["end"] == 0.0
    assert "Welcome to EchoNotes" in segments[0]["text"]
    assert "conclusion paragraph" in segments[2]["text"]


def test_parse_markdown():
    segments, has_timestamps = parse_file(SAMPLE_MD, "lecture.md")
    assert has_timestamps is False
    assert len(segments) >= 3
    assert any("Machine learning is a subset" in s["text"] for s in segments)
    assert any("Supervised Learning" in s["text"] for s in segments)


def test_parse_srt():
    segments, has_timestamps = parse_file(SAMPLE_SRT, "sample.srt")
    assert has_timestamps is True
    assert len(segments) == 3

    assert segments[0]["start"] == 1.0
    assert segments[0]["end"] == 4.5
    assert "Hello everyone" in segments[0]["text"]

    assert segments[1]["start"] == 5.2
    assert segments[1]["end"] == 9.8

    assert segments[2]["start"] == 10.0
    assert segments[2]["end"] == 14.25


def test_parse_vtt():
    segments, has_timestamps = parse_file(SAMPLE_VTT, "podcast.vtt")
    assert has_timestamps is True
    assert len(segments) == 3

    assert segments[0]["start"] == 1.5
    assert segments[0]["end"] == 5.0
    assert "Welcome to this podcast episode" in segments[0]["text"]

    assert segments[1]["start"] == 5.8
    assert segments[1]["end"] == 11.2


def test_parse_unknown_extension_fallback():
    segments, has_timestamps = parse_file("Some unstructured notes line 1\n\nLine 2", "notes.doc")
    assert has_timestamps is False
    assert len(segments) == 2
