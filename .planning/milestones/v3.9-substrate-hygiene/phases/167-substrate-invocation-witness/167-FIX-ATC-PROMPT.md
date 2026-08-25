# Close the phase-ATC CRITICAL: the global install path still mutates before refusing

Phase-level ATC returned FAIL on one CRITICAL. Fix exactly that. Do not re-litigate it.

## The finding, verbatim

> `super-gsd/install.sh:648`, `:919-921` — `install_global_assets` performs
> `repair_substrate_capability` before `distribute_project_hooks` discovers missing
> Codex entry sources and before `precheck_substrate_capability`. In combined
> `--install-global --init-project`/update operation, capability/global state can
> therefore be mutated and grants derived before the later pre-check exits 1. The
> repair's internal shared detector does not close this:
> `feature-propagation/audit.cjs:609-620` checks only repo Claude-hook descriptors,
> not `CODEX_HOOK_MISSING_TARGETS`. This preserves the same unsafe mutate-then-refuse
> class the final fix intended to remove.

ATC also confirmed, so do not disturb these: the new pre-check is genuinely read-only;
its substrate detection cannot drift from repair because `runAudit` computes the check
once and passes that result into repair (`audit.cjs:1357-1386`); passthrough is 0
occurrences; the store selects and consumes only fresh `rewritten` rows.

## What to build

Every entry point that can reach `repair_substrate_capability` must have the COMPLETE
refusal set, Codex hook entry sources included, before any writer runs.

Requirements:

1. The Codex hook entry source check that currently populates
   `CODEX_HOOK_MISSING_TARGETS` inside `distribute_project_hooks` must be available as
   a non-mutating check that `install_global_assets` can run BEFORE its
   `repair_substrate_capability` call at line 648.
2. Detection must stay shared. Do not write a second copy of the Codex-entry check.
   One detector, called from both places, exactly as the substrate check already does.
3. On any missing entry, print the existing `hook_registration_missing <target>
   [<source>]` lines and `exit 1` before the first writer. Message format is matched by
   guard cases; do not change the text.
4. If `--install-global` and `--init-project`/`--update` run in one invocation, no
   ordering of the flags may allow a write before the combined refusal set is known.
5. Extend `assert-installer-registration-guard.cjs` so this hole is a permanently
   caught regression: assert that on EVERY path reaching `repair_substrate_capability`
   the full pre-check precedes it, including the `install_global_assets` path, and that
   the Codex-entry detector is defined once.

## Hard constraints

- Do not weaken any existing guard assertion. 53 assertions were added and 13
  legitimately retired this phase; retiring more requires an explicit stated reason
  per assertion in your report.
- Do not touch the P167 witness contract: PreToolUse fail-closed, PostToolUse returns a
  bounded `substrate_witness_rewrite_failed` object and never passes the raw result
  through, store accepts only `rewritten` rows.
- Fixture paths contain SPACES. Any path handling you touch must survive that.
- Surgical diff, allowlisted files only.

## Verification to run and report verbatim

- All 12 guard cases with exit codes.
- bash -n super-gsd/install.sh; node --check on every JS/CJS file you modify.
- audit.cjs --self-test.

State in one line that no writer can execute on ANY entry point before the combined
refusal set, Codex entries included, is known.

If the sandbox denies spawnSync/mkdtemp/git/bash, say so per command and do not report
it as passing; the orchestrator reruns those unsandboxed. Standard block format,
max 300 words.
