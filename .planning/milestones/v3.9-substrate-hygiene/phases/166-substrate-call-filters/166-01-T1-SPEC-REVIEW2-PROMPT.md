# P166-T1 spec-compliance review, round 2

You returned FAIL on commit 11cea52 with 2 CRITICAL, falsifier items 3, 4 and 7
true. A fix round has landed at commit d63a6e6. Confirm the two CRITICALs are
closed. Do not re-open the nine items you already passed unless the fix
regressed one.

## Your round-1 findings

1. Prompt transport unmediated: enrichment, board, installed researcher and
   installed planner kept raw MCP tools with prose-only constraints; no
   production code validated `substrate_call_record`; the conformance helper
   called `callVtp` synthetically instead of exercising the prompt path.
2. Coverage fail-open inside known files: classification via `/.*/` and
   unanchored patterns let every occurrence in a recognised file through; the
   negative test injected only a new file.

## What to check

- Fix diff: `.../166-01-T1-FIX2-DIFF.patch` (11cea52 to d63a6e6)
- Executor report: `.../166-01-T1-FIX2-REPORT.md`
- The live tree at d63a6e6.
- Plan authority: `.../166-01-PLAN-LOCKED.md`, task `P166-T1`.

For CRITICAL 1, trace whether a bad record is rejected by PRODUCTION code on the
real acceptance path, and whether the test drives that path rather than a
synthetic stand-in. Check the rejection cannot be downgraded to a warning or
skipped when a field is absent.

For CRITICAL 2, check that no wildcard or unanchored pattern remains, that
classification is per occurrence or bounded branch, and that a rogue occurrence
inside an ALREADY-KNOWN file fails. Confirm a duplicated legitimate-looking line
also fails rather than matching a second time.

## Orchestrator evidence, for your information

Run unsandboxed at d63a6e6, all exit 0: prompt-record-acceptance,
caller-coverage, executable-emitters, substrate-policy-required, emitted-args,
real-evidence, three triage scenarios, classify self-test, composer self-test,
enrichment-gate self-test, feature-propagation self-test, kb-triage-shadow.

Live falsification: appending
`const rogue = { tool: "mcp__vtp-kb__vtp_search_substrate", ... }` to
`super-gsd/scripts/sgsd-triage-runtime.cjs` made caller-coverage fail at line
1808. The file was byte-restored.

Treat this as evidence to audit, not as proof. If you think a test passes for
the wrong reason, say so.

## Output

```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<n>
ONE_LINER: <summary>
VERDICT: PASS | PASS-WITH-FINDINGS | FAIL
REQUIRED_CHANGES: none | <numbered>
```

Max 250 words after the contract lines.
