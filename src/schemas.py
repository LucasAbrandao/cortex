from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(slots=True)
class InputMessage:
    text: str
    session_id: str
    interface: str
    user_id: str = "local"
    metadata: dict | None = None


@dataclass(slots=True)
class OutputMessage:
    text: str
    session_id: str
    status: str
    end_session: bool = False
    data: dict | None = None
    confirmation_id: str | None = None


@dataclass(slots=True)
class IntentResult:
    intent: str
    confidence: float
    source: str
    raw_input: str
    tool_name: str | None = None
    extracted_params: dict[str, object] = field(default_factory=dict)


@dataclass(slots=True)
class ToolResponse:
    text: str
    status: str = "success"
    data: dict[str, object] | None = None


@dataclass(slots=True)
class ConversationTurn:
    role: str
    content: str
    timestamp: str
    intent: str | None = None


@dataclass(slots=True)
class PendingConfirmation:
    confirmation_id: str
    action: str
    tool_name: str
    params: dict[str, object]
    prompt: str
    created_at: str


@dataclass(slots=True)
class SessionState:
    session_id: str
    interface: str
    created_at: str
    last_updated: str
    turn_count: int = 0
    conversation_history: list[ConversationTurn] = field(default_factory=list)
    pending_confirmation: PendingConfirmation | None = None
    collected_params: dict[str, object] = field(default_factory=dict)
    last_intent: str | None = None
    user_preferences: dict[str, object] = field(default_factory=dict)
    summary: str | None = None
