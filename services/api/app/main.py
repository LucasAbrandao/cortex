from __future__ import annotations

from uuid import uuid4

from fastapi import FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware

from .catalog import events_2025, is_supported
from .errors import CortexError
from .fastf1_adapter import FastF1Adapter, FastF1Backend
from .jobs import JobManager
from .models import (
    ApiError,
    CacheHealth,
    CapabilitiesResponse,
    CapabilitySession,
    EventCatalogResponse,
    HealthResponse,
    JobRequest,
    LoadJob,
    ReplayResponse,
    SeriesRequest,
    SeriesResponse,
    SessionCatalogResponse,
    SessionManifestResponse,
    SessionSummary,
    TrackRequest,
    TrackResponse,
)
from .session_service import SessionService
from .settings import Settings


def create_app(settings: Settings | None = None, adapter: FastF1Backend | None = None) -> FastAPI:
    resolved_settings = settings or Settings.from_environment()
    resolved_adapter = adapter or FastF1Adapter(resolved_settings.fastf1_cache_dir)
    sessions = SessionService(resolved_settings, resolved_adapter)
    jobs = JobManager(sessions)
    application = FastAPI(title="Cortex API", version="0.2.0")
    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(resolved_settings.allowed_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Content-Type"],
    )
    application.state.sessions = sessions
    application.state.jobs = jobs

    @application.exception_handler(CortexError)
    async def handle_cortex_error(_: Request, error: CortexError) -> JSONResponse:
        return JSONResponse(
            status_code=error.status_code,
            content={
                "requestId": str(uuid4()),
                "error": ApiError(code=error.code, message=error.message).model_dump(by_alias=True),
            },
        )

    @application.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, __: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "requestId": str(uuid4()),
                "error": ApiError(
                    code="VALIDATION_ERROR", message="The request does not match the public API contract."
                ).model_dump(by_alias=True),
            },
        )

    @application.get("/api/health", response_model=HealthResponse, tags=["infrastructure"])
    def health() -> HealthResponse:
        """Report local capabilities only; this endpoint never loads a session."""
        return HealthResponse(
            requestId=str(uuid4()),
            status="ok",
            version=application.version,
            fastf1Available=True,
            cacheConfigured=True,
        )

    @application.get("/api/capabilities", response_model=CapabilitiesResponse, tags=["infrastructure"])
    def capabilities() -> CapabilitiesResponse:
        fastf1_size, normalized_entries, normalized_size = sessions.cache_health()
        return CapabilitiesResponse(
            requestId=str(uuid4()),
            locales=["pt-BR", "en"],
            visibleYears=[2025],
            formats=["CSV", "JSON"],
            enabledSessions=[CapabilitySession(year=2025, event="Belgium", session="R", availability="enabled")],
            cache=CacheHealth(
                fastf1Enabled=True,
                fastf1SizeBytes=fastf1_size,
                normalizedEntries=normalized_entries,
                normalizedSizeBytes=normalized_size,
            ),
        )

    @application.get("/api/f1/2025/events", response_model=EventCatalogResponse, tags=["catalog"])
    def event_catalog() -> EventCatalogResponse:
        return EventCatalogResponse(requestId=str(uuid4()), year=2025, events=events_2025())

    @application.get(
        "/api/f1/2025/belgium/sessions", response_model=SessionCatalogResponse, tags=["catalog"]
    )
    def session_catalog() -> SessionCatalogResponse:
        return SessionCatalogResponse(
            requestId=str(uuid4()),
            year=2025,
            event="Belgium",
            sessions=[SessionSummary(session="R", label="Race", availability="enabled")],
        )

    @application.post("/api/f1/jobs", response_model=LoadJob, status_code=202, tags=["jobs"])
    def create_job(request: JobRequest) -> LoadJob:
        if not is_supported(request.year, request.event, request.session):
            raise CortexError("SESSION_NOT_SUPPORTED", "Only Belgium 2025 Race is enabled.", 422)
        return jobs.create(request.year, request.event, request.session, str(uuid4()))

    @application.get("/api/jobs/{job_id}", response_model=LoadJob, tags=["jobs"])
    def job_status(job_id: str) -> LoadJob:
        return jobs.get(job_id, str(uuid4()))

    @application.delete("/api/jobs/{job_id}", response_model=LoadJob, tags=["jobs"])
    def cancel_job(job_id: str) -> LoadJob:
        return jobs.cancel(job_id, str(uuid4()))

    @application.get(
        "/api/f1/sessions/{session_id}/manifest", response_model=SessionManifestResponse, tags=["sessions"]
    )
    def manifest(session_id: str) -> SessionManifestResponse:
        return SessionManifestResponse(requestId=str(uuid4()), manifest=sessions.get(session_id).manifest)

    @application.get("/api/f1/sessions/{session_id}/replay", response_model=ReplayResponse, tags=["sessions"])
    def replay(
        session_id: str,
        from_: float | None = Query(default=None, alias="from"),
        to: float | None = None,
    ) -> ReplayResponse:
        frames = sessions.get(session_id).replay
        selected = [frame for frame in frames if (from_ is None or frame.time >= from_) and (to is None or frame.time <= to)]
        return ReplayResponse(requestId=str(uuid4()), sessionId=session_id, frames=selected)

    @application.post(
        "/api/f1/sessions/{session_id}/series", response_model=SeriesResponse, tags=["sessions"]
    )
    def series(session_id: str, request: SeriesRequest) -> SeriesResponse:
        return SeriesResponse(requestId=str(uuid4()), sessionId=session_id, series=sessions.series(session_id, request))

    @application.post(
        "/api/f1/sessions/{session_id}/track", response_model=TrackResponse, tags=["sessions"]
    )
    def track(session_id: str, request: TrackRequest) -> TrackResponse:
        session = sessions.get(session_id)
        return TrackResponse(
            requestId=str(uuid4()),
            sessionId=session_id,
            trackAvailable=session.manifest.track_available,
            segments=sessions.track(session_id, request),
        )

    return application


app = create_app()
