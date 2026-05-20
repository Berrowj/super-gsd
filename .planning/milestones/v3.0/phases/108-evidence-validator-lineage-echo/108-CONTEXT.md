---
phase: 108
phase_name: Evidence Validator + Lineage DAG + Echo Detector
milestone: v3.0
created: 2026-05-20
status: queued-planning-only
implementation_status: not-started
source: DLB-08.4 + DLB-08.5 Mesh Memory Lite; consumes P106 schema + P107 writers/CLIs
predecessor: P107 PASS @ c45c24c (cmb-validate + cmb-hash + writers; 20/20 self-test)
---

# Phase 108 — Evidence Validator + Lineage DAG + Echo Detector

> Implementation phase. Consumes P106 schema + 17 fixtures + P107's `cmb-validate.cjs` + `cmb-hash.cjs` + the live mesh memory ledger (already 2 CMB rows from P107 writer self-tests). Ships three tools that turn the schema-validated CMB stream into evidence-validated, lineage-tracked, echo-detected admission decisions.

## Goal

Ship the three tools that operationalise DLB-08 Rule 2 (uniform results are alarms) + DLB-07 Rule 1 (evidence-backed review) at the CMB layer:

1. **`super-gsd/tools/mesh-memory/evidence-validator.cjs`** — consumes `review_finding` CMBs from the ledger and produces `evidence_verdict` CMBs. **Tier 0 (deterministic) + Tier 1 (heuristic) only** — no LLM judgments. Five admission states: `VERIFIED_CRIT`, `REFUTED_CRIT`, `STALE_CRIT`, `UNVERIFIED_CRIT`, `GUARDED_CRIT`. Lineage parent = the review_finding's content_hash.

2. **`super-gsd/tools/mesh-memory/lineage.cjs`** — DAG walker over the ledger. Functions: `ancestors(cmbKey, maxDepth=50)`, `descendants(cmbKey)`, `provenance(cmbKey)` (walk backward through parents), `siblings(cmbKey)` (CMBs sharing a parent). Pure functions; no side effects.

3. **`super-gsd/tools/mesh-memory/echo-detector.cjs`** — given an incoming CMB and a receiver's own produced-key set, returns `echoDetected: true|false` via O(1) ancestor-set intersection (`ancestors(incoming) ∩ Kself ≠ ∅`). Each detection result is recorded as a flag on the receiving CMB — not silently dropped.

Plus extend `run-self-test.cjs` with ≥10 new assertions covering all three new tools. New floor: ≥30 assertions total.

## Binding invariants (inherited from DLB-08 / P106 + P107)

1. **Observation / claim / decision separation** — evidence_verdict is a claim-with-authority (created_by must be `evidence_validator`). Schema already enforces; new tool must respect.
2. **Lineage parent linkage mandatory for evidence_verdict** — `lineage.parents` MUST contain at least one `review_finding` key. Schema enforces via `minItems: 1` in P106; new tool produces compliant CMBs.
3. **Lineage DAG depth bounded ≤50** — matches MMP spec §15.2 bound. Prevents pathological ancestor chains and unbounded ancestor-set growth.
4. **Echo detection records result, never silently drops** — even when echo is detected, the receiver still records the incoming CMB attempt with `lineage.echo_detected: true`. Audit trail preservation.
5. **Tier 0 + Tier 1 only in P108** — deterministic file-exists, line-exists, grep-match, test-passed checks. Heuristic claim-class + severity + changed-file overlap + lineage-to-prior-finding. **No LLM judgments** — that's pseudo_operator in P109.
6. **Real-data guard** — `evidence-validator` rejects review_findings whose `file_path` resolves under `fixtures/`, `mock/`, `__mocks__/` (matches DLB-07 sgsd-audit Layer 4 real-data rule). Whitelist: `super-gsd/tools/plan-schema/fixtures/` and `super-gsd/tools/mesh-memory/fixtures/` are exempt (these ARE the real data for their respective validators).

## Files this phase will create

| Path | Op | Role |
|---|---|---|
| `super-gsd/tools/mesh-memory/evidence-validator.cjs` | create | Tier 0+1 admission gate; emits evidence_verdict CMBs |
| `super-gsd/tools/mesh-memory/lineage.cjs` | create | DAG walker; ancestors/descendants/provenance/siblings |
| `super-gsd/tools/mesh-memory/echo-detector.cjs` | create | O(1) echo detection via ancestor-set intersection |
| `super-gsd/tools/mesh-memory/fixtures/seed-ledger.jsonl` | create | Multi-CMB fixture ledger seeded with realistic lineage chains for echo-detection + admission testing |
| `super-gsd/tools/mesh-memory/run-self-test.cjs` | modify | Extend with ≥10 new assertions for the three new tools |

5 file ops (4 create + 1 modify).

## Semantic acceptance criteria (target — 108-01 PLAN will declare these literally)

```yaml
semantic_acceptance_criteria:
  - id: SAC-P108-01
    input: "a review_finding CMB referencing super-gsd/schemas/cmb.schema.json:1-3 with quoted excerpt matching current file"
    expected_outcome: "evidence-validator emits evidence_verdict with evidence_status=VERIFIED_CRIT and lineage.parents[0]=review_finding key"
    verification_cmd: "node super-gsd/tools/mesh-memory/evidence-validator.cjs --self-test-verified; test $? -eq 0"

  - id: SAC-P108-02
    input: "a review_finding CMB claiming a file:line that does not match current HEAD content"
    expected_outcome: "evidence-validator emits evidence_verdict with evidence_status=REFUTED_CRIT or STALE_CRIT"
    verification_cmd: "node super-gsd/tools/mesh-memory/evidence-validator.cjs --self-test-refuted; test $? -eq 0"

  - id: SAC-P108-03
    input: "a review_finding pointing at super-gsd/tools/mesh-memory/__mocks__/fake.json"
    expected_outcome: "evidence-validator rejects with reason 'fixture_path_in_real_data_check'"
    verification_cmd: "node super-gsd/tools/mesh-memory/evidence-validator.cjs --self-test-fixture-guard; test $? -eq 0"

  - id: SAC-P108-04
    input: "lineage.cjs ancestors() over the seed ledger from a deep-leaf CMB"
    expected_outcome: "ancestors array is correctly ordered and depth-bounded ≤50; provenance walk surfaces the root execution_receipt"
    verification_cmd: "node super-gsd/tools/mesh-memory/lineage.cjs --self-test-ancestors; test $? -eq 0"

  - id: SAC-P108-05
    input: "echo-detector with an incoming CMB whose ancestors intersect with the receiver's Kself"
    expected_outcome: "echoDetected: true; receiver still persists the attempt with lineage.echo_detected=true"
    verification_cmd: "node super-gsd/tools/mesh-memory/echo-detector.cjs --self-test-echo-hit; test $? -eq 0"

  - id: SAC-P108-06
    input: "echo-detector with an incoming CMB whose ancestors do NOT intersect Kself"
    expected_outcome: "echoDetected: false; receiver persists normally"
    verification_cmd: "node super-gsd/tools/mesh-memory/echo-detector.cjs --self-test-echo-miss; test $? -eq 0"

  - id: SAC-P108-07
    input: "the integrated self-test runner exercising all three new tools end-to-end"
    expected_outcome: "run-self-test.cjs exits 0 with ≥30 assertions passed"
    verification_cmd: "node super-gsd/tools/mesh-memory/run-self-test.cjs; test $? -eq 0"
```

## sgsd-audit@v2 wire-in

This phase ALSO updates `super-gsd/skills/sgsd-audit/SKILL.md` (in-place edit, no new file) to reference the evidence_verdict CMB stream as the Layer 4 admission output source. The audit-gate's "Layer 4 Semantic-AC enforcement" section currently describes the per-entry execution loop in prose; this phase makes it concrete: each SAC verification produces an evidence_verdict CMB (or surfaces an existing one); the audit verdict aggregates over the CMB ledger.

This update is a soft wire-in — no new mandatory dispatch in the audit skill — but it makes the v3.0 DLB-08 layer the canonical evidence source for sgsd-audit going forward. Out-of-scope: actually invoking the audit-gate from P108. The wire-in is documentation.

## Out of scope

- pseudo_operator (P109)
- escalation_gate (P109)
- Codex Pro Mode lanes (P110-111)
- Context Authority capsule (P112)
- LLM judgments inside evidence_validator (Tier 2 is pseudo_operator territory)
- Modifying P106 schema or fixtures (frozen)
- Modifying P107 CLIs (frozen except run-self-test extension)
- New CMB types beyond the 7 in P106 (frozen vocabulary)

## Dispatch

Codex executor via codex-executor.sh with read-pack patch fallback. One PLAN authoring dispatch + one executor dispatch. The three new tools are tightly coupled (evidence-validator depends on lineage.cjs; echo-detector depends on lineage.cjs); single Codex run with serial-SDD discipline.

## Cross-references

- `super-gsd/schemas/cmb.schema.json` (P106 @ 390ef1a)
- `super-gsd/tools/mesh-memory/cmb-validate.cjs` (P107 @ c45c24c) — evidence-validator delegates to this for shape validation
- `super-gsd/tools/mesh-memory/cmb-hash.cjs` (P107) — lineage.cjs uses for content-hash computation
- `super-gsd/tools/mesh-memory/run-self-test.cjs` (P107) — extended in this phase
- `.planning/decisions/DLB-08-MESH-MEMORY-LITE.md` — design lock; observation/claim/decision; band-pass admission states; lineage DAG bound
- `.planning/decisions/DLB-07-semantic-vs-structural-verification.md` — Rule 1 real-data guard; sgsd-audit Layer 4 wire-in target
- `super-gsd/skills/sgsd-audit/SKILL.md` — wire-in target for evidence_verdict CMB stream
- `.planning/milestones/v3.0/REQUIREMENTS.md` — REQ-MML-04/-05/-07/-08/-11/-12/-16 + REQ-POL-04 + REQ-POL-08
