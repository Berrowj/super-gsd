# P166-T1 per-dispatch ATC, GATE tier

Read only. Apply the ATC 7 steps and the 10-point anti-slop checklist to the
T1 unit diff. Spec compliance already PASSED at 11/11, so do not re-audit
correctness against the plan. Your question is different: is this the RIGHT
AMOUNT of code, and is any of it slop?

## The unit

Cumulative T1 diff, f39200a to e216712:
`.../166-01-T1-CUMULATIVE-DIFF.patch`

Plan authority: `.../166-01-PLAN-LOCKED.md`, task `P166-T1`.
Live tree at e216712.

## The 7 steps, in order

1. First principles. Is each piece needed, or is it there because the plan
   said so? Name anything whose absence would not be noticed.
2. Delete. Target 10 percent reduction. What can go?
3. Simplify. Is delta complexity at or below zero for the brownfield files
   touched? The composer and the enrichment gate both grew; say whether the
   growth bought proportionate enforcement.
4. Accelerate. Any obvious bottleneck? Note that caller-coverage copies and
   scans the production surface and has already hit a 20 second ceiling once
   during development.
5. Automate. Only for what survived 1 to 4.
6. Validate. 7-point validation.
7. Checklist. The 10 anti-slop points, answered one at a time:
   1 every new function has a caller; 2 every import is used; 3 every parameter
   is read; 4 could this be less code; 5 are new abstractions justified;
   6 does existing code already do 80 percent of this; 7 would a senior engineer
   mass-delete this; 8 delta complexity at or below zero; 9 any just-in-case
   additions; 10 does the unit do ONE thing.

## Specific suspicions to test

- Three fix rounds landed on this unit. Fix-round code is where duplication and
  dead branches accumulate. Look for two mechanisms doing the same job, for
  example a leftover check that the later acceptance seam now subsumes.
- The test file is over 500 lines. Is any of it redundant coverage, or does
  each case falsify something distinct?
- `assertPromptContracts` was criticised in review round 1 as prompt-text
  searching. If it still exists alongside the real acceptance path, does it
  still earn its place?

## Output

```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
DELETABLE_LINES: <int estimate>
DELTA_COMPLEXITY: <negative | zero | positive, with one line of justification>
PASS_RATE: <n>/10
ONE_LINER: <summary>
VERDICT: PASS | PASS-WITH-FINDINGS | FAIL
REQUIRED_CHANGES: none | <numbered>
```

FAIL only for a real defect or genuine slop, not for stylistic preference. Max
250 words after the contract lines.
