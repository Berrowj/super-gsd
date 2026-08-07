# P147 T147-02 — shadow-ledger writer/reader (commit-gate-shadow.jsonl)

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer: fresh context, THIS TASK ONLY (T147-02 of 5). Verify before
reporting. Explicit DONE / DONE_WITH_CONCERNS / BLOCKED.

## ⚠️ THE TWO DEFECT CLASSES (11 P146 CRITICALs + 2 already in THIS phase)
1. **Writer/deleter accepts a caller-supplied destination.** T147-01 just
   shipped a CIRCULAR containment bug: `resolveContainedPath(dirname(x),
   basename(x))` — proving x is contained relative to its own parent, true of
   every path. THE INVARIANT IS NOT "calls resolveContainedPath"; it is
   "**derives the containment ROOT independently of the target**". Your writer
   derives the SGSD root via `findSgsdRoot`/STATE presence, then resolves
   `.planning/metrics/commit-gate-shadow.jsonl` INSIDE that root via
   `resolveContainedPath(root, relativeSubpath)`. Never accept an absolute
   destination from a caller.
2. **Silent success.** Every degraded path (no root, containment refused,
   append failed, malformed input) gets a distinct reason code and — where a
   root is known — a row; plus a non-stack stderr breadcrumb. Never a bare
   warn, never empty-equals-ok.

## Files you may touch
- `super-gsd/scripts/lib/commit-gate-shadow-log.cjs` (CREATE — this task owns it)
- `super-gsd/tests/commit-gate/assert-real-commit-gate.cjs` (EXTEND with
  shadow-ledger scenarios; do not weaken T147-01 scenarios)
- `.planning/metrics/commit-gate-shadow.jsonl` (may be created by the writer)

## Output contract (locked plan)
Never-throw append/read helper for `.planning/metrics/commit-gate-shadow.jsonl`.
Rows are envelope-v1 (mirror gate-evidence-log.cjs conventions) PLUS:
`signal`, `repo_id`, `commit_candidate`, `diff_sha256`,
`artifact_predicate_version`, `artifact_convention_status`, `staged_paths`,
`would_warn`, `would_block`, `false_block_basis`, `waived_paths`,
distinct `reason_codes`. Per-path evidence in EVERY row (the T147-01
evaluatePaths records): a row without per-path evidence is a defect (VTP
directive — the false-block rate is computed from per-path data).

## Falsifier — task FAILS if any holds
Writer accepts caller-supplied absolute destinations; writes outside the SGSD
root; omits per-path evidence; embeds binary content (hash it — diff_sha256 —
never inline); or treats a degraded path as clean.

## Required API (T147-03/04/05 depend on these names)
- `appendShadowRow(root, row)` → envelope-v1 row or null; never throws;
  refuses when root invalid/containment fails (breadcrumb + null).
- `readShadowRows(root, {limit})` → bounded TAIL read (cost proportional to
  limit, not file size — P146's reader already models this) returning
  { rows, skipped_line_count }; malformed lines counted, never dropped
  silently.
- `shadowLedgerPath(root)` → contained path or null (exported for tests).

## Verify (report exact exit codes) — stop_rule made executable
1. `node --check` both files.
2. Contained write: fixture SGSD repo → row appended, parses as envelope-v1,
   contains staged_paths AND per-path evidence fields.
3. ESCAPE attempts refused, NOTHING created: (a) caller-supplied absolute
   temp path as root; (b) root whose `.planning` is a junction/symlink to an
   outside dir (skip with printed reason if links need elevation); (c) bare
   `.planning` with no STATE.md.
4. Degraded row: append into a fixture where metrics is a FILE → no throw,
   breadcrumb, distinct reason code returned.
5. Bounded read: 3000-row ledger, limit 100 → 100 rows, tail, fast; 2 corrupt
   lines interleaved → skipped_line_count===2, valid rows still returned.
6. Binary discipline: a row given a Buffer/binary-ish diff content must store
   only a sha256 hex, never raw bytes (assert the written line is valid UTF-8
   JSON with no replacement chars).
7. Re-run ALL T147-01 scenarios you can (sandbox may block git spawn EPERM —
   say so; orchestrator re-runs host-side).
Build JSON with JSON.stringify. SURGICAL CONSTRAINT as always.

## Report contract (<300 words)
FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / SCRIPTS_CREATED / ONE_LINER
