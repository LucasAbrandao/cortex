from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from threading import Event, RLock
from uuid import uuid4

from .errors import CortexError, JobCancelled
from .models import ApiError, JobSource, JobStage, JobStatus, LoadJob
from .session_service import SessionService


@dataclass
class JobRecord:
    id: str
    year: int
    event: str
    session: str
    status: JobStatus = "queued"
    stage: JobStage = "catalog"
    progress: float | None = None
    message: str = "Waiting to start."
    source: JobSource | None = None
    session_id: str | None = None
    error: ApiError | None = None
    cancelled: Event = field(default_factory=Event)


class JobManager:
    def __init__(self, service: SessionService) -> None:
        self._service = service
        self._records: dict[str, JobRecord] = {}
        self._active_by_selection: dict[tuple[int, str, str], str] = {}
        self._lock = RLock()
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="cortex-fastf1")

    def create(self, year: int, event: str, session: str, request_id: str) -> LoadJob:
        selection = (year, event, session)
        with self._lock:
            active_id = self._active_by_selection.get(selection)
            if active_id is not None:
                return self._to_model(self._records[active_id], request_id)
            record = JobRecord(id=str(uuid4()), year=year, event=event, session=session)
            self._records[record.id] = record
            self._active_by_selection[selection] = record.id
            self._executor.submit(self._run, record.id)
            return self._to_model(record, request_id)

    def get(self, job_id: str, request_id: str) -> LoadJob:
        with self._lock:
            record = self._records.get(job_id)
            if record is None:
                raise CortexError("JOB_NOT_FOUND", "The requested job does not exist.", 404)
            return self._to_model(record, request_id)

    def cancel(self, job_id: str, request_id: str) -> LoadJob:
        with self._lock:
            record = self._records.get(job_id)
            if record is None:
                raise CortexError("JOB_NOT_FOUND", "The requested job does not exist.", 404)
            if record.status in {"succeeded", "failed", "cancelled"}:
                return self._to_model(record, request_id)
            record.cancelled.set()
            record.status = "cancelled"
            record.message = "Cancellation requested."
            self._active_by_selection.pop((record.year, record.event, record.session), None)
            return self._to_model(record, request_id)

    def _run(self, job_id: str) -> None:
        with self._lock:
            record = self._records[job_id]
            if record.cancelled.is_set():
                return
            record.status = "running"
            record.message = "Validating the enabled session."

        def update(stage: JobStage, progress: float | None, message: str) -> None:
            with self._lock:
                if record.cancelled.is_set():
                    raise JobCancelled()
                record.stage = stage
                record.progress = progress
                record.message = message

        try:
            result = self._service.load(record.year, record.event, record.session, record.cancelled.is_set, update)
            with self._lock:
                if record.cancelled.is_set():
                    return
                record.status = "succeeded"
                record.stage = "ready"
                record.progress = 1.0
                record.message = "Session data is ready."
                record.source = result.source
                record.session_id = result.session.manifest.session_id
        except JobCancelled:
            with self._lock:
                record.status = "cancelled"
                record.message = "Loading was cancelled."
        except CortexError as error:
            with self._lock:
                record.status = "failed"
                record.error = ApiError(code=error.code, message=error.message)
                record.message = error.message
        except Exception:  # noqa: BLE001
            with self._lock:
                record.status = "failed"
                record.error = ApiError(code="NORMALIZATION_ERROR", message="The session could not be normalized safely.")
                record.message = record.error.message
        finally:
            with self._lock:
                self._active_by_selection.pop((record.year, record.event, record.session), None)

    @staticmethod
    def _to_model(record: JobRecord, request_id: str) -> LoadJob:
        return LoadJob(
            requestId=request_id,
            id=record.id,
            status=record.status,
            stage=record.stage,
            progress=record.progress,
            message=record.message,
            source=record.source,
            sessionId=record.session_id,
            error=record.error,
        )
