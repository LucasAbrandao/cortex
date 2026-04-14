from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone
import re
from uuid import uuid4

from src.llm.adapters import LLMParseFailure
from src.llm.adapters.base import BaseLLMClient
from src.memory.session import SessionMemoryStore
from src.schemas import (
    InputMessage,
    IntentResult,
    OutputMessage,
    PendingConfirmation,
    SessionState,
    ToolResponse,
)
from src.tools.registry import ToolLike, ToolRegistry

YES_PATTERNS = {"yes", "sim", "confirm", "ok", "sure", "go ahead", "yep", "proceed"}
NO_PATTERNS = {"no", "nao", "cancel", "stop", "nevermind", "nope", "forget it"}
GENERIC_TOOL_TOKENS = {
    "tool",
    "assistant",
    "service",
    "task",
    "manager",
    "helper",
}


def _default_now_provider() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(slots=True)
class ConfirmationState:
    status: str
    pending: PendingConfirmation | None = None


@dataclass(slots=True)
class DecisionResult:
    route: str
    tool: ToolLike | None
    params: dict[str, object]
    intent: IntentResult
    message_text: str | None = None
    missing_params: list[str] | None = None


@dataclass(slots=True)
class ExecutionResult:
    text: str
    status: str
    data: dict[str, object] | None = None
    confirmation_id: str | None = None
    clear_pending_confirmation: bool = False


class OrchestratorPipeline:
    """Deterministic scaffold of the 8-step orchestrator pipeline."""

    def __init__(
        self,
        *,
        registry: ToolRegistry,
        llm_client: BaseLLMClient,
        session_store: SessionMemoryStore | None = None,
        confirmation_id_factory: Callable[[], str] | None = None,
        now_provider: Callable[[], datetime] | None = None,
    ) -> None:
        self._registry = registry
        self._llm_client = llm_client
        self._session_store = session_store or SessionMemoryStore()
        self._confirmation_id_factory = confirmation_id_factory or (
            lambda: str(uuid4())
        )
        self._now_provider = now_provider or _default_now_provider

    def process(self, message: InputMessage) -> OutputMessage:
        normalized = self._step1_input_normalization(message)
        session, confirmation_state = self._step2_context_injection(normalized)
        intent = self._step3_intent_classification(
            normalized,
            session,
            confirmation_state,
        )
        params = self._step4_entity_parameter_extraction(normalized, session, intent)
        decision = self._step5_decision_layer(session, confirmation_state, intent, params)
        pre_execution = self._step6_confirmation_handling(session, decision)
        execution = pre_execution or self._step7_execution(normalized, session, decision)
        return self._step8_response_formatting(normalized, session, intent, execution)

    def _step1_input_normalization(self, message: InputMessage) -> InputMessage:
        return InputMessage(
            text=message.text.strip(),
            session_id=message.session_id,
            interface=message.interface.strip().lower(),
            user_id=message.user_id,
            metadata=message.metadata,
        )

    def _step2_context_injection(
        self,
        message: InputMessage,
    ) -> tuple[SessionState, ConfirmationState]:
        session = self._session_store.get_or_create(message.session_id, message.interface)
        if session.pending_confirmation is None:
            return session, ConfirmationState(status="none")

        normalized_text = self._normalize_confirmation_text(message.text)
        if normalized_text in YES_PATTERNS:
            return session, ConfirmationState(
                status="confirmed",
                pending=session.pending_confirmation,
            )
        if normalized_text in NO_PATTERNS:
            return session, ConfirmationState(
                status="declined",
                pending=session.pending_confirmation,
            )
        return session, ConfirmationState(
            status="awaiting",
            pending=session.pending_confirmation,
        )

    def _step3_intent_classification(
        self,
        message: InputMessage,
        session: SessionState,
        confirmation_state: ConfirmationState,
    ) -> IntentResult:
        if confirmation_state.pending is not None:
            return IntentResult(
                intent="pending_confirmation",
                confidence=1.0,
                source="pending_confirmation",
                raw_input=message.text,
                tool_name=confirmation_state.pending.tool_name,
                extracted_params=dict(confirmation_state.pending.params),
            )

        rule_match = self._match_tool_name(message.text)
        if rule_match is not None:
            return IntentResult(
                intent=rule_match.name,
                confidence=1.0,
                source="rule",
                raw_input=message.text,
                tool_name=rule_match.name,
                extracted_params={},
            )

        try:
            structured = self._llm_client.complete_structured(
                prompt=message.text,
                system_prompt=self._build_system_prompt(session),
            )
        except (LLMParseFailure, TypeError, ValueError, KeyError):
            structured = {}

        tool_name = structured.get("tool_name")
        return IntentResult(
            intent=str(structured.get("intent", "general_response")),
            confidence=float(structured.get("confidence", 0.0)),
            source="llm" if structured else "fallback",
            raw_input=message.text,
            tool_name=tool_name if isinstance(tool_name, str) else None,
            extracted_params=self._coerce_params(structured.get("extracted_params")),
        )

    def _step4_entity_parameter_extraction(
        self,
        message: InputMessage,
        session: SessionState,
        intent: IntentResult,
    ) -> dict[str, object]:
        tool = self._registry.get(intent.tool_name or "")
        deterministic_params = self._extract_deterministic_params(
            text=message.text,
            tool=tool,
        )
        turn_params = dict(deterministic_params)
        turn_params.update(intent.extracted_params)
        intent.extracted_params = turn_params

        params = dict(session.collected_params)
        params.update(turn_params)
        return params

    def _step5_decision_layer(
        self,
        session: SessionState,
        confirmation_state: ConfirmationState,
        intent: IntentResult,
        params: dict[str, object],
    ) -> DecisionResult:
        if confirmation_state.status == "awaiting":
            return DecisionResult(
                route="awaiting_confirmation",
                tool=None,
                params=params,
                intent=intent,
                message_text="I need a yes or no before continuing with the pending action.",
            )

        tool = self._registry.get(intent.tool_name or "")
        if tool is None:
            return DecisionResult(
                route="llm_response",
                tool=None,
                params=params,
                intent=intent,
            )

        if confirmation_state.status == "declined":
            return DecisionResult(
                route="cancelled",
                tool=tool,
                params=params,
                intent=intent,
                message_text="Okay, I cancelled that request.",
            )

        if confirmation_state.status == "confirmed":
            return DecisionResult(
                route="execute_tool",
                tool=tool,
                params=params,
                intent=intent,
            )

        required_params = list(getattr(tool, "required_params", []))
        missing_params = [
            param
            for param in required_params
            if params.get(param) in (None, "", [])
        ]
        if missing_params:
            return DecisionResult(
                route="missing_params",
                tool=tool,
                params=params,
                intent=intent,
                missing_params=missing_params,
            )

        if getattr(tool, "action_class", "") == "EXECUTABLE" and (
            confirmation_state.status != "confirmed"
        ):
            prompt = f"Please confirm: {self._describe_action(tool, params)}"
            return DecisionResult(
                route="request_confirmation",
                tool=tool,
                params=params,
                intent=intent,
                message_text=prompt,
            )

        _ = session
        return DecisionResult(
            route="execute_tool",
            tool=tool,
            params=params,
            intent=intent,
        )

    def _step6_confirmation_handling(
        self,
        session: SessionState,
        decision: DecisionResult,
    ) -> ExecutionResult | None:
        if decision.route == "request_confirmation" and decision.tool is not None:
            confirmation_id = self._confirmation_id_factory()
            prompt = decision.message_text or "Please confirm this action."
            pending = PendingConfirmation(
                confirmation_id=confirmation_id,
                action=self._describe_action(decision.tool, decision.params),
                tool_name=decision.tool.name,
                params=dict(decision.params),
                prompt=prompt,
                created_at=self._now_provider().isoformat(),
            )
            self._session_store.set_pending_confirmation(session.session_id, pending)
            return ExecutionResult(
                text=prompt,
                status="needs_confirmation",
                confirmation_id=confirmation_id,
            )

        if decision.route == "awaiting_confirmation":
            confirmation_id = (
                session.pending_confirmation.confirmation_id
                if session.pending_confirmation is not None
                else None
            )
            return ExecutionResult(
                text=decision.message_text or "I need a yes or no.",
                status="needs_confirmation",
                confirmation_id=confirmation_id,
            )

        if decision.route == "cancelled":
            return ExecutionResult(
                text=decision.message_text or "Okay, I cancelled that request.",
                status="success",
                clear_pending_confirmation=True,
            )

        return None

    def _step7_execution(
        self,
        message: InputMessage,
        session: SessionState,
        decision: DecisionResult,
    ) -> ExecutionResult:
        if decision.route == "missing_params" and decision.tool is not None:
            missing = ", ".join(decision.missing_params or [])
            return ExecutionResult(
                text=f"I still need: {missing}. Please provide the missing details.",
                status="success",
            )

        if decision.route == "llm_response":
            messages = [
                {"role": turn.role, "content": turn.content}
                for turn in session.conversation_history
            ]
            messages.append({"role": "user", "content": message.text})
            text = self._llm_client.chat(
                messages,
                system_prompt=self._build_system_prompt(session),
            )
            return ExecutionResult(text=text, status="success")

        if decision.route == "execute_tool" and decision.tool is not None:
            response = decision.tool.run(
                params=dict(decision.params),
                context={
                    "session": session,
                    "message": message,
                    "intent": decision.intent,
                },
            )
            tool_response = self._coerce_tool_response(response)
            return ExecutionResult(
                text=tool_response.text,
                status=tool_response.status,
                data=tool_response.data,
                clear_pending_confirmation=(
                    session.pending_confirmation is not None
                    and getattr(decision.tool, "action_class", "") == "EXECUTABLE"
                ),
            )

        return ExecutionResult(
            text="I could not complete that request.",
            status="error",
            data={"error_code": "pipeline_unhandled_route", "recoverable": True},
        )

    def _step8_response_formatting(
        self,
        message: InputMessage,
        session: SessionState,
        intent: IntentResult,
        execution: ExecutionResult,
    ) -> OutputMessage:
        session.last_intent = intent.intent
        self._session_store.merge_collected_params(session.session_id, intent.extracted_params)
        self._session_store.append_turn(
            session.session_id,
            role="user",
            content=message.text,
            intent=intent.intent,
        )
        self._session_store.append_turn(
            session.session_id,
            role="assistant",
            content=execution.text,
            intent=intent.intent,
        )
        if execution.clear_pending_confirmation:
            self._session_store.clear_pending_confirmation(session.session_id)
        self._session_store.save(session)
        return OutputMessage(
            text=execution.text,
            session_id=message.session_id,
            status=execution.status,
            data=execution.data,
            confirmation_id=execution.confirmation_id,
        )

    def _build_system_prompt(self, session: SessionState) -> str:
        _ = session
        return "You are JARVIS. Return structured data when requested."

    def _match_tool_name(self, text: str) -> ToolLike | None:
        lowered_text = self._normalize_text(text)
        text_tokens = set(self._tokenize_text(lowered_text))
        best_match: ToolLike | None = None
        best_score = 0

        for tool in self._registry.list_all():
            aliases = self._tool_aliases(tool)
            alias_phrase_hit = any(
                alias in lowered_text and " " in alias
                for alias in aliases
            )
            token_overlap = set(self._tokenize_text(" ".join(aliases))) & text_tokens
            strong_overlap = any(len(token) >= 5 for token in token_overlap)
            score = (
                len(token_overlap)
                + (2 if alias_phrase_hit else 0)
                + (1 if strong_overlap else 0)
            )
            if score > best_score:
                best_score = score
                best_match = tool

        if best_score >= 2:
            return best_match
        return None

    def _coerce_params(self, params: object) -> dict[str, object]:
        if isinstance(params, dict):
            return dict(params)
        return {}

    def _coerce_tool_response(self, response: object) -> ToolResponse:
        if isinstance(response, ToolResponse):
            return response
        if isinstance(response, str):
            return ToolResponse(text=response)
        raise TypeError("tool.run must return ToolResponse or str")

    def _normalize_confirmation_text(self, text: str) -> str:
        return " ".join(text.strip().lower().split())

    def _describe_action(self, tool: ToolLike, params: dict[str, object]) -> str:
        if params:
            return f"{tool.name} with {params}"
        return tool.name

    def _extract_deterministic_params(
        self,
        *,
        text: str,
        tool: ToolLike | None,
    ) -> dict[str, object]:
        if tool is None:
            return {}

        extracted: dict[str, object] = {}
        for param in getattr(tool, "required_params", []):
            if not isinstance(param, str):
                continue
            value = self._extract_param_value(text=text, param_name=param)
            if value is not None:
                extracted[param] = value
        return extracted

    def _extract_param_value(
        self,
        *,
        text: str,
        param_name: str,
    ) -> object | None:
        normalized_param = self._normalize_text(param_name)
        if normalized_param in {"ingredients", "items"}:
            return self._extract_simple_list(text)
        if normalized_param in {"item", "name"}:
            return self._extract_simple_item(text)
        if normalized_param in {"quantity", "amount", "count", "servings"}:
            return self._extract_simple_number(text)
        return None

    def _extract_simple_list(self, text: str) -> list[str] | None:
        patterns = [
            r"\bi have\s+(.+)",
            r"\bwith\s+(.+)",
            r"\bingredients?\s*[:=]\s*(.+)",
            r"\bitems?\s*[:=]\s*(.+)",
        ]
        candidate: str | None = None
        for pattern in patterns:
            match = re.search(pattern, text, flags=re.IGNORECASE)
            if match:
                candidate = match.group(1)
                break

        if candidate is None:
            return None

        normalized = re.sub(r"\b(and|&)\b", ",", candidate, flags=re.IGNORECASE)
        parts = [
            self._clean_extracted_text(part)
            for part in normalized.split(",")
        ]
        values = [part for part in parts if part]
        if not values:
            return None
        return values

    def _extract_simple_item(self, text: str) -> str | None:
        quoted = re.search(r"['\"]([^'\"]+)['\"]", text)
        if quoted:
            value = self._clean_extracted_text(quoted.group(1))
            if value:
                return value

        match = re.search(
            r"\badd\s+(.+?)(?:\s+(?:to|into|on|in)\b|$)",
            text,
            flags=re.IGNORECASE,
        )
        if match:
            value = self._clean_extracted_text(match.group(1))
            if value:
                return value

        named = re.search(r"\b(?:item|name)\s*[:=]\s*(.+)$", text, flags=re.IGNORECASE)
        if named:
            value = self._clean_extracted_text(named.group(1))
            if value:
                return value

        return None

    def _extract_simple_number(self, text: str) -> int | None:
        match = re.search(r"\b(\d+)\b", text)
        if not match:
            return None
        return int(match.group(1))

    def _tool_aliases(self, tool: ToolLike) -> set[str]:
        aliases: set[str] = set()
        normalized_name = self._normalize_text(tool.name)
        aliases.add(normalized_name)

        stripped_name = re.sub(r"\btool\b", "", normalized_name).strip()
        if stripped_name:
            aliases.add(stripped_name)

        for token in self._tokenize_text(stripped_name):
            if token in GENERIC_TOOL_TOKENS:
                continue
            aliases.add(token)
            if len(token) >= 4 and not token.endswith("s"):
                aliases.add(f"{token}s")

        return aliases

    def _normalize_text(self, text: str) -> str:
        lowered = text.strip().lower()
        normalized = re.sub(r"[^a-z0-9\s]+", " ", lowered)
        return " ".join(normalized.split())

    def _tokenize_text(self, text: str) -> list[str]:
        return [token for token in text.split() if token]

    def _clean_extracted_text(self, value: str) -> str:
        cleaned = value.strip().strip(".,!?;:")
        cleaned = re.sub(r"^(the|a|an|my)\s+", "", cleaned, flags=re.IGNORECASE)
        return cleaned.strip()
