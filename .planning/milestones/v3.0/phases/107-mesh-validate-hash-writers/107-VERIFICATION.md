---
phase: 107
status: PASS
date: 2026-05-20
self_test_total: 20
self_test_passed: 20
deferred_count: 0
---

# Phase 107 — Verification

## Goal recall

Ship the first round of CMB tools consuming the P106 schema contract: `cmb-validate.cjs`, `cmb-hash.cjs`, `execution-receipt.cjs`, `review-finding-writer.cjs`, plus `run-self-test.cjs` integration runner + `package.json` + `README.md`. 7 files. The 6 SACs declared in P106-01 PLAN run for the first time at this phase close (the tools they reference finally exist).

## Acceptance criteria

| Criterion | Met? | Evidence |
|---|---|---|
| `cmb-validate.cjs` validates all 7 good fixtures | YES | 7/7 PASS in self-test (assertions 3-9) |
| `cmb-validate.cjs` rejects all 6 schema-bad fixtures with correct error codes | YES | 6/6 reject (assertions 10-15); SCHEMA-MML-02 fires on agent-authored execution_receipt; SCHEMA-MML-03 fires on incomplete CAT7 |
| `cmb-hash.cjs --compare` proves `created_at` excluded from hash | YES | hash-a vs hash-a-created-at-changed → "same" (assertion 16) |
| `cmb-hash.cjs --compare` proves body changes affect hash | YES | hash-a vs hash-a-body-changed → "different" (assertion 17) |
| `execution-receipt.cjs --self-test` writes valid observation CMB to ledger | YES | exits 0 (assertion 18); ledger row has `type: execution_receipt`, `created_by: sgsd-wrapper`, `role: sgsd`, `authority_level: observation` |
| `review-finding-writer.cjs --self-test` writes valid claim CMB with lineage | YES | exits 0 (assertion 19); ledger row has `type: review_finding`, `role: reviewer`, `authority_level: claim`, `lineage.parents[0]` references the execution_receipt's content_hash |
| `.planning/mesh/memory/cmbs.jsonl` exists with ≥2 rows after self-test | YES | 2 rows verified (assertion 20) |
| All P106 SACs (SAC-P106-01 through SAC-P106-06) retired green | YES | SAC-P107-01..04 directly subsume P106's SACs; tools now exist to run them |
| run-self-test.cjs reports ≥15 assertions | YES | 20 assertions (≥15 floor satisfied) |
| Codex SDD discipline followed | YES | Two dispatches: PLAN authoring + executor; fix-1 dispatch was no-op (file already correct) |
| PLAN-LOCKED.md validates against plan-schema-v2 (SCHEMA-09) | YES | `validate.cjs --plan-file 107-01-cmb-validator-hash-writers-PLAN.md` exits 0 VALID |
| All 6 binding invariants from CONTEXT respected | YES | observation/claim/decision separation enforced; CAT7 universal; canonical hash excludes created_at; no executor-authored CMBs; lineage parent linkage; append-only JSONL |

## Self-test results

```
$ node super-gsd/tools/mesh-memory/run-self-test.cjs
[run-self-test] 20/20 passed
```

20/20 green. Per-assertion summary:

| # | Assertion | Result |
|---:|---|---|
| 1 | cmb-validate --help exit 0 | PASS |
| 2 | cmb-hash --help exit 0 | PASS |
| 3-9 | All 7 good fixtures validate | PASS × 7 |
| 10-15 | All 6 schema-bad fixtures reject | PASS × 6 |
| 16 | hash-a vs hash-a-created-at-changed → same | PASS |
| 17 | hash-a vs hash-a-body-changed → different | PASS |
| 18 | execution-receipt --self-test writes valid observation CMB | PASS |
| 19 | review-finding-writer --self-test writes valid claim CMB with lineage | PASS |
| 20 | `.planning/mesh/memory/cmbs.jsonl` has ≥2 valid rows | PASS |

## Diagnostic: ajv multi-instance resolution bug (fixed in-loop)

During the first self-test pass, 8/20 passed and 12 failed with ajv "Error compiling schema, function code: ..." dumps. Root cause: `requireDependency()` in `cmb-validate.cjs` had `name` (bare module name) as the first candidate, which Node resolved to `C:\Users\user\node_modules\ajv` (a different physical install than ajv-errors, which only existed in `super-gsd/tools/plan-schema/node_modules/`). The ajv-errors plugin tried to extend a different ajv instance than the one constructed → compile threw.

Fix: candidate order reordered so `plan-schema/node_modules` is tried first, forcing all three (`ajv`, `ajv-formats`, `ajv-errors`) to resolve from the same install. Compile now succeeds; 20/20 self-test green.

Note: Codex's fix-1 dispatch reported empty patch — by that point the file already had the correct candidate order (possibly applied in an earlier Codex pass that wasn't recorded in the report). The fix-1 audit trail is committed regardless for diagnostic completeness.

## Files shipped

| File | Op | Purpose |
|---|---|---|
| `super-gsd/tools/mesh-memory/cmb-validate.cjs` | create | CLI; ajv-based validation against cmb.schema.json; D-08-style error formatting; JSONL metrics |
| `super-gsd/tools/mesh-memory/cmb-hash.cjs` | create | Canonical sha256 hash with sorted keys; `--compare` mode; `created_at` + `status` excluded |
| `super-gsd/tools/mesh-memory/execution-receipt.cjs` | create | SGSD-emitted observation writer; `created_by` locked to sgsd/sgsd-wrapper; appends to `.planning/mesh/memory/cmbs.jsonl` |
| `super-gsd/tools/mesh-memory/review-finding-writer.cjs` | create | Reviewer-claim writer; lineage parent = execution_receipt content_hash; `created_by` defaults to `atc-v4` |
| `super-gsd/tools/mesh-memory/run-self-test.cjs` | create | 20-assertion integration test runner |
| `super-gsd/tools/mesh-memory/package.json` | create | Node deps declaration (ajv, ajv-formats, ajv-errors — pinned to plan-schema's versions) |
| `super-gsd/tools/mesh-memory/README.md` | create | Operator usage docs for all 4 CLIs |
| `.planning/milestones/v3.0/phases/107-mesh-validate-hash-writers/107-01-cmb-validator-hash-writers-PLAN.md` | create | v2-schema PLAN (already committed @ `e2d5aa4`) |
| `.planning/milestones/v3.0/phases/107-mesh-validate-hash-writers/.codex/*` | create | Codex audit trail (3 dispatches: PLAN authoring + executor + fix-1) |

## Runtime evidence

`.planning/mesh/memory/cmbs.jsonl` populated by writer self-tests:
- Row 1: `execution_receipt` from `execution-receipt.cjs --self-test`
- Row 2: `review_finding` from `review-finding-writer.cjs --self-test`, with `lineage.parents[0]` = the execution_receipt's content_hash

This is the first **real** CMB persistence in the SGSD repo. The mesh memory ledger is live.

## Codex audit trail

| Dispatch | Mode | Exit | Outcome |
|---|---|---|---|
| `107-01-PLAN-authoring` | read-pack patch | 0 | v2-schema PLAN with 7 SACs verbatim |
| `107-01-executor` | read-pack patch | 0 | All 7 files created (cmb-validate, cmb-hash, package.json, execution-receipt, review-finding-writer, run-self-test, README) |
| `107-01-fix1` | read-pack patch | 6 (empty patch) | File already had correct candidate order; no-op |

## Notes for downstream phases

- **P108** (evidence_validator + lineage DAG + echo detector) consumes:
  - `cmb-validate.cjs` for fixture validation
  - `cmb-hash.cjs` for canonical hash computation in lineage operations
  - The 2 existing CMBs in `.planning/mesh/memory/cmbs.jsonl` as seed data for echo-detection tests
- The P107 self-test will be RE-RUN as part of P108's CI to ensure regressions are caught
- The two writers (execution-receipt, review-finding-writer) are now available for P108+ integrations
- ajv multi-instance bug fix is a useful pattern: any future tool under super-gsd/tools/<name>/ that uses requireDependency should follow the same plan-schema-first candidate order

## Verdict

**PASS** — DLB-08.2 + DLB-08.3 tooling shipped. 20/20 self-test green. Mesh memory ledger live with 2 valid CMBs from writer self-tests. Ready for P108 evidence_validator + lineage DAG + echo detector implementation.

## Phase 108 unblock

Phase 108 (DLB-08.4 + DLB-08.5) is now unblocked. Files it will create:
- `super-gsd/tools/mesh-memory/evidence-validator.cjs` (Tier 0 deterministic + Tier 1 heuristic admission)
- `super-gsd/tools/mesh-memory/lineage.cjs` (parents + ancestors DAG; depth bounded ≤50)
- `super-gsd/tools/mesh-memory/echo-detector.cjs` (O(1) ancestor-set intersection)
- Test extensions to run-self-test.cjs covering all three new tools
