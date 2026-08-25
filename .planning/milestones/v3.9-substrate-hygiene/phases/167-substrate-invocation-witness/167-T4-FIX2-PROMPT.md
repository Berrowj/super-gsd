# P167-T4 fix round 2 — one ordering error in a locked list

Everything else is green. The orchestrator ran the full battery at your last
state: T4's own suites pass, T1 34/34, T2 13/13, T3 4/4, and all ten P166
regressions pass. Three of the four registration-guard cases you named pass,
including your new `brokered-substrate-capability`.

One case fails, and it is a sort-order mistake.

## The failure

```
node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs \
  --case hook-distribution-all-types

AssertionError: source hook inventory drifted from the locked seventeen basenames
    at runHookDistributionAllTypes (assert-installer-registration-guard.cjs:1520)

    'sgsd-session-start.js',
-   'sgsd-substrate-invocation-witness.cjs',
    'sgsd-statusline.js',
    'sgsd-stop-handoff.js',
+   'sgsd-substrate-invocation-witness.cjs',
    'sgsd-vtp-pending.js'
```

The set of names is already correct and the count is already 17. Only the
position is wrong. The locked list places
`sgsd-substrate-invocation-witness.cjs` before `sgsd-statusline.js`, but the
inventory read from disk is lexicographically sorted, where
`sgsd-statusline` < `sgsd-stop-handoff` < `sgsd-substrate-invocation-witness`.

## Fix

Move that one entry to its correct sorted position, after
`sgsd-stop-handoff.js` and before `sgsd-vtp-pending.js`.

Do not change the count, do not add or remove any name, and do not relax the
assertion to be order-insensitive. The ordering check is doing real work: it is
what caught this, and an order-insensitive comparison would hide a future
duplicate or a silently reordered distribution.

Check whether the same list is duplicated elsewhere in the file, for example
near `CANONICAL_HOOK_COUNT` at line 75 or the assertions at lines 418, 1594 and
1621, and fix every copy that has the same misordering.

## Constraints

One file:
`super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs`.

Do not weaken any other guard case. The other three must still pass:
`hook-manifest-completeness`, `bundled-overlay-current`,
`brokered-substrate-capability`.

Do not commit. No emoji, no em dashes. Never invoke `claude`.

You can run this one yourself; it needs no fixture temp directory:

```
node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case hook-distribution-all-types
```

If it needs a spawn you cannot do, say so and the orchestrator will run it.

## Report

```
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` -> exit N
DEVIATIONS: description | none
BLOCKERS: description | none
ONE_LINER: how many copies of the list were misordered
```
