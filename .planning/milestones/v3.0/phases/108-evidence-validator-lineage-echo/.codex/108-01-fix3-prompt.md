# SDD Implementer — P108 fix3: relax cmb.schema.json key pattern

You are a fresh SDD implementer.

## The bug

`super-gsd/schemas/cmb.schema.json` defines `definitions.sha256Hex` (or similar) with pattern `^[a-fA-F0-9]{64}$`, used for the `key` field. The seed-ledger uses keys like `cmb-0000000000000000000000000000000000000000000000000000000000000001` which violate the pattern. Cross-file refactor across seed-ledger + run-self-test + lineage is large; relaxing the schema pattern is a one-line change.

## Rationale

JSON Schema CANNOT enforce that a CMB's `key` is the sha256 of its canonical payload — that requires computing the hash, which is the job of `cmb-hash.cjs`. The pattern `^[a-fA-F0-9]{64}$` was stylistic, not load-bearing. The hash CORRECTNESS gate lives in tooling (cmb-validate + cmb-hash), not in JSON Schema.

## The fix

In `super-gsd/schemas/cmb.schema.json`, locate the `sha256Hex` definition (or the inline pattern on the `key` field) and relax its pattern to allow either:
- the canonical 64-hex-char sha256 form, OR
- a `cmb-` prefix followed by ≥1 alphanumeric/hex/hyphen/underscore characters

Suggested updated pattern: `^(cmb-[A-Za-z0-9_-]{1,128}|[a-fA-F0-9]{64})$`

This keeps the original stylistic constraint as one valid form AND admits the `cmb-...` semantic prefix variant used in fixtures and the seed-ledger.

If the pattern lives in a `definitions.sha256Hex` referenced elsewhere, consider renaming to `definitions.cmbKey` to reflect the relaxed semantics. Or keep the name and update only the pattern. Either is acceptable.

## Verification

After patch:
```bash
node super-gsd/tools/mesh-memory/run-self-test.cjs
```
should report `30+/30+ passed` and exit 0.

## Files in read-pack

- `super-gsd/schemas/cmb.schema.json`
- `super-gsd/tools/mesh-memory/fixtures/seed-ledger.jsonl` (for reference; do NOT modify)
- `super-gsd/tools/mesh-memory/fixtures/good-execution-receipt.json` (for reference; do NOT modify — its 64-hex key must still validate)

## Report format

```
PATCH_BEGIN
<unified diff modifying cmb.schema.json>
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
  super-gsd/schemas/cmb.schema.json (modified)
VERIFICATION: key pattern now admits both 64-hex sha256 form AND cmb-prefixed identifier form
DEVIATIONS: <none>
BLOCKERS: <none>
ONE_LINER: Relax CMB key pattern to admit cmb-prefixed semantic identifiers used by fixtures + seed-ledger.
REPORT_END
```
