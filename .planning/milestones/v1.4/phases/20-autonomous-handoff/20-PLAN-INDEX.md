# Phase 20: Autonomous Session Handoff — Plan Index

**Milestone:** v1.4 — Clean Close + Codex Visibility + Autonomous Handoff
**Phase goal:** Close the operator-intervention gap — Stop hook reads ORCHESTRATOR-CHECKPOINT.md
and spawns a fresh claude session autonomously when emergency_halt is true.

**Requirements addressed:** HANDOFF-01, HANDOFF-02, HANDOFF-03

## Safety posture

`--dry-run` flag is the ONLY allowed invocation during development.
Real spawn (`--dangerously-skip-permissions`) fires only when operator sets
`handoff.enabled: true` in `.planning/config.json`. Default is `enabled: false`.

## Execution order (strict serial — no parallel)

| # | Plan | One-liner | HANDOFF-IDs | Depends on |
|---|------|-----------|-------------|------------|
| 1 | 20-01-stop-hook-PLAN.md | Bash Stop hook script + settings-overlay wiring (disabled by default) | HANDOFF-01 | — |
| 2 | 20-02-safety-rails-PLAN.md | Cooldown + depth + abort-file + discuss-phase guard + config.json block | HANDOFF-02 | 20-01 |
| 3 | 20-03-telemetry-MC-PLAN.md | handoff-log.jsonl + MC Handoff-Tile + session-start pairing + audit flag | HANDOFF-03 | 20-02 |

## Research corrections applied (from 20-RESEARCH.md)

- D-04 spawn_args: `--dangerously-skip-permissions` added (without it spawned session hangs on permissions prompt)
- D-05 session ID: `CLAUDE_SESSION_ID` not propagated to hook subprocesses — `$$` PID fallback used
- Stop hook background spawn: `(claude ... >/dev/null 2>&1 &) &` double-background to avoid 60s timeout
- gsd-session-start.js path bug: `path.join(process.cwd(), ...)` replaces `toUnixPath()` in Phase 20 extension

## Wave structure

All 3 plans are wave-1/2/3 respectively (serial dependency chain). No parallel execution.
