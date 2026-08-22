# P166-T2 spec-compliance review, round 2, confirmation only

You returned FAIL on dc8e40e, 11/12, one CRITICAL: falsifier item 9, the
Phase-48 bridge packet cap was weakened because degradation notes were attached
after `_enforcePacketCap`. A fix landed at 2e40c95.

Confirm that one item. Do not re-open the eleven that passed unless the fix
regressed one.

## Check

- Fix diff: `.../166-02-T2-FIX1-DIFF.patch` (dc8e40e to 2e40c95)
- Executor report: `.../166-02-T2-FIX1-REPORT.md`
- Live tree at 2e40c95, `super-gsd/tools/vtp-bridge/classify.cjs`.

1. Notes are attached and costed BEFORE enforcement, and counted in
   `body_token_estimate`.
2. The ceiling is exact. A packet landing exactly on the cap with notes present
   must not exceed it, and cap-minus-one must report one elision plus
   `evidence_packet_size_capped`. An off-by-one either way is a fail.
3. Nothing was dropped silently to fit the budget, and note contents are
   unchanged.
4. T1, P152, P154 and the rest of T2 did not regress.

Note the fix also moved `_substrate_hit_index` assignment ahead of book
filtering, because that path lost raw positions. Confirm that move did not
change which hits are admitted, only their annotation.

## Orchestrator evidence, to audit rather than trust

17/17 exit 0 unsandboxed at 2e40c95. Source read: notes attach at
classify.cjs:431, are costed at :285 inside `_enforcePacketCap`, which runs at
:443; `body_token_estimate` comes from `capResult.tokens` at :504;
`_substrate_hit_index` is assigned at :590.

## Output

```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/12
ONE_LINER: <summary>
VERDICT: PASS | PASS-WITH-FINDINGS | FAIL
REQUIRED_CHANGES: none | <numbered>
```

Max 200 words after the contract lines.
