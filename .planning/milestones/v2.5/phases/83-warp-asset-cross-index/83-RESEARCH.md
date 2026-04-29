---
phase: 83
artifact: research
authored_by: orchestrator (Opus)
---

# Phase 83 -- Research

## Sources

- Phases 64 (workflows) / 79 (skills) / 81 (notebook) / 82 (prompts) / 78 (launch configs) / 68-72 (MCP tools) / 67 (warp-doctor) — all surfaces enumerated.

## Key decisions

### D1 — Backtick-quoted paths as the lint target

Markdown convention is to backtick file paths. Validator extracts via single regex `` `([\w./_\-]+)` `` and filters for SGSD-relevant prefixes. Catches every path; false positives filtered.

### D2 — Self-test fixture with deliberate non-path inside backticks

Validator A1 verifies that a string like `"`super-gsd/tools/foo.cjs` and `WARP.md` plus `not-a-path`."` correctly extracts only the 2 SGSD-relevant entries (filters `not-a-path`).

### D3 — WARP.md additive update

Single new section "Asset Index" between Operating Rules and Warp Integration Direction. No existing content removed.

## Live results

```
total paths cited: 47
missing: 0
exit: 0
```

47 paths is the substantive measure of the v2.2-v2.5 ship.
