from __future__ import annotations

import math
from collections.abc import Callable
from datetime import UTC, datetime
from numbers import Integral, Real
from typing import Any

from .cache import NormalizedSession
from .models import (
    ChannelDefinition,
    DriverSummary,
    LapSummary,
    ReplayFrame,
    SessionManifest,
    StandingSnapshot,
    TelemetrySample,
    TelemetryTrackSample,
)


def normalize_session(
    session: Any,
    *,
    session_id: str,
    schema_version: str,
    normalizer_version: str,
    fastf1_version: str,
    should_cancel: Callable[[], bool],
) -> NormalizedSession:
    """Normalize only values supplied by FastF1; missing values stay null."""
    results = _records(getattr(session, "results", None))
    drivers = [_driver_summary(record) for record in results]
    driver_statuses = {driver.code: driver.status for driver in drivers}
    laps = _records(getattr(session, "laps", None))
    lap_summaries = [_lap_summary(record) for record in laps]
    replay = _replay(lap_summaries, driver_statuses)
    series = _telemetry_series(session, lap_summaries, should_cancel)
    tracks = _track_series(session, lap_summaries, should_cancel)
    track_available = any(
        sample.x is not None and sample.y is not None and sample.on_track is True
        for samples in tracks.values()
        for sample in samples
    )

    manifest = SessionManifest(
        schemaVersion=schema_version,
        normalizerVersion=normalizer_version,
        fastf1Version=fastf1_version,
        sessionId=session_id,
        year=2025,
        event="Belgium",
        session="R",
        source="fastf1",
        drivers=drivers,
        laps=lap_summaries,
        channels=_channels(),
        trackAvailable=track_available,
        limitations=[
            *([] if track_available else ["No valid raw position samples were available for the track map."]),
            "Telemetry and position data are reduced to recorded samples without interpolation.",
        ],
        createdAt=datetime.now(UTC),
    )
    return NormalizedSession(manifest=manifest, replay=tuple(replay), series=series, tracks=tracks)


def _records(frame: Any) -> list[dict[str, Any]]:
    if frame is None or not hasattr(frame, "iterrows"):
        return []
    return [dict(row) for _, row in frame.iterrows()]


def _driver_summary(record: dict[str, Any]) -> DriverSummary:
    return DriverSummary(
        code=str(record.get("Abbreviation") or record.get("Driver") or ""),
        name=_string(record.get("BroadcastName") or record.get("FullName")),
        team=_string(record.get("TeamName")),
        position=_integer(record.get("Position")),
        status=_string(record.get("Status")),
    )


def _lap_summary(record: dict[str, Any]) -> LapSummary:
    return LapSummary(
        driver=str(record.get("Driver") or ""),
        number=_integer(record.get("LapNumber")),
        lapTime=_seconds(record.get("LapTime")),
        time=_seconds(record.get("Time")),
        position=_integer(record.get("Position")),
    )


def _replay(laps: list[LapSummary], statuses: dict[str, str | None]) -> list[ReplayFrame]:
    state: dict[str, StandingSnapshot] = {}
    frames: list[ReplayFrame] = []
    for lap in sorted((item for item in laps if item.time is not None), key=lambda item: item.time or 0):
        if lap.number is None or lap.time is None:
            continue
        state[lap.driver] = StandingSnapshot(
            driver=lap.driver,
            time=lap.time,
            lapsCompleted=lap.number,
            position=lap.position,
            status=statuses.get(lap.driver),
        )
        frames.append(
            ReplayFrame(
                time=lap.time,
                standings=sorted(
                    state.values(),
                    key=lambda standing: (standing.position is None, standing.position or 0, standing.driver),
                ),
            )
        )
    return frames


def _telemetry_series(
    session: Any, laps: list[LapSummary], should_cancel: Callable[[], bool]
) -> dict[str, tuple[TelemetrySample, ...]]:
    raw_laps = getattr(session, "laps", None)
    if raw_laps is None or not hasattr(raw_laps, "pick_drivers"):
        return {}

    series: dict[str, tuple[TelemetrySample, ...]] = {}
    for summary in laps:
        if should_cancel() or summary.number is None or not summary.driver:
            break
        samples = _lap_samples(raw_laps, summary)
        series[_series_key(summary.driver, summary.number)] = tuple(samples)
    return series


def _track_series(
    session: Any, laps: list[LapSummary], should_cancel: Callable[[], bool]
) -> dict[str, tuple[TelemetryTrackSample, ...]]:
    raw_laps = getattr(session, "laps", None)
    if raw_laps is None or not hasattr(raw_laps, "pick_drivers"):
        return {}

    tracks: dict[str, tuple[TelemetryTrackSample, ...]] = {}
    for summary in laps:
        if should_cancel() or summary.number is None or not summary.driver:
            break
        samples = _lap_track_samples(raw_laps, summary)
        tracks[_series_key(summary.driver, summary.number)] = tuple(samples)
    return tracks


def _lap_samples(raw_laps: Any, summary: LapSummary) -> list[TelemetrySample]:
    try:
        selected = raw_laps.pick_drivers(summary.driver).pick_laps(summary.number)
        lap = selected.iloc[0]
        telemetry = lap.get_car_data().add_distance()
    except (AttributeError, IndexError, KeyError, TypeError, ValueError):
        return []

    records = _records(telemetry)
    if not records:
        return []
    samples: list[TelemetrySample] = []
    previous_speed: float | None = None
    previous_time: float | None = None
    lap_start = (
        summary.time - summary.lap_time
        if summary.time is not None and summary.lap_time is not None
        else None
    )
    for record in records:
        lap_time = _seconds(record.get("Time"))
        time = lap_start + lap_time if lap_start is not None and lap_time is not None else None
        speed = _number(record.get("Speed"))
        acceleration = _acceleration(previous_speed, speed, previous_time, lap_time)
        samples.append(
            TelemetrySample(
                time=time,
                lapTime=lap_time,
                distance=_number(record.get("Distance")),
                lapNumber=summary.number,
                values={
                    "speed": speed,
                    "rpm": _integer(record.get("RPM")),
                    "gear": _integer(record.get("nGear")),
                    "throttle": _number(record.get("Throttle")),
                    "brake": _boolean(record.get("Brake")),
                    "drs": _integer(record.get("DRS")),
                    "longitudinalAcceleration": acceleration,
                },
            )
        )
        previous_speed = speed
        previous_time = lap_time
    return samples


def _lap_track_samples(raw_laps: Any, summary: LapSummary) -> list[TelemetryTrackSample]:
    """Keep original FastF1 position samples separate from car telemetry."""
    try:
        selected = raw_laps.pick_drivers(summary.driver).pick_laps(summary.number)
        lap = selected.iloc[0]
        positions = lap.get_pos_data()
    except (AttributeError, IndexError, KeyError, TypeError, ValueError):
        return []

    records = _records(positions)
    if not records:
        return []
    lap_start = (
        summary.time - summary.lap_time
        if summary.time is not None and summary.lap_time is not None
        else None
    )
    return [
        TelemetryTrackSample(
            time=lap_start + lap_time if lap_start is not None and lap_time is not None else None,
            lapTime=lap_time,
            lapNumber=summary.number,
            x=_number(record.get("X")),
            y=_number(record.get("Y")),
            onTrack=_track_status(record.get("Status")),
        )
        for record in records
        for lap_time in [_seconds(record.get("Time"))]
    ]


def _acceleration(
    previous_speed: float | None, speed: float | None, previous_time: float | None, time: float | None
) -> float | None:
    if previous_speed is None or speed is None or previous_time is None or time is None:
        return None
    delta_time = time - previous_time
    if delta_time <= 0 or delta_time > 1:
        return None
    return ((speed - previous_speed) / 3.6) / delta_time


def _channels() -> list[ChannelDefinition]:
    return [
        ChannelDefinition(id="speed", label="Speed", valueType="continuous", unit="km/h", origin="source", suggestedView="line"),
        ChannelDefinition(id="rpm", label="RPM", valueType="continuous", unit="rpm", origin="source", suggestedView="line"),
        ChannelDefinition(id="gear", label="Gear", valueType="integer", unit=None, origin="source", suggestedView="step"),
        ChannelDefinition(id="throttle", label="Throttle", valueType="continuous", unit="%", origin="source", suggestedView="line"),
        ChannelDefinition(id="brake", label="Brake", valueType="boolean", unit=None, origin="source", suggestedView="events"),
        ChannelDefinition(id="drs", label="DRS", valueType="integer", unit=None, origin="source", suggestedView="events"),
        ChannelDefinition(id="longitudinalAcceleration", label="Longitudinal acceleration", valueType="continuous", unit="m/s²", origin="derived", suggestedView="line"),
    ]


def _series_key(driver: str, lap: int) -> str:
    return f"{driver}:{lap}"


def _seconds(value: Any) -> float | None:
    if hasattr(value, "total_seconds"):
        return _number(value.total_seconds())
    return _number(value)


def _number(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, Real):
        numeric = float(value)
        return numeric if math.isfinite(numeric) else None
    return None


def _integer(value: Any) -> int | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, Integral):
        return int(value)
    numeric = _number(value)
    return int(numeric) if numeric is not None and numeric.is_integer() else None


def _boolean(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    numeric = _number(value)
    return bool(numeric) if numeric in (0.0, 1.0) else None


def _track_status(value: Any) -> bool | None:
    if value == "OnTrack":
        return True
    if value == "OffTrack":
        return False
    return None


def _string(value: Any) -> str | None:
    return value if isinstance(value, str) and value else None
