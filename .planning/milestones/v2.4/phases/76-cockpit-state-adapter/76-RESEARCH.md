---
phase: 76
artifact: research
created: 2026-04-29
authored_by: orchestrator (Opus); code by gsd-executor (Sonnet) agentId a59561795a4b7d3ee
---

# Phase 76 -- Research

## Pattern source

- Phase 73 OPERATOR-QUESTION-MODEL.md (10-section structure)
- Phase 74 ORCHESTRATOR-LIVE-EVENTS contract (live events source)
- Phase 75 reader (event consumption)
- Phase 70 _parseStateFrontmatter / _tailJsonl (legacy ledger reading)

## Key decisions

### D1 — recency wins between live events and legacy ledgers

When live event stream and legacy ledger both have data for a section
(e.g., gate fires written to BOTH gate-value-log and ORCHESTRATOR-LIVE),
adapter sorts by ts and prefers most-recent. Legacy ledgers fill gaps
when live stream is silent.

### D2 — planningDir vs projectDir distinction

MCP fixtures pass `fixture_planning_dir` which IS the planning dir
(not its parent). Adapter accepts both `opts.projectDir` (parent of
.planning/) and `opts.planningDir` (the .planning/ itself) for clean
fixture-vs-live paths. Tool 12 branches accordingly.

### D3 — A28 renamed for new envelope shape

warp-mcp self-test A28 was `has_all_7_sections` (composer-internal sub-tools).
Phase 76 unification changes the envelope shape to 10 named sections.
Renamed to `has_all_10_sections` with the new key list. Assertion count
preserved at 42; in-source check updated.

### D4 — fixture pseudo-roots

Per fixture: `_pseudo_root/.planning/STATE.md` + relevant ledgers +
ORCHESTRATOR-LIVE.jsonl. Adapter accepts `planningDir` pointing at
`_pseudo_root/.planning/`. Synthetic but realistic.

## Live test data

```
adapter --json live (this checkout):
  ok:true
  10 sections present (canonical order)
  objective.milestone = v2.2
  codex.live_state = stale (codex-live.json mtime > 1h ago)
  tokens.total = 32.5M
  artifacts.phases = 5
  resume_command = /sgsd-orchestrate go
```

## Forward references

- Phase 77 (Cockpit 2.0 Warp Layout) consumes adapter via `--json` from PowerShell.
- v2.5 Phase 79+ Warp skills query MCP `sgsd_cockpit_snapshot` (now adapter-backed).
- v2.7 Phase 89+ controlled actions read adapter for pre-action state snapshots.
