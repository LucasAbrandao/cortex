from __future__ import annotations

from html import escape
from urllib.parse import parse_qs

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse

from src.orchestrator.pipeline import OrchestratorPipeline
from src.schemas import InputMessage, OutputMessage


def attach_web_routes(
    app: FastAPI,
    orchestrator: OrchestratorPipeline,
    *,
    session_id: str = "web-session",
    assistant_name: str = "CORTEX",
) -> None:
    """Wire minimal web routes that adapt HTTP input/output to shared schemas."""

    @app.get("/", response_class=HTMLResponse)
    async def index() -> str:
        return _render_page(assistant_name=assistant_name)

    @app.post("/chat", response_class=HTMLResponse)
    async def chat(request: Request) -> str:
        body = (await request.body()).decode("utf-8")
        form = parse_qs(body, keep_blank_values=True)
        raw_text = form.get("text", [""])[0]
        normalized_text = raw_text.strip()

        if not normalized_text:
            empty_response = OutputMessage(
                text="Please enter a message.",
                session_id=session_id,
                status="error",
                data={
                    "error_code": "empty_input",
                    "recoverable": True,
                },
            )
            return _render_page(
                input_text="",
                output=empty_response,
                assistant_name=assistant_name,
            )

        input_message = InputMessage(
            text=normalized_text,
            session_id=session_id,
            interface="web",
        )
        output_message = orchestrator.process(input_message)
        return _render_page(
            input_text=normalized_text,
            output=output_message,
            assistant_name=assistant_name,
        )


def _render_page(
    *,
    input_text: str = "",
    output: OutputMessage | None = None,
    assistant_name: str = "CORTEX",
) -> str:
    escaped_input = escape(input_text, quote=False)
    rendered_output = ""
    if output is not None:
        escaped_text = escape(output.text, quote=False)
        escaped_status = escape(output.status, quote=False)
        escaped_session = escape(output.session_id, quote=False)
        escaped_confirmation = escape(output.confirmation_id or "", quote=False)
        rendered_output = (
            "<section>\n"
            "  <h2>Response</h2>\n"
            f"  <p id=\"response-text\">{escaped_text}</p>\n"
            f"  <p id=\"response-status\">status: {escaped_status}</p>\n"
            f"  <p id=\"response-session\">session_id: {escaped_session}</p>\n"
        )
        if escaped_confirmation:
            rendered_output += (
                f"  <p id=\"response-confirmation\">confirmation_id: {escaped_confirmation}</p>\n"
            )
        rendered_output += "</section>\n"

    return (
        "<!doctype html>\n"
        "<html lang=\"en\">\n"
        "<head>\n"
        "  <meta charset=\"utf-8\" />\n"
        "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n"
        f"  <title>{escape(assistant_name, quote=False)}</title>\n"
        "</head>\n"
        "<body>\n"
        "  <main>\n"
        f"    <h1>{escape(assistant_name, quote=False)} Local Web</h1>\n"
        "    <form method=\"post\" action=\"/chat\">\n"
        "      <label for=\"text\">Message</label>\n"
        f"      <input id=\"text\" name=\"text\" type=\"text\" value=\"{escaped_input}\" />\n"
        "      <button type=\"submit\">Send</button>\n"
        "    </form>\n"
        f"{rendered_output}"
        "  </main>\n"
        "</body>\n"
        "</html>\n"
    )

