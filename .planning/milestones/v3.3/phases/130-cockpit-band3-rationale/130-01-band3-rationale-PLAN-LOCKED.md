---
schema_version: 2
schema: plan-schema-v2
status: PLAN-LOCKED
plan_id: P130-01-band3-rationale
phase_id: 130-cockpit-band3-rationale
phase_number: 130
milestone: v3.3
workstream: core
title: Cockpit Band 3 Rationale Layer
created_by: sgsd-write-plan (operator + Claude Opus 4.7)
created_at: 2026-05-24
locked: true
expected_ATC_tier: LITE
skip_gates: []
depends_on:
  - P129-01-band1-band2-terminal
tasks:
  - id: P130-T1
    agent: sgsd-exec-backend
    model: codex
    files_touched:
      - super-gsd/tools/cockpit-sidecar/rationale.cjs
    input_contract: |-
      Reads 130-CONTEXT.md for the cascade-read contract. Reads DLB-03
      (cascade-read mandatory; PROJECT.md core-value + active milestone
      INTENT.md + last completed phase SUMMARY.md + active phase CONTEXT.md).
      No source dependencies beyond Node built-ins.
    output_contract: |-
      Creates super-gsd/tools/cockpit-sidecar/rationale.cjs exporting
      computeRationale({project_md, intent_md, last_summary_md, context_md})
      returning {context, eli5, what_is, what_could_be, why_this_phase,
      evidence_trail}. Each field is a non-empty string derived from cascade
      sources per DLB-03. Function accepts paths to the cascade files (each
      optional); when omitted, derives paths from milestone + phase context.
      Pure: same inputs → same output.
    hypothesis: |-
      Cascade text can be deterministically extracted by reading the 4 source
      MD files and pulling the most relevant section per output field
      (e.g. INTENT.md 'why' → what_is; INTENT.md 'outcome_delivered' →
      what_could_be; CONTEXT.md 'Goal' → why_this_phase; SUMMARY.md tail →
      context). No semantic AI required; rule-based extraction is sufficient.
    falsifier: |-
      If any cascade source is missing or malformed (no YAML frontmatter,
      no expected headings), the output object may have empty-string fields.
      Mitigation: when a source is absent return a clearly-marked placeholder
      ('(no INTENT.md found)') rather than crashing.
    stop_rule: |-
      File exists; require(...) returns {computeRationale}; function returns
      an object with all 6 keys; each key value is a string; SAC-P130-01/02
      pass.

  - id: P130-T2
    agent: sgsd-exec-backend
    model: codex
    files_touched:
      - super-gsd/tools/cockpit-sidecar/succes-lint.cjs
    input_contract: |-
      Reads 130-CONTEXT.md "What ships / succes-lint.cjs" section + SAC-P130-03/04.
    output_contract: |-
      Creates super-gsd/tools/cockpit-sidecar/succes-lint.cjs exporting
      lintWhy(text) returning {ok: boolean, violations: string[]}. Mechanical
      checks (no LLM):
        (a) ≥1 concrete artefact reference: regex match on a file-path token
            (containing .md / .cjs / .js / .json / .ts / .py / .sh) OR a commit
            SHA (7+ hex chars). Violation: 'missing concrete artefact reference'.
        (b) ≥1 named phase reference: regex /\bP\d{2,3}\b|\bphase \d+\b/ (case-
            insensitive). Violation: 'missing phase reference'.
        (c) word count ≤ 60 (split on whitespace, filter empty). Violation:
            'over 60 words ({count})'.
      Pure; no I/O.
    hypothesis: |-
      Mechanical regex-based checks are sufficient for SUCCES (the parts that
      matter for cockpit WHY panels: Concrete via artefact ref; Credibility
      via phase ref + tight word count). Mechanical = byte-stable = automatable
      conformance check.
    falsifier: |-
      A WHY block that uses synonyms ('module.js' is concrete but doesn't
      match the extension list) would false-fail. Mitigation: extension list
      covers all SGSD source types (cjs, js, ts, py, sh, md, json) plus
      explicit file-path slash heuristic.
    stop_rule: |-
      File exists; lintWhy is a function; SAC-P130-03 returns ok:false with
      ≥2 violations for the dumb input; SAC-P130-04 returns ok:true for the
      well-formed input.

  - id: P130-T3
    agent: sgsd-exec-backend
    model: codex
    files_touched:
      - super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs
    input_contract: |-
      Reads existing cockpit-sidecar.cjs (post-P129). Requires T1 (rationale.cjs)
      and T2 (succes-lint.cjs) to exist. Reads 130-CONTEXT.md "What ships /
      cockpit-sidecar.cjs" section.
    output_contract: |-
      MODIFY cockpit-sidecar.cjs:
        (a) `const { computeRationale } = require('./rationale.cjs');`
        (b) `attachRationale(output, opts)` helper called in `run()` after
            attachStagePipeline. Derives cascade paths from milestone+phase.
        (c) parseArgs handles `--bands` value option (comma-separated set,
            default '1,2'). e.g. `--bands=3` or `--bands=1,2,3` or `--bands=all`.
        (d) renderText: when bands set includes '3', append a Band 3 section
            below the existing Band 1+2 box. Band 3 renders WHY THIS PHASE +
            CONTEXT + ELI5 + WHAT IS + WHAT COULD BE + EVIDENCE TRAIL headers
            with the rationale values below each. Use the existing box-drawing
            style; mark each subhead with a Band 3 label.
        (e) module.exports extended with attachRationale.
      Zero v3.2 byte-shape changes. renderHtml unchanged.
    hypothesis: |-
      Additive --bands flag preserves the v3.2 + v3.3 P129 default behaviour
      exactly while enabling drill-in. Krug visual-hierarchy demote-to-drill
      principle: reflective content not visible until requested.
    falsifier: |-
      If default `--text` invocation (no --bands flag) shows any Band 3 content,
      the demote-to-drill contract is broken. SAC-P130-05 catches this.
    stop_rule: |-
      `node cockpit-sidecar.cjs --text` output does NOT contain 'WHY THIS PHASE'.
      `node cockpit-sidecar.cjs --text --bands=3` DOES contain 'WHY THIS PHASE'.
      Both still emit Band 1 + Band 2. SAC-P130-05 passes.

  - id: P130-T4
    agent: sgsd-exec-test
    model: codex
    files_touched:
      - super-gsd/tools/cockpit-sidecar/run-self-test.cjs
    input_contract: |-
      Reads existing run-self-test.cjs (post-P129; 33/33 SACs green). Reads
      130-CONTEXT.md SAC-P130-01..05 verbatim.
    output_contract: |-
      EXTEND run-self-test.cjs (pure append). Add SAC-P130-01..05 entries
      after the SAC-P129-06 block. Test bodies verbatim against 130-CONTEXT.md
      semantic_acceptance_criteria. For SAC-P130-01/02 use a fixture cascade
      built via makeFakePhaseDir helper.
    hypothesis: |-
      Pure-append discipline keeps existing 33 SACs byte-stable; new tests
      independent.
    falsifier: |-
      If any existing test fails after the append, module-level side effect
      was introduced (test pollution).
    stop_rule: |-
      Full self-test exits 0 with 38/38 PASS; per-SAC --sac SAC-P130-NN exits
      0 for each NN in 01..05.

  - id: P130-T5
    agent: sgsd-exec-docs
    model: codex
    files_touched:
      - .planning/milestones/v3.3/phases/130-cockpit-band3-rationale/130-VERIFICATION.md
      - .planning/milestones/v3.3/phases/130-cockpit-band3-rationale/PHASE-CAPSULE.json
    input_contract: |-
      Reads green output of run-self-test.cjs after T1-T4. Reads git log for
      P130 commit chain since P129 close. Mirror P129 VERIFICATION/CAPSULE
      shape.
    output_contract: |-
      Creates 130-VERIFICATION.md verdict=PASS, 5/5 SACs, deviations recorded.
      Creates PHASE-CAPSULE.json with SHA-256 hashes for CONTEXT/PLAN/VERIFICATION.
    hypothesis: |-
      Deterministic projection of green self-test + git log + file hashes.
    falsifier: |-
      Self-test not green at T5 start.
    stop_rule: |-
      Both files exist; verdict=PASS; valid JSON capsule.
    depends_on:
      - P130-T1
      - P130-T2
      - P130-T3
      - P130-T4
semantic_acceptance_criteria:
  - id: SAC-P130-01
    input: "computeRationale called with paths to a fixture PROJECT.md + INTENT.md + SUMMARY.md + CONTEXT.md cascade"
    expected_outcome: "returns object with 6 keys (context, eli5, what_is, what_could_be, why_this_phase, evidence_trail); each is non-empty string drawn from the relevant cascade source per DLB-03"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P130-01"
  - id: SAC-P130-02
    input: "computeRationale output for active phase 130 (real .planning/milestones/v3.3/ tree)"
    expected_outcome: "evidence_trail field contains at least one concrete file-path reference (path with .md, .cjs, .js, .json, .ts, .py, .sh extension OR a 7+ hex char commit SHA)"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P130-02"
  - id: SAC-P130-03
    input: "succes-lint.lintWhy('We should build it because it would be nice to have.')"
    expected_outcome: "returns {ok: false, violations: array of ≥2 entries} — at minimum missing artefact reference + missing phase reference"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P130-03"
  - id: SAC-P130-04
    input: "succes-lint.lintWhy('P130 ships rationale.cjs (super-gsd/tools/cockpit-sidecar/rationale.cjs:1-80) cascading from PROJECT.md INTENT.md SUMMARY.md per DLB-03; unlocks P132 localhost-live.')"
    expected_outcome: "returns {ok: true, violations: []} — has artefact path, has phase refs (P130, P132), ≤60 words"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P130-04"
  - id: SAC-P130-05
    input: "cockpit-sidecar --text (no flag) vs cockpit-sidecar --text --bands=3"
    expected_outcome: "default --text output does NOT contain 'WHY THIS PHASE'; --bands=3 output DOES contain 'WHY THIS PHASE'; both contain Band 1 + Band 2 headers"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P130-05"
---

# P130-01 Cockpit Band 3 Rationale Layer PLAN

## Scope

Author the reflective layer (Band 3) of the cockpit. New modules rationale.cjs (cascade reader) + succes-lint.cjs (mechanical WHY lint). Wire additively into cockpit-sidecar.cjs with `--bands` opt-in flag. Default `--text` remains Band 1+2 only; `--bands=3` reveals Band 3. 5 new SAC tests.

## Authoritative Inputs

- 130-CONTEXT.md (phase spec)
- 129-VERIFICATION.md (predecessor; 33/33 green baseline)
- cockpit-sidecar.cjs (post-P129)
- run-self-test.cjs (post-P129)
- DLB-03 cascade requirement (super-gsd/CLAUDE.md)

## Binding Invariants

Per 130-CONTEXT.md. 5 invariants enforced.

## File Operations

| Operation | Path |
|---|---|
| CREATE | super-gsd/tools/cockpit-sidecar/rationale.cjs (T1) |
| CREATE | super-gsd/tools/cockpit-sidecar/succes-lint.cjs (T2) |
| MODIFY | super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs (T3) |
| EXTEND | super-gsd/tools/cockpit-sidecar/run-self-test.cjs (T4) |
| CREATE | 130-VERIFICATION.md + PHASE-CAPSULE.json (T5) |

## Tasks

5 tasks; see frontmatter for full input_contract / output_contract / hypothesis / falsifier / stop_rule per task.

## Phase Verification

Primary command: `node super-gsd/tools/cockpit-sidecar/run-self-test.cjs` → exit 0; 38/38 PASS (33 pre-P130 + 5 SAC-P130-NN).

## Out of Scope

Per 130-CONTEXT.md "Out of scope" section.

## References

130-CONTEXT.md, DLB-03 cascade-read, brief design principles P10/P11/P14.
