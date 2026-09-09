import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.models import HealthResponse

FIXTURES_DIR = Path(__file__).resolve().parents[3] / "fixtures" / "fastf1"


def test_health_is_safe_and_reports_local_fastf1_capability() -> None:
    response = TestClient(app).get("/api/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["fastf1Available"] is True
    assert payload["cacheConfigured"] is True
    assert isinstance(payload["requestId"], str)


def test_health_fixture_is_valid() -> None:
    payload = json.loads((FIXTURES_DIR / "health.valid.json").read_text(encoding="utf-8"))

    assert HealthResponse.model_validate(payload).model_dump(by_alias=True) == payload


def test_invalid_health_fixture_is_rejected() -> None:
    payload = json.loads((FIXTURES_DIR / "health.invalid.json").read_text(encoding="utf-8"))

    with pytest.raises(ValidationError):
        HealthResponse.model_validate(payload)
