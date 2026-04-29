---
phase: 103
phase_name: Component Ablation And Interference
milestone: v2.9
created: 2026-04-30
status: queued
source: AHE component ablations and non-additive interference
---

# Phase 103 - Context

Measure which SGSD harness components actually carry value.

The AHE paper found that memory, tools, and middleware helped individually, while prompt-only changes regressed and stacked verification could interfere. SGSD has the same risk: many helpful-looking gates can duplicate each other and burn tokens.

## Goal

Build an ablation runner that can disable or swap one harness component class at a time in a copied workspace, then compare benchmark outcomes and token cost.

## Required Outputs

- `super-gsd/tools/harness-ablation/ablate.cjs`
- `super-gsd/tools/harness-ablation/run-self-test.cjs`
- `.planning/metrics/harness-ablation.jsonl`

## First Ablation Targets

- token-waste hook
- context-packet hook
- state resolver read-side
- selected soft gates
- cockpit render/cache layer
- double-agent executor routing
- memory injection
- VTP enrichment

## Acceptance

1. Runner never mutates the main workspace.
2. Each ablation records success, failure detection, token cost, and runtime.
3. Interference report identifies duplicate verification or redundant gate stacks.
4. Self-test proves copy/workspace isolation.
