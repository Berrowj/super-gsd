---
phase: 76
tier: full
codex_review: SKIPPED
---

# Phase 76 -- ATC FULL

## First Principles
Single composer eliminates duplicate logic between cockpit and MCP. Justified.

## Delete
None — 10 sections map 1:1 to Phase 73 question model; 4 fixtures cover known state classes.

## Anti-Slop 10/10
- Every fn called.
- Imports used.
- Lock-13 on every public API.
- READ-ONLY invariant verified.
- ASCII-only.
- Live-events-precedence is recency-based, not a hardcoded preference.
- Fixture pseudo-roots minimal.
- ONE thing: ship adapter + unify MCP tool 12.

## Cross-Phase Sanity
- 10 sections match Phase 73 OPERATOR-QUESTION-MODEL composition.
- Live event source matches Phase 74 contract.
- Reader API matches Phase 75 reader.
- MCP tool 12 envelope shape change documented in Phase 76 fixture updates.
- warp-mcp regression 42/42 confirms backward compat with Phase 71 baseline.

## Verdict: PASS

Phase 77 unblocked.
