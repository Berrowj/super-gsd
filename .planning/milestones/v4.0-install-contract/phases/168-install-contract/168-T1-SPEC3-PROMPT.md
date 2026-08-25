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

## ROUND 2 — confirm the three findings are closed. Do not reopen settled ground.

Round 1 returned FAIL on exactly three findings. Judge those three, plus regressions.
Do not re-litigate what you already passed: the closure computation, the
`generated-transitive-manifest` and `unresolved-module-refuses-before-write` criteria,
and the P167 contract were all confirmed intact.

Commit under review now: `0dfd0d1` (was `7550116`). Read `git show 0dfd0d1`.

1. **CRITICAL, was: rejection-capable steps after the first write.** You cited
   install.sh:1195 publishing before global/init/update dispatch, with
   `ensure_gsd_base` (:479), the update preflight (:1018), and settings/npm/repair/Codex
   registration (:1021, :1048) all able to reject afterwards, and guard:1460 asserting
   the wrong order. Confirm the checks now run in a top-level pre-write block, that
   `set -e` propagates their failure, and that the guard asserts the CORRECT order and
   would fail if a rejecting step were reintroduced after the first write.

2. **HIGH, was: the classifier accepts a load failure.** `boundedLine` flattened
   stdout/stderr and the anchored classifier's trailing `.*` accepted
   `[id] blocked: reason\nError: failed to load`. Confirm a clean policy decision must
   now be the WHOLE output, and that the classifier is still shared, not duplicated.

3. **MEDIUM, was: laundering in both directions.** The module branch discarded real
   output for a synthesised `Cannot find module`; non-module output was disclosed to 2048
   bytes with raw stack frames. Confirm the real bounded message survives in every branch
   and that frames are sanitised rather than dumped.

## New behaviour introduced by the fix — judge it as carefully as the findings

Moving the preflight before distribution refused the Clarity RECOVERY case, where three
managed hooks are legitimately absent and are precisely what the update delivers. The fix
exempts a missing hook when it appears in the sealed candidate's delivery set.

Judge specifically whether that exemption can be abused: can a hook be absent from the
project, absent from the canonical source, yet still appear in the delivery set and so be
waved through? Is the delivery set derived from the sealed candidate rather than
recomputed or hand-listed? Is there an assertion that a managed hook missing from BOTH the
project and the delivery set still refuses before any write? If that assertion is missing
or weak, this fix has quietly become "never refuse on a missing hook", which is worse than
the original bug. Say so plainly if it has.

## Orchestrator-run results, take as given, do not re-run

installer-registration-guard 13/13 in one `--all` sweep; install-contract 3/3; a real
`install.sh --init-project` from a decoy cwd into an empty project exits 0 and delivers 17
hooks and 9 `scripts/lib` modules; assert-hook-contract 38/38; assert-prompt-contracts 4/4;
assert-witness-correlation 13/13; assert-propagation PASS; P166 6/6; P154 PASS; composer,
enrichment-gate, kb-triage-shadow PASS; feature-propagation 15/15; `bash -n` clean.

Verdict line unchanged: `SPEC VERDICT: PASS` or `SPEC VERDICT: FAIL`.
Bound yourself to about 18 shell commands and emit the verdict even if incomplete.
Max 500 words.

## ROUND 3 — one finding only

Round 2 closed CRITICAL and MEDIUM and cleared the recovery exemption. Do not reopen any
of those; state in one line that you re-confirmed each is still closed at this commit and
move on.

The single open item was HIGH:

> smoke output is truncated to 8192 bytes without recording truncation
> (hook-registration-preflight.cjs:643-667). A policy-shaped first line followed by enough
> same-line output can push a later load error beyond that boundary; the clipped output
> then satisfies `isCleanPolicyDecision` and is accepted at lines 738-740.

Commit under review is now the HEAD of this branch. The change records byte-level
truncation and makes clipped output ineligible as a clean policy decision, keeping the
8192 limit and the shared classifier, with a new guard case whose size derives from the
limit constant plus split-UTF-8 boundary coverage.

Judge only:

1. Is truncation now genuinely fail-closed on every path that reaches
   `isCleanPolicyDecision`, including the caller in `hook-install-contract.cjs`?
2. Can any other route reach the classifier with output that was clipped, buffered, or
   otherwise incomplete without the truncation flag set? Check stdout and stderr handling
   separately.
3. Does the new test actually exercise the boundary, and would it still do so if the limit
   constant changed?

Orchestrator-run, take as given: installer-registration-guard 13/13 in one `--all` sweep,
install-contract 3/3, and a real install from a decoy cwd into an empty project exits 0
delivering 17 hooks and 9 `scripts/lib` modules.

Verdict line unchanged. Bound yourself to about 12 shell commands. Max 350 words.
