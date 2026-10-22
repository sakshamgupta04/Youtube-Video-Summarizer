"""End-to-end integration test with live Supabase database for Phase 2."""

import os
import pytest
from app.config import settings
from app.db import get_db
from app.loop import poll_once


@pytest.mark.skipif(
    not settings.supabase_url or "your-project" in settings.supabase_url,
    reason="Supabase credentials not configured",
)
def test_end_to_end_text_item_lifecycle():
    db = get_db()
    # Fetch an existing user or create a temporary one for testing
    users = db.auth.admin.list_users()
    if not users:
        pytest.skip("No auth users available for foreign key")

    user_id = users[0].id

    # 1. Insert manually a queued text item
    raw_text = (
        "Phase 2 integration test text.\n\n"
        "Testing atomic claim and segment generation.\n\n"
        "Final paragraph verifying done status."
    )
    insert_res = (
        db.table("items")
        .insert(
            {
                "user_id": user_id,
                "source_type": "text",
                "title": "Automated Test Item",
                "source_url": raw_text,
                "status": "queued",
            }
        )
        .execute()
    )
    assert insert_res.data
    item_id = insert_res.data[0]["id"]

    try:
        # 2. Process via poll_once
        result = poll_once(db)
        assert result is not None

        # 3. Verify in database
        final = db.table("items").select("*").eq("id", item_id).execute().data[0]
        assert final["status"] == "done"
        assert final["progress"] == 100
        assert final["has_timestamps"] is False
        assert isinstance(final["transcript"], list)
        assert len(final["transcript"]) == 3
        assert "Phase 2 integration test text." in final["transcript"][0]["text"]
    finally:
        # Cleanup test item
        db.table("items").delete().eq("id", item_id).execute()
