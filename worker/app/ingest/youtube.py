"""YouTube ingestion module.

Extracts YouTube video IDs, attempts fast caption retrieval via youtube-transcript-api,
falls back to audio download via yt-dlp + Whisper transcription, and cleans up media files.
Enforces the 90-minute limit and provides clear error messages.
"""

from __future__ import annotations

import logging
import os
import re
import shutil
import tempfile
from typing import Callable, TypedDict

from youtube_transcript_api import YouTubeTranscriptApi
import yt_dlp

from app.pipeline.transcribe import transcribe_media, Segment

logger = logging.getLogger("echonotes.youtube")

MAX_DURATION_SECONDS = 5400  # 90 minutes
FRIENDLY_FAILURE_MESSAGE = "Couldn't fetch this video. Please upload the file instead."

YOUTUBE_ID_REGEX = re.compile(
    r"(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([a-zA-Z0-9_-]{11})"
)


def extract_video_id(url_or_id: str) -> str | None:
    """Extract an 11-character YouTube video ID from any URL format or raw ID string."""
    clean = url_or_id.strip()
    if re.fullmatch(r"[a-zA-Z0-9_-]{11}", clean):
        return clean

    match = YOUTUBE_ID_REGEX.search(clean)
    if match:
        return match.group(1)

    return None


def get_video_metadata(video_id: str) -> dict[str, str | int | None]:
    """Fetch video metadata (title, duration) via yt-dlp without downloading."""
    url = f"https://www.youtube.com/watch?v={video_id}"
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "extract_flat": False,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if not info:
                raise RuntimeError(FRIENDLY_FAILURE_MESSAGE)

            duration = info.get("duration")
            title = info.get("title")

            if duration and duration > MAX_DURATION_SECONDS:
                raise ValueError(
                    f"Video duration ({duration // 60}m) exceeds the 90-minute maximum limit."
                )

            return {
                "title": title,
                "duration": int(duration) if duration else None,
            }
    except ValueError:
        raise
    except Exception as e:
        logger.warning(f"Could not extract video metadata via yt-dlp: {e}")
        return {"title": None, "duration": None}


def try_fetch_captions(video_id: str) -> list[Segment] | None:
    """Try 1: Fetch existing official or auto-generated captions via youtube-transcript-api."""
    logger.info(f"Trying caption fetch for YouTube video: {video_id}...")
    try:
        raw_transcript = None

        # Support both newer v1.x instance API and older classmethods
        if hasattr(YouTubeTranscriptApi, "fetch"):
            api = YouTubeTranscriptApi()
            try:
                raw_transcript = api.fetch(video_id, languages=["en", "en-US", "en-GB"])
            except Exception:
                try:
                    transcript_list = api.list(video_id)
                    t_obj = transcript_list.find_transcript(["en", "en-US", "en-GB"])
                    raw_transcript = t_obj.fetch()
                except Exception:
                    pass

        elif hasattr(YouTubeTranscriptApi, "get_transcript"):
            try:
                raw_transcript = YouTubeTranscriptApi.get_transcript(
                    video_id, languages=["en", "en-US", "en-GB"]
                )
            except Exception:
                pass

        if not raw_transcript:
            logger.info(f"No captions found for {video_id}. Falling back to audio download.")
            return None

        segments: list[Segment] = []
        for item in raw_transcript:
            text = getattr(item, "text", None) or (
                item.get("text") if isinstance(item, dict) else ""
            )
            start = getattr(item, "start", None) or (
                item.get("start") if isinstance(item, dict) else 0.0
            )
            duration = getattr(item, "duration", None) or (
                item.get("duration") if isinstance(item, dict) else 0.0
            )

            start = round(float(start), 3)
            duration = float(duration or 0.0)
            end = round(start + duration, 3)
            clean_text = text.replace("\n", " ").strip()
            if clean_text:
                segments.append({"start": start, "end": end, "text": clean_text})

        if segments:
            logger.info(
                f"Successfully retrieved {len(segments)} caption segments for {video_id}."
            )
            return segments

    except Exception as e:
        logger.info(f"Caption fetch error for {video_id}: {e}. Falling back to audio download.")

    return None


def download_audio_and_transcribe(
    video_id: str,
    progress_callback: Callable[[int], None] | None = None,
) -> tuple[list[Segment], int]:
    """Try 2: Download audio stream with yt-dlp, transcribe with Whisper, delete audio immediately."""
    logger.info(f"Downloading audio for YouTube video {video_id} via yt-dlp...")
    url = f"https://www.youtube.com/watch?v={video_id}"
    temp_dir = tempfile.mkdtemp(prefix="echonotes_yt_")
    out_template = os.path.join(temp_dir, "%(id)s.%(ext)s")

    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": out_template,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "128",
            }
        ],
        "quiet": True,
        "no_warnings": True,
    }

    try:
        if progress_callback:
            progress_callback(10)

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        # Locate downloaded mp3
        downloaded_files = [
            os.path.join(temp_dir, f)
            for f in os.listdir(temp_dir)
            if f.endswith((".mp3", ".m4a", ".opus", ".webm"))
        ]

        if not downloaded_files:
            raise RuntimeError(FRIENDLY_FAILURE_MESSAGE)

        audio_file = downloaded_files[0]

        if progress_callback:
            progress_callback(25)

        # Transcribe with Whisper
        segments, duration_sec = transcribe_media(
            audio_file,
            progress_callback=progress_callback,
        )

        return segments, duration_sec

    finally:
        # Guarantee audio files are permanently deleted immediately after transcription
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)
            logger.info("Deleted temporary YouTube audio files.")


def process_youtube_video(
    video_url_or_id: str,
    progress_callback: Callable[[int], None] | None = None,
) -> tuple[str, list[Segment], int, str | None]:
    """Complete YouTube input ladder:
    1. Check for unsupported links (e.g., Spotify) and extract video ID.
    2. Validate 90-min limit.
    3. Try existing captions.
    4. If no captions, try yt-dlp audio download + Whisper.
    5. If both fail, raise friendly error message.

    Returns:
        (video_id, segments, duration_sec, detected_title)
    """
    clean = video_url_or_id.strip()
    if "spotify.com" in clean or clean.startswith("spotify:"):
        raise ValueError(
            "Spotify isn't supported yet. Upload the file, or paste the YouTube link."
        )

    video_id = extract_video_id(video_url_or_id)
    if not video_id:
        raise ValueError(
            "Invalid YouTube URL or ID. Please provide a valid YouTube link."
        )

    # Check metadata & 90 min limit
    meta = get_video_metadata(video_id)
    title = str(meta["title"]) if meta.get("title") else None
    duration_meta = meta.get("duration")

    if progress_callback:
        progress_callback(10)

    # Try 1: Captions
    segments = try_fetch_captions(video_id)
    if segments:
        duration_sec = (
            int(segments[-1]["end"])
            if segments
            else (int(duration_meta) if duration_meta else 0)
        )
        return video_id, segments, duration_sec, title

    # Try 2: yt-dlp + Whisper
    try:
        segments, duration_sec = download_audio_and_transcribe(
            video_id, progress_callback=progress_callback
        )
        if segments:
            return video_id, segments, duration_sec, title
    except Exception as e:
        logger.error(f"yt-dlp + Whisper failed for {video_id}: {e}")

    # Try 3: Friendly error
    raise RuntimeError(FRIENDLY_FAILURE_MESSAGE)
