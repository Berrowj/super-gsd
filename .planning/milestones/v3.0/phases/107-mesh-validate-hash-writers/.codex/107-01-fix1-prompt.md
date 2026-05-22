# SDD Implementer — P107 fix1: ajv multi-instance resolution bug

You are a fresh SDD implementer. No inherited context.

## The bug

In every `*.cjs` file under `super-gsd/tools/mesh-memory/` that has a `requireDependency()` function, the candidate resolution order is:

```js
const candidates = [
  name,
  path.resolve(__dirname, 'node_modules', name),
  path.resolve(__dirname, '..', 'plan-schema', 'node_modules', name),
];
```

The first candidate (bare `name`) resolves `ajv` from `C:\Users\user\node_modules\ajv` — a different physical install than `ajv-errors`, which only resolves via the third candidate (plan-schema/node_modules). The result: ajv-errors tries to extend a DIFFERENT ajv instance than the one constructed. Compile throws with "Error compiling schema, function code: ..." dumping the generated function body.

## The fix

In every file under `super-gsd/tools/mesh-memory/` containing `function requireDependency(name)`:

**Reorder the candidates** so plan-schema's node_modules is first:

```js
const candidates = [
  path.resolve(__dirname, '..', 'plan-schema', 'node_modules', name),
  path.resolve(__dirname, 'node_modules', name),
  name,
];
```

This forces all three (`ajv`, `ajv-formats`, `ajv-errors`) to resolve from the same `super-gsd/tools/plan-schema/node_modules/` directory. Plugin/constructor instance match restored. Compile succeeds.

## Files to fix

Likely all of:
- `super-gsd/tools/mesh-memory/cmb-validate.cjs`
- `super-gsd/tools/mesh-memory/cmb-hash.cjs`
- `super-gsd/tools/mesh-memory/execution-receipt.cjs`
- `super-gsd/tools/mesh-memory/review-finding-writer.cjs`
- `super-gsd/tools/mesh-memory/run-self-test.cjs`

Search each file for the candidate-order array and swap to the order above. If a file has no requireDependency function, skip it.

## Verification

After patch, the operator will run:
```bash
node super-gsd/tools/mesh-memory/run-self-test.cjs
```

Expected: `20/20 passed`. (Previously: `8/20 passed` with ajv compile errors.)

## Files in read-pack

- `super-gsd/tools/mesh-memory/cmb-validate.cjs` (current state)
- `super-gsd/tools/mesh-memory/cmb-hash.cjs`
- `super-gsd/tools/mesh-memory/execution-receipt.cjs`
- `super-gsd/tools/mesh-memory/review-finding-writer.cjs`
- `super-gsd/tools/mesh-memory/run-self-test.cjs`

## Report format

```
PATCH_BEGIN
<unified diff swapping candidate order in each file with requireDependency>
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
  <list>
VERIFICATION:
  Candidate order reversed in each file: plan-schema first, then mesh-memory, then bare.
DEVIATIONS: <none or list>
BLOCKERS: <none>
ONE_LINER: Fix ajv multi-instance bug by forcing all mesh-memory tools to resolve ajv/ajv-formats/ajv-errors from the same node_modules dir.
REPORT_END
```
