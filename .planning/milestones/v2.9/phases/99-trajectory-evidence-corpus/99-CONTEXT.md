---
phase: 99
phase_name: Trajectory Evidence Corpus
milestone: v2.9
created: 2026-04-30
status: queued
source: AHE experience observability
---

# Phase 99 - Context

Build the experience observability layer for SGSD.

SGSD already emits logs, reports, reviews, pulses, context packets, token rows, and benchmark results. The problem is that they are scattered. AHE says the optimizer should not read millions of raw tokens. It should read a layered corpus with drill-down pointers.

## Goal

Create a trajectory distiller that converts one SGSD run or benchmark run into:

- run overview
- per-task/per-scenario reports
- root-cause labels
- evidence links
- raw trace pointers
- success patterns
- failure patterns
- token and gate cost summary

## Required Outputs

- `super-gsd/tools/harness-evidence/distill.cjs`
- `super-gsd/tools/harness-evidence/run-self-test.cjs`
- `.planning/harness-evolution/runs/{run_id}/OVERVIEW.md`
- `.planning/harness-evolution/runs/{run_id}/tasks/*.md`
- `.planning/harness-evolution/runs/{run_id}/INDEX.json`

## Evidence Sources

- `.planning/metrics/activity-log.jsonl`
- `.planning/metrics/orchestrator-pulse.jsonl`
- `.planning/metrics/context-packet-log.jsonl`
- `.planning/metrics/route-decisions.jsonl`
- `.planning/metrics/token-attribution.jsonl`
- `.planning/metrics/failure-injection-log.jsonl`
- `.planning/metrics/controlled-actions-log.jsonl`
- `.planning/benchmarks/*/RUN.json`
- `.planning/benchmarks/*/REPORT.md`

## Acceptance

1. Distiller can run against `.planning/benchmarks/ahe-paper-smoke`.
2. Output overview is under 4KB by default.
3. Per-task reports link to raw evidence instead of copying large logs.
4. Root-cause labels use a closed vocabulary.
5. Self-test covers malformed JSONL, missing logs, empty benchmark, and successful run.
