# P156-T2 per-dispatch ATC — Delete/Simplify + anti-slop over the uncommitted diff

Read only. Changes UNCOMMITTED: `git diff super-gsd/scripts/lib/orchestrator-hooks.cjs
super-gsd/skills/sgsd-orchestrate/SKILL.md`; direct reads for new
`super-gsd/tools/phase-close/check.cjs` and
`super-gsd/tests/state-close-contract/assert-phase-close-route.cjs`.

Apply ATC steps 2 (Delete) and 3 (Simplify) plus the 10-point anti-slop checklist:
orphans, dead imports, unread params, YAGNI branches, could-be-less-code (name the
deletable blocks specifically), extend-don't-duplicate (does check.cjs re-parse
frontmatter machinery that exists elsewhere in super-gsd/scripts/lib or tools?),
ΔComplexity vs the dead-end it removes.

Verdict weight: CRIT only for real defect/contract violation; WARN observations are
recorded in SUMMARY, not fixed tonight (fix round already spent this phase-gate).

Output, contract lines first, then max 120 words:
```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<n>
ONE_LINER: <summary>
ATC_VERDICT: pass | warn | crit
```
