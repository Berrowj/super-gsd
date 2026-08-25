# P167-T3 spec-compliance review

Read only. Judge the SHIPPED CODE against the LOCKED PLAN, task `P167-T3`.

## Artifacts

- Plan `.../167-01-PLAN-LOCKED.md` revision 3, task `P167-T3`:
  `input_contract`, `falsifier`, `stop_rule`, `known_deadends`.
- Diff `.../167-T3-CUMULATIVE-DIFF.patch` (be6cfa1 to 386d027)
- Reports `.../167-T3-EXEC-REPORT.md`, `.../167-T3-FIX1-REPORT.md`
- Live tree at 386d027.

## Work the falsifier

Check each against the code:

1. Both canonical frontmatter tool lists are raw-substrate-free.
2. Each of the four surfaces keeps its P166 intent family and composer-prepared
   payload, and owns no `source_types` or `limit` literal.
3. No surface asks for `tool_use_id` or any other correlation identifier. An
   agent-supplied identifier anywhere is CRITICAL.
4. No surface can use a response before readiness AND post-call acceptance both
   succeed, and a nonzero acceptance discards content rather than summarising,
   quoting, persisting or retrying it.
5. No prompt instructs the model to cap or truncate text itself; T1's PostToolUse
   is the only pre-model cap.
6. `degradation_notes` flow through the existing normal output path on success.
7. Optional-VTP semantics unchanged: absence degrades, it does not fail a phase.
8. `audit.cjs` was NOT modified; T4 owns the derived installed grants.
9. T1, T2 and P166 all intact.

## The deviation to scrutinise

T3 shipped a DEVIATION: its scope expanded by
`super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs`, which is
not in `files_touched`. The reason given: removing the two grants and replacing
the enrichment policy line invalidated three registered exact occurrences
(`board-tools`, `enrichment-tools`, `enrichment-policy`), so `caller-coverage`
went red, while T3's own `stop_rule` requires it green.

Judge two things:

- Is the stated reason true? Confirm the removals genuinely invalidated exactly
  those three entries and that the plan gave T3 no in-scope way to satisfy its
  stop rule.
- **Was the inventory corrected or loosened?** This is the important one. The
  entries removed must correspond to occurrences that genuinely no longer exist.
  If any pattern became broader, unanchored, or lost single-consumption
  semantics, that is CRITICAL, because it reopens the exact hole P166 closed with
  a CRITICAL of its own.

## Orchestrator evidence, to audit rather than trust

At 386d027, unsandboxed, all exit 0: prompt-contracts 4/4, hook-contract 34/34,
witness-correlation 13/13, caller-coverage, executable-emitters,
prompt-record-acceptance, megachunk-degraded-artifact, cap-shapes,
repair-safe-t2, real-evidence, composer, enrichment-gate, kb-triage-shadow.

Falsification re-run after the inventory change: a rogue substrate call appended
to `sgsd-triage-runtime.cjs` fails caller-coverage; a rogue call in a new file
fails. Both files restored.

Codex could not run the suites and used an in-memory `auditCallerCoverage` probe
instead, which it declared.

## Output

```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/9
ONE_LINER: <summary>
VERDICT: PASS | PASS-WITH-FINDINGS | FAIL
REQUIRED_CHANGES: none | <numbered>
```

Max 250 words after the contract lines.
