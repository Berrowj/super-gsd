---
schema_version: 2
phase: 25
plan: 25-02
plan_name: Edge-guard wiring (INSTR-01)
milestone: v1.5
status: shipped
expected_ATC_tier: LITE
model: sonnet
depends_on: []
created: 2026-04-25
files_touched:
  - super-gsd/skills/sgsd-orchestrate/SKILL.md
tasks:
  - id: T-25-02-1
    hypothesis: |
      Adding `const edgeGuard = require('super-gsd/scripts/lib/edge-guard.cjs')`
      to the cold-start preamble + a spec instruction "call edgeGuard.recordTransition
      after every gates.shouldFire decision" wires the scaffolded edge-guard
      module into the orchestrator dispatch path. (INSTR-01)
    files_touched:
      - super-gsd/skills/sgsd-orchestrate/SKILL.md
    action: |
      1. After the `gates.loadGates(...)` call in cold-start step 3.6, add
         `const edgeGuard = require('super-gsd/scripts/lib/edge-guard.cjs')`.
      2. Add a "Edge-guard call contract (INSTR-01)" block documenting the
         orchestrator's responsibility to call recordTransition on every gate
         decision, with the parameter list verbatim from edge-guard.cjs:56-67.
      3. State graceful-degradation rule: if edge-guard.cjs is absent, calls
         are no-ops (matching gates-registry.cjs degradation pattern).
      4. State halt-on-result rule: orchestrator halts only if status === 'halt'.
    verification:
      - cmd: grep -c "edgeGuard" super-gsd/skills/sgsd-orchestrate/SKILL.md
        expect: ">= 2"
      - cmd: grep -c "recordTransition" super-gsd/skills/sgsd-orchestrate/SKILL.md
        expect: ">= 1"
---

# 25-02 — Edge-guard wiring (INSTR-01)

Wires the scaffolded edge-guard module into the orchestrator spec. Single SKILL.md edit; the orchestrator (Claude) follows the spec to actually emit rows during dispatch.

## Why spec-only?

The orchestrator's loop is interpreted from SKILL.md. Adding the wire-up at the spec level means: (a) every loop iteration sees the edge-guard contract; (b) when sgsd-complete-milestone Step 4 (gate-drift audit) reads `edge-guard-log.jsonl`, real data exists; (c) orchestrator never silently skips the call.

## Out of scope

- Reading the edge-guard log (consumer is sgsd-complete-milestone Step 4 — already implemented per the skill spec).
- Per-gate trigger refinements (the contract is uniform: every gate decision, every loop iteration).
