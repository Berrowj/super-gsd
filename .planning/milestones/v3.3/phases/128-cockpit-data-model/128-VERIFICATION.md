---
phase: 128
phase_name: Cockpit Stage-Pipeline Data Model
milestone: v3.3
ws: core
status: PASS
verdict: PASS
completed_at: 2026-05-24
sacs_total: 9
sacs_passed: 9
files_created: 1
files_modified: 2
deviations: 1
deviation_class: INFO
plan_id: P128-01-stage-pipeline
self_test_command: node super-gsd/tools/cockpit-sidecar/run-self-test.cjs
self_test_result: pass
---

# Phase 128 — Cockpit Stage-Pipeline Data Model — VERIFICATION

## Summary

P128 ships the foundation data structure for v3.3's live contextual awareness cockpit: a deterministic 5-stage pipeline (research → vtp-enrich → plan → execute → verify) appended additively to `cockpit-sidecar.cjs --json` output. New `stage-pipeline.cjs` module exports `STAGES` (frozen 5-entry array) and `computeStagePipeline()` (pure function over phase_dir + vtp_enabled toggle + blocker hint). Wired into `cockpit-sidecar.cjs` via `attachStagePipeline` helper. Nine SAC tests appended to `run-self-test.cjs` covering shape, detection, vtp-skip, blocker handling, additive contract preservation, JSON round-trip, and renderer non-crash. Self-test **27/27 PASS, exit 0** (9 new P128 + 6 P125 + 7 P126 + 5 P127). First v3.3 code phase complete; downstream P129-P132 unblocked.

## Files

- `super-gsd/tools/cockpit-sidecar/stage-pipeline.cjs` (created) — `STAGES` + `computeStagePipeline()` + `stageArtifactPresent()`
- `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` (modified, additive) — require stage-pipeline, `attachStagePipeline()` helper, invoked in `run()` after `evaluateAlerts()`, exported alongside renderers
- `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` (modified, pure append) — SAC-P128-01..09 plus `makeFakePhaseDir()` test helper

## SAC results

| SAC | Outcome | Result |
|---|---|---|
| SAC-P128-01 | STAGES frozen 5-entry array, locked name order, field types correct | PASS |
| SAC-P128-02 | computeStagePipeline exported as function | PASS |
| SAC-P128-03 | phase_dir w/ only RESEARCH.md, vtp_enabled=true → research done, vtp-enrich active, active_index=1 | PASS |
| SAC-P128-04 | vtp_enabled=false → vtp-enrich auto-skipped (done), plan active | PASS |
| SAC-P128-05 | blocker='codex_read_216' → active stage flips to 'blocked', blocker preserved | PASS |
| SAC-P128-06 | attachStagePipeline(sample, opts) → output.stage_pipeline present, 5-entry stages array | PASS |
| SAC-P128-07 | every v3.2 --json key preserved byte-shape after attach | PASS |
| SAC-P128-08 | JSON round-trip preserves stage_pipeline; stages.length === 5 | PASS |
| SAC-P128-09 | renderText / renderHtml / renderBrief don't throw on new key | PASS |

`node super-gsd/tools/cockpit-sidecar/run-self-test.cjs` → exit 0, 27/27 PASS (9 new + 18 pre-existing). Per-SAC `--sac` filter verified for all 9 SAC-P128-NN.

## Invariant compliance

- **Lock-13 untouched** — `git status` confirms only the 3 declared cockpit-sidecar files modified; zero touches to `cockpit-state/*`, `tests/cockpit-acceptance/*`, `tests/cockpit-regression/*`.
- **`--json` contract additive only** — all v3.2 keys (milestone, phase, generated_at, latest_chronicle, binding_gate_status, fog_score, recent_chronicles, signals, warnings, north_star, alerts) preserved byte-shape per SAC-P128-07.
- **Deterministic** — `computeStagePipeline` is a pure function; no LLM call, no network, no mutation of input, no side effects beyond `fs.readdirSync(phase_dir)`.
- **5 stages, not 6** — operator decision Q-D applied verbatim: `research → vtp-enrich → plan → execute → verify`. CONTEXT.md is a precondition of the pipeline, not a stage.
- **vtp-enrich toggle aware** — `vtp_enabled === false` auto-marks the stage `done`, skipped not blocked (per spec).

## Deviations

**INFO-1 — Codex executor SAC drift on SAC-P128-01.** During T3 execution, Codex authored the SAC-P128-01 test with two deviations from the locked CONTEXT.md spec: (a) expected stage names `['research','vtp_enrichment',...]` (added `-ment` suffix + applied a lowercase+hyphen-to-underscore transform that doesn't exist in STAGES), (b) checked a nonexistent `stage.label` field instead of the locked `name+owner+sla_minutes+artifact_glob`. Orchestrator-corrected in-loop to match the verbatim CONTEXT.md SAC-P128-01 input/expected_outcome. Same SAC-drift pattern observed in v3.2 P121/P123/P125/P126 (per v3.2 SUMMARY rules learned). Final test verbatim against locked spec; full suite green.

## Pipeline note

P128 ran a compressed Codex-execute pipeline: research + plan were authored at milestone-scoping time (via `superpowers:brainstorming` + `superpowers:writing-plans` + `sgsd-write-plan` against the validated `plan-schema-v2`), so per-phase research/plan dispatches were skipped. Each task T1-T4 dispatched via `codex-executor.sh` with a fresh-context bounded prompt. Three of four Codex dispatches hit Windows `CreateProcessAsUserW failed: 216` shell-exec block but completed file writes via the OS file API (T1, T2, T3); T4 correctly refused to claim verdict=PASS without being able to run the precondition self-test, and the orchestrator authored the phase-close artefacts directly after verifying green self-test (this VERIFICATION.md and PHASE-CAPSULE.json). Spec-compliance verification done against raw artefacts (file content, `--json` output, self-test exit codes) — not against Codex's self-reported summaries (DLB-11 R4 discipline).

## Commit chain

| Commit | Subject |
|---|---|
| `d8ebaf4` | feat(P128): PLAN-LOCKED — stage-pipeline data model (4 tasks, 9 SACs, validate ✓) |
| `339d137` | feat(P128-T1): stage-pipeline.cjs — 5 frozen STAGES + computeStagePipeline |
| `249597d` | feat(P128-T2): additive --json stage_pipeline key + attachStagePipeline export |
| `543d921` | test(P128-T3): SAC-P128-01..09 + orchestrator SAC-drift correction |

## Next phase

**P129 — Bands 1+2 Terminal Layout.** Rebuilds `renderText()` + `renderBrief()` in `cockpit-sidecar.cjs` to emit the 3-band layout consuming the new `stage_pipeline` key. Adds inline ANSI sparklines for `fog_score` / `dispatch_count` / `token_spend`. Aligns alert palette to GitHub Primer 5-tier (`accent / success / attention / severe / danger / done`). Foundation for the localhost-live HTML cockpit (P132).
