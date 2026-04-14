from __future__ import annotations

from dataclasses import dataclass

from src.schemas import ToolResponse


@dataclass(frozen=True, slots=True)
class _Recipe:
    name: str
    ingredients: tuple[str, ...]


class RecipeTool:
    """Deterministic local recipe suggestions for MVP flows."""

    name = "recipe_tool"
    description = "Suggests simple recipes from provided ingredients."
    action_class = "SUGGESTIVE"
    required_params = ["ingredients"]

    _CATALOG: tuple[_Recipe, ...] = (
        _Recipe(
            name="Cheese Omelet",
            ingredients=("eggs", "cheese", "butter"),
        ),
        _Recipe(
            name="Tomato Pasta",
            ingredients=("pasta", "tomato", "garlic"),
        ),
        _Recipe(
            name="Rice and Beans Bowl",
            ingredients=("rice", "beans", "onion"),
        ),
    )

    def run(self, params: dict[str, object], context: dict[str, object]) -> ToolResponse:
        _ = context
        ingredients = self._coerce_ingredients(params.get("ingredients"))
        if not ingredients:
            return ToolResponse(
                text="Missing required params: ingredients.",
                status="error",
                data={
                    "error_code": "missing_required_params",
                    "recoverable": True,
                    "missing": ["ingredients"],
                },
            )

        suggestions = self._build_suggestions(ingredients)
        names = ", ".join(suggestion["name"] for suggestion in suggestions)
        return ToolResponse(
            text=f"Recipe suggestions: {names}.",
            data={
                "tool": self.name,
                "input_ingredients": ingredients,
                "suggestions": suggestions,
            },
        )

    def _coerce_ingredients(self, raw_ingredients: object) -> list[str]:
        if isinstance(raw_ingredients, str):
            values = [part.strip() for part in raw_ingredients.split(",")]
        elif isinstance(raw_ingredients, list):
            values = [str(part).strip() for part in raw_ingredients]
        else:
            return []

        normalized: list[str] = []
        seen: set[str] = set()
        for value in values:
            cleaned = self._normalize_ingredient(value)
            if cleaned and cleaned not in seen:
                seen.add(cleaned)
                normalized.append(cleaned)
        return normalized

    def _build_suggestions(self, ingredients: list[str]) -> list[dict[str, object]]:
        available = set(ingredients)
        ranked: list[tuple[tuple[int, int, str], dict[str, object]]] = []

        for recipe in self._CATALOG:
            matched = [item for item in recipe.ingredients if item in available]
            if not matched:
                continue
            missing = [item for item in recipe.ingredients if item not in available]
            score = (len(missing), -len(matched), recipe.name)
            ranked.append(
                (
                    score,
                    {
                        "name": recipe.name,
                        "matched_ingredients": matched,
                        "missing_ingredients": missing,
                    },
                )
            )

        ranked.sort(key=lambda item: item[0])
        if ranked:
            return [entry for _, entry in ranked[:3]]

        fallback = sorted(self._CATALOG, key=lambda recipe: recipe.name)[:3]
        return [
            {
                "name": recipe.name,
                "matched_ingredients": [],
                "missing_ingredients": list(recipe.ingredients),
            }
            for recipe in fallback
        ]

    def _normalize_ingredient(self, value: str) -> str:
        return " ".join(value.strip().lower().split())
