from __future__ import annotations

import pytest

from src.llm.adapters import BaseLLMClient, LLMParseFailure, MockLLMClient, OllamaAdapter


def _make_client(
    adapter_name: str,
    monkeypatch: pytest.MonkeyPatch,
    *,
    invalid_structured: bool = False,
) -> BaseLLMClient:
    if adapter_name == "mock":
        structured_response = '{"invalid_json":' if invalid_structured else {
            "intent": "mock_intent",
            "confidence": 1.0,
            "tool_name": "mock_tool",
            "extracted_params": {"ingredient": "eggs"},
        }
        return MockLLMClient(
            complete_response="mock completion",
            chat_response="mock chat response",
            structured_response=structured_response,
        )

    adapter = OllamaAdapter(model="test-model")

    def fake_request_json(
        method: str,
        path: str,
        payload: dict | None = None,
    ) -> dict:
        _ = method
        if path == "/api/tags":
            return {"models": []}
        if path == "/api/chat":
            return {"message": {"content": "ollama chat response"}}
        if path == "/api/generate":
            prompt = "" if payload is None else payload.get("prompt", "")
            if invalid_structured:
                return {"response": '{"invalid_json":'}
            if prompt == "plain prompt":
                return {"response": "ollama completion"}
            return {
                "response": (
                    '{"intent":"ollama_intent","confidence":0.9,'
                    '"tool_name":"recipe_tool","extracted_params":{"ingredient":"cheese"}}'
                )
            }
        raise AssertionError(f"Unexpected path: {path}")

    monkeypatch.setattr(adapter, "_request_json", fake_request_json)
    return adapter


@pytest.mark.parametrize("adapter_name", ["mock", "ollama"])
def test_llm_clients_follow_shared_contract(
    adapter_name: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _make_client(adapter_name, monkeypatch)
    expected_structured = (
        {
            "intent": "mock_intent",
            "confidence": 1.0,
            "tool_name": "mock_tool",
            "extracted_params": {"ingredient": "eggs"},
        }
        if adapter_name == "mock"
        else {
            "intent": "ollama_intent",
            "confidence": 0.9,
            "tool_name": "recipe_tool",
            "extracted_params": {"ingredient": "cheese"},
        }
    )

    assert isinstance(client, BaseLLMClient)
    assert client.complete("plain prompt") in {"mock completion", "ollama completion"}
    assert client.chat([{"role": "user", "content": "hello"}]) in {
        "mock chat response",
        "ollama chat response",
    }
    assert client.complete_structured("structured prompt") == expected_structured
    assert client.is_available() is True


@pytest.mark.parametrize("adapter_name", ["mock", "ollama"])
def test_complete_structured_raises_parse_failure_for_invalid_json(
    adapter_name: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _make_client(adapter_name, monkeypatch, invalid_structured=True)

    with pytest.raises(LLMParseFailure):
        client.complete_structured("structured prompt")


def test_base_llm_client_cannot_be_instantiated() -> None:
    with pytest.raises(TypeError):
        BaseLLMClient()
