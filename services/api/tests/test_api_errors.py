from __future__ import annotations

from pathlib import Path
from typing import Any
from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.main import create_app
from app.models import ApiErrorResponse
from app.settings import Settings


class UnusedAdapter:
    version = "test"

    def cache_size_bytes(self) -> int | None:
        return None

    def load_race(self) -> Any:
        raise AssertionError("Error contract tests must never load FastF1.")


@pytest.fixture
def application(tmp_path: Path) -> FastAPI:
    return create_app(
        Settings(tmp_path / "fastf1", tmp_path / "normalized", ()),
        UnusedAdapter(),
    )


@pytest.mark.parametrize(
    ("method", "url", "body", "status", "code"),
    [
        ("POST", "/api/f1/jobs", {}, 422, "VALIDATION_ERROR"),
        ("POST", "/api/f1/jobs", {"year": 2025, "event": "Italy", "session": "R"}, 422, "SESSION_NOT_SUPPORTED"),
        ("GET", "/api/jobs/missing", None, 404, "JOB_NOT_FOUND"),
        ("DELETE", "/api/jobs/missing", None, 404, "JOB_NOT_FOUND"),
        ("GET", "/api/f1/sessions/missing/manifest", None, 404, "VALIDATION_ERROR"),
        ("GET", "/api/f1/sessions/missing/replay?from=invalid", None, 422, "VALIDATION_ERROR"),
    ],
)
def test_actual_http_errors_match_the_public_error_model(
    application: FastAPI,
    method: str,
    url: str,
    body: dict[str, Any] | None,
    status: int,
    code: str,
) -> None:
    response = TestClient(application).request(method, url, json=body)

    assert response.status_code == status
    payload = response.json()
    validated = ApiErrorResponse.model_validate(payload)
    assert validated.model_dump(by_alias=True) == payload
    assert UUID(validated.request_id)
    assert validated.error.code == code
    assert "detail" not in payload
    assert "missing" not in validated.error.message


@pytest.mark.parametrize(
    ("path", "method", "statuses"),
    [
        ("/api/f1/jobs", "post", [422]),
        ("/api/jobs/{job_id}", "get", [404, 422]),
        ("/api/jobs/{job_id}", "delete", [404, 422]),
        ("/api/f1/sessions/{session_id}/manifest", "get", [404, 422]),
        ("/api/f1/sessions/{session_id}/replay", "get", [404, 422]),
        ("/api/f1/sessions/{session_id}/series", "post", [404, 422]),
        ("/api/f1/sessions/{session_id}/track", "post", [404, 422]),
    ],
)
def test_openapi_declares_the_same_error_model_as_runtime(
    application: FastAPI, path: str, method: str, statuses: list[int],
) -> None:
    schema = application.openapi()

    for status in statuses:
        declared = schema["paths"][path][method]["responses"][str(status)]
        assert declared["content"]["application/json"]["schema"] == {
            "$ref": "#/components/schemas/ApiErrorResponse"
        }
    public_error = schema["components"]["schemas"]["ApiErrorResponse"]
    assert set(public_error["required"]) == {"requestId", "error"}
    assert public_error["additionalProperties"] is False
