from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

JobStatus = Literal["queued", "running", "succeeded", "failed", "cancelled"]
JobStage = Literal["catalog", "cache", "download", "normalize", "ready"]
JobSource = Literal["network", "fastf1-cache", "normalized-cache"]


class ApiModel(BaseModel):
    model_config = ConfigDict(extra="forbid", validate_by_alias=True, validate_by_name=True)


class HealthResponse(ApiModel):
    request_id: str = Field(alias="requestId")
    status: str
    version: str
    fastf1_available: bool = Field(alias="fastf1Available")
    cache_configured: bool = Field(alias="cacheConfigured")


class CacheHealth(ApiModel):
    fastf1_enabled: bool = Field(alias="fastf1Enabled")
    fastf1_size_bytes: int | None = Field(alias="fastf1SizeBytes")
    normalized_entries: int = Field(alias="normalizedEntries")
    normalized_size_bytes: int = Field(alias="normalizedSizeBytes")


class CapabilitySession(ApiModel):
    year: int
    event: str
    session: str
    availability: Literal["enabled", "comingSoon"]


class CapabilitiesResponse(ApiModel):
    request_id: str = Field(alias="requestId")
    locales: list[str]
    visible_years: list[int] = Field(alias="visibleYears")
    formats: list[str]
    enabled_sessions: list[CapabilitySession] = Field(alias="enabledSessions")
    cache: CacheHealth


class EventSummary(ApiModel):
    round: int
    event: str
    availability: Literal["enabled", "comingSoon"]


class EventCatalogResponse(ApiModel):
    request_id: str = Field(alias="requestId")
    year: int
    events: list[EventSummary]


class SessionSummary(ApiModel):
    session: str
    label: str
    availability: Literal["enabled", "comingSoon"]


class SessionCatalogResponse(ApiModel):
    request_id: str = Field(alias="requestId")
    year: int
    event: str
    sessions: list[SessionSummary]


class JobRequest(ApiModel):
    year: int
    event: str
    session: str


class ApiError(ApiModel):
    code: str
    message: str


class LoadJob(ApiModel):
    request_id: str = Field(alias="requestId")
    id: str
    status: JobStatus
    stage: JobStage
    progress: float | None
    message: str
    source: JobSource | None
    session_id: str | None = Field(alias="sessionId")
    error: ApiError | None


class DriverSummary(ApiModel):
    code: str
    name: str | None
    team: str | None
    position: int | None
    status: str | None


class LapSummary(ApiModel):
    driver: str
    number: int | None
    lap_time: float | None = Field(alias="lapTime")
    time: float | None
    position: int | None


class ChannelDefinition(ApiModel):
    id: str
    label: str
    value_type: Literal["continuous", "integer", "boolean", "category", "event"] = Field(alias="valueType")
    unit: str | None
    origin: Literal["source", "derived"]
    suggested_view: Literal["line", "step", "events", "table"] = Field(alias="suggestedView")


class SessionManifest(ApiModel):
    schema_version: str = Field(alias="schemaVersion")
    normalizer_version: str = Field(alias="normalizerVersion")
    fastf1_version: str = Field(alias="fastf1Version")
    session_id: str = Field(alias="sessionId")
    year: int
    event: str
    session: str
    source: Literal["fastf1"]
    drivers: list[DriverSummary]
    laps: list[LapSummary]
    channels: list[ChannelDefinition]
    track_available: bool = Field(alias="trackAvailable")
    limitations: list[str]
    created_at: datetime = Field(alias="createdAt")


class SessionManifestResponse(ApiModel):
    request_id: str = Field(alias="requestId")
    manifest: SessionManifest


class StandingSnapshot(ApiModel):
    driver: str
    time: float | None
    laps_completed: int | None = Field(alias="lapsCompleted")
    position: int | None
    status: str | None


class ReplayFrame(ApiModel):
    time: float
    standings: list[StandingSnapshot]


class ReplayResponse(ApiModel):
    request_id: str = Field(alias="requestId")
    session_id: str = Field(alias="sessionId")
    frames: list[ReplayFrame]


class SeriesSelection(ApiModel):
    driver: str
    lap: int | None


class SeriesRequest(ApiModel):
    axis: Literal["globalTime", "lapTime", "distance"]
    selections: list[SeriesSelection]
    channels: list[str]


class DataAvailability(ApiModel):
    status: Literal["available", "partial", "absent", "unmapped", "uncalibrated"]
    valid_samples: int = Field(alias="validSamples")
    total_samples: int = Field(alias="totalSamples")
    reason: str | None


class TelemetrySample(ApiModel):
    time: float | None
    lap_time: float | None = Field(alias="lapTime")
    distance: float | None
    lap_number: int | None = Field(alias="lapNumber")
    values: dict[str, float | int | bool | None]


class TelemetryTrackSample(ApiModel):
    time: float | None
    lap_time: float | None = Field(alias="lapTime")
    lap_number: int | None = Field(alias="lapNumber")
    x: float | None
    y: float | None
    on_track: bool | None = Field(alias="onTrack")


class ComparisonSeries(ApiModel):
    driver: str
    lap: int | None
    axis: Literal["globalTime", "lapTime", "distance"]
    samples: list[TelemetrySample]
    availability: DataAvailability


class SeriesResponse(ApiModel):
    request_id: str = Field(alias="requestId")
    session_id: str = Field(alias="sessionId")
    series: list[ComparisonSeries]


class TrackRequest(ApiModel):
    drivers: list[str] = Field(default_factory=list)
    selections: list[SeriesSelection] = Field(default_factory=list)


class TrackSegment(ApiModel):
    driver: str
    lap: int | None
    samples: list[TelemetryTrackSample]


class TrackResponse(ApiModel):
    request_id: str = Field(alias="requestId")
    session_id: str = Field(alias="sessionId")
    track_available: bool = Field(alias="trackAvailable")
    segments: list[TrackSegment]
