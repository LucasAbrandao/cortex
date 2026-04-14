from __future__ import annotations

from datetime import datetime, timezone

from src.memory.session import SessionMemoryStore
from src.schemas import PendingConfirmation


def test_session_store_creates_and_loads_sessions() -> None:
    fixed_now = datetime(2026, 4, 14, 12, 0, tzinfo=timezone.utc)
    store = SessionMemoryStore(now_provider=lambda: fixed_now)

    session = store.get_or_create("session-1", "cli")

    assert session.session_id == "session-1"
    assert session.interface == "cli"
    assert session.created_at == fixed_now.isoformat()
    assert session.last_updated == fixed_now.isoformat()
    assert session.turn_count == 0
    assert store.get("session-1") is session


def test_session_store_tracks_history_params_and_pending_confirmation() -> None:
    current_time = datetime(2026, 4, 14, 12, 0, tzinfo=timezone.utc)

    def now_provider() -> datetime:
        nonlocal current_time
        current_time = current_time.replace(minute=current_time.minute + 1)
        return current_time

    store = SessionMemoryStore(now_provider=now_provider)
    session = store.get_or_create("session-2", "cli")

    store.append_turn("session-2", role="user", content="hello", intent="greeting")
    store.merge_collected_params("session-2", {"ingredient": "eggs"})
    pending = PendingConfirmation(
        confirmation_id="confirm-1",
        action="shopping_list_tool with {'item': 'milk'}",
        tool_name="shopping_list_tool",
        params={"item": "milk"},
        prompt="Please confirm: shopping_list_tool with {'item': 'milk'}",
        created_at=now_provider().isoformat(),
    )
    store.set_pending_confirmation("session-2", pending)
    store.append_turn(
        "session-2",
        role="assistant",
        content="Please confirm: shopping_list_tool with {'item': 'milk'}",
        intent="pending_confirmation",
    )

    assert session.turn_count == 2
    assert [turn.role for turn in session.conversation_history] == ["user", "assistant"]
    assert session.collected_params == {"ingredient": "eggs"}
    assert session.pending_confirmation is pending

    store.clear_pending_confirmation("session-2")

    assert session.pending_confirmation is None
