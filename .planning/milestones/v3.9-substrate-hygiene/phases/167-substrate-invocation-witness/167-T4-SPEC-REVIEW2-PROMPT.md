# P167-T4 spec-compliance review, round 2, confirmation only

You returned FAIL at 7/8 on a5e1f97 with one CRITICAL and two warnings. A fix
landed at e85d396. Confirm those three. Do not re-open the seven checks that
passed unless the fix regressed one.

## Your round-1 findings

1. CRITICAL: broker definitions bound to the installing project while
   grant-bearing agents are global, so project B used project A's readiness.
2. `isBrokerDefinition` ignored extra `env`, `cwd`, `type`, url and header
   fields, so a drifted broker audited as current.
3. `audit.cjs:638-642` deleted every direct definition before archiving any.

## What the fix claims

Installation runtime and invocation authority are now separate. Install-time
arguments locate broker code and the private upstream manifest;
`process.env.CLAUDE_PROJECT_DIR` alone selects the project whose hooks, key,
source and registrations control readiness. Absent, empty, whitespace or
relative values resolve to null, and the broker stays protocol-alive but
permanently unavailable. No fallback to the installing project.

`isBrokerDefinition` now requires an exact or allowlisted shape. Mixed supported
and unsupported scopes archive both originals before any withdrawal, with
`broker_repair_failed` and MCP document restoration on failure.

The executor additionally withdraws all four derived grants at repair entry and
re-derives only after both audits are current, closing a window it found itself
where an archive or write failure could leave a grant standing.

## Check

- Diff `.../167-T4-FIX4-DIFF.patch` (a5e1f97 to e85d396); live tree at e85d396.
- Report `.../167-T4-FIX4-REPORT.md`.

1. **Is authority genuinely invocation-bound?** Trace every readiness input. If
   any still derives from `--project-root`, `process.cwd()`, or the private
   manifest's recorded project, the CRITICAL is not closed. Note
   `runtimeProjectRoot` still exists at line 367 for locating code and the
   manifest; confirm it cannot reach a readiness decision.
2. **Does the two-project case actually deny?** Confirm the new test drives a
   real user-only upstream with one guarded and one unguarded project, and
   asserts denial at both `tools/list` and a forced `tools/call`.
3. **Is the null path fail-closed everywhere?** A null invocation root must not
   fall through to any permissive branch.
4. Warnings 2 and 3 closed as described, with mutation coverage per field and
   genuine rollback rather than best-effort.
5. No regression: T1 34/34 depends on broker readiness and forced-call
   behaviour, so it is the most likely casualty. Also T2, T3, the four guard
   cases and P166.
6. The eighth-file deviation is recorded and justified.

## Orchestrator evidence, to audit rather than trust

At e85d396, unsandboxed, all exit 0: assert-propagation, feature-propagation
self-test, four guard cases, hook-contract 34/34, witness-correlation 13/13,
prompt-contracts 4/4, ten P166 regressions.

Direct probe of `resolveInvocationProjectRoot`: absent, empty string,
whitespace and relative path all return null; an absolute path resolves.

Codex ran only `node --check` and module load checks.

## Output

```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/8
ONE_LINER: <summary>
VERDICT: PASS | PASS-WITH-FINDINGS | FAIL
REQUIRED_CHANGES: none | <numbered>
```

Max 200 words after the contract lines.
