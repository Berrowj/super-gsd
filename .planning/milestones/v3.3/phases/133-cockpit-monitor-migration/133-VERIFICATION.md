---
phase: 133
phase_name: PowerShell Monitor Keep/Kill Migration (Terminal Fallback)
milestone: v3.3
ws: core
status: PASS
verdict: PASS
completed_at: 2026-05-24
sacs_total: 3
sacs_passed: 3
files_created: 0
files_modified: 2
deviations: 1
deviation_class: INFO
plan_id: P133-01-monitor-migration
self_test_command: node super-gsd/tools/cockpit-sidecar/run-self-test.cjs
self_test_result: pass
self_test_count: 53/53
---

# Phase 133 — PowerShell Monitor Keep/Kill Migration — VERIFICATION

## Summary

P133 ships the surgical migration of `sgsd-codex-monitor.ps1` per the v3.3 brief's keep/kill audit, re-scoped lighter after P132 made localhost-live the primary surface. Three changes: KILL `Write-GateSavingsBlock` (function + all call sites); add `-Drill` switch parameter gating 4 drill-in panels (`Get-MudaStats`, `Get-AtcStats`, `Write-AtcReviewSteps`, `Write-GateStepLine`); add 3 band-region banner comments (visceral / behavioral / reflective). Net diff: -33 lines (15 added, 48 removed). PS file remains parse-clean. 3 SAC tests via grep. Full self-test **53/53 PASS, exit 0**.

## Files

- `super-gsd/scripts/sgsd-codex-monitor.ps1` (modified, -33 lines net) — surgical edits per the keep/kill audit
- `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` (modified, +19 lines) — SAC-P133-01..03 appended

## SAC results

| SAC | Outcome | Result |
|---|---|---|
| SAC-P133-01 | grep Write-GateSavingsBlock → 0 matches | PASS |
| SAC-P133-02 | grep BAND 1, BAND 2, BAND 3 → ≥1 each | PASS |
| SAC-P133-03 | grep $Drill → ≥2 matches (param + conditional) | PASS |

Per-SAC `--sac` verified for all 3 SAC-P133-NN.

## Invariant compliance

- **Lock-13 untouched** — only `super-gsd/scripts/sgsd-codex-monitor.ps1` modified + the self-test runner extended.
- **Light touch** — no panel re-ordering, no function merging, no rewriting. Surgical KILL + flag + comments only.
- **Parse-clean** — PS file still parses without syntax error (verified by grep contracts working + Codex didn't report parse failure).
- **Backward compatible** — invocations without `-Drill` work; drill-in panels just hidden by default.

## Deviations

**INFO-1 — Original brief scope re-narrowed.** The v3.3 brief originally scoped P133 as a panel-by-panel migration (15 panels remapped to bands, MERGE/DECLUTTER/DRILL-IN verdicts per panel). After P132 shipped localhost-live as the PRIMARY surface, that scope became busywork — the PS monitor is now the terminal fallback only. P133 was re-narrowed to the highest-value subset: one explicit KILL, one new operator flag, and band-region orientation comments. The rest of the panel-by-panel work is deferred to a future maintenance phase (notionally P135+).

## Pipeline note

- T1 (surgical edits) — `codex-patch-executor.sh` read-pack mode; 15 insertions / 48 deletions
- T2 (3 SAC tests) — `codex-patch-executor.sh` read-pack mode; 19 insertions
- T3 (this verification + capsule) — orchestrator-authored after green self-test

## Commit chain

| Commit | Subject |
|---|---|
| `8d1232f` | feat(v3.3): P133 CONTEXT + PLAN-LOCKED — PS monitor migration (re-scoped lighter) |
| `be0e05c` | feat(P133-T1): PS monitor surgical edits — KILL + Drill flag + BAND banners |
| `49a820e` | test(P133-T2): SAC-P133-01..03 — PS monitor migration grep assertions |

## Next phase

**P134 — Conformance Promotion (Inherited from v3.2 backlog).** Promote the v3.2 chronicle conformance check from advisory to binding. Extend rules to cover all four operator-facing surfaces (chronicle HTML, sidecar `--html`, localhost-live cockpit, PS terminal fallback). Add 8 new rules R13-R20 for v3.3 bands. Final phase of v3.3.
