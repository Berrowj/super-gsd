# SDD Implementer Task — P107-01 executor (validator + hasher + writers + self-test)

You are a fresh SDD implementer. No inherited context. Read only what this prompt names.

## What you are doing

Implementing the PLAN at `.planning/milestones/v3.0/phases/107-mesh-validate-hash-writers/107-01-cmb-validator-hash-writers-PLAN.md`. Three serial tasks creating 7 files under `super-gsd/tools/mesh-memory/`.

P107 is the first **consumer** phase of the P106 CMB schema contract. The schema lives at `super-gsd/schemas/cmb.schema.json`. The 17 fixtures live at `super-gsd/tools/mesh-memory/fixtures/`. Your job: ship the CLIs + writers + self-test that consume the schema and fixtures.

## Read these files

1. `.planning/milestones/v3.0/phases/107-mesh-validate-hash-writers/107-01-cmb-validator-hash-writers-PLAN.md` — your 3-task contract
2. `.planning/milestones/v3.0/phases/107-mesh-validate-hash-writers/107-CONTEXT.md` — full design + 6 binding invariants
3. `super-gsd/schemas/cmb.schema.json` — what cmb-validate.cjs validates against
4. `super-gsd/tools/plan-schema/validate.cjs` — exemplar Node CLI shape (model your `cmb-validate.cjs` and `cmb-hash.cjs` on this style: stderr for progress, stdout for machine output, JSONL telemetry, --help available, etc.)
5. `super-gsd/tools/plan-schema/package.json` — exemplar package.json (model deps on this)
6. `super-gsd/tools/mesh-memory/fixtures/good-execution-receipt.json` — sample shape; mimic when constructing the execution-receipt --self-test fixture
7. `super-gsd/tools/mesh-memory/fixtures/good-review-finding.json` — sample shape; mimic when constructing the review-finding-writer --self-test fixture

## Task t1 — `cmb-validate.cjs` + `cmb-hash.cjs` + `package.json`

### `super-gsd/tools/mesh-memory/cmb-validate.cjs`

CLI:
```
node cmb-validate.cjs [--help] <file.json> [<file.json> ...]
```

Behavior:
- Loads `super-gsd/schemas/cmb.schema.json` via ajv@^8.18.0 + ajv-formats + ajv-errors (same versions as plan-schema)
- For each file argument: parse JSON, validate against schema
- On all-pass: print `[cmb-validate] N files VALID` to stderr; exit 0
- On any-fail: print one D-08-style line per file per error to stderr (`[<filename>] <message> (<SCHEMA-MML-N>)`); exit 1
- `--help` flag: print usage to stderr; exit 0
- Append one row to `.planning/metrics/mesh-validate.jsonl` per invocation: `{ ts, files_checked, files_invalid, errors }`

### `super-gsd/tools/mesh-memory/cmb-hash.cjs`

CLI:
```
node cmb-hash.cjs [--help] [--compare <a.json> <b.json>] | <file.json>
```

Behavior:
- For single file arg: print canonical hash (sha256 hex) to stdout; exit 0
- For `--compare a.json b.json`: hash both, print `same` if equal or `different` if not, to stdout; exit 0
- Canonical payload (what gets hashed): JSON.stringify with sorted keys of:
  ```
  { type, created_by, role, milestone_id, phase_id, cat7, body, lineage.parents, authority_level, evidence_refs }
  ```
- **`created_at` and `status` MUST be excluded.** Adding them silently breaks echo detection.
- `--help`: usage; exit 0

### `super-gsd/tools/mesh-memory/package.json`

```json
{
  "name": "sgsd-mesh-memory",
  "version": "1.0.0",
  "description": "DLB-08 Mesh Memory Lite — CMB validator + hasher + writers + self-test",
  "main": "cmb-validate.cjs",
  "type": "commonjs",
  "dependencies": {
    "ajv": "^8.18.0",
    "ajv-formats": "^3.0.1",
    "ajv-errors": "^3.0.0"
  }
}
```

Then run `npm install` in the dir if needed — but per Codex constraints, if you cannot run npm, just emit the package.json and let the operator handle install. Most likely Node will find ajv via the existing super-gsd/tools/plan-schema/node_modules — if so, reference those copies directly.

**Pragmatic note:** to avoid duplicating ajv installs, BOTH cmb-validate.cjs and cmb-hash.cjs may resolve ajv from `path.resolve(__dirname, '..', 'plan-schema', 'node_modules', 'ajv')` to share the existing install. Same pattern as plan-schema's validate.cjs uses.

## Task t2 — `execution-receipt.cjs` + `review-finding-writer.cjs`

### `super-gsd/tools/mesh-memory/execution-receipt.cjs`

CLI:
```
node execution-receipt.cjs [--help] [--self-test] [--commit-before SHA --commit-after SHA --changed-files <json> --tests-run <json> --report-path PATH --report-hash SHA --acceptance-criteria-touched <json> [--phase NN] [--milestone vX.Y]]
```

Behavior:
- `--self-test`: synthesises a fixture execution_receipt with sgsd-wrapper as created_by + dummy commit shas + 2 dummy test runs + dummy report path. Validates the result via cmb-validate.cjs (or by inlining the same ajv compile). Appends the synthesised CMB to `.planning/mesh/memory/cmbs.jsonl` (create the dir/file if absent). Exits 0 on success.
- Non-self-test invocation (operator/orchestrator use): build an `execution_receipt` CMB from CLI args; validate; append to ledger.
- Required CMB fields:
  - `key`: sha256 of canonical payload (must use cmb-hash.cjs's same hash function — extract it into a shared module if helpful, OR duplicate the function with a comment "MUST match cmb-hash.cjs canonical payload definition")
  - `type`: `execution_receipt`
  - `created_by`: `sgsd-wrapper`
  - `role`: `sgsd`
  - `authority_level`: `observation`
  - `cat7`: filled with reasonable defaults for an execution observation
  - `body`: per the schema's execution_receipt branch
  - `lineage.parents`: empty array (root observation)
  - `lineage.ancestors`: empty
  - `status`: `emitted`

### `super-gsd/tools/mesh-memory/review-finding-writer.cjs`

CLI:
```
node review-finding-writer.cjs [--help] [--self-test] [--receipt-key <hash> --severity CRIT|WARN|INFO --claim "..." --current-commit SHA --file-path PATH --line-start N --line-end N ...]
```

Behavior:
- `--self-test`: reads the last execution_receipt from `.planning/mesh/memory/cmbs.jsonl` (or creates a dummy one if none exists), synthesises a review_finding CMB with that receipt's content_hash as `lineage.parents[0]`. Validates. Appends to ledger. Exits 0.
- Non-self-test: build a review_finding from CLI args; validate; append.
- `created_by`: defaults to `atc-v4` if not specified (the reviewer role identity)
- `role`: `reviewer`
- `authority_level`: `claim`

## Task t3 — `run-self-test.cjs` + `README.md`

### `super-gsd/tools/mesh-memory/run-self-test.cjs`

Single-file Node test runner. ≥15 assertions. Exits 0 on full pass; exits 1 with diagnostic stderr on any fail.

Test cases (one assertion each, except where noted):
1. cmb-validate.cjs --help exits 0
2. cmb-hash.cjs --help exits 0
3. cmb-validate.cjs validates good-execution-receipt.json (pass)
4. cmb-validate.cjs validates good-review-finding.json (pass)
5. cmb-validate.cjs validates good-evidence-verdict.json (pass)
6. cmb-validate.cjs validates good-decision-recommendation.json (pass)
7. cmb-validate.cjs validates good-operator-precedent.json (pass)
8. cmb-validate.cjs validates good-context-anchor.json (pass)
9. cmb-validate.cjs validates good-promotion-decision.json (pass)
10. cmb-validate.cjs rejects bad-claim-as-observation.json (exit non-zero)
11. cmb-validate.cjs rejects bad-execution-receipt-created-by-agent.json (with SCHEMA-MML-02 in stderr)
12. cmb-validate.cjs rejects bad-cmb-missing-cat7.json (with SCHEMA-MML-03 in stderr)
13. cmb-validate.cjs rejects bad-context-anchor-without-source.json
14. cmb-validate.cjs rejects bad-review-finding-without-lineage.json
15. cmb-validate.cjs rejects bad-cmb-missing-type.json
16. cmb-hash.cjs --compare hash-a.json hash-a-created-at-changed.json → "same"
17. cmb-hash.cjs --compare hash-a.json hash-a-body-changed.json → "different"
18. execution-receipt.cjs --self-test exits 0
19. review-finding-writer.cjs --self-test exits 0
20. After both self-tests, `.planning/mesh/memory/cmbs.jsonl` exists and contains at least 2 valid CMB rows

20 assertions; ≥15 floor satisfied. Print summary `[run-self-test] 20/20 passed` to stderr on success.

### `super-gsd/tools/mesh-memory/README.md`

Operator-facing usage docs. Brief. Cover:
- What this tool family is (DLB-08 Mesh Memory Lite)
- The 4 CLIs (validate, hash, execution-receipt, review-finding-writer)
- Example invocations
- The self-test
- Where CMBs persist (.planning/mesh/memory/cmbs.jsonl)
- Cross-ref to DLB-08 + 107-CONTEXT.md

## Verification you must run

Per task verification_cmds from the PLAN:
```bash
node super-gsd/tools/mesh-memory/cmb-validate.cjs --help
node super-gsd/tools/mesh-memory/execution-receipt.cjs --help
node super-gsd/tools/mesh-memory/run-self-test.cjs
```

The third command is the load-bearing integration test. It must exit 0 with `20/20 passed` reported.

## Out of scope

- Modifying any P106 schema or fixtures
- evidence_validator (P108)
- lineage/echo detector (P108)
- pseudo_operator (P109)
- escalation gate (P109)
- Codex Pro Mode (P110-111)
- Context Authority (P112)
- npm install (if the package.json can't be installed in-Codex, emit it and let the operator install)

## Report format

```
PATCH_BEGIN
<unified diff creating all 7 files>
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
  super-gsd/tools/mesh-memory/cmb-validate.cjs (created)
  super-gsd/tools/mesh-memory/cmb-hash.cjs (created)
  super-gsd/tools/mesh-memory/package.json (created)
  super-gsd/tools/mesh-memory/execution-receipt.cjs (created)
  super-gsd/tools/mesh-memory/review-finding-writer.cjs (created)
  super-gsd/tools/mesh-memory/run-self-test.cjs (created)
  super-gsd/tools/mesh-memory/README.md (created)
VERIFICATION:
  - All 7 files created and parse / load
  - run-self-test.cjs reports 20/20 passed (or operator runs it post-patch)
DEVIATIONS: <none or list>
BLOCKERS: <none or describe>
ONE_LINER: P107 DLB-08.2+.3 tools shipped — validator/hasher consume P106 schema; receipt/finding writers emit + persist; 20-assertion self-test integrates.
REPORT_END
```

Be terse. No prose beyond the report.
