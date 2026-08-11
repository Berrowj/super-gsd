# P151-T2 — Gate instrument recordEligibleQuery (zero VTP dependency)

Fresh SDD implementer (Codex gpt-5.6-sol/xhigh). ONE task. SURGICAL. Build ON the existing demand-baseline-ledger.cjs (T1, already committed: exports appendRow + validateRow). No VTP imports. No enrichment-gate SOURCE edit (that is T3 docs-only).

## Task contract (from locked plan)
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

## Requirements
- Add recordEligibleQuery(planningDir, {decision_id, query, adequate, reason, latency_ms, est_tokens, vtp_call_count, note?}) to demand-baseline-ledger.cjs. It: stamps schema_version; increments/reads a running DENOMINATOR (count of unique eligible decision_ids seen) persisted in the ledger dir (e.g. .planning/metrics/triage-advisory/denominator.json); attaches the current denominator to the row; validates via validateRow; appendRow()s. Idempotent: replaying a decision_id neither double-counts the denominator nor double-appends. Fire-and-forget: any failure returns {ok:false}, never throws.
- Extend the --self-test to cover the new helper, and add super-gsd/tests/demand-baseline/assert-instrument.cjs asserting: denominator increments once per unique decision_id; replay does not increment or double-append; a forced write failure returns {ok:false} (no throw); a row with a bad reason is rejected before any denominator mutation (validate-first).

## PROGRESS CONTRACT: stage lines t2|<utc>|started/edits-done/verifying/reporting/done to .planning/metrics/dispatch-progress.txt; short on time -> report early + mark done.

## Verify: node super-gsd/scripts/lib/demand-baseline-ledger.cjs --self-test ; node super-gsd/tests/demand-baseline/assert-instrument.cjs ; no VTP import.

## Report contract: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / SCRIPTS_CREATED / ONE_LINER / STATUS
