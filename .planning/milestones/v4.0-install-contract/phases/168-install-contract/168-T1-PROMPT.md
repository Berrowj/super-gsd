# Execute P168-T1 ONLY. The plan is locked and GO. Do not re-plan.

Plan: .planning/milestones/v4.0-install-contract/phases/168-install-contract/168-01-PLAN-LOCKED.md
Read task `P168-T1` and implement exactly its `input_contract` and
`semantic_acceptance_criteria`. Do NOT implement `P168-T2`; it is a separate dispatch.

Context is settled. Do not re-derive the root cause or redesign it:
.planning/milestones/v4.0-install-contract/phases/168-install-contract/CONTEXT.md

## The one-line problem

Distributed hooks reach every project on every update; the modules they `require` never
do, so a project hook doing `require('../scripts/lib/sgsd-state.cjs')` gets
MODULE_NOT_FOUND at first fire. Traced end to end in CONTEXT.md.

## Non-negotiable, and each has drawn blood already

1. **Refuse before writing, literally.** Every rejection-capable smoke runs against the
   complete candidate tree under `os.tmpdir()` BEFORE the first project or profile
   mutation. After the first destination write, only journaled transactional publication
   and NON-rejecting verification may remain. Rollback is not a substitute: a smoked hook
   can touch state outside the tree you would roll back. This class was a CRITICAL at
   install.sh (2c237ef) and inside repairClaudeSubstrateWitness (b2a1435), and the plan
   review caught it a third time in the plan itself. Do not make it four.
2. **Compute, never transcribe.** The dependency closure is lexed from source. No
   hand-maintained module list anywhere, including in tests. If a test needs a fixture,
   generate it from sources. A production exception naming the witness composer or store
   by hand is an automatic reject; discover them by symbolically reducing the
   `COMPOSER_RELATIVE_PATH` / `STORE_RELATIVE_PATH` constants.
3. **Derive destinations.** Never inherit a destination from ambient state or cwd. An
   explicit `--project-dir` is resolved exactly.
4. **One shared detector** between the read-only inspection and the applying path, so the
   two cannot drift.
5. **Carry the real error.** Keep the existing closed reason codes unchanged and attach a
   bounded `underlying_error` carrying MODULE_NOT_FOUND, the request, the path and the
   message. Widening the reason vocabulary instead of carrying the underlying error is a
   regression, not a fix.
6. **P167 witness contract untouchable.** PreToolUse fail-closed; PostToolUse returns a
   bounded `substrate_witness_rewrite_failed` object and never passes the raw result
   through; the store accepts only `rewritten` rows.
7. **Never weaken a guard assertion.** Strengthen `assert-installer-registration-guard.cjs`;
   removals need a per-assertion stated reason.

## Work red-first

Build `super-gsd/tests/install-contract/assert-install-contract.cjs` as the focused suite
and write the failing case before the fix, per the plan's input_contract. Report which
cases were red before and green after.

## Fixture paths contain SPACES

Anything you touch must survive `target project` and `upstream seed` style paths.

## Verification to run and report verbatim, with exit codes

- the new assert-install-contract.cjs suite
- all 12 cases of assert-installer-registration-guard.cjs
- node super-gsd/tools/feature-propagation/audit.cjs --self-test
- node super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs
- node super-gsd/tests/substrate-invocation-witness/assert-prompt-contracts.cjs
- bash -n super-gsd/install.sh, node --check on every JS/CJS you modify

If your sandbox denies spawnSync/mkdtemp/bash/git, mark that command DENIED and do not
report it as passing. The orchestrator re-runs spawn-bound suites unsandboxed and will
reject the change if any is red. Do not ask for approval; implement and verify.

Standard block format, max 300 words.
