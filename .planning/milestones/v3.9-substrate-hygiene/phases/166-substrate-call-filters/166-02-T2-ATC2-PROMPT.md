# P166-T2 ATC, round 2, confirmation only

You returned FAIL on dc8e40e, 7/10, one WARNING: the Phase-48 note matcher
carried just-in-case `doc_id`, `rel_path` and `chunk_id` alternatives beside
`hit_index`, which could over-attach one note to several results. A fix landed
at 2e40c95, removing 21 lines.

Confirm that one finding. Do not re-open what passed.

## Check

- Fix diff: `.../166-02-T2-FIX1-DIFF.patch` (dc8e40e to 2e40c95)
- Executor report: `.../166-02-T2-FIX1-REPORT.md`
- Live tree at 2e40c95.

1. The OR-chain is gone and matching is by `hit_index` alone.
2. Tracing before deletion found that book filtering removed entries before
   `_buildEvidencePacket` assigned `_substrate_hit_index`, so that path lost raw
   positions; the fix indexes hits before filtering. Confirm that is the actual
   cause fixed, not a symptom patched, and that the annotation now survives both
   book filtering and packet elision.
3. No new slop was introduced by the fix: no dead code, no speculative
   parameter, no production-tree copy in a test.
4. The two new cap regressions each falsify something distinct rather than
   restating one another.

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

Max 200 words after the contract lines.
