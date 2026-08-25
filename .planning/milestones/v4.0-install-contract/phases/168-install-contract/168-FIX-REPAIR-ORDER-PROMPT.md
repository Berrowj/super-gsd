# repairClaudeSubstrateWitness mutates before the check that can fail

Field report from a real Linux install, 2026-08-25. `sgsd-update` on a project exited 5.
The project was left with runtime files copied and a witness key provisioned, but ZERO
substrate registrations in `.claude/settings.json`, and the version pin unwritten.

## The defect

`repairClaudeSubstrateWitness` (super-gsd/tools/feature-propagation/audit.cjs:672-707)
runs in this order:

    installSubstrateRuntime(ctx, actions)        // copies runtime files  MUTATES
    witnessStore.provisionWitnessKey(...)        // writes a key          MUTATES
    removeGlobalWitnessRegistrations(actions)    // edits global state    MUTATES
    smokeRepoHookOverlay(ctx)                    // THROWS on failure
    mergeSettingsFiles(...)                      // never reached

`smokeRepoHookOverlay` throws when a hook smoke exits non-zero (see the throw at
audit.cjs:666-669). The catch converts it to `{ ok: false, reasons: ['witness_repair_failed'] }`
and the installer then prints "substrate enforcement was not current; refusing
grant-bearing agent installation" and exits.

So a repair that is going to refuse performs three mutations first and does not roll them
back. The project is left half-repaired: key present, registrations absent.

This is the same class as the phase-ATC CRITICAL closed in commit 2c237ef, which fixed
the ordering in `install.sh`. The same mistake survives one layer down, inside this
function.

## What to build

Every check that can fail the repair must run BEFORE the first mutation.

1. Move `smokeRepoHookOverlay(ctx)` (and any other failure-capable validation in this
   function) ahead of `installSubstrateRuntime`, `provisionWitnessKey` and
   `removeGlobalWitnessRegistrations`. Confirm by reading `smokeRepoHookOverlay` that it
   only needs hooks already distributed by `distribute_project_hooks`, which runs earlier
   in install.sh, so it does not depend on `installSubstrateRuntime` having run. If it
   genuinely does depend on a mutation, say so explicitly in your report and propose the
   smallest split instead of forcing the move.
2. After the reorder, a failed repair must leave the project byte-identical to how it
   started. No key, no copied runtime files, no global registration edits.
3. Keep the existing refusal reason codes and message text exactly as they are; guard
   cases and the installer match on them.

## Regression test, required

Add a case to `assert-installer-registration-guard.cjs` that:

- builds a fixture project whose repo hook overlay smoke FAILS,
- snapshots every file under the fixture with sha256 before calling
  `repairClaudeSubstrateWitness`,
- asserts the call returns `ok: false` with `witness_repair_failed`,
- asserts the post-call snapshot is byte-identical to the pre-call snapshot,
- asserts the `actions` array is empty, so nothing was even recorded as done.

Model it on the existing no-mutation assertion added for the read-only pre-check in
`runPreflightStatic`, which already does a sha256 snapshot comparison over a fixture.

## Hard constraints

- Do not weaken any existing assertion. Removals require a per-assertion reason.
- Do not touch the P167 witness contract: PreToolUse fail-closed, PostToolUse returns a
  bounded `substrate_witness_rewrite_failed` object and never passes the raw result
  through, the store accepts only `rewritten` rows.
- Fixture paths contain SPACES. Anything you touch must survive that.
- Surgical diff, allowlisted files only.

## Verification

Run what your sandbox permits, report exit codes, and mark denied commands DENIED rather
than passing. Always run `node --check` on every file you modify and
`node super-gsd/tools/feature-propagation/audit.cjs --self-test`.
The orchestrator runs all guard cases unsandboxed and rejects the change if any is red.

Standard block format, max 300 words.
