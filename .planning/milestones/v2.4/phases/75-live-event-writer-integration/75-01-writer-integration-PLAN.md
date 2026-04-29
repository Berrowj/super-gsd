---
plan_id: 75-01
phase: 75
title: Live event writer integration (--emit CLI + reader + SKILL.md wire-in)
type: code+docs (FULL tier)
expected_ATC_tier: full
files_touched:
  - super-gsd/scripts/lib/orchestrator-live-writer.cjs
  - super-gsd/scripts/lib/orchestrator-live-reader.cjs
  - super-gsd/skills/sgsd-orchestrate/SKILL.md
  - .planning/ORCHESTRATOR-LIVE.jsonl
---

# Plan 75-01

| # | Task | Acceptance |
|--:|---|---|
| 1 | Add --emit CLI to writer | success path / bad-type / invalid-JSON all return correct exit codes + stdout |
| 2 | Author reader Lock-13 + READ-ONLY | tailEvents / parseEvents / filterByType / selfTest |
| 3 | Add SKILL.md Wire-In Points section | additive; lists 16 events with fire-points + required data fields |
| 4 | Self-tests green | writer 10/10, reader 12/12 |
| 5 | First canonical event row in .planning/ORCHESTRATOR-LIVE.jsonl | from --emit acceptance test |
| 6 | Atomic commit | feat(p75-01) |
