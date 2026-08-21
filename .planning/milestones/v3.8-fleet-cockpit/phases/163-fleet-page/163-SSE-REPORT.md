FILES_CHANGED: server.cjs, public/app.js, run-self-test.cjs.

VERIFICATION: Syntax 3/3; SSE 49/49; client 48/48; legacy tail cases green; diff check clean. Full runner: 614 passed, 3 failed, 2 skipped.

DEVIATIONS: Retained `/codex-live` JSON for compatibility; pane uses SSE only. No commit.

BLOCKERS: Sandbox rejects Node `spawnSync git` with `EPERM` in three unchanged Git-fixture cases, preventing an all-green full-run claim.

ONE_LINER: Codex now receives true append-only SSE with tail resets, heartbeats, reconnect status, scroll pinning, and watcher cleanup.
