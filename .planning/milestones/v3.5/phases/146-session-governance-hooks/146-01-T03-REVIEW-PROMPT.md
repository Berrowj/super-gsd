# Combined Spec-Compliance (9.4) + ATC (9.5) — P146 T146-03 SessionStart hook

You MUST read the file below (use whatever read command your environment
provides — reading is required). Do NOT run self-tests, node, or bash. Do NOT
read any other file. Emit the 5 contract lines FIRST, then FINDINGS_DETAIL,
then stop.

## File
- super-gsd/hooks/sgsd-session-start.js (modified)

## PART A — spec compliance
output_contract: SessionStart injects the governance contract containing the
ATC tier table, gate table, a mode-confirmation note (same gates in every mode;
mode changes WHO confirms, not WHAT runs), and active milestone/phase read from
the repo at the payload's `cwd`. Non-SGSD cwd → quiet exit 0. Must CONSUME the
T146-01 shared helpers (sgsd-state.cjs, gate-evidence-log.cjs), not reimplement
STATE parsing or JSONL writing. Append ONLY `state_phase_missing` rows, and only
when inside a real SGSD repo whose STATE lacks a phase.

falsifier — FAILS if: no first-turn governance context; missing active
milestone/phase; blocks the session; or emits context in a non-SGSD directory.

## PART B — ATC (7-step + anti-slop + the phase's recurring defect)
1. RECURRING DEFECT CHECK (this phase has shipped this CRITICAL twice — in
   T146-01's evidence writer and T146-02's installer): does this hook DERIVE
   every path from `payload.cwd` via the shared resolver, or does it anywhere
   accept/trust a caller-supplied destination? Trace every write.
2. Does it reimplement anything T146-01 already owns (STATE frontmatter
   parsing, root walk, JSONL append)? Duplication here is a delete finding.
3. Never-throw discipline: is EVERY path wrapped so an unexpected error exits 0
   with no stack trace? Any `process.exit(nonzero)`, uncaught throw, or unawaited
   rejection reachable?
4. Could it ever BLOCK a session — emit `decision`, `continue:false`, or exit
   nonzero on a normal SessionStart? That is a board-binding violation.
5. Does it read, log, or echo `~/.claude/settings.json` or any env value?
6. Anti-slop: dead exports, unused options, speculative branches, "just in
   case" surface. Is the contract text itself bloated (it is injected into
   EVERY session's first turn — token cost is real)? Suggest concrete cuts if so.
7. Did it preserve the hook's pre-existing handoff-pairing behavior?

## Context already verified by the orchestrator (do NOT re-run)
21/21 adversarial host checks pass: fixture repo with milestone v9.9 /
current_phase 873 → contract emitted containing v9.9 and 873, and containing
NEITHER this repo's v3.5 NOR 146 (proves resolver read, not hardcoding);
non-SGSD cwd → exit 0, empty stdout, zero files written; SGSD repo whose STATE
lacks a phase → exit 0, contract still emitted, exactly one state_phase_missing
row; empty/garbage/null stdin → exit 0 with no stack trace; nonexistent cwd →
exit 0.

## Report contract (exact — 5 lines FIRST)
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<m>
ONE_LINER: <SPEC_VERDICT pass|fix_required|blocked + ATC summary>
FINDINGS_DETAIL: [severity] [dimension] <description>  (one per CRIT/WARN)
