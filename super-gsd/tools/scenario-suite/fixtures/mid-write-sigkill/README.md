# Fixture: mid-write-sigkill (SA4, adversarial)

The harness writes N complete rows + one truncated (no closing brace, no
newline) row to a tmpdir-isolated crit-backlog.jsonl file, then calls
crit-backlog.cjs.readRows(planningDir). Adversarial PASS == reader returns
exactly N rows (the truncated tail is skipped, no throw).

## Expected outcome

`FAIL-REJECTED`. The reader rejects the partial-line tail and surfaces only
the N complete rows. Lock 13 contract: the reader never throws upward on
malformed input.
