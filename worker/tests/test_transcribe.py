"""Tests for the media transcription pipeline (pipeline/transcribe.py)."""

import os
import subprocess
import tempfile
import pytest
from app.pipeline.transcribe import extract_audio, transcribe_media


@pytest.fixture(scope="module")
def sample_media():
    """Dynamically generate a tiny 2-second audio/video file for testing."""
    temp_dir = tempfile.mkdtemp(prefix="echonotes_test_media_")
    video_path = os.path.join(temp_dir, "test_clip.mp4")

    # Generate a tiny 2-second MP4 with 440Hz sine wave tone via ffmpeg
    cmd = [
        "ffmpeg",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:duration=2",
        "-f",
        "lavfi",
        "-i",
        "color=c=black:s=160x120:d=2",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-shortest",
        video_path,
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    yield video_path

    # Cleanup
    if os.path.exists(temp_dir):
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)


def test_extract_audio_ffmpeg(sample_media):
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        wav_path = f.name

    try:
        extract_audio(sample_media, wav_path)
        assert os.path.exists(wav_path)
        assert os.path.getsize(wav_path) > 1000  # Non-empty PCM audio
    finally:
        if os.path.exists(wav_path):
            os.remove(wav_path)


def test_extract_audio_missing_file_raises():
    with pytest.raises(FileNotFoundError):
        extract_audio("nonexistent_video_path.mp4", "out.wav")


def test_transcribe_media_pipeline(sample_media):
    progress_events: list[int] = []

    def on_progress(p: int) -> None:
        progress_events.append(p)

    segments, duration = transcribe_media(sample_media, progress_callback=on_progress)

    # For pure sine tone, faster-whisper runs with VAD filter and returns valid duration
    assert duration >= 1
    assert len(progress_events) > 0
