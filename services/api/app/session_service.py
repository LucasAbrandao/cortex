from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from .cache import NormalizedCache, NormalizedSession
from .catalog import is_supported
from .errors import CortexError, JobCancelled
from .fastf1_adapter import FastF1Backend
from .models import (
    ComparisonSeries,
    DataAvailability,
    JobSource,
    JobStage,
    SeriesRequest,
    TelemetrySample,
    TrackRequest,
    TrackSegment,
)
from .normalizer import normalize_session
from .settings import Settings

StageUpdate = Callable[[JobStage, float | None, str], None]


@dataclass(frozen=True)
class SessionLoadResult:
    session: NormalizedSession
    source: JobSource | None


class SessionService:
    def __init__(self, settings: Settings, adapter: FastF1Backend) -> None:
        self._settings = settings
        self._adapter = adapter
        self._cache = NormalizedCache(settings.normalized_cache_dir)
        self._sessions: dict[str, NormalizedSession] = {}

    def cache_health(self) -> tuple[int | None, int, int]:
        entries, normalized_size = self._cache.stats()
        return self._adapter.cache_size_bytes(), entries, normalized_size

    def load(self, year: int, event: str, session: str, should_cancel: Callable[[], bool], update: StageUpdate) -> SessionLoadResult:
        if not is_supported(year, event, session):
            raise CortexError("SESSION_NOT_SUPPORTED", "Only Belgium 2025 Race is enabled.", 422)
        key = self._cache.key(
            schema_version=self._settings.schema_version,
            fastf1_version=self._adapter.version,
            year=year,
            event=event,
            session=session,
            normalizer_version=self._settings.normalizer_version,
        )
        update("cache", None, "Checking the versioned normalized cache.")
        cached = self._cache.read(key)
        if cached is not None:
            self._sessions[cached.manifest.session_id] = cached
            return SessionLoadResult(session=cached, source="normalized-cache")
        self._raise_if_cancelled(should_cancel)

        update("download", None, "Loading FastF1 with its native cache enabled.")
        try:
            raw_session = self._adapter.load_race()
        except Exception as error:  # noqa: BLE001
            if error.__class__.__name__ == "RateLimitExceededError":
                raise CortexError("RATE_LIMITED", "The upstream source is rate limited. Try again later.", 503) from None
            raise CortexError("UPSTREAM_UNAVAILABLE", "The FastF1 source is temporarily unavailable.", 503) from None
        self._raise_if_cancelled(should_cancel)

        update("normalize", None, "Normalizing the public race data.")
        session_id = f"2025-belgium-r-{self._settings.schema_version}-{self._settings.normalizer_version}"
        normalized = normalize_session(
            raw_session,
            session_id=session_id,
            schema_version=self._settings.schema_version,
            normalizer_version=self._settings.normalizer_version,
            fastf1_version=self._adapter.version,
            should_cancel=should_cancel,
        )
        self._raise_if_cancelled(should_cancel)
        try:
            self._cache.write(key, normalized)
        except OSError:
            raise CortexError("CACHE_ERROR", "The normalized cache could not be written.", 500) from None
        self._sessions[session_id] = normalized
        return SessionLoadResult(session=normalized, source=None)

    def get(self, session_id: str) -> NormalizedSession:
        session = self._sessions.get(session_id)
        if session is None:
            raise CortexError("VALIDATION_ERROR", "The requested session is not available in this process.", 404)
        return session

    def series(self, session_id: str, request: SeriesRequest) -> list[ComparisonSeries]:
        session = self.get(session_id)
        known_channels = {channel.id for channel in session.manifest.channels}
        unknown_channels = set(request.channels).difference(known_channels)
        if unknown_channels:
            raise CortexError("VALIDATION_ERROR", "One or more requested channels are not available.", 422)

        response: list[ComparisonSeries] = []
        for selection in request.selections:
            samples = session.series.get(_series_key(selection.driver, selection.lap), ()) if selection.lap is not None else ()
            if request.axis == "distance" and any(sample.distance is None for sample in samples):
                raise CortexError("AXIS_UNAVAILABLE", "Distance is unavailable for one or more selected series.", 422)
            filtered = tuple(_filter_channels(sample, request.channels) for sample in samples)
            valid_samples = sum(
                1 for sample in filtered if any(value is not None for value in sample.values.values())
            )
            response.append(
                ComparisonSeries(
                    driver=selection.driver,
                    lap=selection.lap,
                    axis=request.axis,
                    samples=list(filtered),
                    availability=DataAvailability(
                        status="available" if valid_samples == len(filtered) and valid_samples else "partial" if valid_samples else "absent",
                        validSamples=valid_samples,
                        totalSamples=len(filtered),
                        reason=None if valid_samples else "No source samples were available for this driver and lap.",
                    ),
                )
            )
        return response

    def track(self, session_id: str, request: TrackRequest) -> list[TrackSegment]:
        session = self.get(session_id)
        if request.drivers and request.selections:
            raise CortexError("INVALID_SELECTION", "Choose drivers or driver-lap selections, not both.", 422)
        known_drivers = {driver.code for driver in session.manifest.drivers}
        requested_drivers = set(request.drivers) | {selection.driver for selection in request.selections}
        unknown_drivers = requested_drivers.difference(known_drivers)
        if unknown_drivers:
            raise CortexError("INVALID_SELECTION", "One or more requested drivers are not available.", 422)
        allowed_drivers = set(request.drivers) if request.drivers else known_drivers
        allowed_selections = {
            _series_key(selection.driver, selection.lap)
            for selection in request.selections
            if selection.lap is not None
        }
        segments: list[TrackSegment] = []
        for key, samples in session.tracks.items():
            driver, lap = _split_series_key(key)
            if (allowed_selections and key in allowed_selections) or (not allowed_selections and driver in allowed_drivers):
                segments.append(TrackSegment(driver=driver, lap=lap, samples=list(samples)))
        return segments

    @staticmethod
    def _raise_if_cancelled(should_cancel: Callable[[], bool]) -> None:
        if should_cancel():
            raise JobCancelled()


def _series_key(driver: str, lap: int | None) -> str:
    return f"{driver}:{lap}" if lap is not None else ""


def _split_series_key(key: str) -> tuple[str, int | None]:
    driver, separator, raw_lap = key.partition(":")
    return driver, int(raw_lap) if separator and raw_lap.isdigit() else None


def _filter_channels(sample: TelemetrySample, channels: list[str]) -> TelemetrySample:
    return sample.model_copy(update={"values": {channel: sample.values.get(channel) for channel in channels}})
