# P167-T2 per-dispatch ATC, GATE tier

Read only. Spec compliance passed 7/7 with zero findings, so correctness is
settled. Your question is whether this is the right amount of code and whether
any of it is slop.

## The unit

`.../167-T2-CUMULATIVE-DIFF.patch` (f939314 to 5ec8f1c), three files: 95 lines
added to the composer, a new 14-assertion correlation suite, and a policy-test
update. Plan `.../167-01-PLAN-LOCKED.md`, task `P167-T2`. Live tree at 5ec8f1c.

## Apply the 7 steps and the 10-point checklist

1. First principles. Is each piece needed?
2. Delete. Target 10 percent. What can go?
3. Simplify. 95 lines added to a composer that P166 already grew twice. Is the
   correlation logic sitting in the right module, or has the composer become a
   junk drawer? If it belongs elsewhere, say where and whether moving it is worth
   the churn now.
4. Accelerate. Acceptance now does store IO on every prompt record. Bottleneck?
5. Automate. Only what survived 1 to 4.
6. Validate. 7-point.
7. Checklist, one at a time: 1 callers exist; 2 imports used; 3 parameters read;
   4 could be less code; 5 abstractions justified; 6 existing code does 80
   percent; 7 senior engineer would mass-delete; 8 delta complexity at or below
   zero; 9 just-in-case additions; 10 does ONE thing.

## Specific suspicions

- A test-only context override exists on the acceptance path. Spec compliance
  confirmed production never passes it. A test seam in production code is
  sometimes right and sometimes a smell; judge which, and whether it can be
  reached accidentally.
- The `findSgsdRoot(cwd) || realpathSync(cwd)` fallback: is the fallback branch
  actually needed, or is it defensive code for a state that cannot occur?
- P166's ATC found dead residue, a malformed literal, and a test copying the
  production tree. Check all three classes.
- Do the 14 assertions each falsify something distinct, or are there
  near-duplicates under different names?

## Output

```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
DELETABLE_LINES: <int estimate>
DELTA_COMPLEXITY: <negative | zero | positive, one line>
PASS_RATE: <n>/10
ONE_LINER: <summary>
VERDICT: PASS | PASS-WITH-FINDINGS | FAIL
REQUIRED_CHANGES: none | <numbered>
```

FAIL only for a real defect or genuine slop. Max 250 words after the contract
lines.
