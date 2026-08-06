# Combined Spec (9.4) + ATC (9.5) — P146 T146-06 cockpit + MCP gate-evidence reader

You MUST read the files below (use whatever read command your environment
provides — reading is required). Do NOT run self-tests, node, or bash. Do NOT
read any other file. Emit the 5 contract lines FIRST, then FINDINGS_DETAIL,
then stop.

## Files
- super-gsd/tools/cockpit-state/adapter.cjs (modified, +68/-1)
- super-gsd/tools/warp-mcp/server.cjs (NOT modified — the executor claims MCP
  inherits the signal via existing adapter delegation; verify that claim in
  source and judge whether it is genuinely sufficient)

## PART A — spec compliance
output_contract: expose missing-plan gate-evidence rows through BOTH the
cockpit adapter output and the MCP reader output. READS
`.planning/metrics/gate-evidence.jsonl` (owned by T146-01); must NOT create,
append, or rewrite that stream.

falsifier — FAILS if: the adapter cannot surface the row within one refresh;
MCP output disagrees with the adapter; the reader WRITES to the ledger; or
missing evidence degrades the WHOLE snapshot instead of only the governance
signal.

## PART B — ATC through this phase's recurring defects
1. **Silent success** (CRITICAL in T146-03 and T146-04). If the ledger is
   unreadable for an unexpected reason (permissions, directory-instead-of-file,
   partial write mid-read), does the governance signal show as *unavailable*
   with a breadcrumb, or does it silently render as "no problems found"? Those
   are opposite meanings on a dashboard: an empty signal must not be
   indistinguishable from a broken reader. The section currently carries a
   `breadcrumb` field — is it actually populated on failure paths?
2. **Error handlers that can themselves throw.** Are the read/parse guards
   wrapped, including the per-line JSON parse?
3. Unbounded growth: `readGateEvidenceRows` is called with `limit: 100`. Is
   that limit applied at READ time (tail) or after loading the whole file? If
   the latter, a large ledger still costs full I/O every refresh — the exact
   WARNING raised against T146-01's reader.
4. Signal correctness: `missing_plan` rows accumulate forever, so a plan
   created LATER does not retract an earlier row. Does the surfaced signal
   represent CURRENT state or stale history? A cockpit tile claiming
   "missing plan" for a phase that now has one is a false alarm. Judge whether
   dedupe/recency/phase-scoping is needed, and say so concretely.
5. Anti-slop: is any part of the added surface unused by a consumer
   (`missing_plan_count`, `source`, `limit`, `breadcrumb`)? Dead schema is
   still dead code.
6. Did it touch anything in these large shared files beyond what T146-06 needs?

## Verified by the orchestrator already (17/17 — do NOT re-run)
A row emitted by the REAL T146-05 hook surfaces in `adapter --json` with the
correct phase (991) and file_path (touched.js). MCP delegates to the adapter
(single source; no private re-parse of the ledger). Ledger ABSENT → exit 0,
full snapshot, governance = `{"missing_plan":[],"missing_plan_count":0,
"source":"gate-evidence.jsonl","limit":100,"breadcrumb":null}` (stable empty
shape, not a degraded snapshot). Ledger EMPTY → same. Corrupt line followed by
a valid row → valid row (994) still surfaced, exit 0. Ledger byte-identical
after two adapter runs (read-only proven). Non-SGSD cwd → no stack trace.

## Report contract (exact — 5 lines FIRST)
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<m>
ONE_LINER: <SPEC_VERDICT pass|fix_required|blocked + ATC summary>
FINDINGS_DETAIL: [severity] [dimension] <description>  (one per CRIT/WARN)
