# P166-T2 per-dispatch ATC, GATE tier

Read only. ATC 7 steps plus the 10-point anti-slop checklist on the T2 unit
diff. Correctness is being audited separately. Your question is whether this is
the right amount of code and whether any of it is slop.

## The unit

`.../166-02-T2-DIFF.patch` (a35dc49 to dc8e40e), 9 files, 813 insertions,
16 deletions. Plan: `.../166-01-PLAN-LOCKED.md`, task `P166-T2`. Live tree at
dc8e40e.

## The 7 steps

1. First principles. Is each piece needed?
2. Delete. Target 10 percent. What can go?
3. Simplify. Delta complexity at or below zero on the brownfield files?
4. Accelerate. Any bottleneck?
5. Automate. Only what survived 1 to 4.
6. Validate. 7-point.
7. Checklist, one at a time: 1 callers exist; 2 imports used; 3 parameters read;
   4 could be less code; 5 abstractions justified; 6 existing code does 80
   percent; 7 senior engineer would mass-delete; 8 delta complexity at or below
   zero; 9 just-in-case additions; 10 does ONE thing.

## Specific suspicions

- T2 propagates the same degradation note through four surfaces: the composer,
  the enrichment gate, direct triage, and the Phase-48 bridge. Is that four
  necessary boundaries or the same logic written four times? The plan justifies
  the gate as a defensive boundary because injected results bypass callVtp.
  Judge whether triage and the bridge earn theirs too.
- T1's ATC found dead residue, a malformed prompt literal, and a test that
  copied the production tree. Check T2 for the same three classes.
- The test file grew again. Does each new case falsify something distinct?

## Output

```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
DELETABLE_LINES: <int estimate>
DELTA_COMPLEXITY: <negative | zero | positive, one line of justification>
PASS_RATE: <n>/10
ONE_LINER: <summary>
VERDICT: PASS | PASS-WITH-FINDINGS | FAIL
REQUIRED_CHANGES: none | <numbered>
```

FAIL only for a real defect or genuine slop, not stylistic preference. Max 250
words after the contract lines.
