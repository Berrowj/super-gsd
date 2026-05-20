# SDD Implementer Task — P106-01 executor (schema + 17 fixtures)

You are a fresh SDD implementer. No inherited context. Read only what this prompt names.

## What you are doing

Implementing the PLAN at `.planning/milestones/v3.0/phases/106-mesh-cmb-schema/106-01-cmb-schema-PLAN.md`. Three serial tasks (t1, t2, t3) creating 18 files total: one JSON Schema + 17 JSON fixtures.

This is the **contract phase** of DLB-08 Mesh Memory Lite — the substrate for v3.0 SGSD-PRO's mesh memory layer. Get the contract right; downstream tools in P107+ consume it.

## Read these files

1. `.planning/milestones/v3.0/phases/106-mesh-cmb-schema/106-01-cmb-schema-PLAN.md` — your task contract (3 tasks)
2. `.planning/milestones/v3.0/phases/106-mesh-cmb-schema/106-CONTEXT.md` — full schema specification + 12 binding rules + 7 CMB type shapes
3. `.planning/decisions/DLB-08-MESH-MEMORY-LITE.md` — design lock; observation/claim/decision separation invariant
4. `super-gsd/templates/plan-schema-v2.json` — reference for JSON Schema authoring style (ajv-errors errorMessage pattern, draft-07, etc.)

## Task t1 — Author `super-gsd/schemas/cmb.schema.json`

Single JSON file. Must:

1. Be valid draft-07 JSON Schema (`"$schema": "http://json-schema.org/draft-07/schema#"`).
2. Top-level `type: object`.
3. Define the seven CMB types via a `oneOf` discriminated by the `type` field:
   - `execution_receipt` — observation; `created_by` must match `^(sgsd|sgsd-wrapper)$`; body requires `commit_before`, `commit_after`, `changed_files` (array), `tests_run` (array of `{command, result, count}`), `report_path`, `report_hash`, `acceptance_criteria_touched` (array)
   - `review_finding` — claim; `created_by` may be any reviewer-class role; body requires `severity` (enum: CRIT|WARN|INFO), `claim`, `current_commit`; optional `file_path`, `line_start`, `line_end`, `quoted_excerpt`, `violated_invariant`, `reproducer_command`, `confidence`
   - `evidence_verdict` — claim-with-authority; `created_by` must be `evidence_validator`; `lineage.parents` must have minItems: 1; body requires `evidence_status` (enum: VERIFIED_CRIT|REFUTED_CRIT|STALE_CRIT|UNVERIFIED_CRIT|GUARDED_CRIT), `tier_used` (enum: 0|1), `decision_basis`; optional `refuting_evidence`, `tests_refuting`
   - `decision_recommendation` — decision; `created_by` must be `pseudo_operator`; body requires `recommendation`, `authority_level` (integer 1-3), `confidence` (number 0-1), `real_operator_required` (boolean), `context_pack_id`, `evidence_refs`, `carve_outs_triggered`
   - `operator_precedent` — highest-authority decision; `created_by` must be `operator`; `authority_level: "decision_highest"`
   - `context_anchor` — projection; `created_by` must be `context_authority`; body requires `canonical_source_path`, `canonical_source_hash`, `projection_summary`
   - `promotion_decision` — terminal decision; `created_by` must be `sgsd`; body requires `verdict` (enum: PASS|PASS_WITH_REFUTED_REVIEW|PASS_WITH_WARNINGS|FAIL_VERIFIED|NEEDS_OPERATOR|STALE_REVIEW), `phase`

4. Common required fields on every CMB:
   - `key` (string; sha256 hex)
   - `type` (enum of the seven above)
   - `created_at` (ISO 8601 string)
   - `created_by` (string)
   - `role` (enum: sgsd|reviewer|evidence_validator|pseudo_operator|operator|context_authority)
   - `milestone_id` (string)
   - `phase_id` (string or null)
   - `cat7` (object with all seven fields: focus, issue, intent, motivation, commitment, perspective, mood — each a string; mood may also have valence and arousal as optional numbers in [-1, 1])
   - `body` (object; per-type shape)
   - `lineage` (object with parents array, ancestors array of strings, ancestors maxItems: 50)
   - `authority_level` (enum: observation|claim|claim_with_authority|decision|decision_highest|projection)
   - `evidence_refs` (array of strings)
   - `status` (enum: emitted|admitted|remixed|superseded|stale)

5. Use ajv-errors `errorMessage` blocks for the most important constraints:
   - Plan-level (or root-level) errorMessage when `type` is missing → `"CMB must declare 'type' (SCHEMA-MML-01)"`
   - Per-type errorMessage when `created_by` violates the type-class boundary (e.g. agent-authored execution_receipt) → `"execution_receipt may only be emitted by SGSD/system roles (SCHEMA-MML-02)"`
   - errorMessage when CAT7 is incomplete → `"CMB must declare all seven CAT7 fields (SCHEMA-MML-03)"`

## Task t2 — Seven good fixtures

Under `super-gsd/tools/mesh-memory/fixtures/`. Each fixture must:

- Parse as valid JSON
- Validate against `cmb.schema.json` from t1
- Be a minimal valid example of its type (don't pack in unnecessary fields)
- Use realistic-looking but synthetic data (commit shas, file paths, etc.)
- Have the correct `type`, `created_by`, `role`, `authority_level` for its class

Files (one per CMB type):
- `good-execution-receipt.json` — `created_by: "sgsd-wrapper"`, role: `sgsd`
- `good-review-finding.json` — `created_by: "atc-v4"`, role: `reviewer`
- `good-evidence-verdict.json` — `created_by: "evidence_validator"`, role: `evidence_validator`, `lineage.parents: ["cmb_review_finding_001"]` (referencing a fictional review_finding key)
- `good-decision-recommendation.json` — `created_by: "pseudo_operator"`, role: `pseudo_operator`, `body.recommendation`, `body.authority_level: 3`, `body.confidence: 0.93`
- `good-operator-precedent.json` — `created_by: "operator"`, role: `operator`, `authority_level: "decision_highest"`
- `good-context-anchor.json` — `created_by: "context_authority"`, role: `context_authority`, `body.canonical_source_path: ".planning/milestones/v3.0/context/MILESTONE-CONTEXT.yaml"` (fictional path; real file lands in P112), `body.canonical_source_hash: "sha256-stub"`, `body.projection_summary`
- `good-promotion-decision.json` — `created_by: "sgsd"`, role: `sgsd`, `body.verdict: "PASS_WITH_REFUTED_REVIEW"`, `body.phase: "106"`

## Task t3 — Six bad fixtures + three hash variants

Each bad fixture must demonstrate a SPECIFIC rejection. The schema must reject each one.

- `bad-claim-as-observation.json` — a `review_finding` with `created_by: "sgsd"` (rejecting claim-as-observation)
- `bad-context-anchor-without-source.json` — a `context_anchor` missing `body.canonical_source_path` or `canonical_source_hash`
- `bad-execution-receipt-created-by-agent.json` — an `execution_receipt` with `created_by: "codex"` (executor-authored receipt — rejected)
- `bad-cmb-missing-cat7.json` — a CMB with `cat7` containing only 3 of the 7 fields (incomplete envelope)
- `bad-cmb-created-at-affects-hash.json` — see hash-a* files below; this is the existence proof that created_at is excluded from hash. Make this file structurally identical to `hash-a.json` except `created_at` differs. (Both should validate against the schema; the proof is hash equality, run by cmb-hash.cjs in P107.)
- `bad-review-finding-without-lineage.json` — a `review_finding` claiming `authority_level: "claim_with_authority"` (which would imply validation) without an `evidence_verdict` lineage parent

Hash variants for SAC-P106-03 + -04 (these are NOT "bad" — they're valid CMBs used for hash comparison):
- `hash-a.json` — baseline valid CMB (use `good-execution-receipt.json` shape; can copy and rename)
- `hash-a-created-at-changed.json` — identical to hash-a.json except `created_at` field differs
- `hash-a-body-changed.json` — identical to hash-a.json except one body field differs

## Verification you must run

```bash
node -e "JSON.parse(require('fs').readFileSync('super-gsd/schemas/cmb.schema.json'))"
node -e "for (const f of ['good-execution-receipt','good-review-finding','good-evidence-verdict','good-decision-recommendation','good-operator-precedent','good-context-anchor','good-promotion-decision']) JSON.parse(require('fs').readFileSync('super-gsd/tools/mesh-memory/fixtures/'+f+'.json'))"
node -e "for (const f of ['bad-claim-as-observation','bad-context-anchor-without-source','bad-execution-receipt-created-by-agent','bad-cmb-missing-cat7','bad-cmb-created-at-affects-hash','bad-review-finding-without-lineage','hash-a','hash-a-created-at-changed','hash-a-body-changed']) JSON.parse(require('fs').readFileSync('super-gsd/tools/mesh-memory/fixtures/'+f+'.json'))"
```

All three must exit 0.

## Out of scope (do not touch)

- `super-gsd/tools/mesh-memory/cmb-validate.cjs` — P107 work
- `super-gsd/tools/mesh-memory/cmb-hash.cjs` — P107 work
- Any executor/reviewer/validator/pseudo-operator code
- `.codex/hooks.json`
- `super-gsd/skills/sgsd-audit/SKILL.md`
- `.planning/mesh/memory/` runtime CMB stores
- Any context_anchor source YAML (P112)

## Report format

```
PATCH_BEGIN
<unified diff creating cmb.schema.json + 17 fixture files>
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
  super-gsd/schemas/cmb.schema.json (created)
  super-gsd/tools/mesh-memory/fixtures/good-*.json × 7 (created)
  super-gsd/tools/mesh-memory/fixtures/bad-*.json × 6 (created)
  super-gsd/tools/mesh-memory/fixtures/hash-*.json × 3 (created)
VERIFICATION:
  schema parses as JSON → OK
  7 good fixtures parse as JSON → OK
  9 bad+hash fixtures parse as JSON → OK
DEVIATIONS: <none or list>
BLOCKERS: <none or describe>
ONE_LINER: P106 contract shipped — schema + 17 fixtures; ready for P107 cmb-validate/cmb-hash implementation.
REPORT_END
```

Be terse. No prose beyond the report.
