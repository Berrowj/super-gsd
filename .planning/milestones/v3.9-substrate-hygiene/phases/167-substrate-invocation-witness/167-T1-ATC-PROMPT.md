# P167-T1 per-dispatch ATC, GATE tier

Read only. Spec compliance already passed 7/7 and its one warning is fixed, so
correctness is settled. Your question is whether this is the right amount of
code and whether any of it is slop.

## The unit

Cumulative T1 diff `.../167-T1-CUMULATIVE-DIFF.patch` (950422a to HEAD), five
files, roughly 83 KB of new source. Plan: `.../167-01-PLAN-LOCKED.md`, task
`P167-T1`. Live tree at HEAD.

## Apply the 7 steps and the 10-point checklist

1. First principles. Is each piece needed? Three new modules landed: a hook, a
   broker, and a witness store. Does each earn its existence, or could two be
   one?
2. Delete. Target 10 percent. What can go?
3. Simplify. The broker implements a stdio MCP router including server-initiated
   requests, pending client responses, upstream exit containment and malformed
   JSON containment. Is that proportionate to sitting in front of one tool, or
   has a general-purpose proxy been built where a narrow guard would do?
4. Accelerate. Any bottleneck on the hot path? The hook runs on every matching
   tool call.
5. Automate. Only what survived 1 to 4.
6. Validate. 7-point.
7. Checklist, one at a time: 1 callers exist; 2 imports used; 3 parameters read;
   4 could be less code; 5 abstractions justified; 6 existing code does 80
   percent; 7 senior engineer would mass-delete; 8 delta complexity at or below
   zero; 9 just-in-case additions; 10 does ONE thing.

## Specific suspicions

- The witness store is 22 KB, the largest of the three, for what is conceptually
  append a row and consume a row. Justified, or over-built?
- P166's ATC rounds found dead residue, a malformed literal, and a test copying
  the production tree. Check for all three classes here.
- The test file is 36 KB for 34 assertions. Does each falsify something
  distinct, or are there near-duplicates under different names?
- The plan's intent under-claims deliberately, per an operator ruling. Check no
  comment or error string over-claims what the mechanism delivers.

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

FAIL only for a real defect or genuine slop, not stylistic preference. This is
new-module code, so some volume is expected; judge proportion, not size alone.
Max 250 words after the contract lines.
