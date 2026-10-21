from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass, replace
from datetime import timedelta
from pathlib import Path
from typing import Any

import pytest

from app.cache import NormalizedCache
from app.normalizer import normalize_session
from app.session_service import SessionService
from app.settings import Settings


class SourceFrame:
    def __init__(self, records: list[dict[str, Any]]) -> None:
        self.records = records

    def iterrows(self) -> Iterator[tuple[int, dict[str, Any]]]:
        return iter(enumerate(self.records))

    def add_distance(self) -> SourceFrame:
        return self


class SourceLap:
    def __init__(self, number: int) -> None:
        self.number = number

    def get_car_data(self) -> SourceFrame:
        return SourceFrame(
            [
                {"Time": timedelta(seconds=0), "Speed": 180 + self.number, "Distance": 0},
                {"Time": timedelta(seconds=1), "Speed": None, "Distance": None},
            ]
        )

    def get_pos_data(self) -> SourceFrame:
        return SourceFrame(
            [
                {"Time": timedelta(seconds=0), "X": self.number, "Y": 20, "Status": "OnTrack"},
                {"Time": timedelta(seconds=1), "X": None, "Y": 30, "Status": "OffTrack"},
            ]
        )


class SourceLaps(SourceFrame):
    def pick_drivers(self, driver: str) -> SourceLaps:
        return SourceLaps([row for row in self.records if row.get("Driver") == driver])

    def pick_laps(self, number: int) -> SourceLaps:
        return SourceLaps([row for row in self.records if row.get("LapNumber") == number])

    @property
    def iloc(self) -> SourceLaps:
        return self

    def __getitem__(self, index: int) -> SourceLap:
        return SourceLap(int(self.records[index]["LapNumber"]))


@dataclass
class SourceSession:
    results: SourceFrame
    laps: SourceLaps


def _source_session(invalid_lap: dict[str, Any]) -> SourceSession:
    return SourceSession(
        results=SourceFrame([{"Abbreviation": "VER", "Position": 1, "Status": "Finished"}]),
        laps=SourceLaps(
            [
                {"Driver": "VER", "LapNumber": 1, "LapTime": timedelta(seconds=90), "Time": timedelta(seconds=90)},
                invalid_lap,
                {"Driver": "VER", "LapNumber": 3, "LapTime": timedelta(seconds=90), "Time": timedelta(seconds=270)},
            ]
        ),
    )


@pytest.mark.parametrize(
    "invalid_lap",
    [{"Driver": "VER", "LapNumber": None}, {"Driver": "", "LapNumber": 2}],
)
def test_invalid_lap_does_not_discard_later_source_samples(invalid_lap: dict[str, Any]) -> None:
    normalized = normalize_session(
        _source_session(invalid_lap),
        session_id="source-session",
        schema_version="2",
        normalizer_version="test",
        fastf1_version="test",
        should_cancel=lambda: False,
    )

    assert set(normalized.series) == {"VER:1", "VER:3"}
    assert set(normalized.tracks) == {"VER:1", "VER:3"}
    assert normalized.series["VER:3"][0].values["speed"] == 183
    assert normalized.series["VER:3"][1].values["speed"] is None
    assert normalized.tracks["VER:3"][0].x == 3
    assert normalized.tracks["VER:3"][1].x is None
    assert normalized.tracks["VER:3"][1].on_track is False


def test_cancellation_still_stops_processing_after_a_completed_lap() -> None:
    checks = 0

    def should_cancel() -> bool:
        nonlocal checks
        checks += 1
        return checks > 1

    normalized = normalize_session(
        _source_session({"Driver": "VER", "LapNumber": None}),
        session_id="cancelled-session",
        schema_version="2",
        normalizer_version="test",
        fastf1_version="test",
        should_cancel=should_cancel,
    )

    assert set(normalized.series) == {"VER:1"}
    assert normalized.tracks == {}


class SourceAdapter:
    version = "test-fastf1"

    def __init__(self, session: SourceSession) -> None:
        self.session = session
        self.calls = 0

    def cache_size_bytes(self) -> int | None:
        return None

    def load_race(self) -> SourceSession:
        self.calls += 1
        return self.session


def test_corrected_normalizer_does_not_reuse_a_truncated_v5_cache(tmp_path: Path) -> None:
    raw_session = _source_session({"Driver": "VER", "LapNumber": None})
    adapter = SourceAdapter(raw_session)
    settings = Settings(tmp_path / "fastf1", tmp_path / "normalized", ())
    cache = NormalizedCache(settings.normalized_cache_dir)
    old_session = normalize_session(
        raw_session,
        session_id="2025-belgium-r-2-5",
        schema_version="2",
        normalizer_version="5",
        fastf1_version=adapter.version,
        should_cancel=lambda: False,
    )
    old_session = replace(
        old_session,
        series={"VER:1": old_session.series["VER:1"]},
        tracks={"VER:1": old_session.tracks["VER:1"]},
    )
    old_key = cache.key(
        schema_version="2",
        fastf1_version=adapter.version,
        year=2025,
        event="Belgium",
        session="R",
        normalizer_version="5",
    )
    cache.write(old_key, old_session)
    service = SessionService(settings, adapter)

    refreshed = service.load(2025, "Belgium", "R", lambda: False, lambda *_: None)
    cached = service.load(2025, "Belgium", "R", lambda: False, lambda *_: None)

    assert adapter.calls == 1
    assert refreshed.source is None
    assert refreshed.session.manifest.normalizer_version != "5"
    assert refreshed.session.manifest.session_id != old_session.manifest.session_id
    assert set(refreshed.session.series) == {"VER:1", "VER:3"}
    assert set(refreshed.session.tracks) == {"VER:1", "VER:3"}
    assert cached.source == "normalized-cache"
    assert cache.read(old_key) is not None
    assert len(list(settings.normalized_cache_dir.glob("*.json"))) == 2
