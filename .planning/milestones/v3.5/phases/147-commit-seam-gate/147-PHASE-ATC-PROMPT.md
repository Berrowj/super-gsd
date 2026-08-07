# P147 PHASE-LEVEL ATC — Commit-Seam Gate (tier: GATE)

Review the ENTIRE phase as one unit. ATC 7-step + 10-point anti-slop.
You MUST read the files listed (reading is required). Do NOT run
self-tests/node/bash/git — 19/19 scenarios pass host-side; sandbox git spawn
is EPERM-blocked. Emit the 5 contract lines FIRST, then FINDINGS_DETAIL.

## Phase surface (read all)
- super-gsd/scripts/lib/sgsd-artifact-conventions.cjs
- super-gsd/scripts/lib/commit-gate-shadow-log.cjs
- super-gsd/scripts/lib/commit-gate-shadow-report.cjs
- super-gsd/hooks/sgsd-commit-gate.cjs
- super-gsd/scripts/install-commit-gate.cjs
- super-gsd/docs/commit-gate.md

## Review history (do NOT re-litigate)
Per-dispatch: 2 CRIT closed at T147-01 (circular delete containment;
dot-config bypass). Phase-verify: 4 gaps closed (tamper-evident activation
w/ digest + mode_file_invalid degradation; per-repo falsifier floors +
no_source_evidence codes; block requires persisted evidence row;
convention_basis evidence-vs-heuristic). Test-fixture bug fixed (line 1254).
19/19 scenarios incl. real `git commit` through the installed trampoline in
warn AND forced-block modes, tamper detection flipping block→warn.

## Judge the phase as a WHOLE
1. Coherence with P146: same containment contract (resolveContainedPath,
   independent root derivation), same envelope conventions, same degradation
   vocabulary? Or does this phase fork the patterns?
2. The milestone's two defect classes (15 CRITICALs total so far): is this
   surface structurally immune, or patched? Name any writer/deleter not
   routing through the contract, any degradation without a reason code.
3. Delete/simplify: total new surface ~2.5k lines across 6 files. What could
   go? Duplicated logic between shadow-log and gate-evidence-log (both
   envelope-v1 writers — justified separation or copy-paste)? Hand-rolled
   staged-diff parsing vs simpler alternatives?
4. Always-on cost: the hook runs on EVERY commit. Is per-commit cost bounded
   (diff parse, convention discovery, ledger append)? Any unbounded read?
5. Security: the trampoline executes from the COMMON git dir across
   worktrees; the mode file gates blocking; the sentinel bypasses. Any
   privilege/tamper path not already covered by the digest + refusal design?
6. Anti-slop 1-10. Would a senior engineer mass-delete anything?

## Report contract (exact — 5 lines FIRST)
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<m>
ONE_LINER: <summary>
FINDINGS_DETAIL: [severity] [dimension] <description>  (one per CRIT/WARN)
