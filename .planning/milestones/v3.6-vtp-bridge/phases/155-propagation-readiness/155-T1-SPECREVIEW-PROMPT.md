# P155-T1 spec-compliance review (SDD reviewer stage 1)

Read only. Did the executor implement task P155-T1 of
`.planning/milestones/v3.6-vtp-bridge/phases/155-propagation-readiness/155-01-PLAN-LOCKED.md`
exactly? Raw evidence, not summaries:

1. The PLAN task P155-T1 block (contract, falsifier, stop_rule).
2. Raw diff: run `git diff -- super-gsd/config super-gsd/tests` yourself, or read
   `155-T1-DIFF.txt` in the phase dir and spot-check against the working tree.
3. Executor report `155-T1-REPORT.md`.
4. Orchestrator-run evidence: executor-safe regression exit 0 (checks=5); all six
   assert-live-dispatch modes PASS against the installed two-hook + two-event config.

Check the falsifier clauses specifically: hook absent or duplicated; another event
disappeared; config grep substituting for behaviour; env block read anywhere in the
diff; a second overlay remaining. Check the deviation (shadow-test path corrected from
the plan's wrong location) is the honest reading rather than scope creep.

Output, contract lines first, then max 200 words:
```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<n>
ONE_LINER: <summary>
SPEC_VERDICT: pass|fix_required|blocked
MISSING_REQUIREMENTS: none|<list>
EXTRA_SCOPE: none|<list>
```
