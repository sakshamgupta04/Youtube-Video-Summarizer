"""Tests for the worker loop module (app/loop.py)."""

from unittest.mock import MagicMock
import pytest
from app.loop import claim_next_item, process_item, poll_once


def test_claim_next_item_no_queued():
    mock_db = MagicMock()
    mock_db.table().select().eq().order().limit().execute.return_value.data = []

    claimed = claim_next_item(mock_db)
    assert claimed is None


def test_claim_next_item_atomic_success():
    mock_db = MagicMock()
    queued_item = {"id": "test-uuid-1", "status": "queued", "source_type": "text"}
    mock_db.table().select().eq().order().limit().execute.return_value.data = [queued_item]

    # Atomically claimed
    claimed_item = {**queued_item, "status": "fetching", "progress": 10}
    mock_db.table().update().eq().eq().execute.return_value.data = [claimed_item]

    res = claim_next_item(mock_db)
    assert res is not None
    assert res["id"] == "test-uuid-1"
    assert res["status"] == "fetching"


def test_claim_next_item_atomic_conflict_returns_none():
    mock_db = MagicMock()
    queued_item = {"id": "test-uuid-1", "status": "queued", "source_type": "text"}
    mock_db.table().select().eq().order().limit().execute.return_value.data = [queued_item]

    # Someone else took it in the interim, update returns 0 rows
    mock_db.table().update().eq().eq().execute.return_value.data = []

    res = claim_next_item(mock_db)
    assert res is None


def test_process_text_item_inline_content():
    mock_db = MagicMock()
    item = {
        "id": "item-text-1",
        "source_type": "text",
        "source_url": "Introduction paragraph for EchoNotes.\n\nSecond paragraph discusses local AI pipeline.",
        "storage_path": None,
    }

    mock_db.table().update().eq().execute.return_value.data = [{**item, "status": "done"}]

    res = process_item(item, mock_db)
    assert res["status"] == "done"

    # Verify update payload sent to database
    update_call_args = mock_db.table().update.call_args[0][0]
    assert update_call_args["status"] == "done"
    assert update_call_args["progress"] == 100
    assert update_call_args["has_timestamps"] is False
    assert len(update_call_args["transcript"]) == 2


def test_process_item_error_marks_failed():
    mock_db = MagicMock()
    item = {
        "id": "item-err-1",
        "source_type": "text",
        "source_url": None,
        "storage_path": None,
    }

    with pytest.raises(ValueError):
        process_item(item, mock_db)

    # Verify error update sent to db
    update_call_args = mock_db.table().update.call_args[0][0]
    assert update_call_args["status"] == "failed"
    assert "error" in update_call_args
    assert update_call_args["progress"] == 0
