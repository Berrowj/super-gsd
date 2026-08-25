# Spec-compliance review of P168-T1. Read-only. Judge raw artifacts, not the executor's summary.

Do NOT rely on any executor report. Read the PLAN, the diff, and the code.

- Plan: .planning/milestones/v4.0-install-contract/phases/168-install-contract/168-01-PLAN-LOCKED.md
  (revision 2, task P168-T1 only; P168-T2 is a separate future dispatch and is OUT OF SCOPE)
- Diff: `git show 7550116` and `git diff 8ddae0e..7550116 -- super-gsd`
- Context: .../168-install-contract/CONTEXT.md

Orchestrator-run results, unsandboxed, take as given and do not re-run:
installer-registration-guard 13/13 in one `--all` sweep; install-contract 3/3;
assert-witness-correlation 13/13; assert-propagation PASS; assert-hook-contract 38/38;
assert-prompt-contracts 4/4; P166 policy 6/6; P154 real-evidence PASS; composer and
enrichment-gate self-tests PASS; kb-triage-shadow PASS; feature-propagation 15/15;
`bash -n install.sh` clean.

## Judge T1's acceptance criteria one by one

For each `semantic_acceptance_criteria` entry belonging to P168-T1, state MET or NOT MET
with a file:line citation from the implementation. A criterion satisfied only by a test
asserting a shape, rather than by real data through the real path, is NOT MET; say so.

## Specific things to verify, each has a history

1. **Computed, not transcribed.** Is the dependency closure genuinely lexed from source?
   Grep for any hand-maintained module list in production OR in tests. The witness
   composer and store must be discovered by reducing `COMPOSER_RELATIVE_PATH` /
   `STORE_RELATIVE_PATH`, not named. Report any literal module list you find and where.

2. **Refuse before writing, literally.** Confirm every rejection-capable smoke runs
   against the candidate tree before the first destination write, and that only
   transactional publication and non-rejecting verification follow. This class has been a
   CRITICAL twice in code (2c237ef, b2a1435) and once in the plan. Cite the ordering.

3. **The loadability classifier.** It accepts a bracketed hook id followed by
   blocked/denied/refused, a colon and a non-empty reason, and fails closed otherwise.
   Is that sound? Specifically: can a hook that FAILED TO LOAD produce output that
   satisfies the classifier and so be wrongly accepted? Is the classifier shared by both
   callers, or duplicated?

4. **No laundering.** `moduleFailureDetail` previously replaced real output with the
   constant "hook process exited non-zero". Confirm the real bounded output now survives
   in every branch. Confirm disclosure is bounded and does not dump raw stacks.

5. **Seventeen guard assertions were retargeted or retired.** The accounting is in the
   phase directory. Independently check three of the retirements you consider highest
   risk and say whether the named replacement genuinely covers the old behaviour. Pay
   particular attention to the install-ordering assertions and to the former
   `no MODULE_NOT_FOUND leak` rule.

6. **P167 contract intact.** PreToolUse fail-closed; PostToolUse returns a bounded
   `substrate_witness_rewrite_failed` object and never passes the raw result through; the
   store accepts only `rewritten` rows; substrate-scoped repair manages only the witness
   Pre/Post ids.

7. **Scope discipline.** Did T1 implement anything belonging to T2 (`--doctor`,
   explicit-project presentation, worktree/GitHub freshness)? That would be scope creep.

Report findings by severity with file:line. End with exactly
`SPEC VERDICT: PASS` or `SPEC VERDICT: FAIL`. A NOT MET criterion forces FAIL.
Bound yourself to about 20 shell commands and emit the verdict even if incomplete.
Max 600 words.
