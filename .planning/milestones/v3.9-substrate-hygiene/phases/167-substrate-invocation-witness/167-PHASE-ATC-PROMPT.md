# P167 phase-level ATC

Read only. Per-dispatch ATC ran on all five tasks and all are now PASS. This is
the PHASE boundary review: judge the phase as one delivered thing.

## The unit

Full phase diff `.../167-PHASE-DIFF.patch` (950422a to HEAD). Plan
`.../167-01-PLAN-LOCKED.md`. Live tree at HEAD.

The phase shipped five tasks across roughly twenty fix rounds, including a
production defect found only by the live capture.

## Apply the 7 steps and the 10-point checklist to the phase as a whole

1. First principles.
2. Delete. Target 10 percent.
3. Simplify. Does the phase read as one design or as accumulated repair? The
   hook, the store, the broker, the capture harness and four test suites all
   grew together.
4. Accelerate.
5. Automate.
6. Validate. 7-point.
7. Checklist, one at a time.

## Specific questions

1. Do the five tasks compose? Does any later task undo an earlier guarantee?
2. Is there ONE place that owns witness state, or several that agree by
   coincidence?
3. Twenty fix rounds usually leave sediment. Look for two mechanisms doing one
   job, comments describing behaviour later rounds changed, and tests asserting
   the same thing twice.
4. Delta complexity for the phase. Individual ATCs reported positive. Was the
   growth bought or spent?
5. Is the phase revertible as the plan promised, given the fix commits between
   tasks?
6. The plan under-claims deliberately per an operator ruling. Check nothing in
   the phase overclaims protection against a same-user actor.

## Output

```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
DELETABLE_LINES: <int estimate>
DELTA_COMPLEXITY: <negative | zero | positive, one line>
COHERENCE: <one line: one design, or accumulated patches>
PASS_RATE: <n>/10
ONE_LINER: <summary>
VERDICT: PASS | PASS-WITH-FINDINGS | FAIL
REQUIRED_CHANGES: none | <numbered>
```

Max 300 words after the contract lines.
