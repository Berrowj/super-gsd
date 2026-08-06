# Step 9.5 Per-Dispatch ATC (RE-REVIEW) — P146 T146-01 after CRIT+WARN fix

Re-review ONLY. BUDGET: you MUST read the two files below (use whatever read
command your environment provides — reading files is expected and required).
Do NOT run self-tests, benchmarks, or node execution. Do NOT read or grep any
other file. Emit the 5 contract lines FIRST, then
FINDINGS_DETAIL, then stop.

## Files
- super-gsd/scripts/lib/gate-evidence-log.cjs (modified)
- super-gsd/scripts/lib/sgsd-state.cjs (modified)

## Your prior findings — confirm CLOSED or still OPEN, with line evidence
CRIT-1 `_planningDir()` fell back to any resolved input, so logGateEvidence
  could create `<arbitrary>/metrics/gate-evidence.jsonl` outside an SGSD repo.
WARN-2 readGateEvidenceRows read/parsed the entire ledger (OOM/block risk).
WARN-3 frontmatter missed BOM; duplicate keys silently last-win.
WARN-4 duplicate aliases resolvePlanLockedFiles / findPlanLockedForPhase.

Deliberately NOT fixed (do not re-raise, confirm the reasoning is sound):
- Shared envelope-writer extraction with gate-value-log.cjs: that file is
  outside T146-01's allowed_files and backs live gates; recorded as deferred.
- PHASE_SOURCE.STATUS_PROSE retained on purpose: the locked plan's verification
  asserts phaseSource !== "status_prose" and exits 2 if it appears, so the
  constant is the prose-parsing tripwire, not dead code. Confirm a comment now
  documents this.

## Orchestrator host verification (already run — do not re-run)
non-SGSD dir → creates NOTHING, returns null, no throw.
real .planning root → envelope-v1 row appended and parses.
bounded read with limit 5 over 26 rows → 5 rows.
BOM STATE fixture → milestone v9.9, phase 873 parsed.
real repo → milestone v3.5, phase 146, phaseSource current_phase.
exports → findPlanLockedFiles present, resolvePlanLockedFiles gone,
PHASE_SOURCE.STATUS_PROSE retained.
garbage input → no throw.

## Also check for regressions introduced by the fix
- Did the root-bounding change break any legitimate caller shape (e.g. passing
  a repo root vs a .planning dir)? Is the accepted-input contract stated?
- Is the no-op return value distinguishable from a genuine write failure?
- Does the bounded read change default behavior for existing callers?
- Any new throw path, unbounded loop, or silent swallow introduced?

## Report contract (exact — 5 lines FIRST)
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<m>
ONE_LINER: <summary>
FINDINGS_DETAIL: [severity] [dimension] <description>  (one per CRIT/WARN)
