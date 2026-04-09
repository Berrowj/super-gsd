---
phase: 02-memory-layer
plan: "02"
subsystem: memory-layer
tags: [brv, script-registry, injection, orchestrator, executor, smoke-test]
dependency_graph:
  requires: [02-01]
  provides: [orchestrator-script-registry-pattern, executor-overlay-format, scripts-domain-seed]
  affects: [orchestrator-prompt-composer.md, executor-brv-overlay.xml, context-tree/scripts]
tech_stack:
  added: []
  patterns: [EXISTING-injection-format, brv-domain-filtering, curate-then-query-roundtrip]
key_files:
  created:
    - .brv/context-tree/scripts/nodejs/brv-query-local.md
    - .brv/context-tree/scripts/nodejs/brv-curate-local.md
    - .brv/context-tree/scripts/nodejs/smoke-test-entry.md
  modified:
    - super-gsd/templates/orchestrator-prompt-composer.md
    - super-gsd/templates/executor-brv-overlay.xml
key_decisions:
  - "Scripts domain had no seed entries — curated brv-query-local and brv-curate-local as core entries to enable Test 2"
  - "EXISTING: injection format capped at 80 chars via snippet.substring(0,80) per threat model T-02-06"
  - "smoke-test-entry.md retained in context-tree as a live roundtrip test artifact"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-08"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 5
---

# Phase 2 Plan 02: Script Registry Wiring + Overlay Injection Summary

**One-liner:** EXISTING: injection pattern wired end-to-end — orchestrator Step 3 queries scripts domain with brv-query-local.js, formats hits as EXISTING: lines, executor overlay documents the contract, all 4 smoke tests pass.

## What Was Built

### Task 1: orchestrator-prompt-composer.md Steps 3 + 5 (commit b64a277)

Two targeted changes to the prompt composition guide:

- **Step 3** `scripts_to_check` block: replaced pseudocode with executable bash that calls `brv-query-local.js --domain scripts --max 2 --format json`, formats each hit as `EXISTING: {path} — {snippet.substring(0,80)}`, and accumulates into `EXISTING_SCRIPTS` for Step 5. Empty results are skipped — no blank EXISTING lines injected.
- **Step 5** `EXISTING_SCRIPTS` placeholder comment: updated from generic "brv-query script results" to explicit `one "EXISTING: {path} — {80-char description}" per match, or "none"`.

### Task 2: executor-brv-overlay.xml + smoke tests (commit a6438cb)

**Overlay update:** The `existing_scripts` block comment updated from single generic line to two lines:
1. Contract: `one "EXISTING: {path} — {description}" line per script match`
2. Concrete example: `EXISTING: scripts/nodejs/brv-query-local.js — BM25 search engine, no API key required`

**Scripts domain seeding (deviation — see below):** Curated brv-query-local.js and brv-curate-local.js as core seed entries in `scripts/nodejs` domain so Test 2 could return real results.

**All 4 smoke tests passed:**

| Test | Requirement | Result |
|------|-------------|--------|
| T1: Query speed | <100ms, non-empty array | PASS (search logic <1ms) |
| T2: Script registry hit | --domain scripts returns results | PASS (score 69 for brv-query-local) |
| T3: Frontmatter fields | importance, maturity, tags, keywords present | PASS |
| T4: Curate roundtrip | write then query-back succeeds (score > 0) | PASS (score 60) |

## Deviations from Plan

### Auto-added Missing Seed Files

**1. [Rule 2 - Missing Critical Functionality] Curated brv-query-local and brv-curate-local as scripts domain seed entries**
- **Found during:** Task 2 Test 2 (script registry hit)
- **Issue:** `.brv/context-tree/scripts/` contained only `test/test.md` with empty keywords — no real script entries existed, so `--domain scripts` query returned `[]`
- **Fix:** Curated both core scripts as `scripts/nodejs/*.md` entries with accurate titles, snippets, tags, and keywords
- **Files modified:** `.brv/context-tree/scripts/nodejs/brv-query-local.md`, `.brv/context-tree/scripts/nodejs/brv-curate-local.md`
- **Commit:** a6438cb

## Known Stubs

None — all wiring is live and executable against real data.

## Threat Flags

None — T-02-06 (snippet capped at 80 chars) applied in Step 3 shell block as required.

## Self-Check: PASSED

- `super-gsd/templates/orchestrator-prompt-composer.md` — modified (commit b64a277)
- `super-gsd/templates/executor-brv-overlay.xml` — modified (commit a6438cb)
- `.brv/context-tree/scripts/nodejs/brv-query-local.md` — created (commit a6438cb)
- `.brv/context-tree/scripts/nodejs/brv-curate-local.md` — created (commit a6438cb)
- Both commits verified in git log
</content>
</invoke>