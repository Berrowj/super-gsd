---
schema: plan-schema-v2
status: PLAN-LOCKED
plan_id: P126-01-cockpit-answer-first-surface
phase_id: 126-cockpit-answer-first-surface
phase_number: 126
milestone: v3.2
workstream: WS-B
title: Cockpit Answer-First Surface
created_by: SGSD Orchestrator (Codex planning dispatch blocked by Windows read failure CreateProcessAsUserW 216; plan is a mechanical translation of the LOCKED 124-COCKPIT-DESIGN-SPEC.md D4 + 126-CONTEXT.md — no design judgement added; all code authoring routes through Codex)
created_at: 2026-05-22
locked: true
---

# P126-01 Cockpit Answer-First Surface PLAN

## Scope

Evolve `cockpit-sidecar.cjs` from a flat 14-line text dump into the D4 answer-first cockpit: a North-Star banner first, one DO-NEXT action, exactly one preattentive alert, a demoted supporting block. Wire in the P125 modules (`north-star.cjs`, `alert-grammar.cjs`). Add `--brief` and `--html` modes. Extend the self-test by pure append. The `--json` existing keys stay byte-stable; `north_star` + `alerts` are added as additive keys.

## Authoritative Inputs

- `.planning/milestones/v3.2/phases/126-cockpit-answer-first-surface/126-CONTEXT.md`
- `.planning/milestones/v3.2/phases/124-cockpit-research-design/124-COCKPIT-DESIGN-SPEC.md` (D4, D6)
- `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs`
- `super-gsd/tools/cockpit-sidecar/north-star.cjs`, `alert-grammar.cjs`, `run-self-test.cjs`
- `super-gsd/tools/shared/sgsd-design-system.css`
- `super-gsd/templates/plan-schema-v2.json`, `super-gsd/schemas/plan-locked.schema.json`

## Binding Invariants

- Lock-13 untouched: implementation scope limited to `super-gsd/tools/cockpit-sidecar/`. Zero touches to `cockpit-state/*`, `tests/cockpit-acceptance/*`, `tests/cockpit-regression/*`.
- Every EXISTING `--json` key keeps name, position and meaning. `north_star` and `alerts` are added as NEW additive top-level keys only.
- `renderText()` leads with the North Star (R01); supporting state is demoted, not deleted (R07).
- Exactly one DO-NEXT action (R04); exactly one alert shown, the rest counted `+N more` (C1).
- In `--text`, only the North-Star line and the alert line carry ANSI colour (C2); when stdout is not a TTY, output contains no raw ANSI escape sequences.
- `--html` snapshot inlines `sgsd-design-system.css`; zero external http(s) URLs (offline-survivable).
- Deterministic: no new dependency, no network. `north-star.cjs` / `alert-grammar.cjs` / `fog-score.cjs` logic is consumed, not modified.

## File Operations

| Operation | Path | Purpose |
| --- | --- | --- |
| MODIFY | `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` | Wire in P125 modules; add `north_star`+`alerts` additive `--json` keys; replace `renderText()` with the D4 block; add `--brief` and `--html` modes; render-layer DO-NEXT action map. |
| MODIFY | `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` | PURE APPEND of SAC-P126-01..07; the existing SAC-P125-01..06 assertions are not touched or reordered. |

## Tasks

### P126-T1: Evolve `cockpit-sidecar.cjs`

- `require('./north-star.cjs')` + `require('./alert-grammar.cjs')`.
- After the existing `output` object is assembled in `run()`, compute `north_star = computeNorthStar(output)` and `alerts = evaluateAlerts(output)` and add both as new keys on the `--json` output object (additive — no existing key renamed, removed or reordered).
- Replace `renderText()` with the D4 answer-first block: a `NORTH STAR` banner showing `north_star.message`; a `▸ DO NEXT:` line; a `⚠` alert line showing the top alert + `(+N more)` when `others_count > 0` (omit the `⚠` line entirely when `alerts.top` is null); then a demoted supporting block (milestone/phase/progress, gate/fog/dispatches, latest chronicle path).
- DO-NEXT action: a render-layer deterministic map from `north_star.code` — `BLOCKED`→"resolve the binding gate before close"; `CHRONICLE_FAILED`→"fix the chronicle citation, re-validate"; `NEEDS_OPERATOR`→"operator decision required — see blockers"; `HEAVY_PHASE`→"read the must-read chronicle sections"; `ON_TRACK`→"continue — advance to the next phase".
- `parseArgs`: add `--brief` and `--html` as recognised flags alongside `--json`/`--text`.
- `--brief`: print only the North-Star line, the DO-NEXT line, and the alert line (≤ 4 lines total).
- `--html`: emit a self-contained HTML snapshot that inlines the contents of `super-gsd/tools/shared/sgsd-design-system.css` inside a `<style>` block and renders the same answer-first content using the shared system's `[role="operator-decision"]`, `.callout`, `details` classes. No external URL.
- ANSI colour: apply colour to the North-Star and alert lines only, and only when `process.stdout.isTTY` is true; otherwise emit plain text.

Acceptance:

- `--json` output contains every pre-P126 key unchanged, plus `north_star` and `alerts`.
- `--text` first non-border line is the North Star.
- Exactly one alert line renders even when multiple alerts fire; `(+N more)` reflects `others_count`.
- `--brief` is ≤ 4 lines.
- `--html` is self-contained, carries the shared-design-system marker, has zero external http(s) URLs.
- Piped (non-TTY) `--text` carries no raw ANSI escape sequences.
- Covered by SAC-P126-01 through SAC-P126-06.

### P126-T2: Extend `run-self-test.cjs` (pure append)

- Append assertions SAC-P126-01..07 to the existing `tests` array. Do not modify or reorder the SAC-P125 entries.
- New assertions exercise `cockpit-sidecar.cjs` via `child_process` (running the CLI) or by requiring and calling `run()` with fixture option objects — the runner already owns the `--sac` filter and unknown-`--sac` exit-1 behaviour.
- SAC-P126-07 asserts the full suite (SAC-P125-01..06 + SAC-P126-01..06) all pass — the zero-regression keystone.

Acceptance:

- `node super-gsd/tools/cockpit-sidecar/run-self-test.cjs` exits 0 with SAC-P125-01..06 + SAC-P126-01..07 all PASS.
- Per-SAC `--sac SAC-P126-NN` runs only that assertion.

## Semantic Acceptance Criteria

Bound to `126-CONTEXT.md`; the self-test runner implements them verbatim.

| ID | Input | Expected outcome | Verification Command |
| --- | --- | --- | --- |
| SAC-P126-01 | `cockpit-sidecar --text` on a fixture with `binding_gate` RED | the first non-border line of output is the North Star and reads BLOCKED | `node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P126-01` |
| SAC-P126-02 | `cockpit-sidecar --text` on a fixture where 3 alerts fire | exactly one alert line is rendered, annotated `(+2 more)` | `node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P126-02` |
| SAC-P126-03 | `cockpit-sidecar --brief` on any fixture | output is at most 4 lines — North Star, DO NEXT, one alert | `node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P126-03` |
| SAC-P126-04 | `cockpit-sidecar --json` on a fixture | every pre-P126 key is still present and unchanged; `north_star` and `alerts` keys are added | `node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P126-04` |
| SAC-P126-05 | `cockpit-sidecar --html` on a fixture | self-contained HTML containing the shared-design-system marker, zero external http(s) URLs | `node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P126-05` |
| SAC-P126-06 | `cockpit-sidecar --text` piped (stdout not a TTY) | output contains no raw ANSI escape sequences | `node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P126-06` |
| SAC-P126-07 | full cockpit-sidecar self-test | SAC-P125-01..06 still pass + SAC-P126 additions — zero regression | `node super-gsd/tools/cockpit-sidecar/run-self-test.cjs` |

## Phase Verification

```
node super-gsd/tools/cockpit-sidecar/run-self-test.cjs
```

Expected: exit 0; SAC-P125-01..06 + SAC-P126-01..07 all PASS; only the 2 declared files changed.

## Out Of Scope

- Cross-surface conformance test + `conformance-check.cjs` cockpit wiring — P127.
- Any change to `north-star.cjs` / `alert-grammar.cjs` D2/D3 logic, or to `fog-score.cjs`.
- Renaming, removing or reordering any existing `--json` key.
- Touching anything outside `super-gsd/tools/cockpit-sidecar/`.
