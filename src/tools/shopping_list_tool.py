from __future__ import annotations

from src.schemas import ToolResponse


class ShoppingListTool:
    """Deterministic in-memory shopping list state for MVP flows."""

    name = "shopping_list_tool"
    description = "Adds items to and lists items from the shopping list."
    action_class = "EXECUTABLE"
    required_params = ["item"]

    def __init__(self) -> None:
        self._items: list[str] = []

    def run(self, params: dict[str, object], context: dict[str, object]) -> ToolResponse:
        _ = context
        operation = str(params.get("operation", "add")).strip().lower()
        if operation == "list":
            return self._list_items()

        item = self._coerce_item(params.get("item"))
        if not item:
            return ToolResponse(
                text="Missing required params: item.",
                status="error",
                data={
                    "error_code": "missing_required_params",
                    "recoverable": True,
                    "missing": ["item"],
                },
            )

        self._items.append(item)
        return ToolResponse(
            text=f"Added '{item}' to your shopping list.",
            data={
                "tool": self.name,
                "operation": "add",
                "item": item,
                "items": list(self._items),
                "count": len(self._items),
            },
        )

    def _list_items(self) -> ToolResponse:
        if not self._items:
            text = "Your shopping list is empty."
        else:
            text = f"Current shopping list: {', '.join(self._items)}."
        return ToolResponse(
            text=text,
            data={
                "tool": self.name,
                "operation": "list",
                "items": list(self._items),
                "count": len(self._items),
            },
        )

    def _coerce_item(self, raw_item: object) -> str:
        if not isinstance(raw_item, str):
            return ""
        return " ".join(raw_item.strip().split())
