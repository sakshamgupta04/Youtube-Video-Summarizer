"""EchoNotes file ingestion module.

Parses .txt, .md, .srt, and .vtt file contents into a standardized
list of segments: [{"start": float, "end": float, "text": str}].
"""

from __future__ import annotations

import re
from typing import TypedDict


class Segment(TypedDict):
    start: float
    end: float
    text: str


def _parse_timestamp_to_seconds(ts: str) -> float:
    """Convert timestamp HH:MM:SS[,.]mmm or MM:SS[,.]mmm to float seconds."""
    ts = ts.strip().replace(",", ".")
    parts = ts.split(":")
    if len(parts) == 3:
        hours = float(parts[0])
        minutes = float(parts[1])
        seconds = float(parts[2])
        return round(hours * 3600 + minutes * 60 + seconds, 3)
    if len(parts) == 2:
        minutes = float(parts[0])
        seconds = float(parts[1])
        return round(minutes * 60 + seconds, 3)
    return round(float(ts), 3)


def parse_srt(content: str) -> list[Segment]:
    """Parse SubRip (.srt) subtitle content into timed segments."""
    segments: list[Segment] = []
    # Normalize line endings
    normalized = content.replace("\r\n", "\n").replace("\r", "\n")
    # Blocks separated by double newlines
    blocks = re.split(r"\n\s*\n+", normalized.strip())

    time_pattern = re.compile(
        r"(\d{1,2}:\d{2}:\d{2}[,\.]\d{1,3}|\d{2}:\d{2}[,\.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,\.]\d{1,3}|\d{2}:\d{2}[,\.]\d{1,3})"
    )

    for block in blocks:
        lines = [line.strip() for line in block.split("\n") if line.strip()]
        if not lines:
            continue

        match = None
        time_line_idx = -1
        for idx, line in enumerate(lines):
            m = time_pattern.search(line)
            if m:
                match = m
                time_line_idx = idx
                break

        if not match or time_line_idx == -1:
            continue

        start_sec = _parse_timestamp_to_seconds(match.group(1))
        end_sec = _parse_timestamp_to_seconds(match.group(2))
        text_lines = lines[time_line_idx + 1 :]
        text = " ".join(text_lines).strip()

        # Remove html tags like <i>, </i> if present
        text = re.sub(r"<[^>]+>", "", text).strip()

        if text:
            segments.append({"start": start_sec, "end": end_sec, "text": text})

    return segments


def parse_vtt(content: str) -> list[Segment]:
    """Parse WebVTT (.vtt) subtitle content into timed segments."""
    # WebVTT timestamp parsing is identical in structure to SRT
    # Skip headers like WEBVTT and NOTE blocks
    normalized = content.replace("\r\n", "\n").replace("\r", "\n")
    blocks = re.split(r"\n\s*\n+", normalized.strip())
    segments: list[Segment] = []

    time_pattern = re.compile(
        r"(\d{1,2}:\d{2}:\d{2}[,\.]\d{1,3}|\d{2}:\d{2}[,\.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,\.]\d{1,3}|\d{2}:\d{2}[,\.]\d{1,3})"
    )

    for block in blocks:
        lines = [line.strip() for line in block.split("\n") if line.strip()]
        if not lines:
            continue
        if lines[0].startswith("WEBVTT") or lines[0].startswith("NOTE"):
            continue

        match = None
        time_line_idx = -1
        for idx, line in enumerate(lines):
            m = time_pattern.search(line)
            if m:
                match = m
                time_line_idx = idx
                break

        if not match:
            continue

        start_sec = _parse_timestamp_to_seconds(match.group(1))
        end_sec = _parse_timestamp_to_seconds(match.group(2))
        text_lines = lines[time_line_idx + 1 :]
        text = " ".join(text_lines).strip()
        text = re.sub(r"<[^>]+>", "", text).strip()

        if text:
            segments.append({"start": start_sec, "end": end_sec, "text": text})

    return segments


def parse_plain_text(content: str) -> list[Segment]:
    """Parse .txt or .md into paragraphs without timestamps."""
    normalized = content.replace("\r\n", "\n").replace("\r", "\n")
    # Split by double newline for paragraphs; if none, split by single newline
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n+", normalized) if p.strip()]
    if not paragraphs:
        paragraphs = [p.strip() for p in normalized.split("\n") if p.strip()]

    return [{"start": 0.0, "end": 0.0, "text": p} for p in paragraphs]


def parse_file(content: str, filename_or_ext: str) -> tuple[list[Segment], bool]:
    """Parse file content based on file extension.

    Returns:
        (segments, has_timestamps)
    """
    ext = filename_or_ext.lower().strip()
    if "." in ext:
        ext = ext.rsplit(".", 1)[-1]

    if ext in ("srt",):
        segments = parse_srt(content)
        return segments, True
    elif ext in ("vtt", "webvtt"):
        segments = parse_vtt(content)
        return segments, True
    elif ext in ("txt", "md", "markdown", "text"):
        segments = parse_plain_text(content)
        return segments, False
    else:
        # Fallback to plain text
        segments = parse_plain_text(content)
        return segments, False
