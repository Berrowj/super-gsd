---
schema_version: 2
phase: "151"
slug: "demand-baseline"
milestone: "v3.6-vtp-bridge"
status: "PLANNED"
depends_on: []
intent: "Zero-VTP-dependency demand-baseline instrument on the enrichment gate: record per eligible query whether the existing path was adequate, with latency/tokens/call-count and a real denominator, in a versioned append-only idempotent ledger."
execution_mode: "serial-codex"
tasks:
  - id: "P151-T1"
    type: "ledger-schema"
    agent: codex
    model: codex
    files_touched:
      - "super-gsd/scripts/lib/demand-baseline-ledger.cjs"
      - "super-gsd/tests/demand-baseline/assert-ledger.cjs"
    input_contract: >
      Build ONLY the ledger schema module + its self-test. No enrichment-gate wiring in this task. No VTP imports.
    output_contract: >
      demand-baseline-ledger.cjs exports appendRow(planningDir, row) (append-only, idempotent by decision_id, fire-and-forget: returns {ok:false} on failure, never throws) and validateRow(row) enforcing the closed schema; a --self-test CLI exits 0.
    hypothesis: "A versioned closed-vocab ledger row can capture demand evidence that is falsifiable (required reason) and Phase-B-forward-compatible (nullable artefact_kind) without any VTP dependency."
    falsifier: >
      A row missing schema_version, missing/blank reason, or a reason outside the closed enum is ACCEPTED; or a duplicate decision_id appends twice; or a write failure throws instead of returning {ok:false}; or any VTP import appears.
    stop_rule: >
      Stop after the ledger module + self-test pass; do not touch the enrichment gate or SKILL.md.
    verification:
      commands:
        - "node super-gsd/scripts/lib/demand-baseline-ledger.cjs --self-test"
        - "node super-gsd/tests/demand-baseline/assert-ledger.cjs"
        - "grep -riE 'vtp_triage|vtp-kb|mcp__vtp' super-gsd/scripts/lib/demand-baseline-ledger.cjs && exit 1 || exit 0"
  - id: "P151-T2"
    type: "gate-instrument"
    agent: codex
    model: codex
    files_touched:
      - "super-gsd/scripts/lib/demand-baseline-ledger.cjs"
      - "super-gsd/tests/demand-baseline/assert-instrument.cjs"
    input_contract: >
      Add a recordEligibleQuery(planningDir, {decision_id, query, adequate, reason, latency_ms, est_tokens, vtp_call_count}) helper that stamps schema_version + denominator, validates, and appendRow()s. Off the critical path. No enrichment-gate SOURCE edit — expose the helper and prove it via test only; wiring into Step 6.b.5 SKILL.md prose is T3.
    output_contract: >
      recordEligibleQuery maintains a running denominator (count of eligible queries) in the ledger dir, records a well-formed row, is idempotent on decision_id replay, and swallows write failures.
    hypothesis: "Eligible-query recording can maintain an honest denominator and idempotent numerator with zero effect on dispatch latency when it fails."
    falsifier: >
      Denominator is not incremented per unique eligible query; replayed decision_id double-counts; a forced write failure propagates; or latency/tokens/call-count are droppable without validation error.
    stop_rule: >
      Stop after the instrument helper + its self-test pass; do not edit orchestrator SKILL.md.
    verification:
      commands:
        - "node super-gsd/tests/demand-baseline/assert-instrument.cjs"
  - id: "P151-T3"
    type: "docs-wire"
    agent: codex
    model: codex
    files_touched:
      - "super-gsd/skills/sgsd-orchestrate/SKILL.md"
      - "super-gsd/docs/VTP-BRIDGE-PHASE0.md"
    input_contract: >
      Documentation only. Add a Step 6.b.5 note that eligible KB queries SHOULD be recorded via recordEligibleQuery (advisory, fire-and-forget, off critical path), and write VTP-BRIDGE-PHASE0.md describing the baseline, the closed-vocab reason enum, the 4-week/20-query demand test, and the contract-stubs for the four future skills (no code). Cite the board memo.
    output_contract: >
      SKILL.md references the instrument as advisory/off-critical-path; VTP-BRIDGE-PHASE0.md documents Stage 1 + the gated Stages 2-3 + future-skill contract stubs.
    hypothesis: "The baseline can be documented as advisory measurement without implying any VTP call or auto-following, keeping the boundary the board set."
    falsifier: >
      Any doc implies a VTP call is made in Phase 0, or implies route-following before gold-set approval, or contains skill source code.
    stop_rule: >
      Stop after the two docs are written; run no further tasks.
    verification:
      commands:
        - "grep -c 'recordEligibleQuery' super-gsd/skills/sgsd-orchestrate/SKILL.md"
        - "test -f super-gsd/docs/VTP-BRIDGE-PHASE0.md"
semantic_acceptance_criteria:
  - id: "SCHEMA-09"
    input: >
      A hand-built row missing the closed-vocab reason field, run through validateRow.
    expected_outcome: >
      validateRow rejects it; the self-test asserts rejection of missing-reason, out-of-enum-reason, and missing-schema_version rows.
    verification_cmd: "node super-gsd/scripts/lib/demand-baseline-ledger.cjs --self-test"
  - id: "DLB-07"
    input: >
      Two appendRow calls with the SAME decision_id against a temp ledger dir.
    expected_outcome: >
      The ledger contains exactly one row for that decision_id (idempotent); a forced write failure returns {ok:false} without throwing.
    verification_cmd: "node super-gsd/tests/demand-baseline/assert-ledger.cjs"
  - id: "SCHEMA-09"
    input: >
      The full committed diff for phase 151.
    expected_outcome: >
      No VTP tool import or reference (vtp_triage, mcp__vtp, vtp-kb) appears in any non-doc source file.
    verification_cmd: "grep -riE 'vtp_triage|mcp__vtp|vtp-kb' super-gsd/scripts/lib/demand-baseline-ledger.cjs super-gsd/tests/demand-baseline/ && echo LEAK && exit 1 || echo clean"
---

## Goal
Ship the demand-baseline instrument (ledger + gate helper + docs). Zero VTP
dependency. This is the board+Codex-sanctioned Stage 1; Stages 2-3 stay blocked.

## Closed-vocab reason enum (locked)
`existing_path_adequate` · `enrichment_empty_hit` · `enrichment_off_topic` ·
`enrichment_stale` · `no_enrichment_attempted` · `other_inadequate`
(reason REQUIRED on every row; `other_inadequate` requires a free-text note.)

## Source Audit
- CONTEXT.md — goal + board/Codex conditions (this phase dir).
- Board Decision Memo — .planning/decisions/2026-08-11-cross-pollination-BOARD-MEMO.md (conditions 1-5 + Codex challenge additions).
- Handover — .planning/briefs/2026-08-11-cross-pollination-handover.md (Phase-0 framing, falsifiers).
