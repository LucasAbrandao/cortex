from __future__ import annotations

from pathlib import Path
from typing import Any, Protocol

import fastf1  # type: ignore[import-untyped]


class FastF1Backend(Protocol):
    @property
    def version(self) -> str: ...

    def cache_size_bytes(self) -> int | None: ...

    def load_race(self) -> Any: ...


class FastF1Adapter:
    """The only boundary that imports or calls FastF1."""

    def __init__(self, cache_dir: Path) -> None:
        cache_dir.mkdir(parents=True, exist_ok=True)
        fastf1.Cache.enable_cache(str(cache_dir), ignore_version=False)

    @property
    def version(self) -> str:
        return str(fastf1.__version__)

    def cache_size_bytes(self) -> int | None:
        _, size = fastf1.Cache.get_cache_info()
        return size if isinstance(size, int) else None

    def load_race(self) -> Any:
        session = fastf1.get_session(2025, "Belgium", "R")
        session.load(telemetry=True, weather=False, messages=False)
        return session
