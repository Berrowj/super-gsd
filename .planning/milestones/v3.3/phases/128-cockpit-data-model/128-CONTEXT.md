---
phase: 128
phase_name: Cockpit Stage-Pipeline Data Model
milestone: v3.3
ws: core
created: 2026-05-24
status: queued-planning
implementation_status: not-started
source: v3.3 INTENT.md — entry phase, foundation for P129-P132
predecessor: v3.2 P127 PASS (cockpit cross-surface conformance LOCKED, binding_fail=0)
implements: brief lines 119-142 (P128 stage-pipeline grammar); plan tasks T1-T5
unlocks: [P129 (Band 1+2 renders consume stage_pipeline), P130 (Band 3 rationale references stage), P132 (localhost-live cockpit streams stage transitions over SSE)]
---

# Phase 128 — Stage-Pipeline Data Model

> Foundation phase for v3.3. Adds a deterministic 5-stage pipeline data structure to the cockpit `--json` output describing where each active phase is in its lifecycle, who owns the current stage, and any blocker flag. Every downstream v3.3 phase consumes this; nothing else can render correctly without it.

## Goal

After P128, `cockpit-sidecar.cjs --json` output contains an additive `stage_pipeline` key with the shape:

```json
{
  "stage_pipeline": {
    "stages": [
      { "name": "research",    "owner": "codex/xhigh",     "sla_minutes": 30, "status": "done" },
      { "name": "vtp-enrich",  "owner": "vtp-enrich",      "sla_minutes": 5,  "status": "done" },
      { "name": "plan",        "owner": "codex/xhigh",     "sla_minutes": 20, "status": "active" },
      { "name": "execute",     "owner": "codex/xhigh",     "sla_minutes": 90, "status": "pending" },
      { "name": "verify",      "owner": "codex/xhigh",     "sla_minutes": 15, "status": "pending" }
    ],
    "active_index": 2,
    "blocker": null
  }
}
```

Detection is **deterministic** (no LLM call) and reads only the active phase directory + the optional blocker hint from STATE.md / cockpit-state.

## Binding invariants (from v3.3 INTENT.md + DLB-12)

1. **Deterministic, no agent judgement.** Stage detection is a pure function of the phase directory contents + workflow config + optional blocker hint. Same input, same output. No LLM. (DLB-12 invariant 5.)
2. **Lock-13 untouched.** All new code lives under `super-gsd/tools/cockpit-sidecar/`. Zero touches to `cockpit-state/*`, `tests/cockpit-acceptance/*`, `tests/cockpit-regression/*`.
3. **`--json` contract additive only.** P128 adds the `stage_pipeline` key; every v3.2 key already present remains present and byte-identical for unchanged inputs.
4. **5 stages, not 6.** Operator decision 2026-05-24 (Q-D): drop `discuss` — auto-mode synthesizes CONTEXT.md without an interactive discuss step. CONTEXT.md is a *precondition* of the pipeline, not a stage. Pipeline is `research → vtp-enrich → plan → execute → verify`.
5. **vtp-enrich toggle aware.** When `workflow.vtp_research_enrichment` is `false` in `.planning/config.json`, the `vtp-enrich` stage is auto-marked `done` (skipped, not blocked).

## What ships

### `super-gsd/tools/cockpit-sidecar/stage-pipeline.cjs` (new)

Exports two symbols:

- `STAGES` — frozen array of 5 stage descriptors, each `{name, owner, sla_minutes, artifact_glob}`. The single source of truth for stage definitions.
- `computeStagePipeline({phase_dir, vtp_enabled, blocker})` → returns `{stages, active_index, blocker}` where `stages` is `STAGES` mapped to status (`done | active | pending | blocked`). The first stage whose artifact_glob is absent (and isn't auto-skipped) is `active`. If `blocker` is set, the active stage flips to `blocked`. Stages after the active one are `pending`.

Stage detection rules:

| Stage | Artifact present means done |
|---|---|
| `research` | `RESEARCH.md` exists in phase_dir |
| `vtp-enrich` | `VTP-ENRICHMENT.md` exists OR `vtp_enabled === false` |
| `plan` | a file matching `*PLAN-LOCKED.md` exists |
| `execute` | a file matching `*executor*` exists in phase_dir |
| `verify` | `VERIFICATION.md` exists in phase_dir |

### `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` (modified)

Two changes:

- New helper `attachStagePipeline(output, opts)` exported alongside existing renderers. Computes the pipeline and sets `output.stage_pipeline` in place. Returns `output` for chaining.
- `run()` calls `attachStagePipeline` after `evaluateAlerts`, deriving `phase_dir` from `milestone + phase + phase_slug` (when present in cockpit state) and `vtp_enabled` from `.planning/config.json`.

### `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` (extended, pure append)

SAC-P128-01..09 assertions covering: stage count + names + frozen shape, detection across done/active/pending/blocked permutations, vtp-skip toggle, JSON round-trip survival, renderer non-crash (`renderText` / `renderHtml` / `renderBrief` must not throw on the new key — they ignore it until P129 wires it).

## Semantic acceptance criteria

```yaml
semantic_acceptance_criteria:
  - id: SAC-P128-01
    input: "module loaded via require('./stage-pipeline.cjs')"
    expected_outcome: "STAGES is a frozen array of exactly 5 entries with names ['research','vtp-enrich','plan','execute','verify'] in this order; each entry has name+owner+sla_minutes+artifact_glob fields with correct types"
  - id: SAC-P128-02
    input: "module loaded via require('./stage-pipeline.cjs')"
    expected_outcome: "computeStagePipeline is exported as a function"
  - id: SAC-P128-03
    input: "phase_dir containing only RESEARCH.md, vtp_enabled=true, no blocker"
    expected_outcome: "stages[0].status='done', stages[1].status='active' (vtp-enrich), stages[2..4].status='pending', active_index=1"
  - id: SAC-P128-04
    input: "phase_dir containing only RESEARCH.md, vtp_enabled=false"
    expected_outcome: "stages[1].status='done' (vtp-enrich auto-skipped), stages[2].status='active' (plan)"
  - id: SAC-P128-05
    input: "phase_dir containing RESEARCH.md + VTP-ENRICHMENT.md + *PLAN-LOCKED.md, blocker='codex_read_216'"
    expected_outcome: "stages[2].status='done' (plan), stages[3].status='blocked' (execute blocked by flag), result.blocker preserved verbatim"
  - id: SAC-P128-06
    input: "cockpit-sidecar.attachStagePipeline(p127-sample-output, {phase_dir: null})"
    expected_outcome: "output.stage_pipeline is present with 5-entry stages array; pre-existing v3.2 keys unchanged"
  - id: SAC-P128-07
    input: "p127-sample-output (v3.2 byte-shape)"
    expected_outcome: "every key present before attachStagePipeline is still present after — additive contract proved"
  - id: SAC-P128-08
    input: "stage_pipeline-attached output serialized then parsed (JSON round-trip)"
    expected_outcome: "stage_pipeline survives serialization; stages.length is 5"
  - id: SAC-P128-09
    input: "stage_pipeline-attached output passed to renderText / renderHtml / renderBrief (v3.2 renderers, not yet aware of stage_pipeline)"
    expected_outcome: "no renderer throws — they ignore the new key safely until P129 wires it"
```

## Files touched

| Operation | Path | Purpose |
|---|---|---|
| CREATE | `super-gsd/tools/cockpit-sidecar/stage-pipeline.cjs` | STAGES + computeStagePipeline + stageArtifactPresent helpers |
| MODIFY | `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` | require stage-pipeline, add attachStagePipeline helper, call in run(), export the helper |
| EXTEND | `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` | Append SAC-P128-01..09 (pure append, no edit of existing tests) |
| CREATE | `.planning/milestones/v3.3/phases/128-cockpit-data-model/128-VERIFICATION.md` | Phase-close evidence (authored after green self-test) |
| CREATE | `.planning/milestones/v3.3/phases/128-cockpit-data-model/PHASE-CAPSULE.json` | SGSD phase capsule (commit boundaries, files touched, SAC IDs covered) |

## Open questions (deferred or answered)

- **Q-D — answered 2026-05-24:** Drop `discuss` stage. Pipeline is 5 stages.
- **Q-A — deferred 2026-05-24:** ORDER-PIPELINE-SPEC.pdf path not yet provided. Ship P128 with the 5 defaults; if the spec later surfaces material additions a follow-on P128.5 captures them. Non-blocking.

## Source references

- Brief: `.planning/briefs/2026-05-24-cockpit-v3.3-assessment.md` (committed `96e4767`)
- Plan: `.planning/plans/2026-05-24-cockpit-v3.3-implementation.md` (P128 has full bite-sized TDD steps T1-T5)
- Predecessor: `.planning/milestones/v3.2/phases/127-cockpit-cross-surface-conformance/`
- Predecessor design lock: `.planning/milestones/v3.2/phases/124-cockpit-research-design/124-COCKPIT-DESIGN-SPEC.md`
- Operator's own validated stage-pipeline pattern: `wiki/meetings/project-clarity-extraction.md::Idea-0` (VTP-substrate, score 0.94)
