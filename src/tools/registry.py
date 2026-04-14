from __future__ import annotations

from typing import Protocol


class ToolLike(Protocol):
    name: str
    description: str
    action_class: str


class ToolRegistry:
    """Single registry for tool discovery in the application."""

    def __init__(self) -> None:
        self._tools: dict[str, ToolLike] = {}

    def register(self, tool: ToolLike) -> None:
        name = getattr(tool, "name", "")
        if not isinstance(name, str) or not name.strip():
            raise ValueError("tool.name must be a non-empty string")
        self._tools[name] = tool

    def get(self, name: str) -> ToolLike | None:
        return self._tools.get(name)

    def list_all(self) -> list[ToolLike]:
        return list(self._tools.values())

    def list_by_class(self, action_class: str) -> list[ToolLike]:
        return [
            tool
            for tool in self._tools.values()
            if getattr(tool, "action_class", None) == action_class
        ]

    def get_descriptions(self) -> list[dict[str, str]]:
        return [
            {
                "name": tool.name,
                "description": tool.description,
                "action_class": tool.action_class,
            }
            for tool in self._tools.values()
        ]
