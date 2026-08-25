# Phase ATC FAIL 5/10 with a CRITICAL, and the verifier FAILed one criterion. Fix both.

Do NOT rebuild the installer. No `*-installer-stage` modes, no self re-execution, no
whole-root snapshots. That design was built earlier, shipped an install that exited 0
delivering nothing, and was reverted. Keep the current topology: one project candidate,
computed rows, prepare/apply.

Baseline to preserve, verified: real `install.sh --init-project` from a decoy cwd into an
empty project exits 0 delivering 17 hooks and 9 `scripts/lib` modules; install-contract
5/5; installer-registration-guard 13/13; doctor reports real HEAD and freshness.
Check that install FIRST and LAST.

## CRITICAL — refuse-before-write is still violated, and the guard masks it

Phase ATC, verbatim:

> `install.sh:1292` publishes project hooks/modules, then dispatches global install,
> initialization, or update at lines 1303-1311. Those paths subsequently run
> rejection-capable substrate repair and Codex registration (`install.sh:1014-1015`,
> `1110-1111`); global installation can also fail after publication. Direct repair
> similarly publishes at `feature-propagation/audit.cjs:1456` before witness/capability
> repair at lines 1484-1492.
>
> The guard encodes this unsafe order: `assert-installer-registration-guard.cjs:1615` and
> `:1640` require repair after the first writer while only forbidding functions named
> "precheck". A repair failure can therefore exit nonzero after leaving published bytes.
> This contradicts locked-plan invariants 55-57 and the explicit falsifier.

This is the FIFTH occurrence of this class in this codebase. Twice fixed in code, once
caught in the plan, once thought fixed and now found still open behind a weak assertion.

Required shape: `repair_substrate_capability` and `register_codex_hooks` are BOTH
rejection-capable and both write. Split each into a check half and a write half, exactly
as was already done for the precheck. Every check half runs before the first destination
write; only write halves and non-rejecting verification may follow it. Apply the same
split to the direct repair path in `audit.cjs`.

**Fix the guard properly.** Asserting on function NAMES containing "precheck" is what let
this hide. Assert on BEHAVIOUR: enumerate the functions that can reject, and require every
one of them to appear before the first write, failing if any rejection-capable function is
reachable afterwards. If a new rejecting function is added later without being placed
correctly, the guard must fail.

## Verifier — criterion 2 NOT MET

> Production ordering is correct: candidate preparation/refusal precedes publication and
> `update_existing`, including npm. However, the required semantic case creates neither a
> project `package.json` nor npm preinstall sentinel and never asserts an empty
> repair-actions array (`assert-install-contract.cjs:398`). It proves byte preservation,
> but not the criterion as written.

Make `unresolved-module-refuses-before-write` satisfy the criterion literally: create a
project `package.json` with an npm preinstall sentinel that records if npm ever ran, and
assert the sentinel is absent AND the repair-actions array is empty, in addition to the
existing byte-preservation check.

## MINORs, fix while you are here

- `hook-install-contract.cjs:940,944` export `applyPreparedProjectInstall` and
  `prepareProjectInstall` with no consumer; the CLI uses them internally. Remove from
  `module.exports`. If a test imports them, have the test use the CLI or the internals
  handle rather than re-widening the public surface.
- Delete `168-SPECFIX-WIP.patch`; it is superseded, unreferenced and no longer applies.
  Keep `168-ABANDONED-STAGED-INSTALLER.patch`, which the ATC judged defensible evidence.

## Constraints

- Never weaken or delete an assertion; strengthen the ordering one.
- P167 witness contract untouchable.
- Fixture paths contain SPACES.

## Verify

- Real install: exit 0, 17 hooks, 9 modules. FIRST and LAST.
- install-contract, all cases. installer-registration-guard `--all` 13/13.
- `node super-gsd/tools/feature-propagation/audit.cjs --self-test`
- `bash -n super-gsd/install.sh`, `node --check` on every file modified

Sandbox denials: mark DENIED, never as passing. Do not ask for approval.

Standard block format, max 350 words.
