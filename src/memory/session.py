from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timezone

from src.schemas import ConversationTurn, PendingConfirmation, SessionState


def _default_now_provider() -> datetime:
    return datetime.now(timezone.utc)


class SessionMemoryStore:
    """In-memory session state storage for orchestrator flows."""

    def __init__(
        self,
        now_provider: Callable[[], datetime] | None = None,
    ) -> None:
        self._now_provider = now_provider or _default_now_provider
        self._sessions: dict[str, SessionState] = {}

    def get(self, session_id: str) -> SessionState | None:
        return self._sessions.get(session_id)

    def get_or_create(
        self,
        session_id: str,
        interface: str,
    ) -> SessionState:
        session = self.get(session_id)
        if session is not None:
            return session

        timestamp = self._timestamp()
        session = SessionState(
            session_id=session_id,
            interface=interface,
            created_at=timestamp,
            last_updated=timestamp,
        )
        self._sessions[session_id] = session
        return session

    def save(self, session: SessionState) -> SessionState:
        session.last_updated = self._timestamp()
        session.turn_count = len(session.conversation_history)
        self._sessions[session.session_id] = session
        return session

    def append_turn(
        self,
        session_id: str,
        *,
        role: str,
        content: str,
        intent: str | None = None,
    ) -> ConversationTurn:
        session = self._require_session(session_id)
        turn = ConversationTurn(
            role=role,
            content=content,
            timestamp=self._timestamp(),
            intent=intent,
        )
        session.conversation_history.append(turn)
        self.save(session)
        return turn

    def merge_collected_params(
        self,
        session_id: str,
        params: dict[str, object],
    ) -> dict[str, object]:
        session = self._require_session(session_id)
        session.collected_params.update(params)
        self.save(session)
        return dict(session.collected_params)

    def set_pending_confirmation(
        self,
        session_id: str,
        pending_confirmation: PendingConfirmation,
    ) -> PendingConfirmation:
        session = self._require_session(session_id)
        session.pending_confirmation = pending_confirmation
        self.save(session)
        return pending_confirmation

    def clear_pending_confirmation(self, session_id: str) -> None:
        session = self._require_session(session_id)
        session.pending_confirmation = None
        self.save(session)

    def _require_session(self, session_id: str) -> SessionState:
        session = self.get(session_id)
        if session is None:
            raise KeyError(f"Unknown session: {session_id}")
        return session

    def _timestamp(self) -> str:
        return self._now_provider().isoformat()
