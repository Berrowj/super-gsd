---
phase: 107
phase_name: CMB Validator + Canonical Hash + Receipt and Finding Writers
milestone: v3.0
created: 2026-05-20
status: queued-planning-only
implementation_status: not-started
source: DLB-08.2 + DLB-08.3 Mesh Memory Lite; consumes P106 contract (cmb.schema.json + 17 fixtures)
predecessor: P106 (CMB schema, PASS @ 390ef1a)
---

# Phase 107 — CMB Validator + Canonical Hash + Receipt and Finding Writers

> Implementation phase. Consumes the P106 schema + fixtures. Ships four CommonJS modules + tests. **The 6 SACs declared in 106-01 PLAN run for real at this phase close.**

## Goal

Ship the first round of tools that operate on the CMB substrate from P106:

1. **`super-gsd/tools/mesh-memory/cmb-validate.cjs`** — CLI that validates one or more CMB JSON files against `super-gsd/schemas/cmb.schema.json`. Used by every downstream phase to validate emitted CMBs.
2. **`super-gsd/tools/mesh-memory/cmb-hash.cjs`** — CLI that produces the canonical content hash of a CMB and compares two CMBs for hash equality. **`created_at` is excluded; the canonical payload is the rest.** Proves SAC-P106-03 (created_at change → same hash) and SAC-P106-04 (body change → different hash).
3. **`super-gsd/tools/mesh-memory/execution-receipt.cjs`** — SGSD-emitted `execution_receipt` writer. Runs as a post-executor step. Captures observable facts (commit before/after, changed files, tests run, report path + hash, acceptance criteria touched). Appends one CMB row to `.planning/mesh/memory/cmbs.jsonl`.
4. **`super-gsd/tools/mesh-memory/review-finding-writer.cjs`** — Converts a reviewer's prose report into one or more `review_finding` CMBs (one per finding). Reviewer findings come in as structured input; this writer enforces the schema-required fields (severity, claim, current_commit, etc.) and emits one CMB per finding with lineage to the corresponding `execution_receipt`.

Also ship a single self-test runner `super-gsd/tools/mesh-memory/run-self-test.cjs` that:
- Loads `cmb.schema.json` via ajv
- Validates the 7 good fixtures → expect PASS
- Validates the 6 schema-rejection bad fixtures → expect REJECT
- Runs `cmb-hash.cjs --compare hash-a hash-a-created-at-changed` → expect same
- Runs `cmb-hash.cjs --compare hash-a hash-a-body-changed` → expect different
- Runs the 6 SAC verification commands from the 106-01 PLAN → all green
- Smokes execution_receipt and review_finding writers against fixture inputs

≥15 assertions total. Exit 0 on full pass.

## Binding invariants (inherited from DLB-08 / P106 CONTEXT)

1. **Observation / claim / decision separation** — execution_receipt is observation; review_finding is claim. The schema enforces it; the writers must respect it.
2. **CAT7 envelope universal** — every emitted CMB has the full 7-field cognitive header.
3. **Canonical payload hash excludes `created_at`** — hash = sha256 over sorted-keys JSON of `{ type, created_by, role, milestone_id, phase_id, cat7, body, lineage.parents, authority_level, evidence_refs }`. **`created_at` and `status` are excluded.**
4. **No executor-authored CMBs** — `execution_receipt.cjs` is SGSD-emitted. The `created_by` must be `sgsd` or `sgsd-wrapper`; any agent-class value at runtime triggers an error before write.
5. **Lineage parent linkage** — `review_finding` writer must accept the `execution_receipt`'s content_hash as the `lineage.parents[0]` so reviewers' claims are provably about a specific execution.
6. **Mesh memory persistence** — append-only JSONL at `.planning/mesh/memory/cmbs.jsonl`. No deletes; supersession via new lineage parents.

## Files this phase will create

| Path | Op | Role |
|---|---|---|
| `super-gsd/tools/mesh-memory/cmb-validate.cjs` | create | CLI validator (consumes cmb.schema.json) |
| `super-gsd/tools/mesh-memory/cmb-hash.cjs` | create | Canonical hash + compare CLI |
| `super-gsd/tools/mesh-memory/execution-receipt.cjs` | create | SGSD-emitted observation writer |
| `super-gsd/tools/mesh-memory/review-finding-writer.cjs` | create | Reviewer-claim writer |
| `super-gsd/tools/mesh-memory/run-self-test.cjs` | create | ≥15-assertion self-test exercising the 6 SACs from P106 + writer smoke tests |
| `super-gsd/tools/mesh-memory/package.json` | create | Node dependency lockfile (ajv, ajv-formats, ajv-errors — same versions as plan-schema) |
| `super-gsd/tools/mesh-memory/README.md` | create | Operator usage docs (`cmb-validate <files>`, `cmb-hash --compare a b`, etc.) |

7 files. No new schemas.

## Semantic acceptance criteria (target — 107-01 PLAN will declare these literally)

```yaml
semantic_acceptance_criteria:
  - id: SAC-P107-01
    input: "the 7 good fixtures from P106"
    expected_outcome: "cmb-validate.cjs exits 0 for all 7 good fixtures"
    verification_cmd: "node super-gsd/tools/mesh-memory/cmb-validate.cjs super-gsd/tools/mesh-memory/fixtures/good-*.json; test $? -eq 0"

  - id: SAC-P107-02
    input: "the 6 bad fixtures from P106 that should reject"
    expected_outcome: "cmb-validate.cjs exits non-zero with the appropriate SCHEMA-MML-* error code for each"
    verification_cmd: "for f in bad-claim-as-observation bad-context-anchor-without-source bad-execution-receipt-created-by-agent bad-cmb-missing-cat7 bad-cmb-missing-type bad-review-finding-without-lineage; do node super-gsd/tools/mesh-memory/cmb-validate.cjs super-gsd/tools/mesh-memory/fixtures/$f.json && exit 1; done; exit 0"

  - id: SAC-P107-03
    input: "hash-a.json + hash-a-created-at-changed.json (identical except for created_at)"
    expected_outcome: "cmb-hash.cjs --compare produces 'same' (hash equality)"
    verification_cmd: "node super-gsd/tools/mesh-memory/cmb-hash.cjs --compare super-gsd/tools/mesh-memory/fixtures/hash-a.json super-gsd/tools/mesh-memory/fixtures/hash-a-created-at-changed.json | grep -q 'same'"

  - id: SAC-P107-04
    input: "hash-a.json + hash-a-body-changed.json (identical except for body content)"
    expected_outcome: "cmb-hash.cjs --compare produces 'different'"
    verification_cmd: "node super-gsd/tools/mesh-memory/cmb-hash.cjs --compare super-gsd/tools/mesh-memory/fixtures/hash-a.json super-gsd/tools/mesh-memory/fixtures/hash-a-body-changed.json | grep -q 'different'"

  - id: SAC-P107-05
    input: "execution-receipt.cjs invoked with fixture input emulating a Codex post-executor sequence"
    expected_outcome: "writes one execution_receipt CMB to .planning/mesh/memory/cmbs.jsonl with created_by=sgsd-wrapper, role=sgsd, authority_level=observation"
    verification_cmd: "node super-gsd/tools/mesh-memory/execution-receipt.cjs --self-test; test $? -eq 0"

  - id: SAC-P107-06
    input: "review-finding-writer.cjs invoked with fixture reviewer prose pointing at the execution_receipt's content hash"
    expected_outcome: "emits one review_finding CMB with lineage.parents[0] = receipt content hash; authority_level=claim"
    verification_cmd: "node super-gsd/tools/mesh-memory/review-finding-writer.cjs --self-test; test $? -eq 0"

  - id: SAC-P107-07
    input: "self-test runner over all fixtures + writer smokes"
    expected_outcome: "run-self-test.cjs exits 0 with at least 15 assertions"
    verification_cmd: "node super-gsd/tools/mesh-memory/run-self-test.cjs; test $? -eq 0"
```

7 SACs total. SAC-P107-01 through -04 directly retire SAC-P106-01 through -04 (the P106 SACs that referenced P107 tools — they finally have tools to run).

## Out of scope

- evidence_validator (P108)
- lineage DAG walker / echo detector (P108)
- pseudo_operator peer (P109)
- escalation gate (P109)
- Codex Pro Mode lanes (P110-111)
- Context Authority capsule (P112)
- Any modification of `super-gsd/schemas/cmb.schema.json` (P106 frozen)
- Any modification of existing P106 fixtures (P106 frozen)

## Dispatch

Codex executor via `super-gsd/scripts/codex-executor.sh` with read-pack patch fallback. One PLAN authoring dispatch + one executor dispatch. The 7 files are tightly coupled (validator + hasher + writers + self-test); single Codex run with serial-SDD discipline within its context.

## Cross-references

- `super-gsd/schemas/cmb.schema.json` (P106 @ 390ef1a) — the schema this validator consumes
- `super-gsd/tools/mesh-memory/fixtures/*.json` (P106 @ 390ef1a) — the fixtures this validator + hasher exercise
- `.planning/milestones/v3.0/phases/106-mesh-cmb-schema/106-01-cmb-schema-PLAN.md` — declares the 6 P106 SACs whose verification_cmds first run at this phase's close
- `.planning/decisions/DLB-08-MESH-MEMORY-LITE.md` — design lock; observation/claim/decision separation invariant
- `.planning/milestones/v3.0/REQUIREMENTS.md` — REQ-MML-09 (execution_receipt SGSD-emitted) + REQ-MML-10 (review_finding structured evidence) + REQ-MML-03 (canonical hash excludes created_at)
- `super-gsd/templates/plan-schema-v2.json` — P107-01 PLAN must validate per SCHEMA-09
