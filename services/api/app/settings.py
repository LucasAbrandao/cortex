from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]


@dataclass(frozen=True)
class Settings:
    fastf1_cache_dir: Path
    normalized_cache_dir: Path
    allowed_origins: tuple[str, ...]
    schema_version: str = "2"
    normalizer_version: str = "5"

    @classmethod
    def from_environment(cls) -> Settings:
        return cls(
            fastf1_cache_dir=_resolve_cache_path("FASTF1_CACHE_DIR", "fastf1-cache"),
            normalized_cache_dir=_resolve_cache_path("NORMALIZED_CACHE_DIR", "normalized-cache"),
            allowed_origins=tuple(
                origin.strip()
                for origin in os.environ.get(
                    "CORTEX_ALLOWED_ORIGINS", "http://127.0.0.1:3000,http://localhost:3000"
                ).split(",")
                if origin.strip()
            ),
        )


def _resolve_cache_path(variable: str, default: str) -> Path:
    configured = Path(os.environ.get(variable, default))
    return configured if configured.is_absolute() else PROJECT_ROOT / configured
