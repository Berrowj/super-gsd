---
phase: 81
artifact: research
authored_by: orchestrator (Opus)
---

# Phase 81 -- Research

## Sources

- Phase 64 SGSD-WARP-WORKFLOWS.md — 13 workflows (notebook blocks mirror their commands)
- Phase 66 SGSD-WARP-OPERATOR-GUIDE.md — daily routines text mirrors notebook block ordering
- Phase 72 SGSD-WARP-MCP-SETUP.md — MCP tools/call blocks reference setup

## Key decisions

### D1 — Mirror workflow commands, not duplicate

Each notebook block uses the same command body as the corresponding `.warp/workflow/*.yaml`. Operators have two ways to invoke (Workflow Search or Notebook); both point at identical commands.

### D2 — Literal paths for copy-paste correctness

Per operator brief Rule 13. Other-install adaptation is one find-replace away; placeholders force EVERY operator to mentally substitute, which is worse.

### D3 — Import/export round-trip documented

Operators can customize the notebook in Warp Drive and export back to repo as `*.user.md` (gitignored). Avoids drift between repo source and operator's workspace.
