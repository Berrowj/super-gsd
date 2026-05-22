---
phase: 68
phase_name: SGSD MCP Contract
milestone: v2.3
roadmap: warp-integration
created: 2026-04-29
operator: user
status: in-progress
deviation_from_standard: docs-only design phase (Step 1 pattern-mapper skipped, Step 7 MUDA skipped, ATC docs-only LITE)
unblocked: yes (does not depend on M1-M5 manual UI checks; the contract is design-doc work that v2.3 Phase 69+ implements against)
---

# Phase 68 -- SGSD MCP Contract (CONTEXT)

## Goal

Define the read-only MCP tool contract before any implementation. v2.3 Phase
69 builds the MCP server shell against this contract; Phase 70/71 implement
the per-tool logic; Phase 72 wires Warp MCP config + redaction + docs.

This is the central unlock per operator brief: "If only one milestone ships,
ship the read-only SGSD MCP bridge. Everything else gets easier after Warp
Agent can ask SGSD for structured truth."

## Locked Scope (D68.1-D68.7)

- **D68.1**: 14 tools per roadmap (Phase 68 task list). Read-only only;
  no write-capable tools in v2.3 (those land in v2.7 Phase 89+ behind a
  separate controlled-action contract).
- **D68.2**: Each tool documented with: inputs schema, outputs schema,
  failure modes, source files (which `.planning/` paths it reads),
  redaction rules, max output size, degraded behavior.
- **D68.3**: Schema version = 1. Bumping requires a separate phase + a
  v1->v2 migration table. Locked at the contract level.
- **D68.4**: Redaction rules are a closed-vocab list at contract level
  (not per-tool). Phase 72 implements; Phase 70/71 wire to it.
- **D68.5**: Degraded behavior is uniform: every tool returns
  `{ok: false, error_code, error_message, _degraded: true}` when source
  files are missing or unparseable. No throws across the MCP stdio
  boundary (Lock-13 contract).
- **D68.6**: Max output size = 50 KB per tool response. If a tool would
  exceed, it returns a paged sentinel with `_truncated: true` and a
  follow-up tool name (e.g., `sgsd_token_spend_more`) — Phase 71 owns
  the paging contract for ledger-tail tools.
- **D68.7**: Fixture format: per-tool fixtures under
  `super-gsd/tools/warp-mcp/fixtures/{tool_name}/{scenario}.json` with
  matching `.input.json` and `.expected.json` pairs. Phase 70/71 consume.

## Inputs Consumed

- `.planning/milestones/warp-integration/ROADMAP.md` Phase 68 task list +
  v2.3 milestone block
- `.planning/analyses/2026-04-29-warp-ecosystem-atlas.md` Layer 3 § MCP
- `.planning/analyses/2026-04-29-sgsd-warp-convergence-audit.md`
  § Crossover-4 (Warp MCP Vs SGSD Metrics Files) + Data Contract Priorities
- `.planning/analyses/2026-04-29-sgsd-warp-native-research-plan.md` § W2
  (Read-Only SGSD MCP)
- `.planning/STATE.md` (source-file map for status tools)
- Existing `.planning/metrics/*.jsonl` (source for token / codex / pulse / route tools)
- `super-gsd/tools/warp-doctor/check.cjs` (Phase 67 pattern source for Lock-13 / READ-ONLY / frozen vocab)

## Outputs

- `super-gsd/docs/SGSD-WARP-MCP-CONTRACT.md` (NEW; ~500 lines target)
- `super-gsd/tools/warp-mcp/fixtures/README.md` (NEW; fixture-shape doc)
- Phase 68 standard artifacts: 68-CONTEXT.md (this), 68-01-...-PLAN.md,
  68-RESEARCH.md, 68-VERIFICATION.md, 68-ATC-REVIEW.md

## Acceptance

1. `super-gsd/docs/SGSD-WARP-MCP-CONTRACT.md` exists with all 14 tools
   documented (inputs / outputs / failure_modes / source_files / redaction /
   max_output_size / degraded_behavior).
2. Schema version stamped at contract level.
3. `super-gsd/tools/warp-mcp/fixtures/README.md` defines per-tool fixture
   shape: `{tool}.input.json` + `{tool}.expected.json` pairs.
4. No write-capable tool appears.
5. Redaction rules listed with closed vocabulary (>= 5 categories).
6. Cross-references to source files (`.planning/STATE.md`,
   `.planning/metrics/*.jsonl`, etc.) all resolve to existing paths.
7. Phase 68 close commit atomic; isolated under
   `super-gsd/docs/` + `super-gsd/tools/warp-mcp/` + Phase 68 artifacts.

## Out Of Scope

- MCP server implementation (Phase 69-71).
- Warp MCP config wiring (Phase 72).
- Write-capable tools (v2.7 Phase 89+).
- VTP MCP integration (Phase 48 covers; v2.3 MCP is SGSD state only).
