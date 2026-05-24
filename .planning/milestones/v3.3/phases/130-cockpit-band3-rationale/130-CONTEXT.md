---
phase: 130
phase_name: Cockpit Band 3 Rationale Layer
milestone: v3.3
ws: core
created: 2026-05-24
status: queued-planning
implementation_status: not-started
source: v3.3 plan P130 scoped summary + brief principles P10/P11/P14 (Minto + SUCCES + Duarte)
predecessor: P129 PASS (Bands 1+2 layout shipped)
unlocks: [P132 (localhost-live cockpit renders all 3 bands), P134 (conformance covers rationale lint)]
---

# Phase 130 — Cockpit Band 3 Rationale Layer

> Author the reflective layer of the cockpit: CONTEXT / ELI5 / WHAT IS / WHAT COULD BE / WHY THIS PHASE / EVIDENCE TRAIL. Cascade-reads PROJECT.md + active milestone INTENT.md + last completed phase SUMMARY.md + active phase CONTEXT.md (per DLB-03 mandatory cascade). Adds mechanical SUCCES-lint for the WHY panel. `--bands=3` opt-in flag (default remains Band 1+2 only — reflective is drill-in).

## Goal

After P130, `cockpit-sidecar.cjs --json` output additively contains a `rationale` key holding the cascade-derived Band 3 content. New `rationale.cjs` reads the cascade. New `succes-lint.cjs` mechanically validates the WHY block (concrete artefact reference + named upstream/downstream phase + ≤60 words). `cockpit-sidecar.cjs --text --bands=3` renders Band 3 below Bands 1+2. Default `--text` remains Band 1+2 only.

## Binding invariants

1. **Deterministic, no LLM.** Cascade reader is pure file-read + substring extraction.
2. **Lock-13 untouched.** All work under `super-gsd/tools/cockpit-sidecar/`.
3. **`--json` additive.** New `rationale` key; v3.2 + P128 + P129 keys preserved.
4. **DLB-03 cascade mandatory.** Read PROJECT.md core-value + active milestone INTENT.md + last completed phase SUMMARY.md. Skipped cascade = phase drift.
5. **SUCCES self-test mechanically enforced.** WHY block must have concrete artefact reference, named upstream/downstream phase, ≤60 words.
6. **Band 3 opt-in.** Default `--text` is Bands 1+2 only; `--bands=3` reveals Band 3. Krug visual-hierarchy demote-to-drill principle.

## What ships

### `super-gsd/tools/cockpit-sidecar/rationale.cjs` (new)

Exports `computeRationale({project_md, intent_md, last_summary_md, context_md})` returning `{context, eli5, what_is, what_could_be, why_this_phase, evidence_trail}`. Each field a string. Read inputs from disk (relative paths derived from milestone + phase if not supplied). Pure: same inputs → same output.

### `super-gsd/tools/cockpit-sidecar/succes-lint.cjs` (new)

Exports `lintWhy(text)` returning `{ok: bool, violations: string[]}`. Checks:
- contains ≥1 concrete artefact reference (file path / line number / commit SHA — regex)
- contains ≥1 named upstream/downstream phase reference (`P{N}` or `phase {N}`)
- word count ≤ 60

### `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` (modified, additive)

- require both new modules
- `attachRationale(output, opts)` helper called in `run()` after `attachStagePipeline`
- `renderText` reads `opts.bands` (default `'1,2'`); if `'3'` or `'all'` or `'1,2,3'`, append Band 3 section
- parseArgs handles `--bands=N[,M]` (default unchanged)

### `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` (extended, pure append)

SAC-P130-01..05 appended.

## Semantic acceptance criteria

```yaml
semantic_acceptance_criteria:
  - id: SAC-P130-01
    input: "computeRationale called with paths to a fixture PROJECT.md + INTENT.md + SUMMARY.md + CONTEXT.md cascade"
    expected_outcome: "returns object with all 6 keys (context, eli5, what_is, what_could_be, why_this_phase, evidence_trail); each is non-empty string drawn from the relevant cascade source per DLB-03"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P130-01"
  - id: SAC-P130-02
    input: "computeRationale output for active phase 130 (against real .planning/milestones/v3.3/ tree)"
    expected_outcome: "evidence_trail field contains at least one concrete file-path reference (path with .md, .cjs, .js or .json extension)"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P130-02"
  - id: SAC-P130-03
    input: "succes-lint.lintWhy('We should build it because it would be nice to have.')"
    expected_outcome: "returns {ok: false, violations: [...]} — no concrete artefact reference present, no phase reference, expected ≥2 violations"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P130-03"
  - id: SAC-P130-04
    input: "succes-lint.lintWhy('P130 ships rationale.cjs (super-gsd/tools/cockpit-sidecar/rationale.cjs:1-80) cascading from PROJECT.md/INTENT.md/SUMMARY.md per DLB-03; unlocks P132 localhost-live.')"
    expected_outcome: "returns {ok: true, violations: []} — has artefact path, has phase refs (P130, P132), ≤60 words"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P130-04"
  - id: SAC-P130-05
    input: "cockpit-sidecar --text (no --bands flag) AND cockpit-sidecar --text --bands=3"
    expected_outcome: "default --text output does NOT contain 'WHY THIS PHASE' header; --bands=3 output DOES contain 'WHY THIS PHASE' header; both outputs include Band 1 and Band 2"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P130-05"
```

## Files touched

| Operation | Path | Purpose |
|---|---|---|
| CREATE | `super-gsd/tools/cockpit-sidecar/rationale.cjs` | cascade reader (T1) |
| CREATE | `super-gsd/tools/cockpit-sidecar/succes-lint.cjs` | mechanical lint (T2) |
| MODIFY | `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` | additive rationale key + --bands flag + Band 3 render (T3) |
| EXTEND | `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` | append SAC-P130-01..05 (T4) |
| CREATE | `130-VERIFICATION.md`, `PHASE-CAPSULE.json` | phase-close (T5; orchestrator-authored) |

## Out of scope

- No localhost server (P132).
- No PowerShell monitor changes (P133).
- No conformance gate changes (P134).
- ELI5 prompt upgrade (Munroe lint, Duarte arc) → P131; this phase ships only the data plumbing for the eli5 field.

## Source references

- v3.3 INTENT.md (entry phase 3)
- Plan P130 scoped summary
- DLB-03 cascade-read requirement (super-gsd CLAUDE.md)
- Minto SCQA + governing thought (canonical)
- Heath SUCCES (canonical)
- Duarte what-is/what-could-be (canonical)
- Software Architecture in Practice — rationale as first-class artifact (VTP-substrate)
