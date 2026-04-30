---
phase: 102
artifact: research
authored_by: orchestrator (Opus)
---

# Phase 102 -- Research

## Sources
- AHE paper: outer loop = evaluate -> distill -> propose -> route bounded edit -> test -> commit candidate
- Phase 98 catalog.cjs (component registry + protected check)
- Phase 99 distill.cjs (evidence corpus reader)
- Phase 100 manifest.cjs (manifest writer; harness_change_id capsule field)
- Phase 101 attribute.cjs (verdict scorer)
- Existing super-gsd/tools/double-agent-executor/run.cjs (task capsule + route)

## Key decisions

### D1 -- 4 modes, all deterministic + no LLM in self-test
- `--dry-run`: read evidence, print next candidate proposal, no writes.
- `--proposal-only`: write a manifest entry (Phase 100), no code change.
- `--apply-candidate <spec>`: spawn double-agent-executor with a bounded
  capsule referencing harness_change_id; protected-surface guard.
- `--attribute-only <change_id>`: run Phase 101 attribute scorer.

### D2 -- Candidate spec input file (no LLM)
The runner accepts `--candidate-spec <path-to-json>` describing the
proposed edit. This makes the loop testable without invoking an LLM:
self-test feeds synthetic specs.

```json
{
  "change_id": "ch-test-001",
  "component_id": "warp-doctor",
  "files": ["super-gsd/tools/warp-doctor/check.cjs"],
  "evidence_ids": ["run-2026-04-30"],
  "root_cause": "gate_false_negative",
  "targeted_fix": "add probe X",
  "predicted_fixes": ["gate_false_negative"],
  "predicted_regressions": [],
  "expected_token_delta": 0,
  "expected_gate_delta": 0
}
```

### D3 -- Protected-surface guard
Apply-candidate first checks catalog.cjs `findById(component_id)`:
- If row.protected === true AND no `operator_override_id` -> refuse.
- If row.class is in PROTECTED_CLASSES AND no override -> refuse.
- This duplicates manifest schema validation but the runtime check is
  separate so a manually-submitted spec cannot bypass via missing
  `protected_surface_check` field.

### D4 -- Lock-13 envelope on every public function
`runDryRun(opts) -> { ok, proposal_summary, errors }`
`runProposalOnly(opts) -> { ok, change_id, errors }`
`runApplyCandidate(opts) -> { ok, change_id, route_decision, errors }`
`runAttributeOnly(opts) -> { ok, verdict, errors }`

### D5 -- Append run events to .planning/metrics/harness-evolution-log.jsonl
Every mode writes one event row with `ts`, `mode`, `change_id`, `outcome`.
Sourced from manifest's existing JSONL pattern.

### D6 -- Self-test ≥15 assertions, no LLM
- Lock-13 no-throw on bad input
- Each mode runs without spawning external agents
- Protected-surface guard rejects oracle/verifier/model-config classes
- Dry-run is read-only (no writes verified by mtime)
- Proposal-only writes one manifest row
- Apply-candidate without provider returns degraded envelope
- Apply-candidate with mocked executor records execution_route row
- Attribute-only uses Phase 101 module
- ASCII-only source
- Public API stable

### D7 -- Hard boundary
Per CONTEXT: runner must NOT call hidden benchmark oracles from
model-visible prompts. We enforce this by:
- Runner never reads .planning/benchmarks/hidden/* (catalog row marks it
  protected_oracle).
- Runner never adds those paths to capsule.allowed_files.

## Risks
- R1: spec injection. Untrusted JSON spec could carry hostile fields.
  Mitigation: runner validates against manifest schema before write.
- R2: apply-candidate without consent. Mitigation: by default
  apply-candidate emits a route-only ledger row + dry-write a patch path,
  no `--apply` flag pass-through unless `--commit` flag set.
