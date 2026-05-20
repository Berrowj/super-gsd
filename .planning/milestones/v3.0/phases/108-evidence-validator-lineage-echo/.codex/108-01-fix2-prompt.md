# SDD Implementer — P108 fix2: align lineage.cjs expected ancestors with seed-ledger

You are a fresh SDD implementer.

## The bug

`super-gsd/tools/mesh-memory/lineage.cjs`'s `runSelfTestAncestors` function has a hardcoded `expected` array of 7 CMB keys representing the BFS ancestor chain of `cmb-...000008` (the deep leaf). After fix1 regenerated `seed-ledger.jsonl`, the actual ancestor chain of cmb-...000008 in the ledger is:

```
008 → 007 → 010 → 005 → 004 → 003 → 002 → 001
```

But lineage.cjs's `expected` array is currently:

```js
const expected = [
  'cmb-...000007',
  'cmb-...000006',  ← mismatch
  'cmb-...000005',
  'cmb-...000004',
  'cmb-...000003',
  'cmb-...000002',
  'cmb-...000001',
];
```

The second entry should be `000010`, not `000006`. The deep chain in the new seed-ledger routes through cmb-...000010 (an operator_precedent linked from cmb-...000005), not through cmb-...000006 (a context_anchor linked from cmb-...000001 as a sibling, NOT on the deep chain).

## The fix

In `super-gsd/tools/mesh-memory/lineage.cjs`, locate `runSelfTestAncestors` (around line 128) and change the second entry of the `expected` array from `cmb-...000006` to `cmb-...000010`.

Final expected array:
```js
const expected = [
  'cmb-0000000000000000000000000000000000000000000000000000000000000007',
  'cmb-0000000000000000000000000000000000000000000000000000000000000010',  ← changed
  'cmb-0000000000000000000000000000000000000000000000000000000000000005',
  'cmb-0000000000000000000000000000000000000000000000000000000000000004',
  'cmb-0000000000000000000000000000000000000000000000000000000000000003',
  'cmb-0000000000000000000000000000000000000000000000000000000000000002',
  'cmb-0000000000000000000000000000000000000000000000000000000000000001',
];
```

Single one-line change.

## Verification

`node super-gsd/tools/mesh-memory/run-self-test.cjs` should report `30+/30+ passed` and exit 0.

## Files in read-pack

- `super-gsd/tools/mesh-memory/lineage.cjs`
- `super-gsd/tools/mesh-memory/fixtures/seed-ledger.jsonl` (for cross-reference)

## Report

```
PATCH_BEGIN
<unified diff>
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
  super-gsd/tools/mesh-memory/lineage.cjs (modified)
VERIFICATION: expected ancestors[1] now matches seed-ledger topology
DEVIATIONS: <none>
BLOCKERS: <none>
ONE_LINER: Update lineage.cjs expected chain entry from 006 to 010.
REPORT_END
```
