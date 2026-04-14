from __future__ import annotations

import asyncio
from urllib.parse import urlencode

from fastapi import FastAPI

from src.interface.web import attach_web_routes
from src.llm.adapters import MockLLMClient
from src.memory.session import SessionMemoryStore
from src.orchestrator.pipeline import OrchestratorPipeline
from src.tools.recipe_tool import RecipeTool
from src.tools.registry import ToolRegistry
from src.tools.shopping_list_tool import ShoppingListTool


def _build_web_app() -> tuple[FastAPI, OrchestratorPipeline]:
    registry = ToolRegistry()
    registry.register(RecipeTool())
    registry.register(ShoppingListTool())
    pipeline = OrchestratorPipeline(
        registry=registry,
        llm_client=MockLLMClient(
            chat_response="I can help with recipes and shopping lists.",
            structured_response={},
        ),
        session_store=SessionMemoryStore(),
        confirmation_id_factory=lambda: "confirm-web-smoke",
    )
    app = FastAPI(title="CORTEX Test Web", version="0.1.0")
    attach_web_routes(app, pipeline, session_id="web-smoke-session")
    return app, pipeline


def _request_html(
    app: FastAPI,
    *,
    method: str,
    path: str,
    form: dict[str, str] | None = None,
) -> tuple[int, str]:
    body = urlencode(form or {}).encode("utf-8")
    headers = [(b"host", b"testserver")]
    if method.upper() == "POST":
        headers.append((b"content-type", b"application/x-www-form-urlencoded"))
        headers.append((b"content-length", str(len(body)).encode("utf-8")))

    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": method.upper(),
        "scheme": "http",
        "path": path,
        "raw_path": path.encode("utf-8"),
        "query_string": b"",
        "root_path": "",
        "headers": headers,
        "client": ("127.0.0.1", 50000),
        "server": ("testserver", 80),
    }
    response_start: dict[str, object] = {}
    response_body: list[bytes] = []
    has_sent_request = False

    async def receive() -> dict[str, object]:
        nonlocal has_sent_request
        if has_sent_request:
            return {"type": "http.disconnect"}
        has_sent_request = True
        return {"type": "http.request", "body": body, "more_body": False}

    async def send(message: dict[str, object]) -> None:
        if message["type"] == "http.response.start":
            response_start.update(message)
            return
        if message["type"] == "http.response.body":
            response_body.append(message.get("body", b""))  # type: ignore[arg-type]

    async def execute() -> None:
        await app(scope, receive, send)

    asyncio.run(execute())

    status_code = int(response_start["status"])
    html = b"".join(response_body).decode("utf-8")
    return status_code, html


def test_web_get_root_returns_html_form() -> None:
    app, _ = _build_web_app()
    status_code, html = _request_html(app, method="GET", path="/")

    assert status_code == 200
    assert "<form method=\"post\" action=\"/chat\">" in html
    assert "name=\"text\"" in html


def test_web_post_chat_renders_orchestrator_response() -> None:
    app, _ = _build_web_app()
    status_code, html = _request_html(
        app,
        method="POST",
        path="/chat",
        form={"text": "Need a recipe with eggs and cheese"},
    )

    assert status_code == 200
    assert "Recipe suggestions: Cheese Omelet" in html
    assert "status: success" in html
    assert "session_id: web-smoke-session" in html


def test_web_post_chat_preserves_session_for_confirmation_flow() -> None:
    app, pipeline = _build_web_app()
    first_status, first_html = _request_html(
        app,
        method="POST",
        path="/chat",
        form={"text": "Add milk to my shopping list"},
    )
    second_status, second_html = _request_html(
        app,
        method="POST",
        path="/chat",
        form={"text": "yes"},
    )

    session = pipeline._session_store.get("web-smoke-session")

    assert first_status == 200
    assert "Please confirm: shopping_list_tool with {'item': 'milk'}" in first_html
    assert "status: needs_confirmation" in first_html
    assert "confirmation_id: confirm-web-smoke" in first_html

    assert second_status == 200
    assert "Added 'milk' to your shopping list." in second_html
    assert "status: success" in second_html

    assert session is not None
    assert session.pending_confirmation is None
    assert session.turn_count == 4

