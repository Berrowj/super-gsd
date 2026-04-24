---
phase: 21
plan: "03"
subsystem: vtp-enrichment-gates
tags: [vtpe-04, vtpe-05, d-07, d-08, config, artifact-discipline, degraded-mode]
dependency_graph:
  requires: [21-01, 21-02]
  provides: [config.vtp_enrichment, vtp-enrichment-gate-3path, vtp_health-cold-start]
  affects: [sgsd-orchestrate, vtp-enrichment-gate.cjs, config.json]
tech_stack:
  added: []
  patterns: [node-read-mutate-write, 3-path-artifact-write, cold-start-health-probe, degraded-mode-cache]
key_files:
  created: []
  modified:
    - .planning/config.json
    - super-gsd/scripts/lib/vtp-enrichment-gate.cjs
    - super-gsd/skills/sgsd-orchestrate/SKILL.md
decisions:
  - "vtp_enrichment block defaults enabled:false — zero behavioral drift on pre-Phase-21 projects (D-07)"
  - "api_error always writes artifact stub so downstream existence check passes (VTPE-05)"
  - "vtp_available cached once at cold-start (Step 3.7) — not re-checked per gate (cost vs safety tradeoff)"
  - "vtp-health.jsonl append per boot provides observability without blocking loop"
metrics:
  duration_minutes: 25
  completed_at: "2026-04-24T19:50:10Z"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 3
---

# Phase 21 Plan 03: Design-Policy Config + Empty-Hit Artifact Discipline Summary

## One-liner

vtp_enrichment config block (disabled default) + 3-path artifact writes (success/empty_hit/api_error) + D-08 vtp_health cold-start probe caching vtp_available for degraded-mode gate bypass.

## What Was Built

### T1 — config.vtp_enrichment additive block (VTPE-04)

Added `vtp_enrichment` key to `.planning/config.json` using Node read-mutate-write (per feedback_never_head_settings). Fields match D-07 exactly: `enabled:false`, `challenger_mode:false`, `granularity:tier-based`, `empty_hit_policy:continue`, `max_queries_per_gate:5`, `query_seed_max_tokens:800`, `audit_tier_batching:{critical:per-finding,warn:batched,pass:skip}`. All prior config keys preserved. `deliberation.board` unchanged (researcher NOT appended — that is 21-04-T2).

### T2 — Empty-hit artifact discipline (VTPE-05)

Hardened `writeEnrichmentArtifact` in `vtp-enrichment-gate.cjs` to handle all 3 status paths:

- **success**: full D-04 artifact with Library Hits table, Gaps, Alt Framings, `vtp_status: success`
- **empty_hit**: D-04 frontmatter with `empty_hit: true`, `vtp_status: empty_hit`, plus Empty-Hit Rationale section with topic + reasoning
- **api_error**: minimal stub with `vtp_status: api_error`, `## API Error` section, error_message, and EXIT-BLOCK signal comment for orchestrator

Added `vtpStatus` parameter to `writeEnrichmentArtifact`. Updated `run()` to pass `vtpStatus` on enrichmentResult injection. Added 3 new self-tests (16/17/18) covering each path explicitly. All 18 self-tests pass.

### T3 — D-08 VTP-aware degraded mode (cold-start ping)

Extended `sgsd-orchestrate/SKILL.md` Step 3 with new sub-step 3.7: when `config.vtp_enrichment.enabled === true`, ping VTP once at session start, cache result as `vtp_available`. Appends to `.planning/metrics/vtp-health.jsonl` per boot. Updated Step 6.b.5 to read `vtp_available` before dispatching `sgsd-vtp-enrichment`: if `false`, skip gate silently, log deviation, continue to Step 6.c (D-08 degraded mode). Non-blocking: when `enabled=false`, probe is skipped entirely.

## Verification Results

- T1: `node -e "const c=require('./.planning/config.json'); if(c.vtp_enrichment && c.vtp_enrichment.enabled===false) console.log('PASS')"` → PASS
- T2: `node super-gsd/scripts/lib/vtp-enrichment-gate.cjs --self-test` → PASS (18/18 tests)
- T3: `grep -q 'vtp_health' SKILL.md && grep -q 'vtp_available' SKILL.md` → PASS (4 + 14 occurrences)

## Commits

| Task | Hash | Message |
|------|------|---------|
| T1 | 7f4aef6 | feat(21-03/T1): VTPE-04 config.vtp_enrichment additive block (disabled default) |
| T2 | 14dae35 | feat(21-03/T2): VTPE-05 empty-hit artifact discipline -- 3-path artifact writes |
| T3 | 3973d05 | feat(21-03/T3): VTPE-05 + D-08 orchestrator cold-start vtp_health ping for degraded-mode |

## Deviations from Plan

None — plan executed exactly as written. Node read-mutate-write used for config.json per feedback. ASCII-only strings used in SKILL.md edits. All 3 paths tested in self-test.

## Known Stubs

None. The `vtp_health` cold-start probe in SKILL.md references `callVtpHealthProbe()` as a pseudocode placeholder — this is intentional documentation of the pattern; actual MCP calls happen in agent runtime scope per the existing VTPE-01 contract (A1 assumption). No rendered UI or data path depends on this stub.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries introduced. `vtp-health.jsonl` is an append-only local metrics file; no external surface added.

## Self-Check: PASSED

- `.planning/config.json` — EXISTS, vtp_enrichment.enabled=false confirmed
- `super-gsd/scripts/lib/vtp-enrichment-gate.cjs` — EXISTS, self-test exits 0
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` — EXISTS, vtp_health + vtp_available confirmed
- Commits 7f4aef6, 14dae35, 3973d05 — all present in git log
