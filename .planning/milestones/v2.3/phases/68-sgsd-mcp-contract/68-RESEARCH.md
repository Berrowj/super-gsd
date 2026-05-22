---
phase: 68
artifact: research
created: 2026-04-29
operator: user
---

# Phase 68 -- Research: SGSD MCP Contract

## Source inputs surveyed

- ROADMAP.md Phase 68 task list -- 14 tools enumerated.
- Atlas Layer 3 § MCP -- contract should expose read-only first; redaction is critical.
- Convergence audit § Crossover-4 -- "MCP is a query interface over .planning files".
- Native research plan § W2 -- list of 12 tools (atlas + audit added 2 more: cockpit_snapshot composer, warp_doctor inline).
- STATE.md frontmatter shape (this very session) -- source of truth for tools 1-3.
- Existing metrics ledgers under `.planning/metrics/` -- source of truth for tools 4-9, 10.
- Phase 67 warp-doctor (`super-gsd/tools/warp-doctor/check.cjs`) -- shells-out source for tool 14; pattern source for Lock-13/READ-ONLY.

## Key design decisions

### D1 -- Universal envelope for all 14 tools

Same shape every time. Lock-13 enforced. Phase 69 dispatcher routes around the same 5-field envelope (`ok`, `schema_version`, `ts`, `tool`, `data`) plus 3 optional flags (`_truncated`, `_degraded`, `_redactions_applied`). Reduces per-tool implementation cognitive load.

### D2 -- Closed error vocab (11 entries)

Mirrors warp-doctor's REASON_NOTES pattern. selfTest in Phase 69 verifies frozen + len=11. No tool may invent new error codes.

### D3 -- Closed redaction vocab (7 categories)

Listed once at contract level. Phase 72 implements; Phase 70/71 wire. Each tool's contract entry says which categories apply to its outputs. `_redactions_applied` lists categories triggered, not the redacted values themselves -- audit-friendly without leaking.

### D4 -- 50KB default max + 100KB for cockpit_snapshot

Forces paging discipline on tail-style tools. Snapshot tool gets 100KB because it composes 6+ sub-tools; lower would force partial responses.

### D5 -- Fixture pairs `{scenario}.{input,expected}.json`

Familiar convention; matcher engine in Phase 69 supports literal / contains / regex / exists. Avoids brittle full-equality on non-deterministic fields like `ts`.

### D6 -- 4-phase implementation order (69 -> 70 -> 71 -> 72)

69 = skeleton + dispatcher + fixture loader. 70 = 5 status tools (1, 2, 3, 4, 11). 71 = 9 operational tools (5, 6, 7, 8, 9, 10, 12, 13, 14). 72 = redaction + Warp config + docs.

This split keeps each phase scoped to ~5 tools max, all sharing source-file shapes, so the executor can amortise reading the source files across the tools in that phase.

## Forward references

- Phase 69 ships server.cjs + dispatcher + run-self-test.cjs against this contract.
- Phase 76 (v2.4) cockpit-state adapter reuses tool 12 (`sgsd_cockpit_snapshot`).
- Phase 89-90 (v2.7) write-capable contract is SEPARATE; this contract stays read-only forever.
- Phase 94-97 (v2.8) ACP mapping reuses tool 1-4 schemas as ACP session/plan/progress/tool-call shapes.

## Implementation note

Orchestrator-authored design doc per the rebalance plan I proposed in the
prior auto-run halt: small scoping + design docs at Opus, code-heavy
phases (69-71) dispatched to Sonnet executor. Phase 72 mixed.
