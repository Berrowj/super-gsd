# Fixture: race-condition-writes (SA2, adversarial)

Two concurrent node subprocesses each appendRow N times to a shared
crit-backlog.jsonl path under the tmpdir. The harness reads back, counts
rows, and asserts:

1. rows_count === 2 * N (no rows lost).
2. No partial-line tail (every line parses cleanly).
3. Both subprocess exit codes are 0.

When all three conditions hold, the single-writer protocol REJECTED the
race-induced corruption window and the scenario reports
`FAIL-REJECTED` (the adversarial-PASS case).

## Expected outcome

`FAIL-REJECTED`. crit-backlog.cjs appendRow uses fs.appendFileSync which is
line-atomic on POSIX-style filesystems; the harness verifies that property
under concurrent writers.
