---
phase: 102
phase_name: Harness Evolution Runner
milestone: v2.9
created: 2026-04-30
status: queued
source: AHE outer loop
---

# Phase 102 - Context

Build the safe AHE outer loop for SGSD.

This is the first phase where the pieces become an actual loop. It must be conservative: start with dry-run and proposal mode, then allow bounded edits only through existing controlled-action/double-agent surfaces.

## Goal

Implement a runner that can execute:

```text
evaluate -> distill -> propose manifest -> route bounded edit -> test -> commit candidate
```

## Required Outputs

- `super-gsd/tools/harness-evolution/run.cjs`
- `super-gsd/tools/harness-evolution/run-self-test.cjs`
- `super-gsd/tools/harness-evolution/README.md`
- `.planning/harness-evolution/runs/{run_id}/`

## Runner Modes

- `--dry-run`: no edits, only evidence and proposal.
- `--proposal-only`: writes manifest proposal, no code changes.
- `--apply-candidate`: applies bounded candidate edit through approved path.
- `--attribute-only`: runs Phase 101 attribution on existing runs.

## Acceptance

1. Dry-run works against deterministic benchmark output.
2. Proposal-only writes a valid manifest without touching harness code.
3. Apply-candidate refuses protected surfaces.
4. Runner uses fixed model/budget metadata for attribution.
5. Self-test covers all modes without calling an LLM.
