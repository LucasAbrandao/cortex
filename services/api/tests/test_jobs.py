from __future__ import annotations

from collections.abc import Callable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass, field
from threading import Event

import pytest

from app.errors import CortexError, JobCancelled
from app.jobs import JobManager
from app.session_service import SessionLoadResult, SessionService, StageUpdate


@dataclass
class BlockedLoad:
    error: Exception
    started: Event = field(default_factory=Event)
    release: Event = field(default_factory=Event)


class ControlledSessionService(SessionService):
    def __init__(self, loads: list[BlockedLoad]) -> None:
        self._loads = iter(loads)

    def load(
        self,
        year: int,
        event: str,
        session: str,
        should_cancel: Callable[[], bool],
        update: StageUpdate,
    ) -> SessionLoadResult:
        load = next(self._loads)
        load.started.set()
        if not load.release.wait(timeout=5):
            raise TimeoutError("The test did not release its blocked load.")
        raise load.error


@contextmanager
def _manager_for(loads: list[BlockedLoad]) -> Iterator[JobManager]:
    manager = JobManager(ControlledSessionService(loads))
    try:
        yield manager
    finally:
        for load in loads:
            load.release.set()
        manager._executor.shutdown(wait=True, cancel_futures=True)


def test_cancelled_job_completion_preserves_replacement_job_coalescing() -> None:
    first_load = BlockedLoad(JobCancelled())
    replacement_load = BlockedLoad(CortexError("UPSTREAM_UNAVAILABLE", "Source unavailable.", 503))

    with _manager_for([first_load, replacement_load]) as manager:
        first = manager.create(2025, "Belgium", "R", "first")
        assert first_load.started.wait(timeout=5)
        manager.cancel(first.id, "cancel")
        replacement = manager.create(2025, "Belgium", "R", "replacement")
        assert replacement.id != first.id

        first_load.release.set()
        # A single worker can start the replacement only after the first job's finally.
        assert replacement_load.started.wait(timeout=5)
        repeated = manager.create(2025, "Belgium", "R", "repeated")

        assert repeated.id == replacement.id
        assert repeated.status == "running"


@pytest.mark.parametrize(
    "error",
    [
        CortexError("UPSTREAM_UNAVAILABLE", "Source unavailable.", 503),
        RuntimeError("Unexpected late failure."),
    ],
)
def test_cancelled_job_remains_cancelled_after_late_failure(error: Exception) -> None:
    load = BlockedLoad(error)

    with _manager_for([load]) as manager:
        created = manager.create(2025, "Belgium", "R", "create")
        assert load.started.wait(timeout=5)
        cancelled = manager.cancel(created.id, "cancel")
        assert cancelled.status == "cancelled"
        load.release.set()

    # The context joins the worker, so this observes the result after the late error.
    completed = manager.get(created.id, "after-worker")
    assert completed.status == "cancelled"
    assert completed.error is None
