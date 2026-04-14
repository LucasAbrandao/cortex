from __future__ import annotations

from src.tools.recipe_tool import RecipeTool


def test_recipe_tool_contract_metadata() -> None:
    tool = RecipeTool()

    assert tool.name == "recipe_tool"
    assert tool.action_class == "SUGGESTIVE"
    assert tool.required_params == ["ingredients"]
    assert "recipes" in tool.description.lower()


def test_recipe_tool_returns_deterministic_suggestions_for_known_ingredients() -> None:
    tool = RecipeTool()

    response = tool.run(
        params={"ingredients": ["eggs", "cheese"]},
        context={},
    )

    assert response.status == "success"
    assert response.data is not None
    assert response.data["input_ingredients"] == ["eggs", "cheese"]
    assert response.data["suggestions"][0]["name"] == "Cheese Omelet"
    assert response.data["suggestions"][0]["matched_ingredients"] == ["eggs", "cheese"]
    assert response.data["suggestions"][0]["missing_ingredients"] == ["butter"]


def test_recipe_tool_missing_required_params_returns_contract_error() -> None:
    tool = RecipeTool()

    response = tool.run(params={}, context={})

    assert response.status == "error"
    assert response.text == "Missing required params: ingredients."
    assert response.data == {
        "error_code": "missing_required_params",
        "recoverable": True,
        "missing": ["ingredients"],
    }
