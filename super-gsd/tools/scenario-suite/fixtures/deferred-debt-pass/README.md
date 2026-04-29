# Fixture: deferred-debt-pass (SH2, happy)

The harness scenario impl appends a single LOW debt row via crit-backlog
appendRow into a tmpdir-isolated .planning/metrics/crit-backlog.jsonl, then
calls readRows to confirm exactly one row of kind 'phase_atc' is present.

No fixture file is required; the scenario synthesises the debt entry at
runtime so the test stays self-contained.

## Expected outcome

`PASS-WITH-DEFERRED-1`. crit-backlog.cjs appendRow + readRows round-trip
with rows.length === 1 and rows[0].kind === 'phase_atc'.
