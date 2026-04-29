---
plan_id: 64-01
phase: 64
title: Workflow Pack Completion (8 new + 1 fix + lint + docs)
type: code+docs (FULL tier)
created: 2026-04-29
status: ready-for-execution
schema_version: 1
expected_ATC_tier: full
model: sonnet
files_touched:
  - .warp/workflows/sgsd-token-current.yaml
  - .warp/workflows/sgsd-status.yaml
  - .warp/workflows/sgsd-recovery-packet.yaml
  - .warp/workflows/sgsd-gate-status.yaml
  - .warp/workflows/sgsd-watchdog-status.yaml
  - .warp/workflows/sgsd-codex-status.yaml
  - .warp/workflows/sgsd-current-phase-artifacts.yaml
  - .warp/workflows/sgsd-warp-doctor.yaml
  - .warp/workflows/sgsd-remote-monitor-packet.yaml
  - super-gsd/tools/warp-workflow-lint/lint.cjs
  - super-gsd/docs/SGSD-WARP-WORKFLOWS.md
---

# Plan 64-01 -- Workflow Pack Completion

## Tasks

| # | Task | Acceptance |
|--:|---|---|
| 1 | Fix sgsd-token-current.yaml | adds `arguments:` block with `project_dir` default; command prefixed with `cd "{{project_dir}}"`; matches shape of other 4 originals |
| 2 | Author 8 new workflow YAMLs | each has name + description (with search terms) + command + tags + arguments-with-default; all under `.warp/workflows/` |
| 3 | Author `super-gsd/tools/warp-workflow-lint/lint.cjs` | structural shape lint (5 required keys) + collective search-term coverage (10 terms); selfTest 7+ assertions; READ-ONLY invariant; ASCII-only |
| 4 | Author `super-gsd/docs/SGSD-WARP-WORKFLOWS.md` | operator-facing docs index: 13-row table + 3 routines (daily/triage/off-machine) + add-a-new-workflow recipe + constraints + Related links |
| 5 | Run lint --self-test | 7/7 PASS exit 0 |
| 6 | Run lint live on this checkout | 13/13 valid + 10/10 search terms covered + exit 0 |

## 8 New Workflows

| YAML | Name | Trigger / Command |
|---|---|---|
| sgsd-status.yaml | SGSD: Status | Get-Content STATE.md -TotalCount 30 |
| sgsd-recovery-packet.yaml | SGSD: Recovery Packet | ORCHESTRATOR-CHECKPOINT.md or STATE fallback |
| sgsd-gate-status.yaml | SGSD: Gate Status | gate-value-log.jsonl + review-ledger tail |
| sgsd-watchdog-status.yaml | SGSD: Watchdog Status | autopilot-watchdog.json + orchestrator-pulse tail |
| sgsd-codex-status.yaml | SGSD: Codex Status | codex-live.json + codex-log tail |
| sgsd-current-phase-artifacts.yaml | SGSD: Current Phase Artifacts | dynamic milestone+phase resolution -> ls phase folder |
| sgsd-warp-doctor.yaml | SGSD: Warp Doctor | node super-gsd/tools/warp-doctor/check.cjs |
| sgsd-remote-monitor-packet.yaml | SGSD: Remote Monitor Packet | 4-block packet for off-machine sharing |

## Acceptance (Plan-Level)

- All 6 tasks complete.
- All 13 yamls validate via lint tool (5 originals + 8 new).
- All 10 required search terms cited at least once in workflow descriptions.
- Lint tool self-test 7/7 + ASCII-only + READ-ONLY.
- `git diff --stat` after this plan shows additions only under
  `.warp/workflows/`, `super-gsd/tools/warp-workflow-lint/`,
  `super-gsd/docs/`, and Phase 64 artifacts.

## Surgical Constraint (Karpathy)

Workflow YAMLs must call STABLE SGSD commands. No inline logic that
drifts from the canonical surfaces. Workflow `command:` should be a
single PowerShell statement that the operator could equally type
themselves -- workflows are buttons for existing commands, not new
behaviour.

The lint tool must follow the upgrade-drift / warp-doctor pattern
(frozen vocab + Lock-13 wraps + READ-ONLY invariant + ASCII-only).
Any deviation from that pattern is a finding for review.

## Out Of Scope

- PowerShell function aliases for the new workflows.
- `.warpindexingignore` authorship.
- Updating WARP.md / AGENTS.md to point at SGSD-WARP-WORKFLOWS.md
  (the docs index already cross-references both; reverse links are a
  future docs polish).
