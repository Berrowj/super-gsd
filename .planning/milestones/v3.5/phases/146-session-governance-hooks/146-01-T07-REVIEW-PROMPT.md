# Combined Spec (9.4) + ATC (9.5) — P146 T146-07 (+07b) cheap fixes & deferred items

You MUST read the files below (use whatever read command your environment
provides — reading is required). Do NOT run self-tests, node, or bash. Do NOT
read any other file. Emit the 5 contract lines FIRST, then FINDINGS_DETAIL,
then stop.

## Files
- super-gsd/scripts/sgsd-stop-handoff.sh (modified)
- super-gsd/tools/autopilot-watchdog/check.cjs (modified)
- super-gsd/hooks/sgsd-session-start.js (modified — DEFERRED-D)
- super-gsd/config/model-routing.json (modified)
- super-gsd/config/planning-config-overlay.json (modified)

## PART A — spec compliance (locked output_contract)
Reset the handoff-chain latch when the latest valid row is `reason: refused`;
move autopilot-watchdog phase resolution to the shared STATE frontmatter
helper; unregister dead `gsd-atc-slice-gate.js` references; delete dead
token/context config knobs. `settings-overlay.json` edits are cleanup-only and
must NOT rewrite T146-02 repo-local hook entries or `sgsd_managed` markers.

falsifier — FAILS if: refused handoff rows still preserve stale depth; the
watchdog reads phase from a prose regex; dead hook registration remains live;
or dead config knobs remain under super-gsd runtime config.

Note for your judgement: `gsd-atc-slice-gate.js` was NOT modified. Phase
research found it absent from `super-gsd/hooks` with only planning-note
mentions — i.e. nothing live to unregister. Confirm from the sources you can
see whether that leaves the falsifier satisfied or genuinely unmet.

## PART B — ATC through this phase's THREE recurring defects
1. **Writer accepts a caller-supplied destination** (CRITICAL in T146-01, twice
   in T146-02). Any new write path here? Check the watchdog's and the handoff
   script's write/derive behavior.
2. **Silent success** (CRITICAL in T146-03, T146-04, T146-06). DEFERRED-D was
   specifically about the SessionStart outer guard swallowing pre-context
   failures with no breadcrumb. Is the breadcrumb emitted on EVERY pre-context
   path, or only some? Can it print a stack, or exit nonzero? Does it ever
   suppress the mandatory governance contract?
3. **Error handlers that can themselves throw.**

Also check:
4. Handoff latch correctness: the fix treats the LATEST row being `refused` as
   depth 0. What if the latest row is malformed, or `refused` follows a deeper
   legitimate chain, or rows are out of order? Could this now UNDER-count depth
   and let a runaway chain through? Under-counting is the failure mode that
   matters — the latch exists to stop infinite handoff loops.
5. Watchdog: does it degrade gracefully when `readState` returns null, and does
   any prose-parsing fallback genuinely remain removed (not merely unreachable)?
6. Config deletions: only the intended keys removed? Parent objects retained
   sensibly? Both files still valid JSON with unchanged style?
7. Anti-slop across the diff.

## Verified by the orchestrator already (do NOT re-run)
`bash -n` on the handoff script, `node --check` on both JS files, and
`--self-test-phase-resolution` all pass on the host. Adapter self-test 19/19 on
the host (the executor's sandbox reported A7/A10 failures; a stash-and-compare
proved those are sandbox artifacts present with AND without the change).
Prose-regex patterns are gone from the watchdog, which now requires
`scripts/lib/sgsd-state.cjs`. DEFERRED-D: forced failure → exit 0, no stack,
governance contract still emitted, phase still resolved; bad `cwd` type → exit
0, no stack; non-SGSD → silent, zero writes. DEFERRED-E needed no edit — the
reader already tail-reads (100 rows from a 5000-row ledger in 4ms, tail
confirmed). Adapter still surfaces a real T146-05 row afterwards. Config: both
files parse, no non-markdown occurrences of the three keys remain, diff limited
to those deletions.

## Report contract (exact — 5 lines FIRST)
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<m>
ONE_LINER: <SPEC_VERDICT pass|fix_required|blocked + ATC summary>
FINDINGS_DETAIL: [severity] [dimension] <description>  (one per CRIT/WARN)
