---
plan_id: 63-01
phase: 63
title: Warp Capability Evidence Collection
type: docs-only / evidence-collection
created: 2026-04-29
status: ready-for-execution
---

# Plan 63-01 — Warp Capability Evidence Collection

## Goal

Produce a single operator-facing evidence matrix (`WARP-SMOKE.md`) that
records direct terminal-derivable evidence for every claim the v2.2-v2.8
roadmap depends on, and a clean operator-only checklist (`MANUAL-CHECKS.md`)
for UI-bound facts.

## Tasks

| # | Task | Acceptance | Type |
|--:|---|---|---|
| 1 | Probe `sg`/`sgsd`/`sgsd-setup` definition source (PowerShell profile) | Function bodies dumped; entrypoint script paths confirmed | terminal |
| 2 | Probe Warp env detection (`TERM_PROGRAM`, `WARP_*`, `CLAUDECODE`) | Env values captured; sg-launched-Claude topology proven from this session | terminal |
| 3 | Probe `claude`/`codex` CLI availability and entrypoint | `Get-Command` returns ExternalScript paths under `~/AppData/Roaming/npm/` | terminal |
| 4 | Probe Warp install path | `Test-Path` per candidate; locate `Warp.exe` | terminal |
| 5 | Probe `~/.warp/launch_configurations/` existence and contents | Directory exists empty; no fixture YAML present | terminal |
| 6 | Lint `.warp/workflows/*.yaml` shape | All files parse; per-file PASS/FAIL reported | terminal |
| 7 | Probe `.warpindexingignore` presence | File missing; Warp will index everything by default | terminal |
| 8 | Probe `tmux` availability (native) | Not present on Windows PATH; would require WSL | terminal |
| 9 | Reference Warp Codebase Context behavior in WSL/SSH | Cite official Warp docs; record as known constraint | docs |
| 10 | Convert PASS/FAIL/MANUAL into `WARP-SMOKE.md` matrix | One row per smoke question; status ∈ {PASS, FAIL, MANUAL-CHECK-REQUIRED, NOT-APPLICABLE}; evidence cell cites command or file | docs |
| 11 | Promote UI-bound rows to `MANUAL-CHECKS.md` with concrete operator steps | Each item names: where to look in Warp, what to verify, how to record the result back into WARP-SMOKE.md | docs |
| 12 | Write `63-VERIFICATION.md` with phase-status determination | Status ∈ {PASS, PASS-WITH-DEFERRED-N, CANDIDATE-WITH-DEBT}; defer reasons enumerate the unfilled MANUAL-CHECK rows | docs |
| 13 | Write `63-ATC-REVIEW.md` (docs-only ATC verdict) | Anti-slop checklist applied; verdict text-only; no codex review needed for docs-only evidence-collection phase | docs |

## Acceptance (Plan-Level)

- All 13 tasks complete.
- `git diff --stat` after this plan shows additions only under
  `.planning/milestones/v2.2/`.
- No edits to `WARP.md`, `.warp/workflows/`, `super-gsd/scripts/`, or any
  source file. Findings that imply changes are recorded as **inputs to
  Phase 64+**, not fixed here.
- The operator can read `WARP-SMOKE.md` cold and know which Warp behaviors
  are proven, which are blocked on UI verification, and which are not
  applicable on this Windows install.

## Out Of Scope

- Implementing the missing `sgsd-token-current.yaml` `arguments:` block (→ Phase 64).
- Building `super-gsd/tools/warp-doctor/check.cjs` (→ Phase 67).
- Authoring `AGENTS.md` (→ Phase 65).
- Writing the SGSD Warp Operator Guide (→ Phase 66).
- Designing or implementing the read-only MCP server (→ Phase 68+).
- Probing VTP / private KB integration (out of v2.2 scope per operator brief).

## Risks

- The single biggest risk is unconscious overclaiming: writing PASS for an
  item that actually depends on UI inspection. Rule 14 mitigation:
  if not provable from terminal → MANUAL-CHECK-REQUIRED, full stop.
- A second risk is "audit drift": the audit collected during Phase 63 ages
  out as Warp updates. Mitigation: record the Warp version observed at
  audit time and treat the matrix as a snapshot, not a permanent contract.

## Self-Test / Smoke

- This phase produces no executable code, so the self-test is meta:
  `git status` after the close-commit must show only additions under
  `.planning/milestones/v2.2/`. Verified in `63-VERIFICATION.md`.
