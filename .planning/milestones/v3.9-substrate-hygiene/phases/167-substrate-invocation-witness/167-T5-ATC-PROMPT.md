# P167-T5 per-dispatch ATC, GATE tier

Read only. Spec compliance passed 7/7 with zero findings after two rounds, so
correctness is settled. Judge whether this is the right amount of code and
whether any of it is slop.

## The unit

`.../167-T5-FULL-DIFF.patch` (1339eab to ca43513): the T5 build plus fourteen
fix rounds. Plan `.../167-01-PLAN-LOCKED.md`, task `P167-T5`. Live tree at
ca43513.

Files include the fixture MCP server, the capture harness, the production hook,
the witness store, three test suites, and the overlay pins.

## Apply the 7 steps and the 10-point checklist

1. First principles. Is each piece needed?
2. Delete. Target 10 percent.
3. Simplify. Fourteen fix rounds is where sediment collects. The capture
   harness in particular accumulated instrumentation across six diagnostic
   rounds. How much of that is still earning its place now the bugs are found,
   and how much is scaffolding that should come out?
4. Accelerate. The capture spawns real Claude processes across three disposable
   projects. Any redundant setup between scenarios?
5. Automate. Only what survived 1 to 4.
6. Validate. 7-point.
7. Checklist, one at a time: 1 callers exist; 2 imports used; 3 parameters read;
   4 could be less code; 5 abstractions justified; 6 existing code does 80
   percent; 7 senior engineer would mass-delete; 8 delta complexity at or below
   zero; 9 just-in-case additions; 10 does ONE thing.

## Specific suspicions

- Diagnostic instrumentation added to chase six separate failures: payload
  comparison, hook lifecycle, tool result, response shape, tally mismatch,
  bypass payload. Each solved its round. Do they all still need to fire on
  failure, or is some of it dead weight now?
- The hook gained bare-array parsing, a fail-safe passthrough, and a new
  terminal state across three rounds. Is that one coherent design or three
  patches sitting next to each other?
- P166's ATC found dead residue, a malformed literal, and a test copying the
  production tree. Check all three classes.
- Comments written during earlier rounds may now describe behaviour that later
  rounds changed. The response-shape and witness-state areas are most at risk.

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

FAIL only for a real defect or genuine slop. This is new-harness code plus a
production repair, so some volume is expected; judge proportion. Max 250 words
after the contract lines.
