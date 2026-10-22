"""Audio and video transcription pipeline using faster-whisper and ffmpeg.

Converts any media file to 16kHz mono WAV via ffmpeg, transcribes using
faster-whisper (model: base, compute_type: int8, device: cpu), and cleans
up temporary audio files immediately after.
"""

from __future__ import annotations

import logging
import os
import shutil
import subprocess
import tempfile
from typing import Callable, TypedDict

from faster_whisper import WhisperModel

logger = logging.getLogger("echonotes.transcribe")

# Singleton WhisperModel instance
_whisper_model: WhisperModel | None = None


class Segment(TypedDict):
    start: float
    end: float
    text: str


def get_whisper_model(model_size: str = "base") -> WhisperModel:
    """Return a cached instance of the faster-whisper model."""
    global _whisper_model
    if _whisper_model is None:
        logger.info(f"Loading faster-whisper model '{model_size}' (int8 on CPU)...")
        _whisper_model = WhisperModel(
            model_size_or_path=model_size,
            device="cpu",
            compute_type="int8",
        )
        logger.info("faster-whisper model loaded successfully.")
    return _whisper_model


def extract_audio(input_media_path: str, output_wav_path: str) -> None:
    """Use ffmpeg to extract/convert any media file into 16kHz mono PCM WAV."""
    if not os.path.exists(input_media_path):
        raise FileNotFoundError(f"Input media file not found: {input_media_path}")

    cmd = [
        "ffmpeg",
        "-y",
        "-loglevel",
        "error",
        "-i",
        input_media_path,
        "-vn",
        "-acodec",
        "pcm_s16le",
        "-ar",
        "16000",
        "-ac",
        "1",
        output_wav_path,
    ]

    try:
        subprocess.run(
            cmd,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
    except subprocess.CalledProcessError as err:
        stderr_msg = err.stderr.strip() if err.stderr else str(err)
        raise RuntimeError(f"ffmpeg audio extraction failed: {stderr_msg}") from err
    except FileNotFoundError:
        raise RuntimeError("ffmpeg binary was not found in system PATH.")


def transcribe_media(
    input_path: str,
    progress_callback: Callable[[int], None] | None = None,
    model_size: str = "base",
    language: str | None = None,
) -> tuple[list[Segment], int]:
    """Transcribe an audio or video file into timestamped segments.

    Args:
        input_path: Path to the media file on disk.
        progress_callback: Optional callable receiving progress percentage (0-100).
        model_size: Whisper model size (defaults to 'base').
        language: Language code (e.g. 'en') or None for auto-detection.

    Returns:
        (segments, duration_sec)
    """
    temp_dir = tempfile.mkdtemp(prefix="echonotes_")
    wav_path = os.path.join(temp_dir, "extracted.wav")

    try:
        if progress_callback:
            progress_callback(15)

        logger.info(f"Extracting audio from {input_path} -> {wav_path}...")
        extract_audio(input_path, wav_path)

        if progress_callback:
            progress_callback(30)

        model = get_whisper_model(model_size)

        logger.info("Starting transcription with faster-whisper...")
        try:
            segments_generator, info = model.transcribe(
                wav_path,
                beam_size=5,
                language=language or "en",
                vad_filter=True,
            )
        except ValueError as val_err:
            # Handles silent / speech-less audio where VAD strips everything
            if "empty" in str(val_err).lower():
                logger.warning("VAD filter detected no speech in media file.")
                return [], 0
            raise

        total_duration = info.duration or 1.0
        segments: list[Segment] = []

        for seg in segments_generator:
            text = seg.text.strip()
            if text:
                segments.append(
                    {
                        "start": round(float(seg.start), 3),
                        "end": round(float(seg.end), 3),
                        "text": text,
                    }
                )

            if progress_callback and info.duration:
                current_pct = min(90, 30 + int((seg.end / total_duration) * 60))
                progress_callback(current_pct)

        duration_sec = int(round(total_duration))
        logger.info(
            f"Transcription complete: {len(segments)} segments, duration {duration_sec}s."
        )

        return segments, duration_sec

    finally:
        if os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception as e:
                logger.warning(f"Could not remove temp dir {temp_dir}: {e}")
