---
schema_version: 2
schema: plan-schema-v2
status: PLAN-LOCKED
plan_id: P128-01-stage-pipeline
phase_id: 128-cockpit-data-model
phase_number: 128
milestone: v3.3
workstream: core
title: Cockpit Stage-Pipeline Data Model
created_by: sgsd-write-plan (operator + Claude Opus 4.7)
created_at: 2026-05-24
locked: true
expected_ATC_tier: LITE
skip_gates: []
depends_on: []
tasks:
  - id: P128-T1
    agent: sgsd-exec-backend
    model: codex
    files_touched:
      - super-gsd/tools/cockpit-sidecar/stage-pipeline.cjs
    input_contract: |-
      Reads .planning/milestones/v3.3/phases/128-cockpit-data-model/128-CONTEXT.md
      for the 5-stage definition table, artifact_glob rules, vtp_enabled toggle
      semantics, and SAC-P128-01..05 expected behaviour. No source file
      dependencies beyond Node built-ins (fs, path).
    output_contract: |-
      Creates super-gsd/tools/cockpit-sidecar/stage-pipeline.cjs exporting
      STAGES (frozen 5-entry array; each entry name+owner+sla_minutes+artifact_glob)
      and computeStagePipeline({phase_dir, vtp_enabled, blocker}) returning
      {stages, active_index, blocker}. Each stage in result.stages carries
      status in {done, active, pending, blocked}. Pure function, no I/O beyond
      readdirSync on phase_dir. No mutation of input.
    hypothesis: |-
      A deterministic phase-directory scan with artifact_glob matching is
      sufficient to detect the active stage with zero LLM cost and zero
      false-positives, because the SGSD phase lifecycle produces canonical
      files (RESEARCH.md, VTP-ENRICHMENT.md, *PLAN-LOCKED.md, VERIFICATION.md)
      in a known order that uniquely identifies stage completion.
    falsifier: |-
      If any SGSD phase produces a stage's canonical artefact OUT OF ORDER
      (e.g. VERIFICATION.md created while RESEARCH.md is still absent),
      the detection algorithm marks an earlier stage 'pending' while a
      later stage is 'done' — observable as a discontinuous status array.
      SAC-P128-03/04/05 fixtures intentionally exercise ordered cases only;
      out-of-order is treated as a separate failure mode the algorithm does
      not need to handle (operator-grade workflow invariant).
    stop_rule: |-
      File exists at super-gsd/tools/cockpit-sidecar/stage-pipeline.cjs;
      require('./stage-pipeline.cjs') returns an object with STAGES (5
      entries) and computeStagePipeline (function); SAC-P128-01..05 from
      run-self-test.cjs pass when run via
      `node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P128-NN`.

  - id: P128-T2
    agent: sgsd-exec-backend
    model: codex
    files_touched:
      - super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs
    input_contract: |-
      Reads existing super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs
      (v3.2 byte-stable structure with run/parseArgs/render*/etc.) and
      consumes the T1 module via require('./stage-pipeline.cjs'). Reads
      .planning/config.json#workflow.triage_vtp_enrichment for vtp_enabled.
    output_contract: |-
      Modifies cockpit-sidecar.cjs:
      (a) adds `const { computeStagePipeline } = require('./stage-pipeline.cjs');`
          near top;
      (b) adds `attachStagePipeline(output, opts)` helper near recommendedAction
          that writes output.stage_pipeline via computeStagePipeline;
      (c) inside run(), after `output.alerts = evaluateAlerts(output);`,
          derives phase_dir from milestone + phase + phase_slug and calls
          attachStagePipeline;
      (d) extends module.exports to include attachStagePipeline.
      Zero changes to the v3.2 byte-shape of any other --json key.
    hypothesis: |-
      Additive-only wiring at the end of run() preserves the v3.2 --json
      contract because: existing keys are written before the call; the new
      key (stage_pipeline) only appends; renderText/renderHtml/renderBrief
      simply ignore unknown keys today and stay non-crashing tomorrow.
    falsifier: |-
      If any v3.2 key changes byte-shape after the wiring (output[k] vs
      pre-wire output[k] differs for any k in v3.2 key set), SAC-P128-07
      fails. If any renderer crashes on the new key, SAC-P128-09 fails.
      If JSON.parse(JSON.stringify(output)).stage_pipeline.stages.length
      != 5 round-trip, SAC-P128-08 fails.
    stop_rule: |-
      `node super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs --json`
      output contains a `stage_pipeline` key with `stages` array of 5
      entries; all v3.2 keys (milestone, phase, fog_score, alerts,
      signals, north_star, latest_chronicle, binding_gate_status, warnings,
      generated_at, recent_chronicles) still present; SAC-P128-06/07/08/09
      pass via `node run-self-test.cjs`.

  - id: P128-T3
    agent: sgsd-exec-test
    model: codex
    files_touched:
      - super-gsd/tools/cockpit-sidecar/run-self-test.cjs
    input_contract: |-
      Reads existing super-gsd/tools/cockpit-sidecar/run-self-test.cjs
      (v3.2 self-test runner with SAC-P125-01..06 and SAC-P126-01..07
      and SAC-P127-01..05). Reads .planning/.../128-CONTEXT.md for SAC
      verbatim text. Requires the T1 and T2 modules to be importable.
    output_contract: |-
      Appends (pure append, no edit of existing tests) 9 new test entries
      SAC-P128-01..09 to the tests array. Each entry: {id, run} with
      assertions verbatim against 128-CONTEXT.md semantic_acceptance_criteria.
      Adds the small makeFakePhaseDir helper used by T2/T3/T4 tests if not
      already present from prior phases. Existing tests remain byte-stable.
    hypothesis: |-
      Per-SAC assertions using Node built-in `assert` module (no test
      framework) are sufficient because the runner already follows this
      pattern (v3.2 ships 18/18 with this style). Appending new tests
      cannot break existing tests because the runner iterates a flat
      array and each test is independent (no shared state).
    falsifier: |-
      If any pre-P128 test in run-self-test.cjs starts failing after the
      append, the assumption of independence is wrong. Mitigation: each
      append must not introduce a module-level side-effect; all setup is
      local to the .run() closure.
    stop_rule: |-
      `node super-gsd/tools/cockpit-sidecar/run-self-test.cjs` exits 0;
      every SAC-P128-NN runs and passes; v3.2 SACs still all green
      (chronicle 111/111, cockpit 18/18 totals unchanged for those bands).
      Per-SAC invocation `--sac SAC-P128-NN` for NN in 01..09 exits 0.

  - id: P128-T4
    agent: sgsd-exec-docs
    model: codex
    files_touched:
      - .planning/milestones/v3.3/phases/128-cockpit-data-model/128-VERIFICATION.md
      - .planning/milestones/v3.3/phases/128-cockpit-data-model/PHASE-CAPSULE.json
    input_contract: |-
      Reads .planning/milestones/v3.2/phases/125-cockpit-alert-grammar/
      125-VERIFICATION.md and PHASE-CAPSULE.json as gold-reference shapes.
      Reads the green output of run-self-test.cjs after T1-T3 complete.
      Reads `git log` for the P128 commit chain (since phase_start_ref).
    output_contract: |-
      Creates 128-VERIFICATION.md with frontmatter verdict=PASS,
      evidence_paths listing the 3 new/modified source files and the
      self-test runner, and a body section enumerating each SAC-P128-NN
      with its expected outcome and a one-line "verified via X" pointer.
      Creates PHASE-CAPSULE.json mirroring v3.2 P125 shape:
      {phase, milestone, plan_id, phase_start_ref, phase_close_commit,
       files_touched (array), sac_ids (array of 9), self_test_command,
       verdict}.
    hypothesis: |-
      Phase-close artefacts authored AFTER T1-T3 are green can be derived
      mechanically from git + the self-test output, because SGSD's phase
      lifecycle already produces all the inputs required for verification
      (commit chain, file diff, test results).
    falsifier: |-
      If the self-test is not green at T4 start, the VERIFICATION verdict
      cannot be PASS. Mitigation: T4's depends_on enforces T1-T3 complete.
      If any of the 3 source files lacks a corresponding commit in the
      P128 chain, PHASE-CAPSULE.files_touched cannot be populated.
    stop_rule: |-
      .planning/milestones/v3.3/phases/128-cockpit-data-model/128-VERIFICATION.md
      exists with verdict=PASS; PHASE-CAPSULE.json exists with all required
      keys (validated against the v2.9+ PHASE-CAPSULE.json conformance,
      same as v3.2). git log shows P128 commit chain bounded by
      phase_start_ref and phase_close_commit. Phase 128 ready to close.
    depends_on:
      - P128-T1
      - P128-T2
      - P128-T3
semantic_acceptance_criteria:
  - id: SAC-P128-01
    input: "module loaded via require('./stage-pipeline.cjs')"
    expected_outcome: "STAGES is a frozen array of exactly 5 entries with names ['research','vtp-enrich','plan','execute','verify'] in this order; each entry has name+owner+sla_minutes+artifact_glob fields with correct types (string, string, number>0, string)"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P128-01"
  - id: SAC-P128-02
    input: "module loaded via require('./stage-pipeline.cjs')"
    expected_outcome: "computeStagePipeline is exported as a function"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P128-02"
  - id: SAC-P128-03
    input: "phase_dir containing only RESEARCH.md, vtp_enabled=true, no blocker"
    expected_outcome: "stages[0].status='done', stages[1].status='active' (vtp-enrich), stages[2..4].status='pending', active_index=1, blocker=null"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P128-03"
  - id: SAC-P128-04
    input: "phase_dir containing only RESEARCH.md, vtp_enabled=false"
    expected_outcome: "stages[1].status='done' (vtp-enrich auto-skipped when disabled), stages[2].status='active' (plan), active_index=2"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P128-04"
  - id: SAC-P128-05
    input: "phase_dir containing RESEARCH.md + VTP-ENRICHMENT.md + *PLAN-LOCKED.md, blocker='codex_read_216'"
    expected_outcome: "stages[2].status='done' (plan), stages[3].status='blocked' (execute blocked by flag), result.blocker preserved as 'codex_read_216' verbatim"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P128-05"
  - id: SAC-P128-06
    input: "cockpit-sidecar.attachStagePipeline(p127-sample-output, {phase_dir: null}) where p127-sample-output is a v3.2-shaped JSON fixture"
    expected_outcome: "output.stage_pipeline key is present after attach with 5-entry stages array; pre-existing v3.2 keys remain present unchanged"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P128-06"
  - id: SAC-P128-07
    input: "p127-sample-output (v3.2 byte-shape) passed through attachStagePipeline"
    expected_outcome: "every v3.2 key (milestone, phase, generated_at, latest_chronicle, binding_gate_status, fog_score, recent_chronicles, signals, warnings, north_star, alerts) still present after — additive contract preserved"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P128-07"
  - id: SAC-P128-08
    input: "stage_pipeline-attached output serialized via JSON.stringify then parsed via JSON.parse (round-trip)"
    expected_outcome: "stage_pipeline survives JSON round-trip; parsed.stage_pipeline.stages.length === 5"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P128-08"
  - id: SAC-P128-09
    input: "stage_pipeline-attached output passed to v3.2 renderers renderText / renderHtml / renderBrief (not yet wired for stage_pipeline)"
    expected_outcome: "no renderer throws on the new key — they ignore it safely until P129 wires it; output strings remain well-formed"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P128-09"
---

# P128-01 Cockpit Stage-Pipeline Data Model PLAN

## Scope

Add a deterministic 5-stage pipeline data structure to the cockpit `--json` output describing where each active phase is in its lifecycle, who owns the current stage, and any blocker flag. Foundation for v3.3 Bands 1+2 (P129), Band 3 rationale (P130), localhost-live cockpit (P132). This plan does not change any v3.2 `--json` key byte-shape, does not modify renderers (P129 does that), and does not introduce LLM calls.

## Authoritative Inputs

- `.planning/milestones/v3.3/phases/128-cockpit-data-model/128-CONTEXT.md` — phase spec
- `.planning/briefs/2026-05-24-cockpit-v3.3-assessment.md` — milestone brief (committed `96e4767`)
- `.planning/plans/2026-05-24-cockpit-v3.3-implementation.md` — comprehensive plan (P128 full bite-sized detail)
- `.planning/milestones/v3.2/phases/125-cockpit-alert-grammar/125-01-cockpit-alert-grammar-PLAN.md` — gold-reference PLAN shape
- `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` — predecessor v3.2 cockpit (byte-stable contract source)
- `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` — predecessor self-test runner (SAC-P125-NN, SAC-P126-NN, SAC-P127-NN pattern)
- `super-gsd/templates/plan-schema-v2.json` — schema this plan validates against
- `super-gsd/schemas/plan-locked.schema.json` — PLAN-LOCKED conformance schema

## Binding Invariants (from 128-CONTEXT.md)

1. **Deterministic, no agent judgement.** Stage detection is a pure function of phase directory contents + workflow config + optional blocker hint. Same input, same output. No LLM. (DLB-12 invariant 5.)
2. **Lock-13 untouched.** All new code lives under `super-gsd/tools/cockpit-sidecar/`. Zero touches to `cockpit-state/*`, `tests/cockpit-acceptance/*`, `tests/cockpit-regression/*`.
3. **`--json` contract additive only.** P128 adds the `stage_pipeline` key; every v3.2 key already present remains byte-identical for unchanged inputs.
4. **5 stages, not 6.** Operator decision 2026-05-24 (Q-D): drop `discuss` — auto-mode synthesizes CONTEXT.md without an interactive discuss step. CONTEXT.md is a *precondition* of the pipeline, not a stage. Pipeline: `research → vtp-enrich → plan → execute → verify`.
5. **vtp-enrich toggle aware.** When `workflow.vtp_research_enrichment` is `false` in `.planning/config.json`, the `vtp-enrich` stage is auto-marked `done` (skipped, not blocked).

## File Operations

| Operation | Path | Purpose |
| --- | --- | --- |
| CREATE | `super-gsd/tools/cockpit-sidecar/stage-pipeline.cjs` | Export `STAGES` frozen array + `computeStagePipeline()` (T1) |
| MODIFY | `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` | Wire `attachStagePipeline()` helper + call from `run()` (T2) |
| EXTEND | `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` | Append SAC-P128-01..09 tests (pure append; T3) |
| CREATE | `.planning/milestones/v3.3/phases/128-cockpit-data-model/128-VERIFICATION.md` | Phase-close evidence (T4, after T1-T3 green) |
| CREATE | `.planning/milestones/v3.3/phases/128-cockpit-data-model/PHASE-CAPSULE.json` | SGSD phase capsule (T4) |

## Tasks

### P128-T1: Stage-Pipeline Module

- File operation: CREATE `super-gsd/tools/cockpit-sidecar/stage-pipeline.cjs`.
- Export exactly `STAGES` (frozen 5-entry array) and `computeStagePipeline({phase_dir, vtp_enabled, blocker})`.
- Stage detection per the artifact_glob table in 128-CONTEXT.md.
- Deterministic behaviour with no mutation of input state and no I/O beyond `fs.readdirSync` on `phase_dir`.
- Pure CommonJS, no runtime dependencies beyond Node built-ins.

Acceptance:

- `require('./stage-pipeline.cjs').STAGES` is a frozen array of 5 entries with the locked names and field shapes.
- `require('./stage-pipeline.cjs').computeStagePipeline` is a function.
- Detection across done/active/pending/blocked permutations matches SAC-P128-03/04/05 verbatim.
- Covered by SAC-P128-01..05 in the self-test runner.

### P128-T2: Cockpit-Sidecar Wiring

- File operation: MODIFY `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs`.
- Add `require('./stage-pipeline.cjs')` and the `attachStagePipeline(output, opts)` helper.
- Invoke `attachStagePipeline` inside `run()` after `evaluateAlerts(output)`.
- Derive `phase_dir` from `milestone + phase + phase_slug` (when present in cockpit state) and `vtp_enabled` from `.planning/config.json#workflow.triage_vtp_enrichment`.
- Extend `module.exports` to include `attachStagePipeline`.
- Zero byte-shape change to any v3.2 `--json` key.

Acceptance:

- `node super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs --json` output contains the new `stage_pipeline` key with 5-entry `stages` array.
- All v3.2 keys present and unchanged.
- Renderers (renderText, renderHtml, renderBrief) do not crash on the new key.
- Covered by SAC-P128-06/07/08/09 in the self-test runner.

### P128-T3: Self-Test Extension

- File operation: EXTEND `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` (pure append).
- Append 9 new entries to the existing `tests` array as SAC-P128-01..09.
- Each entry: `{id, run}` with assertions verbatim against 128-CONTEXT.md semantic_acceptance_criteria.
- Add a small `makeFakePhaseDir(files)` helper if not already present from prior phases.
- Support `--sac SAC-P128-NN` per-test invocation (already supported by existing runner; just author the new SACs).
- Zero edit of existing tests.

Acceptance:

- `node super-gsd/tools/cockpit-sidecar/run-self-test.cjs` exits 0 with SAC-P128-01..09 all passing.
- `node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P128-NN` exits 0 for each NN in 01..09.
- Pre-P128 tests (SAC-P125-*, SAC-P126-*, SAC-P127-*) remain byte-stable and green.

### P128-T4: Phase-Close Artefacts

- File operations: CREATE `128-VERIFICATION.md` and `PHASE-CAPSULE.json` in the phase directory.
- Author after T1-T3 are green and committed.
- Mirror v3.2 P125 phase-close artefact shape exactly.
- Include the phase commit chain bounded by `phase_start_ref` and `phase_close_commit`.

Acceptance:

- `128-VERIFICATION.md` exists with frontmatter `verdict: PASS`, `evidence_paths` listing the 3 source files + the self-test runner, and body enumerating each SAC-P128-NN with its expected outcome.
- `PHASE-CAPSULE.json` exists with required keys (phase, milestone, plan_id, phase_start_ref, phase_close_commit, files_touched, sac_ids, self_test_command, verdict).
- Phase 128 ready to close.

## Phase Verification

Primary command:

```bash
node super-gsd/tools/cockpit-sidecar/run-self-test.cjs
```

Expected result:

- Exit code 0.
- SAC-P128-01 through SAC-P128-09 pass.
- All pre-P128 SACs (SAC-P125-*, SAC-P126-*, SAC-P127-*) still pass.
- No source files outside the declared file operations are modified.

Secondary commands:

```bash
node super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs --json | node -e "const j = JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('stages:', j.stage_pipeline.stages.length, 'active_index:', j.stage_pipeline.active_index);"
```

Expected: `stages: 5  active_index: <integer>`.

## Out Of Scope

- No modification to cockpit `--json` output beyond the additive `stage_pipeline` key.
- No render-layer changes (P129 wires the new data into renderText/renderBrief).
- No rationale-layer cascade (P130 reads CONTEXT/INTENT/SUMMARY).
- No localhost server (P132).
- No PowerShell monitor changes (P133).
- No ORDER-PIPELINE-SPEC.pdf integration (deferred to P128.5 if material additions surface).
- No LLM in any code path.

## Open Questions

- **Q-A · deferred 2026-05-24:** ORDER-PIPELINE-SPEC.pdf path not provided; P128 ships with default 5 stages. Follow-on P128.5 captures material additions if surfaced later.
- **Q-D · answered 2026-05-24:** Dropped `discuss` stage. Pipeline is 5 stages. Applied verbatim in STAGES array.

## References

- 128-CONTEXT.md (phase spec)
- 2026-05-24-cockpit-v3.3-assessment.md (milestone brief)
- 2026-05-24-cockpit-v3.3-implementation.md (comprehensive plan with bite-sized TDD)
- v3.2 P125-01-cockpit-alert-grammar-PLAN.md (gold-reference PLAN shape)
- v3.2 124-COCKPIT-DESIGN-SPEC.md (predecessor design lock)
- v3.2 P127 cross-surface conformance (binding_fail=0 baseline)
- Operator's own validated pattern: `wiki/meetings/project-clarity-extraction.md::Idea-0` (6-stage pipeline with SLA + named owner + blocker — re-scoped to 5 stages for SGSD)
