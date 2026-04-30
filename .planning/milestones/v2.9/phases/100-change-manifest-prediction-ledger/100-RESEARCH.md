---
phase: 100
artifact: research
authored_by: orchestrator (Opus)
---

# Phase 100 -- Research

## Sources
- VTP-AHE-EVIDENCE.md AHE-P-03 (turn edits into falsifiable contracts)
- AHE-P-10 (regression prediction is first-class)
- REQUIREMENTS.md AHE-DEC-01..04
- Phase 98 catalog.cjs (component_id source-of-truth)
- Phase 99 distill.cjs (evidence_ids source-of-truth)
- Existing super-gsd/tools/double-agent-executor/run.cjs (capsule schema integration)

## Key decisions

### D1 -- Manifest schema (13 required fields)
```json
{
  "schema_version": 1,
  "change_id": "ch-2026-04-30-001",       // unique, kebab-case
  "component_id": "warp-doctor",          // must exist in catalog.cjs
  "component_class": "tool",              // mirrors catalog row
  "files": ["super-gsd/tools/warp-doctor/check.cjs"],
  "evidence_ids": ["run-2026-04-30-overnight"], // run_ids from distiller
  "root_cause": "gate_false_negative",    // must be in distiller ROOT_CAUSES
  "targeted_fix": "<=120 chars why this edit fixes that root cause",
  "predicted_fixes": ["fix label 1", "fix label 2"],
  "predicted_regressions": ["risk label 1"], // empty array OK; null forbidden
  "expected_token_delta": -200,           // signed integer (delta vs baseline)
  "expected_gate_delta": 0,               // signed integer
  "rollback_method": "git-revert",        // mirrors catalog row
  "protected_surface_check": "false",     // string for explicitness
  "operator_override_id": null            // required if protected_surface_check=="true"
}
```

### D2 -- Append-only JSONL ledger
Path: `.planning/metrics/harness-change-manifest.jsonl`. One row per
manifest entry. Idempotent on `change_id` (re-append same id is rejected).

### D3 -- Atomic-enough writes for local SGSD
Use `fs.appendFileSync` with `'a'` flag (atomic on POSIX/NTFS for small
writes). NOT a distributed-systems-grade atomic; explicit "atomic enough
for local SGSD use" per acceptance line.

### D4 -- Protected-surface guard
- `component_class` in PROTECTED_CLASSES (per Phase 98 catalog) AND no
  `operator_override_id` -> rejection.
- `operator_override_id` must be a non-empty string when present (no
  empty-string bypass).

### D5 -- Cross-link with task capsule
Optional `harness_change_id` on the capsule. When present:
- normalizeCapsule preserves the field.
- route-decisions row evidence array gets a second item:
  `{ kind: 'harness_change_manifest', ref: <change_id> }`.
- No schema break: existing capsules without the field continue to work.

### D6 -- Minimum 15 self-test assertions
Coverage:
- Schema requires all 13 fields (1 fail-case per missing field family)
- Protected-class without override rejected
- Protected-class with empty-string override rejected
- Append + read round-trip
- Duplicate change_id rejected
- ASCII-only source
- Public API stable
- Lock-13 no-throw on bad input
- Cross-link via task capsule (with harness_change_id) preserved

### D7 -- Stop rule (from PLAN.md)
"No harness evolution runner may apply candidate edits until this ledger
exists." -> Phase 102 runner must require() this manifest module before
dispatching any candidate edit. Will be enforced in Phase 102.

## Risks
- R1: Manifest entries written manually drift from catalog ids. Mitigation:
  validator cross-checks `component_id` against catalog.cjs at write time.
- R2: Operator-override field abuse. Mitigation: documenting that
  protected-surface edits must be exceptional and operator-attested.
