# Fixture: redis-on-graceful-degrade (SH4, happy)

The harness requires the redis-adapter.cjs module from the live tree; the
adapter is expected to surface a graceful-degrade sentinel when redis is
not reachable (the typical CI/dev steady state). When the adapter file is
absent, the scenario soft-skips with degrade_reason='redis_adapter_absent'.

## Expected outcome

`PASS-WITH-SOFT-SKIP`. Redis adapter falls back to SQLite (or marks
fallback_active when both are unavailable) without canonical drift.
