---
phase: 98
phase_name: Harness Component Substrate
milestone: v2.9
created: 2026-04-30
status: queued
source: AHE component observability
---

# Phase 98 - Context

Build the component observability layer for SGSD.

The AHE paper says self-improvement becomes stable only when the editable action space is explicit and reversible. For SGSD, that means creating a registry of every harness component that Claude, Codex, Warp, MCP, or SGSD itself may change.

## Goal

Create a read-only harness component registry and validator.

The registry must answer:

- What component exists?
- What class is it?
- What files own it?
- Who/what may edit it?
- What tests prove it still works?
- How is it rolled back?
- Is it protected from harness evolution?

## Component Classes

Use this closed vocabulary:

- prompt
- tool
- middleware_hook
- skill
- agent_config
- memory
- workflow
- mcp_bridge
- gate
- dashboard
- docs
- protected_oracle
- protected_verifier
- protected_model_config

## Required Outputs

- `super-gsd/registry/harness-components.yaml`
- `super-gsd/tools/harness-components/catalog.cjs`
- `super-gsd/tools/harness-components/run-self-test.cjs`
- docs section explaining component classes and protected surfaces

## Acceptance

1. Registry includes at least 25 current SGSD harness components.
2. Each row has `id`, `class`, `paths`, `owner`, `edit_policy`, `test_commands`, `rollback_method`, and `protected`.
3. Validator rejects unknown component classes and unsafe absolute paths.
4. Protected rows exist for hidden benchmark decks, scoring oracle, verifier code, model config, and token budget.
5. Self-test passes 15+ assertions.
6. No behavior changes to active orchestrator.
