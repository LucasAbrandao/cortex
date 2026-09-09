from __future__ import annotations

from datetime import timedelta
from pathlib import Path
from threading import Event
from time import sleep
from typing import Any, cast

from fastapi.testclient import TestClient

from app.main import create_app
from app.settings import Settings


class FakeFrame:
    def __init__(self, records: list[dict[str, Any]]) -> None:
        self._records = records

    def iterrows(self) -> Any:
        return iter(enumerate(self._records))


class FakeTelemetry(FakeFrame):
    def add_distance(self) -> FakeTelemetry:
        return self


class FakeLap:
    def get_car_data(self) -> FakeTelemetry:
        return FakeTelemetry(
            [
                {
                    "Time": timedelta(seconds=0),
                    "Speed": 180.0,
                    "RPM": 11000,
                    "nGear": 7,
                    "Throttle": 80.0,
                    "Brake": False,
                    "DRS": 8,
                    "Distance": 0.0,
                },
                {
                    "Time": timedelta(seconds=1),
                    "Speed": 216.0,
                    "RPM": 11500,
                    "nGear": 8,
                    "Throttle": 100.0,
                    "Brake": False,
                    "DRS": 10,
                    "Distance": 120.0,
                },
                *[
                    {"Time": timedelta(seconds=index), "Speed": 216.0, "RPM": 11500, "nGear": 8, "Throttle": 100.0, "Brake": index == 150, "DRS": 10, "Distance": index * 120.0}
                    for index in range(2, 302)
                ],
            ]
        )

    def get_pos_data(self) -> FakeTelemetry:
        return FakeTelemetry(
            [
                {"Time": timedelta(seconds=0), "X": 10.0, "Y": 20.0, "Status": "OnTrack"},
                {"Time": timedelta(seconds=1), "X": None, "Y": 30.0, "Status": "OffTrack"},
                *[
                    {"Time": timedelta(seconds=index), "X": float(index), "Y": float(index * 2), "Status": "OnTrack"}
                    for index in range(2, 302)
                ],
            ]
        )


class FakeLaps(FakeFrame):
    def pick_drivers(self, _: str) -> FakeLaps:
        return self

    def pick_laps(self, _: int) -> FakeLaps:
        return self

    @property
    def iloc(self) -> FakeLaps:
        return self

    def __getitem__(self, _: int) -> FakeLap:
        return FakeLap()


class FakeSession:
    def __init__(self) -> None:
        self.results = FakeFrame(
            [
                {
                    "Abbreviation": "VER",
                    "BroadcastName": "M VERSTAPPEN",
                    "TeamName": "Red Bull Racing",
                    "Position": 1,
                    "Status": "Finished",
                }
            ]
        )
        self.laps = FakeLaps(
            [
                {
                    "Driver": "VER",
                    "LapNumber": 1,
                    "LapTime": timedelta(seconds=1),
                    "Time": timedelta(seconds=101),
                    "Position": 1,
                }
            ]
        )


class FakeAdapter:
    version = "3.8.3"

    def __init__(self, release: Event | None = None) -> None:
        self.started = Event()
        self._release = release
        self.calls = 0

    def cache_size_bytes(self) -> int | None:
        return 42

    def load_race(self) -> FakeSession:
        self.calls += 1
        self.started.set()
        if self._release is not None:
            self._release.wait(timeout=2)
        return FakeSession()


def test_catalog_health_and_allowlist_are_explicit(tmp_path: Path) -> None:
    client = _client(tmp_path, FakeAdapter())

    health = client.get("/api/health")
    capabilities = client.get("/api/capabilities")
    catalog = client.get("/api/f1/2025/events")
    cors = client.options(
        "/api/f1/jobs",
        headers={
            "Origin": "http://127.0.0.1:3000",
            "Access-Control-Request-Method": "POST",
        },
    )
    unsupported = client.post("/api/f1/jobs", json={"year": 2025, "event": "Italy", "session": "R"})

    assert health.status_code == 200
    assert health.json()["fastf1Available"] is True
    assert capabilities.json()["cache"]["fastf1SizeBytes"] == 42
    assert [event["event"] for event in catalog.json()["events"] if event["availability"] == "enabled"] == ["Belgium"]
    assert cors.headers["access-control-allow-origin"] == "http://127.0.0.1:3000"
    assert unsupported.status_code == 422
    assert unsupported.json()["error"]["code"] == "SESSION_NOT_SUPPORTED"


def test_job_uses_normalized_cache_and_exposes_public_session_data(tmp_path: Path) -> None:
    adapter = FakeAdapter()
    client = _client(tmp_path, adapter)

    created = client.post("/api/f1/jobs", json={"year": 2025, "event": "Belgium", "session": "R"})
    completed = _wait_for_terminal_job(client, created.json()["id"])

    assert completed["status"] == "succeeded"
    assert completed["source"] is None
    assert completed["sessionId"] is not None
    session_id = completed["sessionId"]
    manifest = client.get(f"/api/f1/sessions/{session_id}/manifest")
    replay = client.get(f"/api/f1/sessions/{session_id}/replay?from=100&to=101")
    series = client.post(
        f"/api/f1/sessions/{session_id}/series",
        json={
            "axis": "lapTime",
            "selections": [{"driver": "VER", "lap": 1}],
            "channels": ["speed", "longitudinalAcceleration"],
        },
    )
    track = client.post(f"/api/f1/sessions/{session_id}/track", json={"drivers": ["VER"]})
    selected_track = client.post(
        f"/api/f1/sessions/{session_id}/track",
        json={"selections": [{"driver": "VER", "lap": 1}]},
    )
    ambiguous_track = client.post(
        f"/api/f1/sessions/{session_id}/track",
        json={"drivers": ["VER"], "selections": [{"driver": "VER", "lap": 1}]},
    )

    assert adapter.calls == 1
    assert manifest.json()["manifest"]["drivers"][0]["code"] == "VER"
    assert manifest.json()["manifest"]["trackAvailable"] is True
    assert len(replay.json()["frames"]) == 1
    assert series.json()["series"][0]["availability"]["status"] == "available"
    assert series.json()["series"][0]["samples"][1]["values"]["longitudinalAcceleration"] == 10.0
    assert len(series.json()["series"][0]["samples"]) == 302
    assert series.json()["series"][0]["samples"][150]["values"]["speed"] == 216.0
    assert track.json()["segments"][0]["samples"][0]["onTrack"] is True
    assert track.json()["segments"][0]["samples"][1]["x"] is None
    assert len(track.json()["segments"][0]["samples"]) == 302
    assert len(selected_track.json()["segments"]) == 1
    assert ambiguous_track.status_code == 422

    repeated = client.post("/api/f1/jobs", json={"year": 2025, "event": "Belgium", "session": "R"})
    cached = _wait_for_terminal_job(client, repeated.json()["id"])
    assert cached["status"] == "succeeded"
    assert cached["source"] == "normalized-cache"
    assert adapter.calls == 1

    cache_file = next((tmp_path / "normalized").glob("*.json"))
    cache_file.write_text("{}", encoding="utf-8")
    invalidated = client.post("/api/f1/jobs", json={"year": 2025, "event": "Belgium", "session": "R"})
    refreshed = _wait_for_terminal_job(client, invalidated.json()["id"])
    assert refreshed["status"] == "succeeded"
    assert adapter.calls == 2


def test_identical_active_job_coalesces_and_cancelled_job_does_not_write_cache(tmp_path: Path) -> None:
    release = Event()
    adapter = FakeAdapter(release)
    client = _client(tmp_path, adapter)
    payload = {"year": 2025, "event": "Belgium", "session": "R"}

    first = client.post("/api/f1/jobs", json=payload).json()
    assert adapter.started.wait(timeout=1)
    second = client.post("/api/f1/jobs", json=payload).json()
    cancelled = client.delete(f"/api/jobs/{first['id']}").json()
    release.set()
    terminal = _wait_for_terminal_job(client, first["id"])

    assert first["id"] == second["id"]
    assert cancelled["status"] == "cancelled"
    assert terminal["status"] == "cancelled"
    assert not list((tmp_path / "normalized").glob("*.json"))


def _client(tmp_path: Path, adapter: FakeAdapter) -> TestClient:
    settings = Settings(
        fastf1_cache_dir=tmp_path / "fastf1",
        normalized_cache_dir=tmp_path / "normalized",
        allowed_origins=("http://127.0.0.1:3000",),
    )
    return TestClient(create_app(settings=settings, adapter=adapter))


def _wait_for_terminal_job(client: TestClient, job_id: str) -> dict[str, Any]:
    for _ in range(100):
        payload = client.get(f"/api/jobs/{job_id}").json()
        if payload["status"] in {"succeeded", "failed", "cancelled"}:
            return cast(dict[str, Any], payload)
        sleep(0.01)
    raise AssertionError("Job did not reach a terminal state.")
