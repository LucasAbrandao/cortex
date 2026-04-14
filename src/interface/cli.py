from __future__ import annotations

from src.orchestrator.pipeline import OrchestratorPipeline
from src.schemas import InputMessage, OutputMessage

EXIT_COMMANDS = {"exit", "quit"}


def run_cli(
    orchestrator: OrchestratorPipeline,
    session_id: str = "cli-session",
    assistant_name: str = "CORTEX",
) -> OutputMessage | None:
    """Run the CLI adapter loop backed by the orchestrator pipeline."""

    last_response: OutputMessage | None = None

    while True:
        try:
            raw_text = input("You> ")
        except EOFError:
            break

        normalized_text = raw_text.strip()
        if normalized_text.lower() in EXIT_COMMANDS:
            break
        if not normalized_text:
            continue

        message = InputMessage(
            text=normalized_text,
            session_id=session_id,
            interface="cli",
        )
        response = orchestrator.process(message)
        print(f"{assistant_name}: {response.text}")
        last_response = response

        if response.end_session:
            break

    return last_response

