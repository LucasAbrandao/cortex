from __future__ import annotations

from src.tools.shopping_list_tool import ShoppingListTool


def test_shopping_list_tool_contract_metadata() -> None:
    tool = ShoppingListTool()

    assert tool.name == "shopping_list_tool"
    assert tool.action_class == "EXECUTABLE"
    assert tool.required_params == ["item"]
    assert "shopping list" in tool.description.lower()


def test_shopping_list_tool_add_item_is_deterministic() -> None:
    tool = ShoppingListTool()

    response = tool.run(params={"item": "milk"}, context={})

    assert response.status == "success"
    assert response.text == "Added 'milk' to your shopping list."
    assert response.data == {
        "tool": "shopping_list_tool",
        "operation": "add",
        "item": "milk",
        "items": ["milk"],
        "count": 1,
    }


def test_shopping_list_tool_list_returns_current_in_memory_state() -> None:
    tool = ShoppingListTool()
    tool.run(params={"item": "milk"}, context={})
    tool.run(params={"item": "eggs"}, context={})

    response = tool.run(params={"operation": "list"}, context={})

    assert response.status == "success"
    assert response.text == "Current shopping list: milk, eggs."
    assert response.data == {
        "tool": "shopping_list_tool",
        "operation": "list",
        "items": ["milk", "eggs"],
        "count": 2,
    }
