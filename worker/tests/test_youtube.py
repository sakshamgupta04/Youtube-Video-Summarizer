"""Tests for YouTube ingestion module (ingest/youtube.py)."""

import pytest
from app.ingest.youtube import (
    extract_video_id,
    process_youtube_video,
    FRIENDLY_FAILURE_MESSAGE,
    MAX_DURATION_SECONDS,
)


def test_extract_video_id_various_formats():
    test_cases = [
        ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://www.youtube.com/v/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s", "dQw4w9WgXcQ"),
        ("https://m.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("dQw4w9WgXcQ", "dQw4w9WgXcQ"),
    ]

    for url, expected in test_cases:
        assert extract_video_id(url) == expected, f"Failed for {url}"


def test_extract_video_id_invalid_returns_none():
    assert extract_video_id("https://vimeo.com/123456") is None
    assert extract_video_id("not-a-youtube-url") is None
    assert extract_video_id("") is None


def test_process_invalid_youtube_url_raises_friendly_error():
    with pytest.raises(Exception) as exc_info:
        process_youtube_video("https://www.youtube.com/watch?v=invalid_id_999999999")

    # Should raise either invalid ID or friendly failure message
    err = str(exc_info.value)
    assert FRIENDLY_FAILURE_MESSAGE in err or "Invalid YouTube URL" in err
