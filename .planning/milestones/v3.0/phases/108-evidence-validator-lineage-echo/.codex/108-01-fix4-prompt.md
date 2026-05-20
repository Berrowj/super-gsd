# SDD Implementer — P108 fix4: evidence-validator CMB-builder schema conformance

You are a fresh SDD implementer.

## The bug

`super-gsd/tools/mesh-memory/evidence-validator.cjs --self-test-verified` exits 1. The emitted `evidence_verdict` CMB is missing many fields required by `super-gsd/schemas/cmb.schema.json`:

- `milestone_id` (required at top level)
- `phase_id` (required at top level)
- `cat7` (required at top level; all 7 fields)
- `evidence_refs` (required at top level)
- `lineage.ancestors` (required inside lineage)
- `status` must be one of: `emitted | admitted | remixed | superseded | stale`
- Body fields for `evidence_verdict`: must include `evidence_status`, `tier_used`, `decision_basis` AND only those (additionalProperties: false on body)

self-test currently fails with: 37/38 passed.

## The fix

In `super-gsd/tools/mesh-memory/evidence-validator.cjs`, locate the CMB-builder code path (likely a function building the evidence_verdict object). Ensure the emitted CMB has the FULL shape required by the schema:

```json
{
  "key": "<computed sha256 or cmb-* identifier>",
  "type": "evidence_verdict",
  "created_at": "<ISO-8601 string>",
  "created_by": "evidence_validator",
  "role": "evidence_validator",
  "milestone_id": "v3.0",
  "phase_id": "108",
  "cat7": {
    "focus": "<short>",
    "issue": "<short>",
    "intent": "<short>",
    "motivation": "<short>",
    "commitment": "<short>",
    "perspective": "evidence-validator",
    "mood": "calm"
  },
  "body": {
    "evidence_status": "VERIFIED_CRIT|REFUTED_CRIT|STALE_CRIT|UNVERIFIED_CRIT|GUARDED_CRIT",
    "tier_used": 0,
    "decision_basis": "<short rationale>"
  },
  "lineage": {
    "parents": ["<review_finding key>"],
    "ancestors": []
  },
  "authority_level": "claim_with_authority",
  "evidence_refs": [],
  "status": "emitted"
}
```

Required:
- `lineage.parents` must contain at least one entry (the source review_finding's key)
- `lineage.ancestors` must be an array (may be empty `[]`)
- `cat7` must have all 7 fields populated with non-empty strings
- `body` must contain ONLY the three required fields for evidence_verdict (additionalProperties: false). Specifically do NOT include refuting_evidence/tests_refuting fields in the BODY if they're causing additionalProperties violations — those may need to move elsewhere or the schema needs updating. For this fix, simplest: ensure body has exactly `{ evidence_status, tier_used, decision_basis }` (drop `refuting_evidence`/`tests_refuting` from body for now; can be added later if schema allows).
- `status` defaults to `emitted`
- `authority_level` is exactly `claim_with_authority`

Apply the same fix shape to `echo-detector.cjs` if it emits CMBs (e.g., the augmented "echo detected" persisted row) — and to the other writers if their --self-test paths exhibit similar issues.

## Verification

After patch:
```bash
node super-gsd/tools/mesh-memory/run-self-test.cjs
```
should report `38/38 passed` (or higher) and exit 0.

## Files in read-pack

- `super-gsd/tools/mesh-memory/evidence-validator.cjs`
- `super-gsd/tools/mesh-memory/echo-detector.cjs`
- `super-gsd/schemas/cmb.schema.json`
- `super-gsd/tools/mesh-memory/fixtures/good-evidence-verdict.json` (reference)
- `super-gsd/tools/mesh-memory/run-self-test.cjs`

## Report

```
PATCH_BEGIN
<unified diff>
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
  super-gsd/tools/mesh-memory/evidence-validator.cjs (modified)
  super-gsd/tools/mesh-memory/echo-detector.cjs (modified if needed)
VERIFICATION: emitted CMBs now include all required top-level fields; body shape conforms
DEVIATIONS: <none or list>
BLOCKERS: <none>
ONE_LINER: evidence-validator (and echo-detector) emit schema-conformant CMBs with full CAT7, milestone_id, phase_id, evidence_refs, lineage.ancestors.
REPORT_END
```
