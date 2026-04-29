---
phase: 98
artifact: research
authored_by: orchestrator (Opus)
---

# Phase 98 -- Research

## Sources
- VTP-AHE-EVIDENCE.md (this milestone) -- 9 principles AHE-P-01..10
- REQUIREMENTS.md AHE-COMP-01..04 (component observability rules)
- VTP paper: agentic-harness-engineering-observability-driven-automatic-evolution-of-coding-a
- Existing SGSD surface inventory (50+ components across tools/, scripts/, docs/, .agents/, .warp/)
- Phase 89 4-tier permission contract (protected surfaces parallel)

## Key decisions

### D1 -- Registry schema (frozen)
Each row carries: `id`, `class`, `paths`, `owner`, `edit_policy`, `test_commands`,
`rollback_method`, `protected`. Closed-vocab class field with 14 members
(prompt, tool, middleware_hook, skill, agent_config, memory, workflow,
mcp_bridge, gate, dashboard, docs, protected_oracle, protected_verifier,
protected_model_config). Frozen array in catalog.cjs prevents drift.

### D2 -- ≥25-row inventory target
SGSD already has the components. Inventory work is cataloging, not designing.
Target distribution:
- prompts: 5+ (skill prompts, agent system prompts)
- tools: 8+ (warp-doctor, warp-mcp, cockpit-state, state-resolver, double-agent-executor, harness-benchmark, failure-injection, context-packet)
- middleware_hook: 1+ (orchestrator-hooks.cjs)
- skill: 7 (.agents/skills + sgsd-orchestrate, sgsd-pause)
- mcp_bridge: 2 (warp-mcp, warp-mcp-actions)
- workflow: 15 (.warp/workflows)
- gate: 3+ (sgsd-complete-milestone, plan-schema validate, deliberate gate)
- dashboard: 2+ (cockpit, mission-control)
- docs: 2+ (CLAUDE.md, AGENTS.md, WARP.md)
- protected_oracle: 1 (hidden benchmark decks)
- protected_verifier: 1 (gsd-verifier agent contract)
- protected_model_config: 1 (model routing rules in CLAUDE.md / config.json)

### D3 -- Lock-13 catalog API (degraded envelope, never throws)
Public API: `loadRegistry(path?) -> { ok, rows, errors }`. On parse failure,
return `{ ok: false, rows: [], errors: [...] }`. Never throw. Never propagate
exceptions across boundary. Self-test asserts bad input does not throw.

### D4 -- Validator rules
- Unknown class -> error
- `protected: true` rows must use class with `protected_` prefix
- `paths[]` entries: relative paths only (reject absolute), ASCII-only,
  no `..` traversal
- Empty arrays for paths/test_commands -> error
- Duplicate `id` -> error

### D5 -- Self-test ≥15 assertions
- A1: 25+ rows present
- A2-A14: one per class member rejecting unknown variants and accepting valid
- A15: bad-input no-throw (Lock-13)
- A16: protected rows correctly classed
- A17: ASCII-only source
- A18: registry yaml parseable
- A19: catalog public API returns 4 expected keys

### D6 -- Component IDs use kebab-case
`warp-doctor`, `state-resolver`, `cockpit-state`, etc. ID stability is the
contract; paths can move but IDs cannot.

### D7 -- Stop rule (from PLAN.md)
"Do not move to Phase 99 until the registry can be read by a script without
loading full SGSD docs into context." Mechanical: Phase 99 distillation tool
will `require()` catalog.cjs and consume rows directly, not via doc parsing.

## Risks

- R1: Registry rot if components move and rows aren't updated. Mitigation:
  Phase 105 release-gate adds existence-check pass over all `paths[]`.
- R2: Over-claiming protection. Mitigation: D4 validator rejects mismatch
  between `protected: true` and non-protected class.
