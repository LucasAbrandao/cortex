from __future__ import annotations

from datetime import UTC, datetime

import pytest

from app.cache import NormalizedSession
from app.errors import CortexError
from app.models import (
    DriverSummary,
    SeriesSelection,
    SessionManifest,
    TelemetryTrackSample,
    TrackRequest,
)
from app.session_service import SessionService


class LoadedSessionService(SessionService):
    def __init__(self) -> None:
        self.session = NormalizedSession(
            manifest=SessionManifest(
                schemaVersion="2",
                normalizerVersion="test",
                fastf1Version="test",
                sessionId="loaded-session",
                year=2025,
                event="Belgium",
                session="R",
                source="fastf1",
                drivers=[
                    DriverSummary(code=code, name=None, team=None, position=None, status=None)
                    for code in ["VER", "LEC"]
                ],
                laps=[],
                channels=[],
                trackAvailable=True,
                limitations=[],
                createdAt=datetime.now(UTC),
            ),
            replay=(),
            series={},
            tracks={
                key: (TelemetryTrackSample(time=1, lapTime=1, lapNumber=lap, x=x, y=2, onTrack=True),)
                for key, lap, x in [("VER:1", 1, 10), ("VER:2", 2, 20), ("LEC:1", 1, 30)]
            },
        )

    def get(self, session_id: str) -> NormalizedSession:
        return self.session


@pytest.mark.parametrize(
    "selections",
    [
        [SeriesSelection(driver="VER", lap=None)],
        [SeriesSelection(driver="VER", lap=None), SeriesSelection(driver="LEC", lap=None)],
    ],
)
def test_track_without_a_valid_lap_does_not_expand_the_requested_selection(
    selections: list[SeriesSelection],
) -> None:
    service = LoadedSessionService()

    assert service.track("loaded-session", TrackRequest(selections=selections)) == []


@pytest.mark.parametrize(
    ("track_request", "expected"),
    [
        (TrackRequest(), [("VER", 1), ("VER", 2), ("LEC", 1)]),
        (TrackRequest(drivers=["VER"]), [("VER", 1), ("VER", 2)]),
        (
            TrackRequest(selections=[SeriesSelection(driver="VER", lap=None), SeriesSelection(driver="LEC", lap=1)]),
            [("LEC", 1)],
        ),
    ],
)
def test_track_keeps_explicit_all_driver_and_valid_lap_selection_behavior(
    track_request: TrackRequest, expected: list[tuple[str, int]],
) -> None:
    service = LoadedSessionService()

    segments = service.track("loaded-session", track_request)

    assert [(segment.driver, segment.lap) for segment in segments] == expected


@pytest.mark.parametrize(
    "track_request",
    [
        TrackRequest(drivers=["VER"], selections=[SeriesSelection(driver="VER", lap=None)]),
        TrackRequest(selections=[SeriesSelection(driver="UNKNOWN", lap=None)]),
    ],
)
def test_track_rejects_ambiguous_and_unknown_driver_requests(track_request: TrackRequest) -> None:
    with pytest.raises(CortexError) as error:
        LoadedSessionService().track("loaded-session", track_request)

    assert error.value.code == "INVALID_SELECTION"
    assert error.value.status_code == 422
