from __future__ import annotations

import json
from abc import ABC, abstractmethod


class LLMParseFailure(ValueError):
    """Raised when structured LLM output cannot be parsed safely."""


class BaseLLMClient(ABC):
    @staticmethod
    def parse_structured_response(response_text: str) -> dict:
        """Parse a structured LLM response into a JSON object."""

        try:
            parsed = json.loads(response_text)
        except json.JSONDecodeError as exc:
            raise LLMParseFailure("LLM structured response was not valid JSON") from exc

        if not isinstance(parsed, dict):
            raise LLMParseFailure(
                "LLM structured response must decode to a JSON object"
            )

        return parsed

    @abstractmethod
    def complete(
        self,
        prompt: str,
        system_prompt: str | None = None,
        max_tokens: int = 500,
        temperature: float = 0.7,
    ) -> str:
        """Single-turn completion. Returns response string."""

    @abstractmethod
    def chat(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
        max_tokens: int = 500,
        temperature: float = 0.7,
    ) -> str:
        """Multi-turn chat. Returns response string."""

    @abstractmethod
    def complete_structured(
        self,
        prompt: str,
        system_prompt: str | None = None,
    ) -> dict:
        """Structured output. Returns parsed dict. Raises LLMParseFailure on error."""

    @abstractmethod
    def is_available(self) -> bool:
        """Health check. Returns True if model is reachable and responding."""
