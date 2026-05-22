---
phase: 126
phase_name: Cockpit Answer-First Surface
milestone: v3.2
ws: B
status: PASS
verdict: PASS
completed_at: 2026-05-22
sacs_total: 7
sacs_passed: 7
self_test_total: 13
self_test_passed: 13
files_created: 0
files_modified: 2
deviations: 0
---

# Phase 126 — Cockpit Answer-First Surface — VERIFICATION

## Summary

P126 evolves `cockpit-sidecar.cjs` into the D4 answer-first cockpit: a North-Star banner first, one DO-NEXT action, exactly one preattentive alert (`+N more`), a demoted supporting block. Added `--brief` and `--html` modes; wired in the P125 modules. Cumulative cockpit self-test **13/13 PASS** (SAC-P125-01..06 + SAC-P126-01..07), exit 0 — zero regression.

## Files

- `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` (modified) — North-Star/alert wiring, `renderText` rebuilt to D4, `renderBrief` + `renderHtml` added, `--brief`/`--html` formats, `recommendedAction` map, additive `north_star`+`alerts` `--json` keys, additive exports
- `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` (modified) — pure append of SAC-P126-01..07

## SAC results

| SAC | Outcome | Result |
|---|---|---|
| SAC-P126-01 | `--text` with gate RED → first non-border line is the North Star, reads BLOCKED | PASS |
| SAC-P126-02 | 3 alerts fire → exactly one alert line, annotated `(+2 more)` | PASS |
| SAC-P126-03 | `--brief` → ≤ 4 lines | PASS |
| SAC-P126-04 | `--json` → all 9 pre-P126 keys unchanged + `north_star` + `alerts` added | PASS |
| SAC-P126-05 | `--html` → self-contained, design-system marker present, zero external URLs | PASS |
| SAC-P126-06 | non-TTY `--text` → no raw ANSI escape sequences | PASS |
| SAC-P126-07 | full suite — zero regression keystone | PASS |

`node super-gsd/tools/cockpit-sidecar/run-self-test.cjs` → exit 0, 13/13 PASS.

## Functional probe (live repo state)

- `--brief` → 3 lines: `NORTH STAR [HEAVY_PHASE]` / `▸ DO NEXT` / `⚠ warnings`.
- `--text` → North Star first, DO-NEXT, alert, then a demoted `SUPPORTING` block.
- `--json` → keys `milestone,phase,generated_at,latest_chronicle,binding_gate_status,fog_score,recent_chronicles,signals,warnings` (all pre-P126, unchanged) + `north_star` + `alerts`.
- `--html` → 9,294 bytes, contains `role="operator-decision"`, zero `http(s)://` URLs.

## Invariant compliance

- **Lock-13 untouched** — `git status` shows only the 2 `cockpit-sidecar/` files modified; zero touches to `cockpit-state/*`, `tests/cockpit-acceptance/*`, `tests/cockpit-regression/*`.
- **`--json` existing keys frozen** — all 9 historical keys retain name/position; `north_star`+`alerts` additive only.
- **Answer-first + preattentive** — North Star leads; exactly one alert shown; supporting block demoted not deleted.
- **Colour discipline** — ANSI only on the North-Star + alert lines and only under a TTY; SAC-P126-06 confirms no escape codes in piped output.
- **Offline-survivable** — `--html` inlines `sgsd-design-system.css`; no external dependency.

## Note

`alert-grammar.cjs`'s benign-warning filter intentionally does NOT suppress `executor_log_parse_error` warnings — a corrupt executor log is a genuine signal, so the cockpit surfaces it as the top alert. Correct behaviour, not a defect.

## Pipeline note

Codex planning dispatch was blocked by the Windows Codex read failure (`CreateProcessAsUserW 216`); per the blocker-recovery routing policy the orchestrator authored the PLAN-LOCKED doc (a mechanical translation of the already-locked 124-COCKPIT-DESIGN-SPEC.md D4 + 126-CONTEXT.md — no design judgement). All code was authored by the Codex executor (full-file emission in-report, applied by the orchestrator) and verified against artifacts.

## Next phase

P127 — Cockpit integration + cross-surface conformance. Wire `conformance-check.cjs --surface cockpit` over the `--html` snapshot; cross-surface self-test asserting both chronicle and cockpit obey the shared 12 rules. Final WS-B phase.

## Provenance

Codex executor (full-file in-report emission, Windows read-block). Cockpit self-test 13/13 PASS exit 0. Orchestrator spec-compliance review + 4-mode functional probe against raw artifacts.
