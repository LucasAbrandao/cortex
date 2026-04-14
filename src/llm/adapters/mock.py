from __future__ import annotations

from copy import deepcopy

from src.llm.adapters.base import BaseLLMClient


class MockLLMClient(BaseLLMClient):
    """Deterministic adapter used by tests and non-networked flows."""

    def __init__(
        self,
        complete_response: str = "mock completion",
        chat_response: str = "mock chat response",
        structured_response: dict | str | None = None,
        available: bool = True,
    ) -> None:
        self._complete_response = complete_response
        self._chat_response = chat_response
        self._structured_response = (
            structured_response
            if structured_response is not None
            else {
                "intent": "mock_intent",
                "confidence": 1.0,
                "tool_name": "mock_tool",
                "extracted_params": {},
            }
        )
        self._available = available

    def complete(
        self,
        prompt: str,
        system_prompt: str | None = None,
        max_tokens: int = 500,
        temperature: float = 0.7,
    ) -> str:
        _ = (prompt, system_prompt, max_tokens, temperature)
        return self._complete_response

    def chat(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
        max_tokens: int = 500,
        temperature: float = 0.7,
    ) -> str:
        _ = (messages, system_prompt, max_tokens, temperature)
        return self._chat_response

    def complete_structured(
        self,
        prompt: str,
        system_prompt: str | None = None,
    ) -> dict:
        _ = (prompt, system_prompt)

        if isinstance(self._structured_response, dict):
            return deepcopy(self._structured_response)

        return self.parse_structured_response(self._structured_response)

    def is_available(self) -> bool:
        return self._available
