# DLB-08 Mesh Memory Lite

This directory contains the P107 consumer tools for the P106 CMB schema contract.
The tools validate Canonical Memory Blocks, compute echo-stable hashes, and emit
the first execution/review CMB rows into the mesh memory ledger.

## CLIs

Validate one or more CMB JSON files:

```bash
node super-gsd/tools/mesh-memory/cmb-validate.cjs super-gsd/tools/mesh-memory/fixtures/good-execution-receipt.json
```

Hash a CMB using the canonical payload definition. The hash excludes
`created_at` and `status`.

```bash
node super-gsd/tools/mesh-memory/cmb-hash.cjs super-gsd/tools/mesh-memory/fixtures/hash-a.json
node super-gsd/tools/mesh-memory/cmb-hash.cjs --compare super-gsd/tools/mesh-memory/fixtures/hash-a.json super-gsd/tools/mesh-memory/fixtures/hash-a-created-at-changed.json
```

Emit an execution receipt:

```bash
node super-gsd/tools/mesh-memory/execution-receipt.cjs --self-test
```

Emit a review finding linked to an execution receipt:

```bash
node super-gsd/tools/mesh-memory/review-finding-writer.cjs --self-test
```

## Self-Test

Run the integration self-test:

```bash
node super-gsd/tools/mesh-memory/run-self-test.cjs
```

On success it prints:

```text
[run-self-test] 20/20 passed
```

## Persistence

Writer CLIs append CMB rows to:

```text
.planning/mesh/memory/cmbs.jsonl
```

Validator invocations append metrics to:

```text
.planning/metrics/mesh-validate.jsonl
```

See also DLB-08 and
`.planning/milestones/v3.0/phases/107-mesh-validate-hash-writers/107-CONTEXT.md`.
