# Bounded dispatch 2 of 2: the verifier's NOT-MET criterion, plus two orphan exports.

Baseline that must hold, check FIRST and LAST: real `install.sh --init-project` from a
decoy cwd into an empty project exits 0 delivering 17 hooks and 9 `scripts/lib` modules;
install-contract 5/5; guard 13/13. Forbidden: staging machinery, self re-execution,
restructures. Two files only.

## Verifier finding, verbatim

> The required semantic case creates neither a project `package.json` nor npm preinstall
> sentinel and never asserts an empty repair-actions array
> (`assert-install-contract.cjs:398`). It proves byte preservation, but not the criterion
> as written.

Extend `unresolved-module-refuses-before-write` to satisfy the criterion literally:

1. Give the fixture project a `package.json` whose `preinstall` script writes a sentinel
   file, so if npm ever runs during the refused install the sentinel exists.
2. After the refused install, assert the sentinel is ABSENT.
3. Assert the repair-actions array is EMPTY, in addition to the existing
   byte-preservation snapshot. Take the actions from the refusal output or the journal,
   whichever the implementation exposes; if neither exposes it, expose it read-only
   rather than weakening the assertion.

Keep the existing byte-identity check. The three assertions together prove: no module
delivery, no npm, no recorded action, on a refused install.

## ATC MINOR — orphan exports

`hook-install-contract.cjs:940,944` export `applyPreparedProjectInstall` and
`prepareProjectInstall` with no external consumer; the CLI uses them internally. Remove
them from `module.exports`. If any test imports them, switch that test to the CLI or an
`_internals` handle; do not re-widen the public surface.

## Constraints

- Never weaken or delete an assertion.
- P167 witness contract untouchable. Fixture paths contain SPACES.

## Verify

- Real install FIRST and LAST: exit 0, 17 hooks, 9 modules.
- install-contract, all cases. guard `--all` 13/13. `node --check` both files.

Sandbox denials: mark DENIED. Do not ask approval. Standard block, max 200 words.
