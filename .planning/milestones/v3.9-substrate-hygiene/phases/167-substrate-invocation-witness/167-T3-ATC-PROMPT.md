# P167-T3 per-dispatch ATC, GATE tier

Read only. Spec compliance passed 9/9 with zero findings, so correctness is
settled. Judge whether this is the right amount of code and whether any is slop.

## The unit

`.../167-T3-CUMULATIVE-DIFF.patch` (be6cfa1 to 386d027), four files: two agent
prompts, a new 4-assertion contract test, and an inventory correction in the P166
policy test. Plan `.../167-01-PLAN-LOCKED.md`, task `P167-T3`. Live tree at
386d027.

## Apply the 7 steps and the 10-point checklist

1. First principles. Is each piece needed?
2. Delete. Target 10 percent.
3. Simplify. The shared contract wording is duplicated across two prompts and
   modelled for two more. Is duplicated prose the right call here, given prompts
   cannot import, or should it be generated?
4. Accelerate. Any bottleneck?
5. Automate. Only what survived 1 to 4.
6. Validate. 7-point.
7. Checklist, one at a time: 1 callers exist; 2 imports used; 3 parameters read;
   4 could be less code; 5 abstractions justified; 6 existing code does 80
   percent; 7 senior engineer would mass-delete; 8 delta complexity at or below
   zero; 9 just-in-case additions; 10 does ONE thing.

## Specific suspicions

- Prompt prose is where dead instruction accumulates. Does the added contract
  contradict anything already in these prompts from P166, or restate it? A
  prompt that says the same thing twice in different words is worse than one
  that says it once.
- Four assertions for four surfaces looks thin next to T1's 34 and T2's 13. Is
  the coverage proportionate to what can go wrong here, or is it one assertion
  per file with no real falsification?
- The prompts describe a readiness command and an acceptance command. Are those
  the real command names as shipped, or has prose drifted from the actual CLI?
  A prompt naming a command that does not exist is a live defect.
- P166's ATC found dead residue, a malformed literal, and a test copying the
  production tree. Check all three classes.

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

Max 250 words after the contract lines.
