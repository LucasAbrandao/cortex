from __future__ import annotations

from copy import deepcopy

from src.llm.adapters import MockLLMClient
from src.memory.session import SessionMemoryStore
from src.orchestrator.pipeline import OrchestratorPipeline
from src.schemas import InputMessage
from src.tools.recipe_tool import RecipeTool
from src.tools.registry import ToolRegistry
from src.tools.shopping_list_tool import ShoppingListTool


class ScriptedStructuredMockLLM(MockLLMClient):
    """Queued deterministic structured responses for scripted turns."""

    def __init__(self, structured_responses: list[dict[str, object]]) -> None:
        super().__init__()
        self._structured_responses = list(structured_responses)

    def complete_structured(
        self,
        prompt: str,
        system_prompt: str | None = None,
    ) -> dict:
        _ = (prompt, system_prompt)
        if self._structured_responses:
            return deepcopy(self._structured_responses.pop(0))
        return {
            "intent": "general_response",
            "confidence": 0.0,
            "tool_name": None,
            "extracted_params": {},
        }


def _build_pipeline(
    *,
    structured_responses: list[dict[str, object]],
    confirmation_id: str,
) -> tuple[OrchestratorPipeline, SessionMemoryStore]:
    registry = ToolRegistry()
    registry.register(RecipeTool())
    registry.register(ShoppingListTool())
    session_store = SessionMemoryStore()
    pipeline = OrchestratorPipeline(
        registry=registry,
        llm_client=ScriptedStructuredMockLLM(structured_responses),
        session_store=session_store,
        confirmation_id_factory=lambda: confirmation_id,
    )
    return pipeline, session_store


def test_mvp_recipe_conversation_script_flow() -> None:
    session_id = "conversation-mvp-recipe"
    pipeline, session_store = _build_pipeline(
        structured_responses=[
            {
                "intent": "recipe_suggestion",
                "confidence": 0.95,
                "tool_name": "recipe_tool",
                "extracted_params": {},
            },
            {
                "intent": "recipe_followup",
                "confidence": 0.95,
                "tool_name": "recipe_tool",
                "extracted_params": {},
            },
            {
                "intent": "shopping_add",
                "confidence": 0.95,
                "tool_name": "shopping_list_tool",
                "extracted_params": {"item": "butter"},
            },
        ],
        confirmation_id="confirm-mvp-recipe",
    )

    turn1 = pipeline.process(
        InputMessage(
            text="I have eggs and cheese",
            session_id=session_id,
            interface="cli",
        )
    )
    session_after_turn1 = session_store.get(session_id)
    assert turn1.session_id == session_id
    assert turn1.status == "success"
    assert turn1.data is not None
    assert turn1.data["tool"] == "recipe_tool"
    assert turn1.data["input_ingredients"] == ["eggs", "cheese"]
    assert turn1.data["suggestions"][0]["name"] == "Cheese Omelet"
    assert session_after_turn1 is not None
    assert session_after_turn1.pending_confirmation is None
    assert session_after_turn1.collected_params == {"ingredients": ["eggs", "cheese"]}
    assert session_after_turn1.turn_count == 2

    turn2 = pipeline.process(
        InputMessage(
            text="Option 1",
            session_id=session_id,
            interface="cli",
        )
    )
    session_after_turn2 = session_store.get(session_id)
    assert turn2.session_id == session_id
    assert turn2.status == "success"
    assert turn2.data is not None
    assert turn2.data["tool"] == "recipe_tool"
    assert turn2.data["input_ingredients"] == ["eggs", "cheese"]
    assert session_after_turn2 is not None
    assert session_after_turn2.pending_confirmation is None
    assert session_after_turn2.collected_params == {"ingredients": ["eggs", "cheese"]}
    assert session_after_turn2.turn_count == 4

    turn3 = pipeline.process(
        InputMessage(
            text="Add missing items to my list",
            session_id=session_id,
            interface="cli",
        )
    )
    session_after_turn3 = session_store.get(session_id)
    assert turn3.session_id == session_id
    assert turn3.status == "needs_confirmation"
    assert turn3.confirmation_id == "confirm-mvp-recipe"
    assert "Please confirm: shopping_list_tool with" in turn3.text
    assert "'item': 'butter'" in turn3.text
    assert session_after_turn3 is not None
    assert session_after_turn3.pending_confirmation is not None
    assert session_after_turn3.pending_confirmation.confirmation_id == "confirm-mvp-recipe"
    assert session_after_turn3.pending_confirmation.tool_name == "shopping_list_tool"
    assert session_after_turn3.pending_confirmation.params["item"] == "butter"
    assert session_after_turn3.collected_params == {
        "ingredients": ["eggs", "cheese"],
        "item": "butter",
    }
    assert session_after_turn3.turn_count == 6

    turn4 = pipeline.process(
        InputMessage(
            text="yes",
            session_id=session_id,
            interface="cli",
        )
    )
    session_after_turn4 = session_store.get(session_id)
    assert turn4.session_id == session_id
    assert turn4.status == "success"
    assert turn4.text == "Added 'butter' to your shopping list."
    assert turn4.data == {
        "tool": "shopping_list_tool",
        "operation": "add",
        "item": "butter",
        "items": ["butter"],
        "count": 1,
    }
    assert session_after_turn4 is not None
    assert session_after_turn4.pending_confirmation is None
    assert session_after_turn4.collected_params == {
        "ingredients": ["eggs", "cheese"],
        "item": "butter",
    }
    assert session_after_turn4.turn_count == 8


def test_executable_confirmation_cancel_conversation_script_flow() -> None:
    session_id = "conversation-confirm-cancel"
    pipeline, session_store = _build_pipeline(
        structured_responses=[
            {
                "intent": "shopping_add",
                "confidence": 0.95,
                "tool_name": "shopping_list_tool",
                "extracted_params": {"item": "milk"},
            }
        ],
        confirmation_id="confirm-cancel-flow",
    )

    turn1 = pipeline.process(
        InputMessage(
            text="Add milk to weekly list",
            session_id=session_id,
            interface="cli",
        )
    )
    session_after_turn1 = session_store.get(session_id)
    assert turn1.session_id == session_id
    assert turn1.status == "needs_confirmation"
    assert turn1.confirmation_id == "confirm-cancel-flow"
    assert turn1.text == "Please confirm: shopping_list_tool with {'item': 'milk'}"
    assert session_after_turn1 is not None
    assert session_after_turn1.pending_confirmation is not None
    assert session_after_turn1.pending_confirmation.confirmation_id == "confirm-cancel-flow"
    assert session_after_turn1.pending_confirmation.tool_name == "shopping_list_tool"
    assert session_after_turn1.pending_confirmation.params == {"item": "milk"}
    assert session_after_turn1.collected_params == {"item": "milk"}
    assert session_after_turn1.turn_count == 2

    turn2 = pipeline.process(
        InputMessage(
            text="no",
            session_id=session_id,
            interface="cli",
        )
    )
    session_after_turn2 = session_store.get(session_id)
    assert turn2.session_id == session_id
    assert turn2.status == "success"
    assert turn2.text == "Okay, I cancelled that request."
    assert turn2.data is None
    assert turn2.confirmation_id is None
    assert session_after_turn2 is not None
    assert session_after_turn2.pending_confirmation is None
    assert session_after_turn2.collected_params == {"item": "milk"}
    assert session_after_turn2.turn_count == 4
