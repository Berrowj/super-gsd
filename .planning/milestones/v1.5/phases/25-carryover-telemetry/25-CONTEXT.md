---
phase: 25
phase_name: Carryover + Telemetry
milestone: v1.5
status: discussed
date: 2026-04-25
discussed_via: fast-track (small carryover items + scaffolded edge-guard wire-up)
---

# Phase 25 — Carryover + Telemetry

## Goal

Final v1.5 phase. 6 REQs across 3 plans:
- **CARRY-01..03** (Plan 25-01) — small carryover items from v1.4 phases 17/18: awk anchor brittleness, JSDoc consistency audit, dogfood audit strictness methodology.
- **INSTR-01** (Plan 25-02) — wire scaffolded edge-guard module into orchestrator dispatch path. Enables `gate-drift-audit.md` at milestone close to have data.
- **INSTR-02..03** (Plan 25-03) — dashboard offload math audit + timeout observability metric.

## CARRY items (small)

- **CARRY-01** awk anchor brittleness — replace `/^\| git_spawn_pct/` regex anchor with `<!-- qual-row-insert -->` sentinel marker in compose_waste_md body.
- **CARRY-02** providers-registry.cjs JSDoc consistency — verify Phase 17 T1 swap was thorough; no remaining `reviewer_agent` literals.
- **CARRY-03** dogfood audit strictness — append explicit methodology block to `18-DOGFOOD-AUDIT.md` documenting strict 4-criterion filter (provider, fallback_triggered, exit, contract).

## INSTR items (telemetry)

- **INSTR-01** edge-guard wiring — read `super-gsd/scripts/lib/edge-guard.cjs`; identify hooks; wire emits at every gate transition. Append rows to `.planning/metrics/edge-guard-log.jsonl`.
- **INSTR-02** dashboard math audit + fix — `Get-CodexStats` in `lib/sgsd-codex-status.ps1`: reconcile `claude_tokens_saved_by_codex`, `codex_invocations_this_milestone` filter, `fallback_rate` denominator, `avg_codex_duration_ms`.
- **INSTR-03** timeout observability — new `.planning/metrics/codex-timeout-observability.jsonl` row per timeout event (ts, tier_requested, tier_actual_via_retry, duration_ms, exit_code). Dashboard tile surfaces "timeout rate by tier".

## Decisions locked

- **Plan ordering**: 25-01 fast (3 carryover items), 25-02 medium (edge-guard wire-up), 25-03 medium (PowerShell + new JSONL).
- **Risk on INSTR-01**: edge-guard module exists but its API surface needs a quick read before wiring. If wire-up exceeds plan scope, defer to v1.6.
- **Risk on INSTR-02**: PowerShell math fixes — fix-forward, no new tests required. Existing dashboard tiles continue to render.

## Files to modify

- `super-gsd/scripts/sgsd-muda-audit.sh` (CARRY-01)
- `.planning/milestones/v1.4/phases/18-codex-hardening/18-DOGFOOD-AUDIT.md` (CARRY-03 amendment)
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` (INSTR-01 wire emits)
- `super-gsd/scripts/lib/sgsd-codex-status.ps1` (INSTR-02 math fixes)
- `super-gsd/scripts/codex-exec.sh` (INSTR-03 timeout-observability emit)
- `.planning/metrics/codex-timeout-observability.jsonl` (INSTR-03 new file — created on first emit)

## Out of scope

- Cross-milestone telemetry rollups (v1.6 if surfaced)
- New dashboard layouts (only fixing existing math)
- edge-guard READ path (only WRITE wire-up; readers ship later)

## Next

Execute 25-01..03, then `sgsd-complete-milestone v1.5`.
