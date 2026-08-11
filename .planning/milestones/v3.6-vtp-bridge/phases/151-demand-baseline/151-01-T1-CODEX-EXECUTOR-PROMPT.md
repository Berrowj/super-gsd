# P151-T1 — Demand-baseline ledger module + self-test (zero VTP dependency)

Fresh SDD implementer (Codex gpt-5.6-sol/xhigh). ONE task. SURGICAL CONSTRAINT: every line traces to this task; no VTP imports anywhere.

## Task contract (from locked plan)
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

## Closed-vocab reason enum (LOCKED — enforce exactly)
## Closed-vocab reason enum (locked)
`existing_path_adequate` · `enrichment_empty_hit` · `enrichment_off_topic` ·
`enrichment_stale` · `no_enrichment_attempted` · `other_inadequate`
(reason REQUIRED on every row; `other_inadequate` requires a free-text note.)


## Requirements
- appendRow(planningDir, row): append-only JSONL to .planning/metrics/triage-advisory/demand-baseline.jsonl; IDEMPOTENT by row.decision_id (if a row with that decision_id already exists, no-op return {ok:true,deduped:true}); FIRE-AND-FORGET (any fs error -> return {ok:false,error} , NEVER throw).
- validateRow(row): require schema_version (integer), decision_id (non-empty string), adequate (boolean), reason (in the closed enum; if 'other_inadequate' require row.note non-empty), latency_ms (number>=0), est_tokens (number>=0), vtp_call_count (number>=0). artefact_kind is OPTIONAL/nullable (reserved for Phase B). Return {valid, errors[]}.
- --self-test CLI: assert valid row accepted; missing schema_version rejected; missing reason rejected; out-of-enum reason rejected; other_inadequate without note rejected; duplicate decision_id dedupes to one row; forced write failure returns {ok:false} not throw. Print 'N pass, 0 fail'; exit 0 on all pass.

## PROGRESS CONTRACT (mandatory)
Append stage lines to .planning/metrics/dispatch-progress.txt: t1|<utc>|started, |edits-done, |verifying, |reporting, and FINAL |done. Short on time -> report early, mark done.

## Verify before reporting
node super-gsd/scripts/lib/demand-baseline-ledger.cjs --self-test ; node super-gsd/tests/demand-baseline/assert-ledger.cjs ; grep -riE 'vtp_triage|mcp__vtp|vtp-kb' the module (must be empty)

## Report contract: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / SCRIPTS_CREATED / ONE_LINER / STATUS
