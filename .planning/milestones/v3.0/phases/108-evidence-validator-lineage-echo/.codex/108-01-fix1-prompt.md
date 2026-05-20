# SDD Implementer — P108 fix1: seed-ledger.jsonl schema conformance

You are a fresh SDD implementer.

## The bug

`super-gsd/tools/mesh-memory/fixtures/seed-ledger.jsonl` rows do NOT validate against `super-gsd/schemas/cmb.schema.json`. Specific failures observed on row 1:
- `created_by: "p108_seed"` (for type `execution_receipt`; schema requires `^(sgsd|sgsd-wrapper)$`)
- `role: "executor"` (not in role enum: must be one of `sgsd|reviewer|evidence_validator|pseudo_operator|operator|context_authority`)
- `authority_level: "claim_with_authority"` (must be `observation` for execution_receipt)
- Missing `cat7` envelope entirely (SCHEMA-MML-03)
- Missing required body fields for execution_receipt: `commit_before`, `commit_after`, `changed_files`, `tests_run`, `report_path`, `report_hash`, `acceptance_criteria_touched`

`run-self-test.cjs` exits 1 with `16/17 passed` (early exit on first seed CMB validation failure).

## The fix

Regenerate the entire `super-gsd/tools/mesh-memory/fixtures/seed-ledger.jsonl` so each row validates against `cmb.schema.json`. **Keep the same 10 CMB keys** (cmb-...000001 through cmb-...000010) and **keep the same lineage topology** so the existing assertions in `run-self-test.cjs` (lines 81-100, deepLeaf/root/revA/revB/verdict/decision/promotion) still pass.

### Required lineage topology (DO NOT CHANGE — run-self-test depends on these)

- `cmb-...000001` — root execution_receipt (no parents)
- `cmb-...000002` — first review_finding, lineage.parents = [`cmb-...000001`]
- `cmb-...000009` — second review_finding, lineage.parents = [`cmb-...000001`] (sibling of 002)
- `cmb-...000003` — evidence_verdict, lineage.parents = [`cmb-...000002`]
- `cmb-...000004` — decision_recommendation, lineage.parents = [`cmb-...000003`]
- `cmb-...000005` — promotion_decision, lineage.parents = [`cmb-...000004`]
- `cmb-...000006` — context_anchor (sibling chain; lineage.parents = [`cmb-...000001`])
- `cmb-...000007` — intermediate CMB (e.g., another evidence_verdict), lineage.parents = [`cmb-...000003`]
- `cmb-...000008` — deep leaf CMB. lineage.parents = [`cmb-...000007`]. This is the deepLeaf in the runner; ancestor chain must yield 7 entries ending at root.
- `cmb-...000010` — operator_precedent or extra CMB; any valid parent chain.

The `run-self-test.cjs` (line 92) asserts `deepAncestors.length === 7` for the deep leaf. The chain `008 → 007 → 003 → 002 → 001` is only 5 deep. To get 7 ancestors, either:
- Insert intermediate CMBs between 003 and 008 (e.g., make 003 → 007 indirect via 004 or another), OR
- Have 008 link through 007 → 005 → 004 → 003 → 002 → 001 (7 hops)

Choose whatever topology gives exactly 7 ancestors to cmb-...000008 while preserving the other expected links (e.g., siblings(revA) includes revB; descendants(root) includes deepLeaf).

### Per-CMB shape requirements (against cmb.schema.json)

Every row must have ALL of:
- `key` (sha256-hex-shaped string; the existing cmb-...0000NN keys are fine — they're treated as opaque identifiers)
- `type` (one of the 7 enum values)
- `created_at` (ISO-8601 string)
- `created_by` — **must match the type's allowed roles**:
  - `execution_receipt` → `sgsd` or `sgsd-wrapper`
  - `review_finding` → any reviewer-class string (e.g. `atc-v4`, `codex-reviewer`)
  - `evidence_verdict` → `evidence_validator`
  - `decision_recommendation` → `pseudo_operator`
  - `operator_precedent` → `operator`
  - `context_anchor` → `context_authority`
  - `promotion_decision` → `sgsd`
- `role` (one of: `sgsd|reviewer|evidence_validator|pseudo_operator|operator|context_authority`)
- `milestone_id` (e.g., `"v3.0"`)
- `phase_id` (e.g., `"108"` or `null`)
- `cat7` — ALL 7 fields populated (`focus`, `issue`, `intent`, `motivation`, `commitment`, `perspective`, `mood`). Values are short strings; `mood` may include `valence`/`arousal` floats.
- `body` — type-specific required fields per the schema's `oneOf` branches:
  - execution_receipt: `commit_before`, `commit_after`, `changed_files[]`, `tests_run[]`, `report_path`, `report_hash`, `acceptance_criteria_touched[]`
  - review_finding: `severity` (CRIT|WARN|INFO), `claim`, `current_commit`
  - evidence_verdict: `evidence_status` (one of VERIFIED_CRIT|REFUTED_CRIT|STALE_CRIT|UNVERIFIED_CRIT|GUARDED_CRIT), `tier_used` (0 or 1), `decision_basis`
  - decision_recommendation: `recommendation`, `authority_level` (integer 1-3), `confidence` (0-1), `real_operator_required` (bool), `context_pack_id`, `evidence_refs[]`, `carve_outs_triggered[]`
  - operator_precedent: any reasonable body
  - context_anchor: `canonical_source_path`, `canonical_source_hash`, `projection_summary`
  - promotion_decision: `verdict`, `phase`
- `lineage.parents` (array of CMB keys, per the topology above)
- `lineage.ancestors` (transitive closure of parents up to depth 50; may be empty array if you compute lazily)
- `authority_level` — match the class:
  - observation: execution_receipt
  - claim: review_finding
  - claim_with_authority: evidence_verdict
  - decision: decision_recommendation, promotion_decision
  - decision_highest: operator_precedent
  - projection: context_anchor
- `evidence_refs` (array; may be empty)
- `status` (one of: emitted|admitted|remixed|superseded|stale)

Use realistic synthetic values. Keep the file under 200 lines total (the 10 CMBs each on one line — JSONL).

## Verification

After patch, `node super-gsd/tools/mesh-memory/run-self-test.cjs` should report `30+/30+ passed` and exit 0.

## Files in read-pack

- `super-gsd/schemas/cmb.schema.json` — the schema each row must conform to
- `super-gsd/tools/mesh-memory/fixtures/seed-ledger.jsonl` — current broken file
- `super-gsd/tools/mesh-memory/fixtures/good-execution-receipt.json` — exemplar shape
- `super-gsd/tools/mesh-memory/fixtures/good-review-finding.json` — exemplar shape
- `super-gsd/tools/mesh-memory/fixtures/good-evidence-verdict.json` — exemplar shape
- `super-gsd/tools/mesh-memory/run-self-test.cjs` — the assertions that must still pass

## Report format

```
PATCH_BEGIN
<unified diff rewriting seed-ledger.jsonl>
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
  super-gsd/tools/mesh-memory/fixtures/seed-ledger.jsonl (modified)
VERIFICATION:
  10 CMB rows; each conforms to cmb.schema.json; lineage topology preserves run-self-test assertions
DEVIATIONS: <none or list>
BLOCKERS: <none>
ONE_LINER: Regenerate seed-ledger with schema-valid CMBs while preserving lineage topology.
REPORT_END
```
