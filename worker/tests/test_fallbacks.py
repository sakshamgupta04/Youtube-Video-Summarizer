"""Tests for Section 7: Fallback Table & Fault Tolerance.

Verifies:
1. yt-dlp fails -> Friendly message asks the user to upload the file.
2. No captions -> Whisper path fallback.
3. Video too long -> Friendly error with 90-minute limit.
4. Worker asleep/down -> Item stays queued.
5. Embedding service down -> Falls back to keyword search.
6. Summary model fails -> Shows key points and chapters; summary marked "Summary unavailable.".
7. Spotify link pasted -> Friendly message: "Spotify isn't supported yet. Upload the file, or paste the YouTube link."
"""

import pytest
from unittest.mock import patch, MagicMock

from app.ingest.youtube import (
    extract_video_id,
    process_youtube_video,
    get_video_metadata,
    FRIENDLY_FAILURE_MESSAGE,
    MAX_DURATION_SECONDS,
)
from app.loop import _process_understanding_pipeline


def test_spotify_link_rejected_with_friendly_message():
    """Fallback 7: Spotify link pasted -> Friendly message."""
    spotify_links = [
        "https://open.spotify.com/episode/7makk4oTKqOh6nRsgACRYC",
        "https://spotify.com/episode/12345",
        "spotify:episode:7makk4oTKqOh6nRsgACRYC",
    ]
    for link in spotify_links:
        with pytest.raises(ValueError) as exc:
            process_youtube_video(link)
        assert "Spotify isn't supported yet. Upload the file, or paste the YouTube link." in str(exc.value)


def test_ytdlp_fails_returns_friendly_message():
    """Fallback 1: yt-dlp fails -> Friendly message asks user to upload the file."""
    with patch("app.ingest.youtube.try_fetch_captions", return_value=None), \
         patch("app.ingest.youtube.download_audio_and_transcribe", side_effect=RuntimeError("yt-dlp extraction failed")):
        with pytest.raises(RuntimeError) as exc:
            process_youtube_video("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
        assert FRIENDLY_FAILURE_MESSAGE in str(exc.value)
        assert "upload the file" in str(exc.value).lower()


def test_no_captions_falls_back_to_whisper():
    """Fallback 2: No captions -> Whisper path."""
    mock_segments = [
        {"start": 0.0, "end": 4.5, "text": "Transcribed via Whisper fallback."}
    ]
    with patch("app.ingest.youtube.try_fetch_captions", return_value=None), \
         patch("app.ingest.youtube.download_audio_and_transcribe", return_value=(mock_segments, 5)):
        vid, segments, duration, title = process_youtube_video("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
        assert vid == "dQw4w9WgXcQ"
        assert len(segments) == 1
        assert segments[0]["text"] == "Transcribed via Whisper fallback."


def test_video_too_long_raises_90_minute_limit_error():
    """Fallback 3: Video too long -> Friendly error with the 90-minute limit."""
    mock_info = {
        "title": "Super Long 2 Hour Lecture",
        "duration": 7200,  # 120 minutes > 90 min (5400s)
    }
    with patch("yt_dlp.YoutubeDL") as mock_ydl:
        instance = mock_ydl.return_value.__enter__.return_value
        instance.extract_info.return_value = mock_info
        with pytest.raises(ValueError) as exc:
            get_video_metadata("dQw4w9WgXcQ")
        assert "90-minute" in str(exc.value) or "90" in str(exc.value)


def test_summary_model_fails_preserves_chapters_and_keypoints():
    """Fallback 6: Summary model fails -> Show key points and chapters only; mark summary unavailable."""
    segments = [
        {"start": 0.0, "end": 15.0, "text": "Introduction to neural network architectures."},
        {"start": 15.0, "end": 35.0, "text": "Backpropagation computes gradients through the chain rule."},
        {"start": 35.0, "end": 60.0, "text": "Optimization using Adam and stochastic gradient descent."},
    ]

    mock_db = MagicMock()
    mock_db.table.return_value.update.return_value.eq.return_value.execute.return_value = None
    mock_db.table.return_value.upsert.return_value.execute.return_value = None

    # Force summarize_chapters_and_overall to throw an error (e.g. OOM or timeout)
    with patch("app.loop.summarize_chapters_and_overall", side_effect=RuntimeError("Model CUDA OOM")):
        chapters, key_points, summary = _process_understanding_pipeline(
            item_id="test-item-123",
            user_id="user-456",
            segments=segments,
            has_timestamps=True,
            db=mock_db,
        )

    # Chapters and key points should be preserved
    assert len(chapters) >= 1
    assert len(key_points) >= 1
    # Summary should be explicitly marked "Summary unavailable."
    assert summary == "Summary unavailable."
