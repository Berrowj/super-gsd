---
milestone: v3.4
phase: 999
plan_id: 999-01-localhost-startup-wiring
status: PLAN-LOCKED
created_at: 2026-05-29
---

# P999 Localhost Startup Wiring Plan

## Goal

Make the normal SGSD startup path launch the v3.4 localhost cockpit from the
project worktree, prefer port 7777, fall forward to an available loopback port,
and print a health-checked URL.

## Tasks

1. Fix `super-gsd/scripts/start-cockpit-server.ps1` so it health-checks
   `127.0.0.1`, selects an available port starting at 7777, records PID/port/URL
   under `.planning/runtime/`, and cleans up failed starts before exiting.
2. Wire `super-gsd/scripts/sgsd-boot.ps1` to invoke the cockpit server wrapper
   during normal launch.
3. Add the same cockpit server startup contract for Linux/tmux:
   `sgsd-boot.sh` and `sgsd-remote-tmux.sh` must start the Node cockpit
   sidecar from the project worktree, prefer 7777, fall forward to a free
   loopback port, write `.planning/runtime/cockpit-server.{pid,port,url}`,
   and print the health-checked URL.
4. Verify direct wrapper launch and SGSD boot/no-open behavior without relying
   on overwatcher.

## Acceptance

- `start-cockpit-server.ps1` reports a healthy URL and `/snapshot` returns 200.
- If 7777 is occupied by another listener, the wrapper selects a later free port.
- `sgsd-boot.ps1` includes the localhost cockpit startup step.
- Linux/tmux startup paths include the same localhost cockpit startup step.
- Backfill command remains available via
  `node super-gsd/tools/phase-capsule/write.cjs --backfill --all`.
