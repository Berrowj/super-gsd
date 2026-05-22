---
plan_id: 65-01
phase: 65
title: AGENTS.md authorship + WARP.md rule-hierarchy update
type: docs-only
created: 2026-04-29
status: ready-for-execution
schema_version: 1
expected_ATC_tier: lite
model: sonnet
---

# Plan 65-01 — AGENTS.md authorship + WARP.md rule-hierarchy update

## Goal

Produce a tool-neutral `AGENTS.md` at repo root and add a "Rule Hierarchy"
section to `WARP.md` so Warp Agent / Codex / Claude Code / future ACP clients
all converge on the same SGSD operating contract without loading the full
CLAUDE.md handbook.

## Tasks

| # | Task | Files | Acceptance |
|--:|---|---|---|
| 1 | Author `AGENTS.md` at repo root | `AGENTS.md` | ≤ 150 lines; covers truth locations, rule hierarchy, hard rules (5 explicit), command catalogue summary, CLAUDE.md pointer |
| 2 | Add "Rule Hierarchy" section to `WARP.md` | `WARP.md` | Additive only; placed near top, before "Daily Commands"; lists AGENTS.md → WARP.md → CLAUDE.md with priority and audience for each |
| 3 | Verify AGENTS.md byte-size ratio vs CLAUDE.md | — | `wc -c AGENTS.md` divided by `wc -c CLAUDE.md` < 0.30 |
| 4 | Verify line-count compactness | — | `wc -l AGENTS.md` ≤ 150 |
| 5 | Verify WARP.md daily-commands and project-shape sections preserved verbatim | — | git diff WARP.md shows ONLY the new Rule Hierarchy section as net additions |

## Surgical Constraint (Karpathy)

Every line in AGENTS.md must serve one of: truth locations, rule hierarchy,
the 5 hard rules, command catalogue summary, or CLAUDE.md pointer. No filler
prose. No "in this section we will…" boilerplate. No copying of CLAUDE.md
content. If a topic exists in CLAUDE.md or WARP.md already, AGENTS.md
references it by path rather than duplicating it.

WARP.md update must be ADDITIVE ONLY. Do not refactor existing sections.
Do not rewrite the daily-commands section even if you'd write it differently.
The acceptance check (Task 5) requires a clean additive diff.

## Acceptance (Plan-Level)

- `AGENTS.md` exists at `C:\Users\user\GSDedits\AGENTS.md`.
- `WARP.md` has a Rule Hierarchy section.
- Both files commit atomically with the Phase 65 close.
- All 5 task acceptance criteria pass.

## Self-Test

```bash
# Compactness floor
test "$(wc -l < AGENTS.md)" -le 150 || echo "FAIL: AGENTS.md > 150 lines"

# Byte-ratio floor
node -e '
  const fs=require("fs");
  const a=fs.statSync("AGENTS.md").size;
  const c=fs.statSync("CLAUDE.md").size;
  const ratio=a/c;
  console.log("ratio="+ratio.toFixed(3));
  process.exit(ratio < 0.30 ? 0 : 1);
'

# Required-section presence
for s in "Truth Locations" "Rule Hierarchy" "Hard Rules" "Daily Commands" "Claude Code"; do
  grep -q "$s" AGENTS.md || echo "FAIL: AGENTS.md missing section: $s"
done

# WARP.md additive only — Rule Hierarchy added, daily commands preserved
grep -q "Rule Hierarchy" WARP.md || echo "FAIL: WARP.md missing Rule Hierarchy"
grep -q "Daily Commands" WARP.md || echo "FAIL: WARP.md daily-commands section gone"
```
