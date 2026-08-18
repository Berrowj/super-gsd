# P153 Spec-Compliance Review, round 2

You returned `fix_required` on round 1. Read only. Change nothing.

Your round-1 findings and what was done:

1. `RELAXATION_SAFE: no` — "a successful guard hook pair plus a forged session-correlated
   routing row passes without classifier lifecycle". ADDRESSED in commit `d1c2f7f`:
   the lifecycle check now requires a complete successful hook_started/hook_response pair for
   EVERY registered managed hook, not at least one. Matched probes additionally require a
   hook_response whose `stdout` carries the classifier directive, which the guard cannot emit
   on a benign prompt. New `--control guard-only-lifecycle-must-fail` reproduces your exact
   bypass and asserts rejection.
2. `MISSING_REQUIREMENTS: AC2, AC3, AC4, AC6, AC7` — these all followed from finding 1.
   Re-check them against the new logic.
3. `EXTRA_SCOPE: super-gsd/CLAUDE-OVERLAY.md communication/Recap protocol` — ACKNOWLEDGED as
   operator-directed out-of-plan work, committed separately in `b62b07c` and `26e0684`, later
   reduced to the repo-scoped Recap only. It is not P153 deliverable work. Confirm it is
   recorded honestly rather than presented as phase output.

## Read

- `.planning/milestones/v3.6-vtp-bridge/phases/153-hook-transport-completion/153-01-PLAN-LOCKED.md`
- `super-gsd/tests/hook-transport/assert-live-dispatch.cjs` (the changed file)
- `153-VERIFICATION.md` including the T2e section and its disclosed coverage limits
- `153-DEVIATIONS.md` (process findings D1 to D4)
- Run `git diff d1c2f7f~1..d1c2f7f -- super-gsd/` yourself.

## Attack the fix

Can a probe still pass when the classifier did not run? Consider: a classifier that dispatches
and exits 0 without writing a row; a stdout check satisfiable by the guard; the count check
being satisfiable by two guard invocations; anything the registration layers catch first but
the lifecycle layer would not.

The orchestrator disclosed that its three live breakage attempts were each rejected by an
earlier layer, so lifecycle closure rests on the control's code rather than a live injected
runtime failure. Assess whether that is sufficient evidence, and if not, name the specific
live test that would settle it.

## Output. Emit the five contract lines FIRST, then the spec block.

```
FINDINGS: <integer total>
CRITICAL: <integer>
WARNINGS: <integer>
PASS_RATE: <n>/<n>
ONE_LINER: <short summary>
SPEC_VERDICT: pass|fix_required|blocked
MISSING_REQUIREMENTS: none|<AC or task ids>
EXTRA_SCOPE: none|<unrequested changes>
RELAXATION_SAFE: yes|no — <can a probe pass with the classifier not running?>
LIFECYCLE_EVIDENCE_SUFFICIENT: yes|no — <if no, the exact live test that would settle it>
DEFERRALS_HONEST: yes|no
```

The five contract lines are required by the dispatch wrapper's validator. Omitting them logs
this run as a contract violation even when the content is good, which is defect D1.
