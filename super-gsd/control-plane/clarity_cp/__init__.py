"""Clarity Control Plane phase-one safety primitives."""

from __future__ import annotations

from datetime import datetime, timezone

__version__ = "1.0.0"


class ControlPlaneError(Exception):
    """An expected CLI failure with a stable process exit code."""

    def __init__(self, message: str, exit_code: int = 1, detail: object = None):
        super().__init__(message)
        self.message = message
        self.exit_code = exit_code
        self.detail = detail


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_utc(value: datetime | None = None) -> str:
    current = value or utc_now()
    current = current.astimezone(timezone.utc).replace(microsecond=0)
    return current.isoformat().replace("+00:00", "Z")


def parse_utc(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)
