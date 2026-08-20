# P158 plan review — single round (overnight contract), ATC + MUDA

Read only. Plan: `.planning/milestones/v3.6-vtp-bridge/phases/158-notification-routing/158-01-PLAN-LOCKED.md`,
CONTEXT.md beside it, and `super-gsd/hooks/sgsd-intent-classifier.cjs`.

Checks, in order of importance:
1. Is the gate ORIGIN/STRUCTURAL at the payload level BEFORE route evaluation?
   Any phrase-blacklist mechanism is a CRITICAL (it fails falsifier direction 3:
   an operator quoting notification text must still fire).
2. Falsifier covers all three directions with real payload shapes, and the skip
   evidence is a WRITTEN text-free row (absent-row negatives are the P150 seam
   defect; reject them).
3. Existing classifier + KB-shadow self-tests in verification_cmd, unchanged.
4. Scope: no new routes, no predicate weakening, no cosine.
5. MUDA: one task right-sized?

Output, contract lines first, then max 150 words:
```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<n>
ONE_LINER: <summary>
VERDICT: GO | GO-WITH-CHANGES | NOGO
REQUIRED_CHANGES: none | <numbered>
```
