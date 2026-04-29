---
phase: 80
artifact: research
authored_by: orchestrator (Opus); code by gsd-executor (Sonnet) agentId a09b70d2ea3c4513d
---

# Phase 80 -- Research

## Sources
- ROADMAP-AGENT.md standard phase artifact set (CONTEXT/PLAN/RESEARCH/VERIFICATION/ATC-REVIEW)
- super-gsd/tools/upgrade-drift pattern (Lock-13 / frozen vocab / selfTest)
- Phase 73 OPERATOR-QUESTION-MODEL (TODO marker conventions)

## Key decisions

### D1 — DRAFT-only output to .planning/analyses/

Converter never writes outside `.planning/analyses/<ISO>-warp-plan-import/`. Active milestone folders untouched. selfTest A11/A12 mtime-snapshots verify.

### D2 — Mtime-snapshot read-only invariant

Stronger than `git status before/after` because it catches even ATTRIBUTE changes (read-only dir touches). Phase 80 selfTest A11 captures `fs.statSync('.planning/STATE.md').mtimeMs` before and after, asserts equality.

### D3 — TODO markers + acceptance checkboxes

Generated PLANs have `## Acceptance (TODO)` with 6 `- [ ]` checkbox bullets. RESEARCH has `<!-- TODO: Claude research source inputs -->`. Operator fills these in before activating the draft phase.

### D4 — IMPORT-MANIFEST.md per conversion

Each conversion run produces an `IMPORT-MANIFEST.md` listing source file + generated phase folders + DRAFT marker reminder. Operator reads this first when reviewing.

## Live conversion evidence

```
.planning/analyses/2026-04-29-warp-plan-import-test/v2-x-draft/
  IMPORT-MANIFEST.md
  phases/01-discovery/{01-CONTEXT.md, 01-01-discovery-PLAN.md, 01-RESEARCH.md}
  phases/02-design/{02-CONTEXT.md, 02-01-design-PLAN.md, 02-RESEARCH.md}
  phases/03-implementation/{03-CONTEXT.md, 03-01-implementation-PLAN.md, 03-RESEARCH.md}
```

3 phase dirs × 3 files = 9 phase files + 1 manifest = 10 files generated. All DRAFT-marked.

## Forward references
- Phase 83 cross-index references this converter as the "Warp Plan import" path.
- Operators: convert Warp Plan → review draft → manually merge into ROADMAP.md to activate.
