# Fixture: route-ledger-truncated-stream

Scenario id: route-ledger-truncated-stream
Target tool: super-gsd/scripts/lib/route-ledger.cjs (readRows)
Inject mechanism: partial_line_jsonl_write

## Failure mode

The harness pre-writes a deliberately truncated JSONL stream to:

  tmpdir/.planning/metrics/route-decisions.jsonl

The stream contains:
  Line 1: a complete envelope-v1 row (ends with \n)
  Line 2: a complete envelope-v1 row (ends with \n)
  Line 3: a partial JSON fragment with NO trailing newline (e.g. a
          process crashed mid-appendFileSync; the run_id field never
          finished writing)

The harness then spawns a node -e wrapper that requires the real
route-ledger.cjs and calls:

  readRows(planningDir)

The real readRows (route-ledger.cjs:202-212) reads the file with
readFileSync, splits on /\r?\n/, filters Boolean (drops empty trailing
empty-string after a final newline), and JSON.parses each line under
try/catch (returning null on parse failure), then drops nulls. The
expected behavior is:
- readRows returns exactly 2 rows (the 2 valid envelope-v1 entries)
- the partial-line tail is silently dropped
- subprocess exit_code === 0
- the on-disk file is byte-untouched (readRows is read-only)

## Closed-vocab observation

`expected_reason_codes` per scenarios.json:
`['row_skipped_invalid', 'tail_skipped_partial_line']`.

The real readRows does NOT emit a closed-vocab reason on the implicit
skip - it silently drops malformed lines via the inline try/catch
(lines 209-211). The harness synthesizes both expected codes when the
structural assertion holds:
- valid rows count === 2 (the 2 well-formed lines retained)
- raw line count from split >= 3 (the partial tail was present pre-read)
- subprocess exit_code === 0

This mirrors S1 (token-attribution-poisoned-row) which also synthesizes
`parse_skipped_malformed_row` from a structural fact.

Structural assertion (load-bearing):
- subprocess exit_code is a number (real spawn proven)
- wrapper.ok === true
- rows.length === 2 (the 2 valid envelope-v1 entries survived)
- canonical_byte_equal === true (route-decisions.jsonl in tmpdir was
  not rewritten by readRows; its sha256 digest pre/post call is stable)

If readRows regresses to throw on the partial tail (CRIT regression),
or starts mutating the file (Lock 11 byte-equality violation), or
loses one of the valid rows (defensive-skip too aggressive), the verdict
flips to FAIL.

## Files

- README.md (this file)
- seed-valid-row-1.jsonl: first valid envelope-v1 route-decision row
- seed-valid-row-2.jsonl: second valid envelope-v1 route-decision row
- seed-partial-line.txt: partial JSON fragment (NO trailing newline)
  appended after the two valid rows to simulate mid-write truncation

ASCII-only. No credentials. The fixture files use the .jsonl extension
on the rows so the contents are recognizable as line-oriented JSON
inputs; the partial tail uses .txt so it is plainly NOT a complete JSON
document.
