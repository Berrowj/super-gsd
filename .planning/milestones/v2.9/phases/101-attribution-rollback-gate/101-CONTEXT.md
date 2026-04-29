---
phase: 101
phase_name: Attribution And Rollback Gate
milestone: v2.9
created: 2026-04-30
status: queued
source: AHE next-round attribution
---

# Phase 101 - Context

Build the evaluation verdict step.

AHE attributes each prior manifest against the next run. SGSD needs the same: compare predicted fixes/regressions to observed benchmark or live-run deltas, then decide whether the edit is kept, reverted, quarantined, or needs a component-layer pivot.

## Goal

Create a scorer that reads:

- prior harness change manifest
- previous run evidence
- next run evidence
- component registry

and writes:

- per-change verdict
- fix precision/recall
- regression precision/recall
- keep/revert/pivot recommendation

## Required Outputs

- `super-gsd/tools/harness-attribution/attribute.cjs`
- `super-gsd/tools/harness-attribution/run-self-test.cjs`
- `.planning/metrics/harness-attribution.jsonl`

## Verdicts

Closed vocabulary:

- keep
- revert
- quarantine
- pivot_component
- inconclusive
- environmental_skip

## Acceptance

1. Attribute predicted fixes separately from predicted regressions.
2. Regression misses are visible and cannot be hidden by fix success.
3. Revert recommendation includes exact commit/change IDs, not prose only.
4. Self-test covers true positive fix, missed fix, true regression, missed regression, and inconclusive environment.
