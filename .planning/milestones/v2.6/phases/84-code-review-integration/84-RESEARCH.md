---
phase: 84
artifact: research
authored_by: orchestrator (Opus)
---

# Phase 84 -- Research

## Sources

- Convergence audit § Crossover-7 (Warp Code Review vs SGSD ATC)
- Atlas Layer 2 (Code UX / Code Review panel)
- Phase 71 sgsd_artifact_links MCP tool (artifact path resolver)
- Phase 64 workflow shape

## Key decisions

### D1 — 2-layer review model

Atlas/audit make this explicit: Warp Code Review is human-facing; SGSD ATC is mechanical evidence. Phase 84 documents the layering so operators don't conflate.

### D2 — `SGSD: Open Review Artifacts` workflow

Single command lists all review-relevant files for the active phase + last 5 commits. Operator opens the right files; Warp Code Review handles the diff. Prevents "where's the ATC review?" lookup churn.

### D3 — Cumulative phase diff trick

Phase commits are atomic per-task; reviewing the CUMULATIVE phase diff requires `git diff <phase-start>..HEAD`. Documented in the guide so operators don't get lost in fragmented commits.

### D4 — Hard rule citations

Hard rules 1 / 2 / 5 cited where operators might be tempted to override gates. Prevents drift back to ad-hoc review patterns.
