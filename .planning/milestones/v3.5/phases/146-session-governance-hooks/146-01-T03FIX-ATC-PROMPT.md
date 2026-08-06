# ATC RE-REVIEW — P146 T146-03 after 2 CRIT + 1 WARN fix

Re-review ONLY. You MUST read the file below (use whatever read command your
environment provides — reading is required). Do NOT run self-tests, node, or
bash. Do NOT read any other file. Emit the 5 contract lines FIRST, then
FINDINGS_DETAIL, then stop.

## File
- super-gsd/hooks/sgsd-session-start.js (modified)

## Your prior findings — confirm CLOSED or still OPEN with line evidence
CRIT-1 `main()` had no top-level guard: `resolveContext(payload)` could
  propagate from findSgsdRoot, `readState(ctx.root)` was outside any try, and
  catch blocks called `logStatePhaseMissing()` unguarded, so `logGateEvidence()`
  could throw with a stack and nonzero exit.
CRIT-2 `emitGovernanceContext()` ran optional checkpoint/memory briefing BEFORE
  `console.log()`, so an unexpected filesystem error suppressed the governance
  contract entirely.
WARN-1 failure catch paths reused `state_phase_missing` rows for
  `session_start_governance_failed` and `session_start_handoff_pairing_failed`,
  producing misleading duplicate missing-phase evidence.

## Orchestrator host verification (31/31 pass — do NOT re-run)
Preserve: fixture v9.9/873 emits contract with those values and neither v3.5
nor 146; non-SGSD cwd exit 0 + empty stdout + zero files; empty/garbage/null
stdin exit 0 no stack; nonexistent cwd exit 0; never emits decision/continue.
Environment-failure matrix (new): `.planning/metrics` created as a FILE so the
evidence append must fail → exit 0, no stack, contract STILL emitted;
ORCHESTRATOR-CHECKPOINT.md created as a DIRECTORY → exit 0, no stack, contract
still emitted, phase 555 still resolved; corrupt/NUL-byte STATE frontmatter →
exit 0, no stack; STATE.md as a DIRECTORY → exit 0, no stack; repo WITH a phase
plus a failing optional section → ZERO state_phase_missing rows (reason
fidelity holds).

## Also check for regressions introduced by the fix
- Is the mandatory contract genuinely composed+emitted before ANY optional
  enrichment, on every path — including when the resolver returns partial state?
- Can the top-level guard swallow a genuine programming error so silently that
  a broken hook looks healthy forever? Is there any failure-evidence row or
  stderr breadcrumb (that is NOT a stack trace) for diagnosis?
- Does any optional section still run before emission on some branch?
- Are the new distinct reason codes actually distinct, and still envelope-v1 via
  the T146-01 writer (no second writer introduced)?
- Any dead code left from the restructure?

## Report contract (exact — 5 lines FIRST)
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<m>
ONE_LINER: <summary>
FINDINGS_DETAIL: [severity] [dimension] <description>  (one per CRIT/WARN)
