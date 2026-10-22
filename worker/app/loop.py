"""Worker loop module – polls Supabase items table for queued jobs and executes them.

Supports:
- Phase 2: TEXT (.txt, .md, .srt, .vtt)
- Phase 3: AUDIO / VIDEO (uploads via Whisper)
- Phase 4: YOUTUBE (captions first -> yt-dlp + Whisper -> friendly error fallback)
"""

from __future__ import annotations

import logging
import os
import shutil
import sys
import tempfile
import time
from typing import Any

from app.config import settings
from app.db import get_db
from app.ingest.files import parse_file
from app.ingest.youtube import process_youtube_video, extract_video_id
from app.pipeline.transcribe import transcribe_media

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("echonotes.worker")


def claim_next_item(db: Any = None) -> dict[str, Any] | None:
    """Atomically find and claim one queued item from the items table."""
    if db is None:
        db = get_db()

    try:
        response = (
            db.table("items")
            .select("*")
            .eq("status", "queued")
            .order("created_at", desc=False)
            .limit(1)
            .execute()
        )
    except Exception as e:
        logger.error(f"Error querying queued items: {e}")
        return None

    if not response.data:
        return None

    item = response.data[0]
    item_id = item["id"]

    try:
        claim_res = (
            db.table("items")
            .update(
                {
                    "status": "fetching",
                    "progress": 5,
                    "error": None,
                }
            )
            .eq("id", item_id)
            .eq("status", "queued")
            .execute()
        )
    except Exception as e:
        logger.error(f"Error claiming item {item_id}: {e}")
        return None

    if not claim_res.data:
        logger.info(f"Item {item_id} was claimed by another worker.")
        return None

    claimed = claim_res.data[0]
    logger.info(f"Successfully claimed item {item_id} (source_type={claimed.get('source_type')})")
    return claimed


def _load_text_content(item: dict[str, Any], db: Any) -> tuple[str, str]:
    """Retrieve raw text content and determine the extension."""
    storage_path = item.get("storage_path")
    source_url = item.get("source_url")

    if storage_path:
        if os.path.exists(storage_path):
            with open(storage_path, "r", encoding="utf-8", errors="replace") as f:
                return f.read(), storage_path

        try:
            res_bytes = db.storage.from_("uploads").download(storage_path)
            content = res_bytes.decode("utf-8", errors="replace")
            return content, storage_path
        except Exception as e:
            raise RuntimeError(
                f"Failed to download storage_path '{storage_path}' from bucket 'uploads': {e}"
            ) from e

    if source_url:
        if os.path.exists(source_url):
            with open(source_url, "r", encoding="utf-8", errors="replace") as f:
                return f.read(), source_url
        if "\n" in source_url or len(source_url.split()) > 5:
            return source_url, "txt"
        raise ValueError(f"File or URL '{source_url}' could not be accessed.")

    if item.get("title") and len(item["title"].split()) > 10:
        return item["title"], "txt"

    raise ValueError("No storage_path, source_url, or text content provided for this item.")


def _download_media_to_temp(item: dict[str, Any], db: Any) -> tuple[str, str | None]:
    """Download audio/video from storage or locate it on disk."""
    storage_path = item.get("storage_path")
    source_url = item.get("source_url")

    if storage_path and os.path.exists(storage_path):
        return storage_path, None
    if source_url and os.path.exists(source_url):
        return source_url, None

    if storage_path:
        logger.info(f"Downloading '{storage_path}' from bucket 'uploads'...")
        try:
            file_bytes = db.storage.from_("uploads").download(storage_path)
        except Exception as e:
            raise RuntimeError(
                f"Failed to download '{storage_path}' from Supabase 'uploads' bucket: {e}"
            ) from e

        temp_dir = tempfile.mkdtemp(prefix="echonotes_dl_")
        ext = storage_path.split(".")[-1] if "." in storage_path else "media"
        local_path = os.path.join(temp_dir, f"input.{ext}")
        with open(local_path, "wb") as f:
            f.write(file_bytes)
        return local_path, temp_dir

    raise ValueError("No storage_path or media file provided for audio/video item.")


def process_item(item: dict[str, Any], db: Any = None) -> dict[str, Any]:
    """Process a claimed item through the pipeline."""
    if db is None:
        db = get_db()

    item_id = item["id"]
    source_type = item.get("source_type")

    logger.info(f"Processing item {item_id} [type: {source_type}]")

    try:
        # 1. TEXT path
        if source_type == "text":
            content, filename = _load_text_content(item, db)
            segments, has_timestamps = parse_file(content, filename)

            if not segments:
                raise ValueError("Parsed file contained no text segments.")

            duration_sec = int(segments[-1]["end"]) if has_timestamps and segments else None

            update_payload = {
                "status": "done",
                "progress": 100,
                "has_timestamps": has_timestamps,
                "duration_sec": duration_sec,
                "transcript": segments,
                "error": None,
            }
            res = db.table("items").update(update_payload).eq("id", item_id).execute()
            logger.info(f"Text item {item_id} successfully processed and marked done.")
            return res.data[0] if res.data else update_payload

        # 2. AUDIO / VIDEO path
        elif source_type in ("audio", "video"):
            local_media_path, temp_cleanup_dir = _download_media_to_temp(item, db)

            try:
                db.table("items").update(
                    {"status": "transcribing", "progress": 15}
                ).eq("id", item_id).execute()

                def on_progress(pct: int) -> None:
                    try:
                        db.table("items").update({"progress": pct}).eq("id", item_id).execute()
                    except Exception as e:
                        logger.warning(f"Could not update progress for {item_id}: {e}")

                segments, duration_sec = transcribe_media(
                    local_media_path,
                    progress_callback=on_progress,
                )

                if not segments:
                    raise ValueError("Whisper detected no speech in this media file.")

                update_payload = {
                    "status": "done",
                    "progress": 100,
                    "has_timestamps": True,
                    "duration_sec": duration_sec,
                    "transcript": segments,
                    "error": None,
                }
                res = db.table("items").update(update_payload).eq("id", item_id).execute()
                logger.info(f"Media item {item_id} successfully transcribed ({duration_sec}s) and marked done.")
                return res.data[0] if res.data else update_payload

            finally:
                if temp_cleanup_dir and os.path.exists(temp_cleanup_dir):
                    shutil.rmtree(temp_cleanup_dir, ignore_errors=True)

        # 3. YOUTUBE path
        elif source_type == "youtube":
            video_url = item.get("source_url") or ""
            video_id = item.get("video_id") or extract_video_id(video_url)

            if not video_id:
                raise ValueError("Could not extract a valid YouTube video ID.")

            # Cache check: if another done item has the same video_id, copy results
            cached = (
                db.table("items")
                .select("*")
                .eq("video_id", video_id)
                .eq("status", "done")
                .neq("id", item_id)
                .limit(1)
                .execute()
            )
            if cached.data:
                cached_item = cached.data[0]
                logger.info(f"Cache hit for video {video_id}! Copying results from {cached_item['id']}.")
                update_payload = {
                    "status": "done",
                    "progress": 100,
                    "has_timestamps": True,
                    "duration_sec": cached_item.get("duration_sec"),
                    "transcript": cached_item.get("transcript"),
                    "video_id": video_id,
                    "error": None,
                }
                res = db.table("items").update(update_payload).eq("id", item_id).execute()
                return res.data[0] if res.data else update_payload

            def on_yt_progress(pct: int) -> None:
                try:
                    db.table("items").update({"progress": pct}).eq("id", item_id).execute()
                except Exception as e:
                    logger.warning(f"Could not update progress for {item_id}: {e}")

            extracted_id, segments, duration_sec, detected_title = process_youtube_video(
                video_url or video_id,
                progress_callback=on_yt_progress,
            )

            update_payload = {
                "status": "done",
                "progress": 100,
                "has_timestamps": True,
                "duration_sec": duration_sec,
                "transcript": segments,
                "video_id": extracted_id,
                "error": None,
            }
            # Update title if not custom
            if detected_title and (not item.get("title") or item["title"] == "YouTube Video"):
                update_payload["title"] = detected_title

            res = db.table("items").update(update_payload).eq("id", item_id).execute()
            logger.info(f"YouTube item {item_id} ({extracted_id}) successfully processed and marked done.")
            return res.data[0] if res.data else update_payload

        else:
            raise NotImplementedError(
                f"Source type '{source_type}' is not supported."
            )

    except Exception as exc:
        error_msg = str(exc)
        logger.error(f"Failed processing item {item_id}: {error_msg}")
        db.table("items").update(
            {
                "status": "failed",
                "progress": 0,
                "error": error_msg,
            }
        ).eq("id", item_id).execute()
        raise


def poll_once(db: Any = None) -> dict[str, Any] | None:
    """Single polling cycle: claims one item and processes it."""
    claimed = claim_next_item(db)
    if not claimed:
        return None
    try:
        return process_item(claimed, db)
    except Exception as e:
        logger.warning(f"Item {claimed.get('id')} failed with: {e}")
        return claimed


def run_loop(poll_interval: int | None = None) -> None:
    """Continuous polling loop, running every poll_interval seconds."""
    interval = poll_interval or settings.poll_interval_sec
    logger.info(f"Starting EchoNotes worker loop (polling every {interval}s)...")

    while True:
        try:
            item = poll_once()
            if not item:
                time.sleep(interval)
        except KeyboardInterrupt:
            logger.info("Worker loop stopped by user.")
            sys.exit(0)
        except Exception as e:
            logger.error(f"Unexpected error in worker loop: {e}", exc_info=True)
            time.sleep(interval)


if __name__ == "__main__":
    run_loop()
