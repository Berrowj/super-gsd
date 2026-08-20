"""Long-running job registration and stale reporting."""

from __future__ import annotations

from datetime import timedelta

from . import ControlPlaneError, parse_utc, utc_now
from .config import Config, load_config
from .registry import Registry

STALE_AFTER = timedelta(minutes=30)


def _describe(row: object, now=None) -> dict[str, object]:
    current = now or utc_now()
    data = dict(row)  # type: ignore[arg-type]
    try:
        age_seconds = max(0, int((current - parse_utc(data["started_at"])).total_seconds()))
        heartbeat_age = max(0, int((current - parse_utc(data["heartbeat_at"])).total_seconds()))
    except (KeyError, TypeError, ValueError):
        age_seconds = 0
        heartbeat_age = 0
    data["age_seconds"] = age_seconds
    data["age"] = _human_age(age_seconds)
    data["stale"] = data.get("state") == "running" and heartbeat_age > int(STALE_AFTER.total_seconds())
    data["status"] = "stale" if data["stale"] else data.get("state")
    data["resumable"] = bool(data.get("resumable"))
    return data


def _human_age(seconds: int) -> str:
    if seconds < 60:
        return f"{seconds}s"
    if seconds < 3600:
        return f"{seconds // 60}m"
    return f"{seconds // 3600}h{(seconds % 3600) // 60:02d}m"


def register(
    *,
    job_id: str,
    kind: str,
    service: str | None = None,
    session: str | None = None,
    pid: int | None = None,
    resumable: bool = False,
    checkpoint: str | None = None,
    interrupt_cost: str | None = None,
    config: Config | None = None,
) -> dict[str, object]:
    current = config or load_config()
    with Registry(current) as registry:
        return registry.register_job(
            job_id=job_id,
            kind=kind,
            service=service,
            session=session,
            pid=pid,
            resumable=resumable,
            checkpoint=checkpoint,
            interrupt_cost=interrupt_cost,
        )


def list_jobs(config: Config | None = None) -> dict[str, object]:
    current = config or load_config()
    if not current.database_path.is_file():
        return {"jobs": [], "running_count": 0, "stale_count": 0}
    with Registry(current, create=False, read_only=True) as registry:
        rows = [_describe(row) for row in registry.jobs()]
    return {
        "jobs": rows,
        "running_count": sum(row["state"] == "running" for row in rows),
        "stale_count": sum(bool(row["stale"]) for row in rows),
    }


def running_for_services(
    services: list[str], config: Config | None = None
) -> list[dict[str, object]]:
    current = config or load_config()
    if not current.database_path.is_file():
        return []
    targets = set(services)
    with Registry(current, create=False, read_only=True) as registry:
        return [_describe(row) for row in registry.jobs(state="running") if row["service"] in targets]


def finish(job_id: str, state: str = "done", config: Config | None = None) -> dict[str, object]:
    current = config or load_config()
    if not current.database_path.is_file():
        raise ControlPlaneError(f"unknown job: {job_id}", exit_code=2)
    with Registry(current, create=False) as registry:
        return registry.finish_job(job_id, state)
