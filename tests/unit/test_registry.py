from __future__ import annotations

from dataclasses import dataclass

from src.schemas import InputMessage, OutputMessage
from src.tools.registry import ToolRegistry


@dataclass
class DummyTool:
    name: str
    description: str
    action_class: str


def test_registry_register_and_get() -> None:
    registry = ToolRegistry()
    tool = DummyTool(
        name="recipe_tool",
        description="Suggests simple recipes.",
        action_class="SUGGESTIVE",
    )

    registry.register(tool)

    assert registry.get("recipe_tool") is tool


def test_registry_list_methods_and_descriptions() -> None:
    registry = ToolRegistry()
    suggestive = DummyTool(
        name="recipe_tool",
        description="Suggests simple recipes.",
        action_class="SUGGESTIVE",
    )
    executable = DummyTool(
        name="shopping_list_tool",
        description="Adds items to a shopping list.",
        action_class="EXECUTABLE",
    )

    registry.register(suggestive)
    registry.register(executable)

    assert registry.list_all() == [suggestive, executable]
    assert registry.list_by_class("SUGGESTIVE") == [suggestive]
    assert registry.list_by_class("EXECUTABLE") == [executable]
    assert registry.get_descriptions() == [
        {
            "name": "recipe_tool",
            "description": "Suggests simple recipes.",
            "action_class": "SUGGESTIVE",
        },
        {
            "name": "shopping_list_tool",
            "description": "Adds items to a shopping list.",
            "action_class": "EXECUTABLE",
        },
    ]


def test_shared_schemas_instantiate() -> None:
    message = InputMessage(
        text="hello",
        session_id="session-1",
        interface="cli",
    )
    response = OutputMessage(
        text="Placeholder response",
        session_id="session-1",
        status="success",
    )

    assert message.user_id == "local"
    assert message.metadata is None
    assert response.end_session is False
    assert response.data is None
    assert response.confirmation_id is None
