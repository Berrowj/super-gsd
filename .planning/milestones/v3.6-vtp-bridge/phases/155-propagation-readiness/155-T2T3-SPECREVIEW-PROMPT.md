# P155-T2-T3 spec-compliance review (GATE tier)

Read only. Did the executor implement task P155-T2-T3 exactly? Raw evidence:

1. The task block in `155-01-PLAN-LOCKED.md` — contract, falsifier, stop_rule.
2. Raw diff: `git diff -- super-gsd/` yourself, or `155-T2T3-DIFF.txt` in the phase dir,
   spot-checked against the working tree.
3. Executor report `155-T2T3-REPORT.md` — note it honestly reported 2 of 3 harnesses
   sandbox-blocked (EPERM on child spawn, 171 pass / 77 process-blocked).
4. Orchestrator evidence: ALL THREE verification commands exit 0 outside the sandbox:
   assert-install-layout --case all; audit.cjs --self-test; assert-dual-root-resolvers
   --tool all --case full-matrix.

Falsifier clauses to check against the diff specifically:
- any named reader retaining a private phase-name regex or single-root assumption
  (grep the four consumers + audit.cjs + resolve.cjs for residual /^\d/ phase patterns)
- the installer change separable from consumer safety (they must be one change set)
- v/decimal/integer divergence, absent-root errors, realpath duplicates processed twice
- fixtures mutated (mutation sentinels)
- the T4b BOUNDARY: resolve.cjs changes must be confined to phase-NAME parsing and
  folder discovery; evidence-tier logic, confidence values and repair recommendations
  must be bit-identical for integer names. Flag ANY tier-semantics drift as CRITICAL —
  that is T4b's scope and mixing it here destroys the next task's fixture baseline.

Output, contract lines first, then max 200 words:
```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<n>
ONE_LINER: <summary>
SPEC_VERDICT: pass|fix_required|blocked
MISSING_REQUIREMENTS: none|<list>
EXTRA_SCOPE: none|<list>
BOUNDARY_T4B: clean|violated — <evidence>
```
