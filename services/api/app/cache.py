from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from .models import ReplayFrame, SessionManifest, TelemetrySample, TelemetryTrackSample


@dataclass(frozen=True)
class NormalizedSession:
    manifest: SessionManifest
    replay: tuple[ReplayFrame, ...]
    series: dict[str, tuple[TelemetrySample, ...]]
    tracks: dict[str, tuple[TelemetryTrackSample, ...]]


class NormalizedCache:
    def __init__(self, directory: Path) -> None:
        self._directory = directory
        self._directory.mkdir(parents=True, exist_ok=True)

    def key(self, *, schema_version: str, fastf1_version: str, year: int, event: str, session: str, normalizer_version: str) -> str:
        return "/".join((schema_version, fastf1_version, str(year), event, session, normalizer_version))

    def read(self, key: str) -> NormalizedSession | None:
        path = self._path_for(key)
        try:
            artifact = json.loads(path.read_text(encoding="utf-8"))
            payload = artifact["payload"]
            encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")
            if artifact["key"] != key or artifact["checksum"] != hashlib.sha256(encoded).hexdigest():
                raise ValueError("cache checksum mismatch")
            return NormalizedSession(
                manifest=SessionManifest.model_validate(payload["manifest"]),
                replay=tuple(ReplayFrame.model_validate(frame) for frame in payload["replay"]),
                series={
                    key: tuple(TelemetrySample.model_validate(sample) for sample in samples)
                    for key, samples in payload["series"].items()
                },
                tracks={
                    key: tuple(TelemetryTrackSample.model_validate(sample) for sample in samples)
                    for key, samples in payload["tracks"].items()
                },
            )
        except (FileNotFoundError, KeyError, TypeError, ValueError, json.JSONDecodeError):
            if path.exists():
                path.unlink(missing_ok=True)
            return None

    def write(self, key: str, session: NormalizedSession) -> None:
        payload = {
            "manifest": session.manifest.model_dump(by_alias=True, mode="json"),
            "replay": [frame.model_dump(by_alias=True, mode="json") for frame in session.replay],
            "series": {
                series_key: [sample.model_dump(by_alias=True, mode="json") for sample in samples]
                for series_key, samples in session.series.items()
            },
            "tracks": {
                series_key: [sample.model_dump(by_alias=True, mode="json") for sample in samples]
                for series_key, samples in session.tracks.items()
            },
        }
        encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")
        artifact = {
            "key": key,
            "checksum": hashlib.sha256(encoded).hexdigest(),
            "createdAt": datetime.now(UTC).isoformat(),
            "payload": payload,
        }
        path = self._path_for(key)
        temporary = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
        temporary.write_text(json.dumps(artifact, ensure_ascii=False, sort_keys=True), encoding="utf-8")
        os.replace(temporary, path)

    def stats(self) -> tuple[int, int]:
        entries = list(self._directory.glob("*.json"))
        return len(entries), sum(entry.stat().st_size for entry in entries)

    def _path_for(self, key: str) -> Path:
        digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
        return self._directory / f"{digest}.json"
