---
phase: 125
phase_name: Cockpit Alert Grammar + North-Star Ranking
milestone: v3.2
ws: B
status: PASS
verdict: PASS
completed_at: 2026-05-22
sacs_total: 6
sacs_passed: 6
files_created: 3
files_modified: 0
deviations: 1
deviation_class: INFO
---

# Phase 125 — Cockpit Alert Grammar + North-Star Ranking — VERIFICATION

## Summary

P125 ships the two deterministic computation layers the answer-first cockpit (P126) will render: `north-star.cjs` (D2 5-rank first-match cascade) and `alert-grammar.cjs` (D3 rank-then-gate). A fresh `run-self-test.cjs` exercises all six SACs. Self-test **6/6 PASS, exit 0**. First WS-B code phase complete.

## Files

- `super-gsd/tools/cockpit-sidecar/north-star.cjs` (created) — `computeNorthStar(state)`, D2 cascade
- `super-gsd/tools/cockpit-sidecar/alert-grammar.cjs` (created) — `evaluateAlerts(state)` → `{top, others_count, all}`
- `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` (created) — SAC-P125-01..06, full-suite + `--sac` filter

## SAC results

| SAC | Outcome | Result |
|---|---|---|
| SAC-P125-01 | gate RED + high fog → rank 1 BLOCKED (first-match) | PASS |
| SAC-P125-02 | verdict BROKEN_CITATION → rank 2 CHRONICLE_FAILED | PASS |
| SAC-P125-03 | healthy state → rank 5 ON_TRACK | PASS |
| SAC-P125-04 | 3 alerts fire → one top + others_count=2 | PASS |
| SAC-P125-05 | only benign warning → top=null | PASS |
| SAC-P125-06 | fog>70 no prior context → fog alert does not fire | PASS |

`node super-gsd/tools/cockpit-sidecar/run-self-test.cjs` → exit 0, 6/6 PASS. Per-SAC `--sac` filter verified; unknown `--sac` exits 1.

## Invariant compliance

- **Lock-13 untouched** — `git status` shows only the 3 new files under `cockpit-sidecar/`; zero touches to `cockpit-state/*`, `tests/cockpit-acceptance/*`, `tests/cockpit-regression/*`.
- **`cockpit-sidecar.cjs` + `fog-score.cjs` unmodified** — confirmed not in the git diff.
- **Deterministic** — both modules are pure functions of `state`; no LLM, no network, no mutation, no side effects.
- **`--json` contract frozen** — `cockpit-sidecar.cjs` not wired this phase (P126).

## Deviations

**INFO-1 — Executor report misnarrated the result.** The Codex executor ran in patch-fallback mode and its report said `FILES_CHANGED: none` / "read-pack already contains the implementations." This was inaccurate — the 3 files were in fact written (workspace-write) with correct, spec-faithful content (mtime 14:28, fresh). Ground truth was verified independently: `git status` shows 3 new untracked files, the self-test runs 6/6 PASS exit 0, and the orchestrator spec-compliance review confirmed D2/D3 fidelity by reading the source. The misleading self-report did not affect the outcome — verification was done against artifacts, not the report (DLB-11 R4 discipline).

## Pipeline note

P125 ran a compressed pipeline: the design was already research-locked in 124-COCKPIT-DESIGN-SPEC.md, so a separate research dispatch was skipped; the orchestrator corrected SAC drift in the Codex-authored plan (generalized tautologies → verbatim CONTEXT input/output SACs) in place of a separate plan-check round. Execution and code authoring routed through Codex per the provider lock; spec-compliance review and verification done against raw artifacts.

## Next phase

P126 — Cockpit answer-first surface. Evolves `cockpit-sidecar.cjs`: wire `computeNorthStar` + `evaluateAlerts` into a rebuilt `renderText()` (D4 layout) + a `--brief` mode + the `--html` snapshot consuming the P120 shared design system.

## Provenance

Codex executor (patch-fallback mode, Windows read-block). Self-test 6/6 PASS exit 0. Orchestrator spec-compliance review against raw source.
