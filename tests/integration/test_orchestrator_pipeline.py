from __future__ import annotations

from src.llm.adapters import MockLLMClient
from src.memory.session import SessionMemoryStore
from src.orchestrator.pipeline import OrchestratorPipeline
from src.schemas import InputMessage
from src.tools.recipe_tool import RecipeTool
from src.tools.registry import ToolRegistry
from src.tools.shopping_list_tool import ShoppingListTool


class FailingStructuredMockLLM(MockLLMClient):
    def complete_structured(
        self,
        prompt: str,
        system_prompt: str | None = None,
    ) -> dict:
        _ = (prompt, system_prompt)
        raise AssertionError("LLM structured fallback should not run on deterministic match")


def test_orchestrator_pipeline_recipe_suggestion_flow() -> None:
    registry = ToolRegistry()
    registry.register(RecipeTool())
    pipeline = OrchestratorPipeline(
        registry=registry,
        llm_client=FailingStructuredMockLLM(),
        session_store=SessionMemoryStore(),
    )

    response = pipeline.process(
        InputMessage(
            text="Need a recipe with eggs and cheese",
            session_id="integration-recipe",
            interface="cli",
        )
    )
    session = pipeline._session_store.get("integration-recipe")

    assert response.status == "success"
    assert response.data is not None
    assert response.data["tool"] == "recipe_tool"
    assert response.data["input_ingredients"] == ["eggs", "cheese"]
    assert response.data["suggestions"][0]["name"] == "Cheese Omelet"
    assert session is not None
    assert session.last_intent == "recipe_tool"


def test_orchestrator_pipeline_shopping_add_flow_with_confirmation() -> None:
    registry = ToolRegistry()
    registry.register(ShoppingListTool())
    pipeline = OrchestratorPipeline(
        registry=registry,
        llm_client=MockLLMClient(),
        session_store=SessionMemoryStore(),
        confirmation_id_factory=lambda: "confirm-shopping-add",
    )

    first_response = pipeline.process(
        InputMessage(
            text="Add milk to my shopping list",
            session_id="integration-shopping-add",
            interface="cli",
        )
    )
    second_response = pipeline.process(
        InputMessage(
            text="yes",
            session_id="integration-shopping-add",
            interface="cli",
        )
    )
    session = pipeline._session_store.get("integration-shopping-add")

    assert first_response.status == "needs_confirmation"
    assert first_response.confirmation_id == "confirm-shopping-add"
    assert second_response.status == "success"
    assert second_response.text == "Added 'milk' to your shopping list."
    assert second_response.data == {
        "tool": "shopping_list_tool",
        "operation": "add",
        "item": "milk",
        "items": ["milk"],
        "count": 1,
    }
    assert session is not None
    assert session.pending_confirmation is None
