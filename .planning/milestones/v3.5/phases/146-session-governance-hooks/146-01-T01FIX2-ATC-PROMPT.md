# Step 9.5 ATC (RE-REVIEW 2) — P146 T146-01 CRIT-1 tightening

Re-review ONLY. You MUST read the one file below (use whatever read command
your environment provides — reading files is expected and required). Do NOT
run self-tests, benchmarks, or node execution. Do NOT read or grep any other
file. Emit the 5 contract lines FIRST, then FINDINGS_DETAIL, then stop.

## File
- super-gsd/scripts/lib/gate-evidence-log.cjs (modified)

## Your prior CRIT-1 (partially open) — confirm CLOSED or still OPEN with line evidence
"`_planningDir()` still accepts an arbitrary existing `.planning` directory
without requiring `STATE.md`: direct `.planning` input returns early, and
repo-root/direct-child `.planning` returns early, before the `_hasStateFile`
guard used only for the ancestor path."

Required: EVERY resolution path (direct `.planning`, repo-root/direct-child,
ancestor walk) must require `.planning/STATE.md` before returning a writable
ledger dir; otherwise no-op, create nothing, never throw.

## Orchestrator adversarial host verification (already run — do not re-run)
bare `.planning` no STATE.md, direct form → no-op, ZERO files created.
bare `.planning` no STATE.md, parent form → no-op, ZERO files created.
`.planning/metrics/` present but no STATE.md → no-op, no ledger.
no `.planning` at all → ZERO files created.
`.planning` WITH STATE.md, direct form → row written, status ok.
`.planning` WITH STATE.md, parent form → row written.
row parses as envelope-v1 with correct signal.
bounded read honors limit; garbage input never throws; real repo resolver
unchanged (v3.5 / 146 / current_phase).

## Also check for regressions introduced by this tightening
- Is the accepted-input contract now documented at the resolver?
- Any path that could still return a dir without STATE.md (symlinked
  .planning, STATE.md as a directory rather than a file, case-sensitivity on
  Windows vs POSIX, race between check and write)?
- Is the no-op return still distinguishable from a genuine write failure?
- Any new throw path, unbounded loop, or silent swallow?

## Report contract (exact — 5 lines FIRST)
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<m>
ONE_LINER: <summary>
FINDINGS_DETAIL: [severity] [dimension] <description>  (one per CRIT/WARN)
