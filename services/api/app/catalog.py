from __future__ import annotations

from .models import EventSummary

EVENTS_2025 = (
    "Australia", "China", "Japan", "Bahrain", "Saudi Arabia", "Miami", "Emilia-Romagna", "Monaco",
    "Spain", "Canada", "Austria", "Great Britain", "Belgium", "Hungary", "Netherlands", "Italy",
    "Azerbaijan", "Singapore", "United States", "Mexico", "Brazil", "Las Vegas", "Qatar", "Abu Dhabi",
)

SUPPORTED_SELECTION = (2025, "Belgium", "R")


def is_supported(year: int, event: str, session: str) -> bool:
    return (year, event, session) == SUPPORTED_SELECTION


def events_2025() -> list[EventSummary]:
    return [
        EventSummary(round=index, event=event, availability="enabled" if event == "Belgium" else "comingSoon")
        for index, event in enumerate(EVENTS_2025, start=1)
    ]
