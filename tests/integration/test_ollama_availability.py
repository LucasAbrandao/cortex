from __future__ import annotations

from src.llm.adapters import OllamaAdapter


def test_ollama_is_available_returns_false_when_service_is_unreachable() -> None:
    client = OllamaAdapter(
        model="test-model",
        base_url="http://127.0.0.1:1",
        timeout=0.1,
    )

    assert client.is_available() is False
