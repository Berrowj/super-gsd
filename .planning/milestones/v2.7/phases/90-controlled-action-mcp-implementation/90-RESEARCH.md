---
phase: 90
artifact: research
authored_by: orchestrator (Opus); code by gsd-executor (Sonnet) agentIds a44a66bef9737dc6d (90-01) + ac0a265ba491770c3 (90-02)
operator_override: 2026-04-29 (CONTEXT.md retroactively expanded with D90.0 + D90.6)
---

# Phase 90 -- Research

## Two-plan structure

Phase 90 ships as 2 atomic commits:

- **dae0550** (Plan 90-01): controlled-action MCP server with 3 net-new tools.
- **55b25d8** (Plan 90-02): state-resolver + read-side integration (D90.0 + D90.6).

Operator's expanded CONTEXT.md added the resolver work as MANDATORY before Phase 90 close. Plan 90-02 closes that gap.

## Pattern source

- Phase 89 contract (controlled-action contract — substrate for 90-01)
- Phase 70 sgsd_current_state / current_phase (substrate for 90-02 wiring)
- Phase 76 cockpit-state adapter (substrate for 90-02 wiring)
- Phase 86 staleness probes (90-02 builds on; doesn't replace)

## Key decisions

### D1 — Resolver priority order

```
checkpoint > pulse > activity-log > phase folders > git > STATE.md legacy
```

Each tier has a freshness threshold + confidence score. Highest-confidence-fresh source wins. STATE.md is LAST because it's the legacy projection that this entire override exists to fix.

### D2 — `projection_stale` is the hinge

When resolver disagrees with STATE.md, `projection_stale: true` + `stale_sources: ["state_md"]` + `recommended_repair: "Re-sync STATE.md to <resolved>"`. Callers expose this to operators (cockpit / Warp Agent) so the staleness is VISIBLE rather than buried.

### D3 — Phase_name fidelity preserved when no drift

Initial wiring overwrote cockpit's curated phase_name (e.g., "Cockpit-state Adapter") with title-cased folder slug ("76-Cockpit-State-Adapter"). Fix: when resolver and STATE.md AGREE on milestone+phase (no drift), preserve STATE.md's curated phase_name. Resolver only overrides when stale.

### D4 — A20 next_unlock vocab extended

Phase 86 next_unlock.from accepted {checkpoint, state}. Phase 90-02 adds `resolver_repair` as a 3rd valid value (when STATE.md is stale and resolver provides recommended_repair). Self-test A20 updated.

### D5 — Lock-4 on Phase 89 deliverables

Plan 90-01 ships warp-mcp-actions/server.cjs. Plan 90-02 does NOT modify it (only the v2.3 read-only server). v2.3 server.cjs SHA verified unchanged at end of 90-01; modified by 90-02 for resolver wiring (3 tool functions only).

## Live evidence

```
state-resolver --json on this checkout:
  milestone: v2.7
  phase: 90
  phase_name: Controlled Action MCP Implementation
  source: pulse
  projection_stale: true
  stale_sources: ["state_md"]
  recommended_repair: "Re-sync STATE.md to milestone=v2.7 phase=90"
  conflicts: [{ source_a: pulse, phase_a: 90, source_b: state_md, phase_b: complete }]

sgsd_current_phase via MCP:
  milestone: v2.7 (from resolver, NOT from raw STATE.md v2.6)
  phase: 90
  effective_source: pulse
  projection_stale: true

cockpit objective section:
  milestone: v2.7
  phase: 90
  source: pulse
  staleness.state_md.recommended_repair: surfaced
```

## Adjacent test totals

| Self-test | Result |
|---|--:|
| warp-mcp | 47/47 |
| warp-mcp-actions | 21/21 |
| warp-doctor | 17/17 |
| cockpit-state | 19/19 |
| state-resolver (NEW) | 14/14 |
| sgsd-complete-milestone | 8/8 |
| orchestrator-hooks | 9/9 |
| chaos-restart | 18+5/18+5 |
| context-bench | 33/33 |
| failure-injection | 24+10/24+10 |
| installer-audit | 12/12 |
| release-readiness | 15/15 |
| scenario-suite | +10/10 |
| upgrade-drift | 12/12 |
| warp-plan-converter | 17/17 |
| **Phase 87 orchestrator-hooks** | 9/9 |

All green. Resolver wired; v2.7 / Phase 90 effective state visible.

## Forward references

- STATE.md should be re-synced to v2.7 P90 ALL-CLOSED via the resolver's recommended_repair (operator action OR follow-up phase 91+ may auto-sync).
- Phase 91 (cloud-safe SGSD skills) consumes resolver for Oz cloud-side state queries.
- Phase 94+ ACP adapter inherits resolver as its state oracle.
