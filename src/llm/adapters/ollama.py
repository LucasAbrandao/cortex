from __future__ import annotations

import json
from urllib import error, request

from src.llm.adapters.base import BaseLLMClient


class OllamaAdapter(BaseLLMClient):
    """Minimal Ollama-backed implementation of the shared LLM contract."""

    def __init__(
        self,
        model: str,
        base_url: str = "http://127.0.0.1:11434",
        timeout: float = 5.0,
    ) -> None:
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def complete(
        self,
        prompt: str,
        system_prompt: str | None = None,
        max_tokens: int = 500,
        temperature: float = 0.7,
    ) -> str:
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": self._build_options(max_tokens=max_tokens, temperature=temperature),
        }
        if system_prompt is not None:
            payload["system"] = system_prompt

        response = self._request_json("POST", "/api/generate", payload)
        content = response.get("response")
        if not isinstance(content, str):
            raise RuntimeError("Ollama generate response did not include text output")
        return content

    def chat(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
        max_tokens: int = 500,
        temperature: float = 0.7,
    ) -> str:
        payload_messages = []
        if system_prompt is not None:
            payload_messages.append({"role": "system", "content": system_prompt})
        payload_messages.extend(messages)

        payload = {
            "model": self.model,
            "messages": payload_messages,
            "stream": False,
            "options": self._build_options(max_tokens=max_tokens, temperature=temperature),
        }
        response = self._request_json("POST", "/api/chat", payload)
        message = response.get("message")
        if not isinstance(message, dict):
            raise RuntimeError("Ollama chat response did not include a message payload")

        content = message.get("content")
        if not isinstance(content, str):
            raise RuntimeError("Ollama chat response did not include message text")
        return content

    def complete_structured(
        self,
        prompt: str,
        system_prompt: str | None = None,
    ) -> dict:
        response_text = self.complete(prompt=prompt, system_prompt=system_prompt)
        return self.parse_structured_response(response_text)

    def is_available(self) -> bool:
        try:
            self._request_json("GET", "/api/tags")
        except (ConnectionError, RuntimeError):
            return False
        return True

    @staticmethod
    def _build_options(max_tokens: int, temperature: float) -> dict[str, int | float]:
        return {
            "num_predict": max_tokens,
            "temperature": temperature,
        }

    def _request_json(
        self,
        method: str,
        path: str,
        payload: dict | None = None,
    ) -> dict:
        headers = {"Accept": "application/json"}
        body = None
        if payload is not None:
            body = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"

        http_request = request.Request(
            url=f"{self.base_url}{path}",
            data=body,
            headers=headers,
            method=method,
        )

        try:
            with request.urlopen(http_request, timeout=self.timeout) as response:
                raw_body = response.read().decode("utf-8")
        except (error.HTTPError, error.URLError, TimeoutError, OSError) as exc:
            raise ConnectionError(
                f"Unable to reach Ollama at {self.base_url}"
            ) from exc

        try:
            parsed = json.loads(raw_body)
        except json.JSONDecodeError as exc:
            raise RuntimeError("Ollama returned invalid JSON") from exc

        if not isinstance(parsed, dict):
            raise RuntimeError("Ollama returned an unexpected JSON payload")

        return parsed
