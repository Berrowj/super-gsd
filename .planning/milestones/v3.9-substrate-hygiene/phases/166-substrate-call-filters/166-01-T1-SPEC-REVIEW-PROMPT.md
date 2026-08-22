# P166-T1 spec-compliance review

Read only. Judge the SHIPPED CODE against the LOCKED PLAN. You are reviewing raw
artifacts, not the executor's summary of itself. The executor was cut off before
writing a report, so there is no summary to be misled by.

## Artifacts

- Plan (authority, revision 2, reviewed GO):
  `.planning/milestones/v3.9-substrate-hygiene/phases/166-substrate-call-filters/166-01-PLAN-LOCKED.md`
  Read the `P166-T1` task block: `input_contract`, `falsifier`, `stop_rule`,
  and the first two `semantic_acceptance_criteria`.
- The diff as committed: `.../166-01-T1-DIFF.patch` (commit 11cea52)
- Raw verification output: `.../166-01-T1-VERIFICATION-RAW.txt`
- Fix-round report: `.../166-01-T1-FIX1-REPORT.md`
- The live tree, to check anything the diff does not settle.

## What to decide

Does the shipped code satisfy T1's contract, or does it merely appear to?

Work the `falsifier` list literally, one item at a time. It fails if ANY of
these is true. Check each against the code, not against intent:

1. Any executable caller owns `source_types` or `limit`.
2. `callVtp` invokes transport before validating v2.
3. A prompt call path lacks matching gateway evidence.
4. An unfiltered or limit-6 candidate can reach a transport spy.
5. v1 schema or P154 evidence changed.
6. Triage remains query-only.
7. The coverage grep can miss an unclassified occurrence.
8. Either Phase-48 branch is collapsed or untested.
9. Book lookup sends an unsupported field or admits a non-book result.
10. P152 or P154 behaviour changed.
11. A test touches the real USERPROFILE or HOME.
12. T1 is not one revertible commit.

## Pay particular attention

The whole point of revision 2 was that validation is MECHANICAL and IN THE CALL
PATH. A test that validates a payload proves nothing if production can still
transport an unvalidated one. Trace the actual code path from each of the eight
sites to `mcpInvoke` and confirm there is no route around the gateway.

Also scrutinise the fix round specifically. Two allowlist entries were added to
let a comment and a self-test label in `classify.cjs` pass coverage. Confirm
those entries are exact and anchored, and that they could NOT absorb a genuine
new caller. If they are broader than the two literal strings, that is a
CRITICAL, because it reopens the round-1 defect.

## Output

Contract lines first, then max 250 words.

```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<n>
ONE_LINER: <summary>
VERDICT: PASS | PASS-WITH-FINDINGS | FAIL
REQUIRED_CHANGES: none | <numbered>
```

FAIL if any falsifier item is true. PASS-WITH-FINDINGS for a real but
non-blocking gap. PASS only if the contract is actually met.
