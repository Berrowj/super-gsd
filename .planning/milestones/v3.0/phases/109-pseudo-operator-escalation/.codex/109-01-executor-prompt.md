# SDD Implementer Task — P109-01 executor (escalation_gate + pseudo_operator + self-test)

You are a fresh SDD implementer. No inherited context.

## What you are doing

Implementing 2 tasks creating 2 new files + extending 1 file. Final phase of DLB-08 Mesh Memory Lite.

This phase ships the **decision layer** + the **hard restraint case** (Fixture D). The escalation_gate is a pure-function carve-out checker; the pseudo_operator_peer consumes evidence_verdict CMBs from P108 and emits decision_recommendation CMBs subject to the gate.

## Read these files

1. `.planning/milestones/v3.0/phases/109-pseudo-operator-escalation/109-01-pseudo-operator-escalation-PLAN.md` — 2-task contract
2. `.planning/milestones/v3.0/phases/109-pseudo-operator-escalation/109-CONTEXT.md` — full design + 6 binding invariants
3. `super-gsd/schemas/cmb.schema.json` — decision_recommendation body shape (REQUIRED FIELDS: recommendation, authority_level 1-3, confidence 0-1, real_operator_required bool, context_pack_id, evidence_refs[], carve_outs_triggered[])
4. `super-gsd/tools/mesh-memory/evidence-validator.cjs` — exemplar shape for new tools (same requireDependency plan-schema-first pattern; same metrics logging; same --help)
5. `super-gsd/tools/mesh-memory/run-self-test.cjs` — what you extend
6. `super-gsd/tools/mesh-memory/fixtures/good-decision-recommendation.json` — reference shape

## Task t1 — `super-gsd/tools/mesh-memory/escalation-gate.cjs`

Pure-function module. NO I/O. NO ledger writes. Easy to unit-test.

CLI:
```
node escalation-gate.cjs [--help] [--check <json>] [--self-test-production-mutation] [--self-test-credential] [--self-test-pass-through]
```

Exports `checkCarveOuts(context)` where context shape:
```js
{
  decision_type: 'data_mutation' | 'code_change' | 'config_change' | 'doc_update' | ...,
  target_systems: string[],     // e.g. ['mongo', 'sap', 'qdrant', 'elasticsearch', 'customer_db']
  target_files: string[],       // file paths
  milestone_state: { scope_change: bool, commercial_impact: bool, legal_impact: bool },
  confidence: number,            // 0-1
  destructive: bool,             // e.g. git history rewrite, force-push, DROP TABLE
}
```

Returns:
```js
{
  allow_autonomous: bool,
  real_operator_required: bool,
  carve_outs_triggered: string[]  // names of fired carve-outs
}
```

Carve-out rules (in this evaluation order):

1. **`production_mutation`** — any target_system in `['sap', 'mongo', 'qdrant', 'elasticsearch', 'customer_db', 'production']` OR any target_file matching `prod*` / `production/*`
2. **`credential_or_security`** — any target_file matching `*.env|secrets/*|credentials/*|*token*|*key*|*.pem|*.crt` OR decision_type === `auth_change` OR `security_change`
3. **`milestone_scope_change`** — `context.milestone_state.scope_change === true`
4. **`commercial_legal_policy`** — `context.milestone_state.commercial_impact === true` OR `context.milestone_state.legal_impact === true`
5. **`destructive_or_irreversible`** — `context.destructive === true`
6. **`low_confidence`** — `context.confidence < 0.70`

If ANY of the above triggers: `real_operator_required = true`, `allow_autonomous = false`.
If NONE triggers: `allow_autonomous = true`, `real_operator_required = false`.

CLI behaviors:
- `--check <json-string>`: parse JSON, run checkCarveOuts, print result to stdout
- `--self-test-production-mutation`: synthesize context with `target_systems: ['mongo']`; assert production_mutation triggers + real_operator_required=true. Exit 0 on pass.
- `--self-test-credential`: synthesize context with `target_files: ['config/secrets.env']`; assert credential_or_security triggers. Exit 0 on pass.
- `--self-test-pass-through`: synthesize context with no carve-outs (e.g. doc_update, no prod targets, confidence 0.85); assert allow_autonomous=true. Exit 0 on pass.

## Task t2 — `super-gsd/tools/mesh-memory/pseudo-operator-peer.cjs`

CLI:
```
node pseudo-operator-peer.cjs [--help] [--evidence-key <cmb-key>] [--ledger PATH] [--self-test-verified-path] [--self-test-refuted-path] [--self-test-fixture-d] [--self-test-low-confidence]
```

Behavior:
- Loads ledger; loads the named evidence_verdict (or recent for self-test paths)
- Composes a context_pack from lineage walk + any operator_precedent matches
- Computes Tier 1 confidence (rule-based): VERIFIED_CRIT lineage with multiple corroborating verdicts → high confidence; REFUTED_CRIT → moderate confidence in PASS_WITH_REFUTED_REVIEW recommendation; etc.
- Optionally Tier 2 LLM judge (not required for MVP; skip if Codex CLI unreachable — fall back to Tier 1 deterministic)
- Builds decision context with target_systems / target_files / milestone_state inferred from the evidence + lineage
- Calls `escalation-gate.checkCarveOuts(context)`
- Emits `decision_recommendation` CMB with FULL schema shape:
  - top-level: key, type, created_at, created_by: `pseudo_operator`, role: `pseudo_operator`, milestone_id, phase_id, full cat7, lineage.parents (evidence_verdict key) + lineage.ancestors (empty array OK), authority_level: `decision`, evidence_refs[], status: `emitted`
  - body: `recommendation`, `authority_level` (1-3 integer), `confidence` (0-1 number), `real_operator_required` (from gate), `context_pack_id`, `evidence_refs[]`, `carve_outs_triggered[]` (from gate)

`--self-test-verified-path`: synthesize evidence with VERIFIED_CRIT + benign decision context. Expect authority_level=3, confidence≥0.80, real_operator_required=false, carve_outs_triggered=[]. Exit 0.

`--self-test-refuted-path`: synthesize evidence with REFUTED_CRIT. Expect recommendation suggesting PASS_WITH_REFUTED_REVIEW. Exit 0.

`--self-test-fixture-d`: **FIXTURE D — the restraint proof.** Synthesize evidence with VERIFIED_CRIT + HIGH internal LLM-judge confidence (mock to 0.95) + target_systems = ['sap']. Expect real_operator_required=true (production_mutation carve-out fires) regardless of confidence. Exit 0.

`--self-test-low-confidence`: synthesize with confidence 0.50. Expect real_operator_required=true (low_confidence carve-out fires). Exit 0.

Same plan-schema-first requireDependency order as other mesh-memory tools.

## Task t2b — extend `super-gsd/tools/mesh-memory/run-self-test.cjs`

Add ≥10 new assertions at the end of `main()` (before the floor check):

1. escalation-gate.cjs --help exit 0
2. pseudo-operator-peer.cjs --help exit 0
3. escalation-gate --self-test-production-mutation exit 0
4. escalation-gate --self-test-credential exit 0
5. escalation-gate --self-test-pass-through exit 0
6. checkCarveOuts({target_systems:['sap']}) → carve_outs includes production_mutation
7. checkCarveOuts({target_systems:[],confidence:0.65}) → carve_outs includes low_confidence
8. checkCarveOuts({target_systems:[],confidence:0.85,destructive:false,milestone_state:{scope_change:false,commercial_impact:false,legal_impact:false}}) → allow_autonomous=true
9. pseudo-operator-peer --self-test-verified-path exit 0
10. pseudo-operator-peer --self-test-refuted-path exit 0
11. pseudo-operator-peer --self-test-fixture-d exit 0 (FIXTURE D)
12. pseudo-operator-peer --self-test-low-confidence exit 0
13. After self-tests, live ledger has at least 1 decision_recommendation CMB with carve_outs_triggered:['production_mutation']
14. Update final floor assertion to require ≥60 total

Update final summary line to print `[run-self-test] N/N passed`. Update floor check `passed >= 60` (was 30 in P108).

## requireDependency must use plan-schema-first candidate order

```js
const candidates = [
  path.resolve(__dirname, '..', 'plan-schema', 'node_modules', name),
  path.resolve(__dirname, 'node_modules', name),
  name,
];
```

## decision_recommendation CMB shape — full required fields

Per cmb.schema.json (must conform — recurring bug from P107/P108):

```json
{
  "key": "cmb-<unique>",
  "type": "decision_recommendation",
  "created_at": "<ISO-8601>",
  "created_by": "pseudo_operator",
  "role": "pseudo_operator",
  "milestone_id": "v3.0",
  "phase_id": "109",
  "cat7": { "focus": "...", "issue": "...", "intent": "...", "motivation": "...", "commitment": "...", "perspective": "pseudo-operator", "mood": "..." },
  "body": {
    "recommendation": "PASS|PASS_WITH_REFUTED_REVIEW|NEEDS_OPERATOR|...",
    "authority_level": 1-3,
    "confidence": 0.0-1.0,
    "real_operator_required": true|false,
    "context_pack_id": "ctx-<id>",
    "evidence_refs": ["<file:line>"],
    "carve_outs_triggered": ["..."]
  },
  "lineage": { "parents": ["<evidence_verdict-key>"], "ancestors": [] },
  "authority_level": "decision",
  "evidence_refs": [],
  "status": "emitted"
}
```

ALL TOP-LEVEL FIELDS REQUIRED. cat7 must have ALL 7 fields. lineage MUST have parents + ancestors arrays.

## Verification

```bash
node super-gsd/tools/mesh-memory/escalation-gate.cjs --help
node super-gsd/tools/mesh-memory/pseudo-operator-peer.cjs --help
node super-gsd/tools/mesh-memory/run-self-test.cjs
```

The last must report `N/N passed` with N ≥ 60, exit 0.

## Out of scope

- Codex Pro Mode lanes (P110-111)
- Context Authority capsule (P112)
- LLM-judge implementation depth (Tier 2 hook only; rule-based Tier 1 fallback acceptable for MVP)
- Modifying P106 schema, P107 CLIs, or P108 tools (frozen)

## Report

```
PATCH_BEGIN
<unified diff>
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
  super-gsd/tools/mesh-memory/escalation-gate.cjs (created)
  super-gsd/tools/mesh-memory/pseudo-operator-peer.cjs (created)
  super-gsd/tools/mesh-memory/run-self-test.cjs (modified — extended)
VERIFICATION:
  - escalation-gate exposes checkCarveOuts pure function
  - pseudo-operator-peer emits schema-conformant decision_recommendation CMBs
  - Fixture D (production_mutation overrides high confidence) holds
DEVIATIONS: <none or list>
BLOCKERS: <none>
ONE_LINER: P109 DLB-08.6+.7 shipped — pseudo_operator + escalation_gate; Fixture D restraint proof green.
REPORT_END
```
