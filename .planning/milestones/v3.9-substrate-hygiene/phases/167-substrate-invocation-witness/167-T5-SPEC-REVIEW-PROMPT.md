# P167-T5 spec-compliance review

Read only. Judge the SHIPPED CODE against the LOCKED PLAN, task `P167-T5`.

## Artifacts

- Plan `.../167-01-PLAN-LOCKED.md` revision 3, task `P167-T5`.
- Diff `.../167-T5-CUMULATIVE-DIFF.patch` (1339eab to 99a8790).
- The written evidence `.../167-REAL-MCP-HOOK-EVIDENCE.json`.
- Live tree at 99a8790.

## What actually happened, so you judge the right thing

The capture PASSES and the evidence re-verifies independently:

```
active_path PASS   absent_guard PASS   same_user_bypass PASS
P167_T5_CAPTURE PASS schema=sgsd.p167.real-mcp-hook-evidence.v1
P167_T5_VERIFY  PASS {"active_invocations":1,"absent_invocations":0,
                      "same_user_bypass_invocations":2}
```

Getting there required changing a PRODUCTION file, the hook, because the capture
found a real defect: `parseMcpDomain` rejected arrays and expected
`toolResponse.content`, while the runtime delivers the content array itself.
Valid searches were being replaced with
`substrate_witness_rewrite_failed:malformed_response`.

## Work the falsifier

1. Does the evidence file contain everything the plan's `input_contract`
   enumerates: schema and version, capture time, hook IDs, source and
   registration hashes, broker and manifest hashes, fixture hash, prepared and
   actual payload digests, redacted session and tool-use hashes, denial reason,
   invocation count, character counts, degradation reason, discarded-marker
   absence, witness state sequence, acceptance result, and a separate
   `absent_guard` object? Name anything missing.
2. Is the evidence internally consistent with the three scenarios, and does
   `--verify` genuinely re-derive rather than trust stored values?
3. Is the same-user bypass recorded as a POSITIVE characterisation that
   succeeded, not as a blocked attempt?
4. **Is the fail-safe correct?** An unparseable PostToolUse response must pass
   the original result through untouched. Confirm it cannot silently drop the
   cap on a response that IS parseable, and that the staged byte ceiling still
   applies.
5. Does PreToolUse still fail CLOSED, byte-identical in behaviour to before?
6. Does the fixture log store digests and key names only, never payload values?
7. T1 37/37, T2, T3 4/4, T4, four guard cases and ten P166 suites all pass. Spot
   check that the hook change did not weaken acceptance in T2, which requires a
   real post-transport witness state.

## Specific scrutiny

The bypass characterisation no longer requires byte-exact payload equality,
because the live model declined to send a deliberately malformed payload and
corrected it. Confirm that relaxation is scoped to the bypass scenario ONLY and
that the active path still compares exactly, where the payload is
composer-prepared and exactness is the point.

## Output

```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/7
ONE_LINER: <summary>
VERDICT: PASS | PASS-WITH-FINDINGS | FAIL
REQUIRED_CHANGES: none | <numbered>
```

Max 250 words after the contract lines.
