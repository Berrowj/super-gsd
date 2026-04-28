# Fixture: token-attribution-poisoned-row

Scenario id: token-attribution-poisoned-row
Target tool: super-gsd/tools/token-attribution/report.cjs (summarize)
Inject mechanism: append_malformed_jsonl_row

## Failure mode

Five valid envelope-v1 rows are seeded into
tmpdir/.planning/metrics/agent-token-spend.jsonl, then one deliberately
malformed JSONL line (truncated mid-string, no closing brace, no newline)
is appended via fs.appendFileSync. The harness then spawns a node -e
wrapper that requires the real report.cjs and calls
`summarize(planningDir, { groupBy:'role' })`.

The real `_readRows` in report.cjs (line 293-312) has a per-line
try/catch around JSON.parse that returns null on parse error and filters
out null rows. The expected behavior is: aggregate based on the 5 valid
rows; the malformed line is silently skipped; the function does NOT
throw.

## Closed-vocab observation

`expected_reason_codes` per scenarios.json: `parse_skipped_malformed_row`.

The real summarize() does not emit a closed-vocab reason code on the
skip; the skip is implicit. The harness observes the implicit skip via:
- subprocess exit_code === 0 (no throw)
- stdout JSON parses to an array with `calls` count matching valid row
  count (i.e. 5 rows -> aggregate `calls` field reflects 5)
- live planning dir byte-equal pre/post (Lock 4 anti-pollution)

If the implicit-skip semantic regresses (e.g. summarize starts throwing
on malformed rows), the scenario verdict flips to FAIL via Lock 13's
exit_code !== 0 path.

## Files

- README.md (this file)
- seed-rows.jsonl: 5 valid envelope-v1 token-attribution rows
- poisoned-row.txt: 1 truncated JSON line appended after the seed rows

ASCII-only. No credentials.
