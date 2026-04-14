from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.interface.cli import run_cli
from src.interface.web import attach_web_routes
from src.llm.adapters import BaseLLMClient, MockLLMClient, OllamaAdapter
from src.memory.session import SessionMemoryStore
from src.orchestrator.pipeline import OrchestratorPipeline
from src.tools.recipe_tool import RecipeTool
from src.tools.registry import ToolRegistry
from src.tools.shopping_list_tool import ShoppingListTool


def load_environment() -> Path | None:
    """Load `.env` when present, otherwise fall back to `.env.example`."""

    for filename in (".env", ".env.example"):
        candidate = PROJECT_ROOT / filename
        if candidate.exists():
            load_dotenv(candidate, override=False)
            return candidate
    return None


def create_app(orchestrator: OrchestratorPipeline) -> FastAPI:
    """Create the FastAPI app and wire the web adapter to the orchestrator."""

    app = FastAPI(title="JARVIS", version="0.1.0")
    attach_web_routes(app, orchestrator)
    return app


def build_registry() -> ToolRegistry:
    registry = ToolRegistry()
    registry.register(RecipeTool())
    registry.register(ShoppingListTool())
    return registry


def build_llm_client() -> BaseLLMClient:
    model = os.getenv("OLLAMA_MODEL", "").strip()
    if model:
        return OllamaAdapter(
            model=model,
            base_url=os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434"),
        )

    return MockLLMClient(
        chat_response="I can help with recipes and shopping lists.",
        structured_response={},
    )


def build_orchestrator() -> OrchestratorPipeline:
    registry = build_registry()
    session_store = SessionMemoryStore()
    llm_client = build_llm_client()
    return OrchestratorPipeline(
        registry=registry,
        llm_client=llm_client,
        session_store=session_store,
    )


load_environment()
orchestrator = build_orchestrator()
app = create_app(orchestrator)


def main() -> None:
    run_cli(orchestrator=orchestrator)


if __name__ == "__main__":
    main()
