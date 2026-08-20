# P156-T1 per-dispatch ATC — Delete/Simplify + anti-slop over the uncommitted diff

Read only. Changes are UNCOMMITTED: `git diff` for modified files, direct reads for
new files `super-gsd/tools/state-write/write.cjs`,
`super-gsd/tests/state-close-contract/assert-state-write.cjs`,
`super-gsd/hooks/gsd-phase-boundary.sh`.

Apply ATC steps 2 (Delete) and 3 (Simplify) plus the 10-point anti-slop checklist:
- Orphans: every export/function has a caller (writeState CLI + SKILL wiring count).
- Dead imports, unread params, "just in case" branches (YAGNI).
- Could write.cjs (21KB) be materially less code without losing a contract item?
  Name specific deletable blocks if so — do not hand-wave.
- Does the test duplicate fixture machinery that exists in
  super-gsd/tests/propagation-readiness/ helpers? (extend-don't-duplicate check)
- ΔComplexity vs the manual STATE mutation it replaces.

Verdict weight: CRIT only for a real defect or contract violation; WARN for
size/duplication observations. Overnight contract: one fix round max, already spent
on spec review — a WARN here is recorded in SUMMARY, not fixed tonight.

Output, contract lines first, then max 150 words:
```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<n>
ONE_LINER: <summary>
ATC_VERDICT: pass | warn | crit
```
