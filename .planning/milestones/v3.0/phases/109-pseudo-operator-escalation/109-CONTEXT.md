---
phase: 109
phase_name: Pseudo Operator Peer + Escalation Gate
milestone: v3.0
created: 2026-05-20
status: queued-planning-only
implementation_status: not-started
source: DLB-08.6 + DLB-08.7 Mesh Memory Lite; consumes P106 schema + P107 CLIs + P108 lineage/evidence_validator
predecessor: P108 PASS (49/49 self-test)
---

# Phase 109 — Pseudo Operator Peer + Escalation Gate

> Final DLB-08 phase. Ships the decision layer that consumes evidence_verdict CMBs + context anchors + operator_precedents + lineage → emits `decision_recommendation` CMBs. Then enforces hard escalation carve-outs that route to real operator when authority is exceeded.
>
> **This is where Fixture D (the restraint proof) materializes.** Pseudo-operator with high confidence is BLOCKED from autonomous decisions when production-mutation / credentials / scope-change / commercial impact apply.

## Goal

Ship the two tools that complete the v3.0 DLB-08 substrate:

1. **`super-gsd/tools/mesh-memory/pseudo-operator-peer.cjs`** — consumes admitted CMBs (evidence_verdict + context_anchor + operator_precedent) and produces `decision_recommendation` CMBs. Tier 2 LLM judge (optional; if Codex CLI unreachable, falls back to rule-based recommendation). Each emitted CMB declares `authority_level` (1-3), `confidence` (0-1), `real_operator_required` (boolean), `evidence_refs[]`, `carve_outs_triggered[]`.

2. **`super-gsd/tools/mesh-memory/escalation-gate.cjs`** — pure-function carve-out checker. Given a decision context (decision_type, target_files, target_systems, milestone_state), returns `{ allow_autonomous: bool, real_operator_required: bool, carve_outs_triggered: string[] }`. Hard carve-outs:
   - `production_mutation` — any write to SAP / Mongo / Qdrant / Elasticsearch / customer-DB
   - `credential_or_security` — any key/token/credential reference; any auth-bypass concern
   - `milestone_scope_change` — introducing or removing a milestone-level commitment
   - `commercial_legal_policy` — pricing, contracts, public statements
   - `low_confidence` — pseudo_operator confidence < 0.70
   - `destructive_or_irreversible` — git history rewrite, force-push, destructive DB op

If ANY carve-out triggers → `real_operator_required = true` regardless of confidence.

Plus extend `run-self-test.cjs` with ≥10 new assertions covering both tools, INCLUDING **Fixture D** (production-mutation scenario forces escalation despite confidence ≥0.80).

## Binding invariants (inherited from DLB-08)

1. **No LLM judgments override hard carve-outs.** Even Tier 2 LLM judge with confidence 1.0 cannot bypass production-mutation carve-out. Schema + escalation-gate enforce.
2. **decision_recommendation CMB shape**: required body fields per cmb.schema.json — `recommendation`, `authority_level` (1-3), `confidence` (0-1), `real_operator_required` (bool), `context_pack_id`, `evidence_refs[]`, `carve_outs_triggered[]`. Plus full top-level CMB shape (milestone_id, phase_id, cat7, lineage.ancestors etc.).
3. **lineage.parents** for decision_recommendation includes one or more evidence_verdict keys (the validated claims that informed the decision).
4. **operator_precedent influence**: pseudo_operator's recommendation MUST cite any matching operator_precedent CMBs from the ledger. Decision lineage walks back through precedent for traceability.
5. **Tier 2 LLM only when needed**: Tier 0+1 deterministic verdicts from P108 are taken at face value. Tier 2 LLM judge fires only for genuinely semantic decisions (trade-offs, persona conflicts, lexicon disambiguation). Most code-correctness decisions use deterministic path.
6. **Pure-function escalation-gate**: no side effects. Input → output. Easy to test, no I/O.

## Files this phase will create

| Path | Op | Role |
|---|---|---|
| `super-gsd/tools/mesh-memory/pseudo-operator-peer.cjs` | create | Decision-recommendation writer with Tier 0+1 deterministic + optional Tier 2 LLM judge |
| `super-gsd/tools/mesh-memory/escalation-gate.cjs` | create | Pure-function hard-carve-out checker |
| `super-gsd/tools/mesh-memory/run-self-test.cjs` | modify | Extend with ≥10 new assertions; new floor ≥60 total |

3 file ops. No new schema (consumes P106 frozen schema).

## Semantic acceptance criteria (target — 109-01 PLAN will declare these literally)

```yaml
semantic_acceptance_criteria:
  - id: SAC-P109-01
    input: "pseudo-operator-peer --self-test-verified-path: evidence_verdict CMB with VERIFIED_CRIT status + low-risk context (e.g., schema-only plan)"
    expected_outcome: "emits decision_recommendation with authority_level=3, confidence>=0.80, real_operator_required=false, carve_outs_triggered=[]"
    verification_cmd: "node super-gsd/tools/mesh-memory/pseudo-operator-peer.cjs --self-test-verified-path; test $? -eq 0"

  - id: SAC-P109-02
    input: "pseudo-operator-peer --self-test-refuted-path: evidence_verdict CMB with REFUTED_CRIT"
    expected_outcome: "emits decision_recommendation suggesting PASS_WITH_REFUTED_REVIEW; cites the refutation"
    verification_cmd: "node super-gsd/tools/mesh-memory/pseudo-operator-peer.cjs --self-test-refuted-path; test $? -eq 0"

  - id: SAC-P109-03
    input: "escalation-gate.checkCarveOuts({ target_systems: ['mongo'], decision_type: 'data_mutation' })"
    expected_outcome: "carve_outs_triggered includes 'production_mutation'; real_operator_required=true"
    verification_cmd: "node super-gsd/tools/mesh-memory/escalation-gate.cjs --self-test-production-mutation; test $? -eq 0"

  - id: SAC-P109-04
    input: "escalation-gate.checkCarveOuts({ target_files: ['secrets.env'], decision_type: 'config_change' })"
    expected_outcome: "carve_outs_triggered includes 'credential_or_security'; real_operator_required=true"
    verification_cmd: "node super-gsd/tools/mesh-memory/escalation-gate.cjs --self-test-credential; test $? -eq 0"

  - id: SAC-P109-05
    input: "pseudo-operator-peer fed an evidence chain with high LLM-judge confidence (0.95) BUT target_systems includes 'sap'"
    expected_outcome: "FIXTURE D — production-mutation hard carve-out FORCES real_operator_required=true regardless of confidence"
    verification_cmd: "node super-gsd/tools/mesh-memory/pseudo-operator-peer.cjs --self-test-fixture-d; test $? -eq 0"

  - id: SAC-P109-06
    input: "pseudo-operator-peer with low confidence (0.50)"
    expected_outcome: "real_operator_required=true regardless of decision type; carve_outs_triggered includes 'low_confidence'"
    verification_cmd: "node super-gsd/tools/mesh-memory/pseudo-operator-peer.cjs --self-test-low-confidence; test $? -eq 0"

  - id: SAC-P109-07
    input: "run-self-test runner covering both new tools + Fixture D restraint proof"
    expected_outcome: "exit 0 with ≥60 assertions passed"
    verification_cmd: "node super-gsd/tools/mesh-memory/run-self-test.cjs; test $? -eq 0"
```

7 SACs. SAC-P109-05 is **Fixture D** — the production-mutation restraint proof, the DLB-08 close gate's most important assertion.

## Out of scope

- Codex Pro Mode lanes (P110-111)
- Context Authority capsule (P112)
- Tier 3 embedding-based SVAF (deferred to v3.1+)
- LLM-judge implementation depth (P109 ships hook for Tier 2 but accepts mock/rule-based fallback in MVP)
- Modifying P106 schema or P107/P108 tools (frozen)

## Dispatch

Codex executor via codex-executor.sh with read-pack patch fallback. One PLAN authoring + one executor + likely 2-3 fix rounds (per P108 pattern). The two new tools are loosely coupled (escalation-gate is pure-function; pseudo-operator-peer calls it).

## Cross-references

- `super-gsd/schemas/cmb.schema.json` — decision_recommendation type definition
- `super-gsd/tools/mesh-memory/evidence-validator.cjs` — emits the inputs pseudo-operator consumes
- `super-gsd/tools/mesh-memory/lineage.cjs` — used for context-pack composition
- `super-gsd/tools/mesh-memory/echo-detector.cjs` — pseudo-operator checks for echo before emitting
- `.planning/decisions/DLB-08-MESH-MEMORY-LITE.md` — hard carve-outs binding watchlist
- `.planning/milestones/v3.0/REQUIREMENTS.md` — REQ-MML-13 (decision_recommendation shape) + REQ-MML-14 (operator_precedent highest authority) + REQ-POL-04 (hard carve-outs)
