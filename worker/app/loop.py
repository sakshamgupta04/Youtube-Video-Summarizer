"""Worker loop module – polls Supabase items table for queued jobs and executes them.

For Phase 2, handles the TEXT path (.txt, .md, .srt, .vtt) end-to-end:
queued -> fetching -> done (or failed on error).
"""

from __future__ import annotations

import logging
import os
import sys
import time
from typing import Any

from app.config import settings
from app.db import get_db
from app.ingest.files import parse_file, Segment

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("echonotes.worker")


def claim_next_item(db: Any = None) -> dict[str, Any] | None:
    """Atomically find and claim one queued item from the items table.

    Returns the claimed item record or None if no items were claimed.
    """
    if db is None:
        db = get_db()

    # Find the oldest queued item
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

    # Atomically claim it: only update if status is still 'queued'
    try:
        claim_res = (
            db.table("items")
            .update(
                {
                    "status": "fetching",
                    "progress": 10,
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
    """Retrieve raw text content and determine the extension.

    Returns:
        (raw_text_content, extension_or_filename)
    """
    storage_path = item.get("storage_path")
    source_url = item.get("source_url")

    # 1. If storage_path is specified
    if storage_path:
        # Check if it's a local file first (for tests/local dev)
        if os.path.exists(storage_path):
            with open(storage_path, "r", encoding="utf-8", errors="replace") as f:
                return f.read(), storage_path

        # Otherwise download from Supabase Storage "uploads" bucket
        try:
            res_bytes = db.storage.from_("uploads").download(storage_path)
            content = res_bytes.decode("utf-8", errors="replace")
            return content, storage_path
        except Exception as e:
            raise RuntimeError(
                f"Failed to download storage_path '{storage_path}' from bucket 'uploads': {e}"
            ) from e

    # 2. If source_url is specified
    if source_url:
        if os.path.exists(source_url):
            with open(source_url, "r", encoding="utf-8", errors="replace") as f:
                return f.read(), source_url
        # If it looks like raw inline text rather than a URL or path
        if "\n" in source_url or len(source_url.split()) > 5:
            return source_url, "txt"
        raise ValueError(f"File or URL '{source_url}' could not be accessed.")

    # 3. Check if title or transcript was provided as fallback
    if item.get("title") and len(item["title"].split()) > 10:
        return item["title"], "txt"

    raise ValueError("No storage_path, source_url, or text content provided for this item.")


def process_item(item: dict[str, Any], db: Any = None) -> dict[str, Any]:
    """Process a claimed item through the pipeline.

    For Phase 2, implements the TEXT path (.txt, .md, .srt, .vtt).
    """
    if db is None:
        db = get_db()

    item_id = item["id"]
    source_type = item.get("source_type")

    logger.info(f"Processing item {item_id} [type: {source_type}]")

    try:
        if source_type == "text":
            content, filename = _load_text_content(item, db)
            segments, has_timestamps = parse_file(content, filename)

            if not segments:
                raise ValueError("Parsed file contained no text segments.")

            duration_sec = None
            if has_timestamps and segments:
                duration_sec = int(segments[-1]["end"])

            # Save transcript and mark as done
            update_payload = {
                "status": "done",
                "progress": 100,
                "has_timestamps": has_timestamps,
                "duration_sec": duration_sec,
                "transcript": segments,
                "error": None,
            }

            res = (
                db.table("items")
                .update(update_payload)
                .eq("id", item_id)
                .execute()
            )
            logger.info(f"Item {item_id} successfully processed and marked done.")
            return res.data[0] if res.data else update_payload

        else:
            raise NotImplementedError(
                f"Source type '{source_type}' is not yet supported in Phase 2."
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
