---
schema_version: 2
schema: plan-schema-v2
status: PLAN-LOCKED
plan_id: P129-01-band1-band2-terminal
phase_id: 129-cockpit-band1-band2-terminal
phase_number: 129
milestone: v3.3
workstream: core
title: Cockpit Bands 1+2 Terminal Layout
created_by: sgsd-write-plan (operator + Claude Opus 4.7)
created_at: 2026-05-24
locked: true
expected_ATC_tier: LITE
skip_gates: []
depends_on:
  - P128-01-stage-pipeline
tasks:
  - id: P129-T1
    agent: sgsd-exec-backend
    model: codex
    files_touched:
      - super-gsd/tools/cockpit-sidecar/sparkline.cjs
    input_contract: |-
      Reads 129-CONTEXT.md for the renderAnsi/renderSvg contract: pure functions
      over a number array, optional width + color opts, graceful empty/null input
      handling. No source dependencies beyond Node built-ins.
    output_contract: |-
      Creates super-gsd/tools/cockpit-sidecar/sparkline.cjs (CommonJS, zero deps)
      exporting:
        - renderAnsi(values, opts): returns a string of Unicode block characters
          (▁▂▃▄▅▆▇█) of width opts.width (default 16). Optional opts.color is an
          ANSI color escape (e.g. '\x1b[33m'); when provided, wraps output with
          the color and reset.
        - renderSvg(values, opts): returns a string containing a single inline
          <svg> element with width=opts.width (default 110) height=opts.height
          (default 24) and a <polyline> path drawn from the normalized values.
          opts.color sets stroke (default 'currentColor').
      Both pure; no I/O; no side effects.
    hypothesis: |-
      Unicode block characters give terminal sparklines at zero extra space cost
      (1 char per sample); SVG polyline gives HTML surfaces equivalent visual
      density. Normalizing values to the block-char count or the height pixels
      is sufficient; we do NOT need axes, labels, or interpolation.
    falsifier: |-
      If a sparkline renders wider than opts.width OR an SVG polyline contains
      NaN coordinates from a zero-range values array, the visual contract is
      broken. Mitigation: handle the constant-array edge case by returning
      mid-range characters / mid-height SVG line.
    stop_rule: |-
      File exists at the declared path; require(...) returns {renderAnsi,
      renderSvg}; both are functions; renderAnsi([1,2,3,4,5,6,7,8]) returns
      string of length 16 by default; renderSvg([1,2,3]) returns a string
      starting with '<svg' and ending with '</svg>'.

  - id: P129-T2
    agent: sgsd-exec-backend
    model: codex
    files_touched:
      - super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs
    input_contract: |-
      Reads existing cockpit-sidecar.cjs (post-P128 with attachStagePipeline +
      stage_pipeline JSON key). Requires P129-T1 sparkline.cjs to exist.
      Consumes stage_pipeline.stages[].status from P128.
    output_contract: |-
      Rewrites renderText(output, opts) to emit the 3-band terminal layout per
      129-CONTEXT.md "What ships" section: Band 1 (NORTH STAR + DO NEXT + one
      alert), Band 2 (stage pipeline strip + WHY-RUNNING + UNLOCKS + BLOCKED-BY
      + trend strip with 3 sparklines). Preserves renderBrief() at ≤4 lines.
      renderHtml() unchanged (P132 handles HTML primary surface).
      Uses Unicode characters ✓ ⏳ for stage status. Box-drawing characters for
      band separators. ANSI colour only on the North Star line and the one
      alert (single-loud-line rule). Empty/missing fields render gracefully.
    hypothesis: |-
      The 3-band layout is renderable as plain ANSI text given the v3.2
      box-drawing toolkit (──, │, ├, ┤, ┌, ┐, └, ┘). Stage pipeline + sparkline
      strip can fit in ≤80 chars wide. Operator reads top-to-bottom; one loud
      line per band keeps Krug visual-hierarchy contract.
    falsifier: |-
      If renderText output exceeds 80 chars per line, terminal wrap breaks
      the band structure. If more than one element per band carries ANSI bold
      (the one-loud-line rule), Krug contract is violated. Both observable
      via SAC-P129-01/02.
    stop_rule: |-
      renderText output passes SAC-P129-01 (3 distinct sections), SAC-P129-02
      (exactly one bold ANSI sequence per band), SAC-P129-03 (stage strip
      renders with correct status indicators), SAC-P129-04 (trend strip
      renders 3 sparkline lines). renderBrief ≤ 4 lines verified by line count.

  - id: P129-T3
    agent: sgsd-exec-test
    model: codex
    files_touched:
      - super-gsd/tools/cockpit-sidecar/alert-grammar.cjs
      - super-gsd/tools/cockpit-sidecar/run-self-test.cjs
    input_contract: |-
      Reads existing alert-grammar.cjs (post-v3.2 with evaluateAlerts()). Reads
      run-self-test.cjs (post-P128 with SAC-P128 tests appended). Requires P129-T2
      (renderText 3-band layout exists and runnable). Reads 129-CONTEXT.md SAC
      block verbatim.
    output_contract: |-
      MODIFY alert-grammar.cjs: in evaluateAlerts(), add a deterministic
      palette_tier field on each alert entry in the all[] array AND on top
      (when top is non-null). Mapping per 129-CONTEXT.md: gate RED → danger;
      validator not GROUNDED → danger; fog>70 sustained → severe; dispatch>12
      → attention; stale warnings → attention; default → accent. Tier value
      ∈ {accent, success, attention, severe, danger, done}.
      EXTEND run-self-test.cjs (pure append): SAC-P129-01..06 verbatim against
      129-CONTEXT.md inputs and expected_outcome rows.
    hypothesis: |-
      Adding palette_tier is purely additive (no v3.2 alert key removed). The
      mapping is deterministic and matches Primer's 6-tier (effectively 5 used
      tiers + 'done' for archival). renderText/renderHtml ignore the new field
      until they consume it (T2 consumes it on the alert line).
    falsifier: |-
      If any v3.2 alert key changes byte-shape (e.g. signal, threshold,
      duration, channel) the additive contract is broken. If any alert in
      all[] lacks palette_tier post-T3, SAC-P129-06 fails.
    stop_rule: |-
      `node super-gsd/tools/cockpit-sidecar/run-self-test.cjs` exits 0 with
      SAC-P129-01..06 passing AND all pre-existing SACs still green. Per-SAC
      invocation green for each SAC-P129-NN.

  - id: P129-T4
    agent: sgsd-exec-docs
    model: codex
    files_touched:
      - .planning/milestones/v3.3/phases/129-cockpit-band1-band2-terminal/129-VERIFICATION.md
      - .planning/milestones/v3.3/phases/129-cockpit-band1-band2-terminal/PHASE-CAPSULE.json
    input_contract: |-
      Reads .planning/milestones/v3.3/phases/128-cockpit-data-model/
      128-VERIFICATION.md and PHASE-CAPSULE.json as gold-reference shapes for
      v3.3 phase-close artefacts. Reads green output of run-self-test.cjs after
      T1-T3. Reads `git log` for P129 commit chain since P128 close.
    output_contract: |-
      Creates 129-VERIFICATION.md (frontmatter verdict=PASS, sacs_total=6,
      sacs_passed=6, files_created/_modified counts, deviations enumerated).
      Body section table for SAC-P129-01..06; invariant compliance block;
      commit chain; next phase pointer to P130 (Band 3 rationale).
      Creates PHASE-CAPSULE.json mirroring P128 shape with all source_hashes
      computed (SHA-256 of CONTEXT.md, PLAN-LOCKED.md, VERIFICATION.md).
    hypothesis: |-
      Phase-close artefacts are deterministic projections of green self-test +
      git log + file content hashes. Same authoring path as P128 T4 (which the
      orchestrator authored after Codex aborted under shell-exec block).
    falsifier: |-
      If self-test is not green at T4 start, verdict cannot be PASS. If any
      commit in the source_commits list lacks the correct SHA, the capsule's
      lineage is broken.
    stop_rule: |-
      Both files exist at canonical paths; 129-VERIFICATION.md has
      verdict: PASS; PHASE-CAPSULE.json is valid JSON; self-test confirmed
      green before write.
    depends_on:
      - P129-T1
      - P129-T2
      - P129-T3
semantic_acceptance_criteria:
  - id: SAC-P129-01
    input: "cockpit-sidecar --text against a synthesized green-state output (north_star.code=ON_TRACK, stage_pipeline present, fog=10, no alerts)"
    expected_outcome: "rendered text contains 3 visually-distinct horizontal-line section boundaries; Band 1 heading and Band 2 heading present"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P129-01"
  - id: SAC-P129-02
    input: "renderText output with one alert and color enabled"
    expected_outcome: "exactly one ANSI bold sequence in Band 1 (North Star line); no other line carries bold; alert line is palette-coloured per tier"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P129-02"
  - id: SAC-P129-03
    input: "renderText output for state with stage_pipeline.active_index=2 (plan active), earlier stages done"
    expected_outcome: "stage pipeline strip renders 5 cells with ✓ on done stages, ⏳ on active stage at index 2, no indicator on pending stages 3-4"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P129-03"
  - id: SAC-P129-04
    input: "renderText output with signals.fog_score=38, signals.dispatch_count=7, signals.token_spend=2400000"
    expected_outcome: "Band 2 trend strip renders 3 lines (fog, dispatches, tokens) with inline Unicode-block sparkline ≤16 chars each + current value column"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P129-04"
  - id: SAC-P129-05
    input: "renderBrief output for any state"
    expected_outcome: "line count ≤4; line 1 is north_star.message; line 2 starts with 'DO NEXT:'; if line 3 exists it is an alert; no Band 2 content"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P129-05"
  - id: SAC-P129-06
    input: "evaluateAlerts state with binding_gate_status=RED, fog_score.score=85, signals.dispatch_count=15 (multiple alert candidates)"
    expected_outcome: "every alert in result.all carries palette_tier ∈ {accent, success, attention, severe, danger, done}; result.top.palette_tier matches its signal type per locked mapping (gate RED → danger)"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P129-06"
---

# P129-01 Cockpit Bands 1+2 Terminal Layout PLAN

## Scope

Rebuild `renderText()` and `renderBrief()` in `cockpit-sidecar.cjs` to emit the v3.3 3-band terminal layout (Band 1 + Band 2 only; Band 3 deferred to P130). Add `sparkline.cjs` for inline Unicode-block (terminal) and SVG (HTML) sparkline rendering. Add `palette_tier` field on each alert per the GitHub Primer 5-tier mapping. Append SAC-P129-01..06 to the self-test runner. Zero changes to `--json` shape beyond the additive `palette_tier` field.

## Authoritative Inputs

- `.planning/milestones/v3.3/phases/129-cockpit-band1-band2-terminal/129-CONTEXT.md`
- `.planning/milestones/v3.3/phases/128-cockpit-data-model/128-01-stage-pipeline-PLAN-LOCKED.md` (predecessor; `stage_pipeline` JSON contract)
- `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` (post-P128 byte-stable)
- `super-gsd/tools/cockpit-sidecar/alert-grammar.cjs` (post-v3.2)
- `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` (post-P128, 27 SACs green)
- v3.3 brief design principles P5+P7+P17 (Tufte sparklines + Krug one-loud + Primer 5-tier)

## Binding Invariants (from 129-CONTEXT.md)

1. **Deterministic.** No LLM in render path.
2. **Lock-13 untouched.** All edits within `super-gsd/tools/cockpit-sidecar/`.
3. **`--json` contract additive only.** P129 adds `palette_tier` on each alert; everything else unchanged.
4. **One loud line per band.** Krug + v3.2 R04 enforced per SAC-P129-02.
5. **`--brief` ≤ 4 lines.** Sullivan ≤10-words; enforced per SAC-P129-05.
6. **Primer 5-tier palette.** alert.palette_tier ∈ {accent, success, attention, severe, danger, done}; ≤5 colour codes total.

## File Operations

| Operation | Path | Purpose |
|---|---|---|
| CREATE | `super-gsd/tools/cockpit-sidecar/sparkline.cjs` | renderAnsi + renderSvg (T1) |
| MODIFY | `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` | rewrite renderText 3-band, preserve renderBrief (T2) |
| MODIFY | `super-gsd/tools/cockpit-sidecar/alert-grammar.cjs` | additive palette_tier (T3 part 1) |
| EXTEND | `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` | SAC-P129-01..06 (T3 part 2; pure append) |
| CREATE | `129-VERIFICATION.md` | phase-close (T4) |
| CREATE | `PHASE-CAPSULE.json` | phase-close (T4) |

## Tasks

### P129-T1: sparkline.cjs

CREATE the new sparkline module per the contract in 129-CONTEXT.md. Pure CommonJS; zero external dependencies. Both `renderAnsi` and `renderSvg` exported.

Acceptance: file exists; both functions exported; behaviour matches the falsifier checks (constant-array edge case handled).

### P129-T2: cockpit-sidecar.cjs — renderText rewrite

MODIFY cockpit-sidecar.cjs. Rewrite `renderText(output, opts)` to emit the Band 1 + Band 2 layout from 129-CONTEXT.md. Use `require('./sparkline.cjs').renderAnsi` for trend lines. Use `output.stage_pipeline.stages[].status` for the pipeline strip cells. Preserve `renderBrief()` ≤4-line discipline.

Acceptance: SAC-P129-01..05 pass; v3.2 renderers (renderHtml, renderBrief) unchanged in v3.2-behavior; existing v3.2 SAC tests stay green.

### P129-T3: alert palette_tier + self-test extension

MODIFY alert-grammar.cjs: add `palette_tier` to each alert per the deterministic mapping. EXTEND run-self-test.cjs: append SAC-P129-01..06 verbatim.

Acceptance: full self-test exits 0 with 33/33 PASS (27 pre + 6 new); per-SAC --sac SAC-P129-NN exits 0.

### P129-T4: Phase-close artefacts

CREATE 129-VERIFICATION.md (verdict: PASS) + PHASE-CAPSULE.json (mirrors P128 capsule shape with SHA-256 hashes computed for CONTEXT/PLAN/VERIFICATION). Only after T1-T3 are green and committed.

Acceptance: both files exist; VERIFICATION verdict=PASS; capsule is valid JSON.

## Phase Verification

Primary command:

```bash
node super-gsd/tools/cockpit-sidecar/run-self-test.cjs
```

Expected: exit 0; 33/33 PASS (27 pre-P129 + 6 SAC-P129-NN). Secondary smoke test: `node super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs --text` emits the 3-band layout against the live ledger state.

## Out Of Scope

- Band 3 layout (deferred to P130).
- localhost-live HTML cockpit (P132).
- PowerShell monitor migration (P133).
- Conformance gate changes (P134).

## References

- 129-CONTEXT.md (this phase's spec)
- 128-CONTEXT.md / 128-01-stage-pipeline-PLAN-LOCKED.md (predecessor data model)
- v3.3 brief design system (principles P5, P7, P17)
- Tufte sparklines (VTP-substrate: `wiki/research/tufte-visual-display-data-density.md`)
- Krug one-loud-line (VTP-substrate: `wiki/research/krug-dont-make-me-think.md`)
- GitHub Primer 5-tier colour (VTP-substrate: `wiki/research/github-primer-design-system.md`)
