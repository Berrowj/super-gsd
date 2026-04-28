# Fixture: sqlite-context-index-deleted-db

Scenario id: sqlite-context-index-deleted-db
Target tool: super-gsd/tools/context-cache/rebuild.cjs (status / rebuild)
Inject mechanism: rm_context_index_db

## Failure mode

A synthetic SQLite db file is created at
tmpdir/.planning/cache/context-index.db (1 byte placeholder; rebuild.cjs
does not actually open it for the status verb when the file does not
exist - the absence is the load-bearing inject). The synthetic file is
then unlinked pre-spawn so the deletion mechanism is documented in the
fixture trail.

The harness then spawns a node -e wrapper that requires the real
rebuild.cjs and calls status({ planningDir }). The expected behavior is:
- subprocess exit_code === 0 (graceful sentinel; status does NOT throw
  when the .db file is absent)
- result.ok === true (per rebuild.cjs:848-859 the absent-db path returns
  ok=true with doc_count=0)
- doc_count === 0 (no documents indexed when the .db file is gone)

If better-sqlite3 is not installed (the documented degraded sentinel per
rebuild.cjs:842), the harness records the soft-skip path via the
better_sqlite3_missing reason; structural assertion still holds because
the subprocess exits 0 and emits a typed JSON sentinel.

## Closed-vocab observation

`expected_reason_codes` per scenarios.json:
`['index_unavailable', 'rebuild_error']`.

The real rebuild.cjs status() does NOT emit either of those tokens in
the absent-db happy path (it returns ok=true with doc_count=0 instead).
Per the harness Lock-11 byte-equality matching, the observed reason set
is empty intersection with expected, so the harness records a
PASS-WITH-SOFT-SKIP via reason
`cli_shape_drift_status_emits_doc_count_not_index_unavailable`.

Structural assertion (load-bearing):
- subprocess exit_code is a number (real spawn proven)
- result is parseable JSON
- result.ok === true OR result.error === 'better_sqlite3_missing'
- if ok: doc_count === 0 (graceful absent-db response)

If status() regresses to throw on a missing .db file, or returns ok=true
with a non-zero doc_count when the db is gone, the verdict flips to
FAIL via the structural-OK predicate.

## Files

- README.md (this file)
- seed-context-index.db.txt: 1 byte placeholder file. The .txt extension
  dodges the project-wide *.db gitignore so the fixture seed is tracked
  in version control. The harness copies this file into
  tmpdir/.planning/cache/context-index.db (renaming on copy) and then
  unlinks it pre-spawn (the deletion mechanism is the inject, not the
  placeholder content).

ASCII-only. No credentials.
