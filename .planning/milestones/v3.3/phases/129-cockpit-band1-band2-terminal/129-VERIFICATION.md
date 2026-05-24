---
phase: 129
phase_name: Cockpit Bands 1+2 Terminal Layout
milestone: v3.3
ws: core
status: PASS
verdict: PASS
completed_at: 2026-05-24
sacs_total: 6
sacs_passed: 6
files_created: 1
files_modified: 2
deviations: 2
deviation_class: INFO
plan_id: P129-01-band1-band2-terminal
self_test_command: node super-gsd/tools/cockpit-sidecar/run-self-test.cjs
self_test_result: pass
self_test_count: 33/33
---

# Phase 129 — Cockpit Bands 1+2 Terminal Layout — VERIFICATION

## Summary

P129 ships the v3.3 3-band terminal layout for the cockpit sidecar (Bands 1 + 2; Band 3 deferred to P130). New `sparkline.cjs` renders inline Unicode-block (terminal) + SVG (HTML) sparklines. `renderText()` rewritten with box-drawing chrome to emit NORTH STAR + DO NEXT + ⚠ ALERT (Band 1) above the stage pipeline strip + WHY/UNLOCK/BLOCK + trend strip (Band 2). `renderBrief()` preserved at ≤4 lines. `alert-grammar.cjs` extended additively with `palette_tier` per GitHub Primer 5-tier mapping. 6 new SAC tests appended; full self-test **33/33 PASS, exit 0** (6 P125 + 7 P126 + 5 P127 + 9 P128 + 6 P129).

## Files

- `super-gsd/tools/cockpit-sidecar/sparkline.cjs` (created) — `renderAnsi(values, opts)` + `renderSvg(values, opts)`, pure CommonJS, zero deps
- `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` (modified, +117 lines) — `renderText` rewritten for 3-band Band 1+2 layout; `renderBrief` preserved
- `super-gsd/tools/cockpit-sidecar/alert-grammar.cjs` (modified, +19 lines) — additive `palette_tier` field on each alert in `result.all` and on `result.top`
- `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` (modified, +97 lines new + 6 line filter update on SAC-P126-01)

## SAC results

| SAC | Outcome | Result |
|---|---|---|
| SAC-P129-01 | renderText emits ≥3 horizontal-rule boundary lines (3-band structure) | PASS |
| SAC-P129-02 | renderText with color emits exactly 1-2 ANSI bold sequences (North Star line only) | PASS |
| SAC-P129-03 | stage pipeline strip renders ✓ for done stages + ⏳ for active stage | PASS |
| SAC-P129-04 | Band 2 trend strip renders ≥3 lines with inline Unicode-block sparklines | PASS |
| SAC-P129-05 | renderBrief output ≤4 lines; line 1 contains north_star.message; line 2 contains DO NEXT | PASS |
| SAC-P129-06 | alerts result.all + result.top carry palette_tier ∈ Primer 5-tier set; gate RED → top.palette_tier='danger' | PASS |

`node super-gsd/tools/cockpit-sidecar/run-self-test.cjs` → exit 0, 33/33 PASS. Per-SAC `--sac` filter verified for all 6 SAC-P129-NN and all pre-existing SACs.

## Invariant compliance

- **Lock-13 untouched** — `git status` confirms only the 4 declared cockpit-sidecar files modified; zero touches to `cockpit-state/*`, `tests/cockpit-acceptance/*`, `tests/cockpit-regression/*`.
- **`--json` contract additive only** — alert objects gain a `palette_tier` field; every v3.2 alert key preserved byte-shape (signal, threshold, duration, channel unchanged).
- **One loud line per band** — SAC-P129-02 enforces ≤2 ANSI bold sequences across the full render (the North Star line + its terminator).
- **`--brief` ≤ 4 lines** — SAC-P129-05 line count assertion ≤4.
- **Primer 5-tier palette** — `palette_tier` ∈ `{accent, success, attention, severe, danger, done}` enforced by SAC-P129-06.
- **Deterministic** — both new modules and the alert-grammar extension are pure functions of state.

## Deviations

**INFO-1 — Codex executor abort on first T2 dispatch.** `codex-executor.sh` returned `FILES_CHANGED: none` for T2's first attempt: "BLOCKERS: local command tool cannot start any process in this Windows sandbox: CreateProcessAsUserW failed: 216. That prevents reading the locked plan/context, safely patching exactly one file, or running SAC verification." Codex correctly refused to mutate without verification capability. Recovery routed via `codex-patch-executor.sh` (read-pack patch mode per CLAUDE.md rule 5.1): orchestrator assembled bounded read-pack (8 files), Codex returned a unified diff, the wrapper applied it. Final patch 117 insertions, T2 SACs green.

**INFO-2 — SAC-P129-05 orchestrator-relaxed; SAC-P126-01 filter extended.** Original locked SAC-P129-05 expected renderBrief line 1 to *equal* `north_star.message`. Codex correctly identified this as inconsistent with v3.2's shipped renderBrief (which emits `NORTH STAR [CODE]: message` prefix per v3.2 R04) and refused to write a failing test (empty patch first round). Orchestrator-relaxed to substring containment: line 1 contains north_star.message; line 2 contains DO NEXT (case-insensitive). Same SAC-drift recovery pattern as P128-T3 / v3.2 P121/P123/P125/P126. Separately, SAC-P126-01's "first non-border line" filter regex was extended to skip v3.3's new box-drawing header line (`┌─ NORTH STAR ─...─┐`) before checking for BLOCKED — test intent preserved; mechanical layout-awareness fix.

## Pipeline note

P129 ran a compressed Codex-execute pipeline (same as P128) using fresh-context bounded dispatches via `codex-executor.sh` and `codex-patch-executor.sh`:
- T1 (sparkline.cjs) — direct codex-executor.sh path, OS file API succeeded under shell-exec block
- T2 (renderText rewrite) — required codex-patch-executor.sh fallback (first dispatch returned `FILES_CHANGED: none`; patch-mode round trip via 8-file read-pack succeeded)
- T3 (alert palette + 6 SAC tests) — required codex-patch-executor.sh; first dispatch returned empty PATCH_BEGIN/PATCH_END due to SAC-P129-05/renderBrief inconsistency; orchestrator-corrected SAC; second dispatch succeeded
- T4 (this verification + capsule) — orchestrator-authored directly after green self-test (P128-T4 pattern; Codex correctly refused to claim PASS without precondition verification capability)

Spec-compliance verification done against raw artefacts (file content, `--json` output, self-test exit codes) — not against Codex's self-reported summaries (DLB-11 R4 discipline).

## Commit chain

| Commit | Subject |
|---|---|
| `1941ac5` | feat(v3.3): P129 CONTEXT + PLAN-LOCKED — bands 1+2 terminal layout |
| `ffe75aa` | feat(P129-T1): sparkline.cjs — renderAnsi + renderSvg (pure, zero deps) |
| `d1cacf0` | feat(P129-T2): renderText 3-band layout — Band 1 + Band 2 + sparkline trend strip |
| `4df5f07` | feat(P129-T3): alert palette_tier + SAC-P129-01..06 + SAC-P126-01 v3.3-layout filter |

## Next phase

**P130 — Band 3 Rationale Layer.** Reads the PROJECT.md core-value + active milestone INTENT.md + last completed phase SUMMARY.md cascade per DLB-03. Authors the reflective layer of the cockpit: CONTEXT, ELI5, WHAT IS, WHAT COULD BE, WHY THIS PHASE, EVIDENCE TRAIL. SUCCES self-test for the WHY panel (Simple, Unexpected, Concrete, Credible, Stories — drop Emotional). Adds `--bands=3` flag to `--text` mode (default remains 1+2 visible; Band 3 drill-in). Foundation for the localhost-live HTML cockpit (P132).
