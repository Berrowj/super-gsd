---
phase: 100
phase_name: Change Manifest Prediction Ledger
milestone: v2.9
created: 2026-04-30
status: queued
source: AHE decision observability
---

# Phase 100 - Context

Build the decision observability layer for SGSD.

AHE's most important operational rule is that every harness edit must become a falsifiable prediction. SGSD currently records commits, reviews, and phase artifacts, but it does not require a harness edit to predict which future failures it will fix and which regressions it might cause.

## Goal

Create a manifest schema and append-only ledger for candidate harness edits.

## Required Outputs

- `super-gsd/tools/harness-manifest/MANIFEST.schema.json`
- `super-gsd/tools/harness-manifest/manifest.cjs`
- `super-gsd/tools/harness-manifest/run-self-test.cjs`
- `.planning/metrics/harness-change-manifest.jsonl`

## Manifest Entry

Each entry must include:

- `change_id`
- `component_id`
- `component_class`
- `files`
- `evidence_ids`
- `root_cause`
- `targeted_fix`
- `predicted_fixes`
- `predicted_regressions`
- `expected_token_delta`
- `expected_gate_delta`
- `rollback_method`
- `protected_surface_check`

## Acceptance

1. Schema rejects missing predictions.
2. Schema rejects protected-surface edits unless `operator_override_id` exists.
3. Manifest writer appends JSONL atomically enough for local SGSD use.
4. Double-agent task capsules can reference a `change_id`.
5. Self-test passes 15+ assertions.
