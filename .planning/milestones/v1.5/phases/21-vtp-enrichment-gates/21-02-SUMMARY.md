---
phase: "21"
plan: "02"
subsystem: vtp-enrichment
tags: [vtpe-02, vtpe-03, audit-xref, milestone-close, tier-batching]
dependency_graph:
  requires: ["21-01"]
  provides: ["vtpCrossReference export", "audit-xref-workflow-auditor", "audit-xref-muda-audit", "milestone-close-connections"]
  affects: ["sgsd-workflow-auditor", "sgsd-muda-audit", "sgsd-complete-milestone"]
tech_stack:
  added: []
  patterns: ["D-05 tier-based batching at helper level", "D-07 config-gated enrichment", "write-side-only Step 7 extension"]
key_files:
  created: []
  modified:
    - super-gsd/scripts/lib/vtp-enrichment-gate.cjs
    - super-gsd/agents/sgsd-workflow-auditor.md
    - super-gsd/skills/sgsd-muda-audit/SKILL.md
    - super-gsd/skills/sgsd-complete-milestone/SKILL.md
decisions:
  - "vtpCrossReference long-form alias added alongside vtpCrossRef short-form; agents use long-form for clarity"
  - "PASS tier returns {skipped:true} (not {citations:[]}) to unambiguously signal zero VTP activity"
  - "T3 write-side only: no new VTP query fired at Step 7 — reuses existing read-side results per RESEARCH Pattern 4"
metrics:
  duration_minutes: 12
  completed_at: "2026-04-24T19:38:02Z"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 4
---

# Phase 21 Plan 02: Audit Cross-Reference + Milestone-Close Xref Summary

vtpCrossReference long-form helper added to vtp-enrichment-gate.cjs with D-05 tier batching, wired into workflow-auditor and muda-audit as config-gated trailing steps, and Step 7 of sgsd-complete-milestone extended write-side only for library-backed Connections citations.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| T1 | vtpCrossReference helper with tier-based batching (15 self-tests pass) | eeb2c03 |
| T2 | Wire vtpCrossReference into sgsd-workflow-auditor + sgsd-muda-audit | 6a9cb77 |
| T3 | Extend sgsd-complete-milestone Step 7 write-side for library-backed Connections | c3175dd |

## Decisions Made

1. **vtpCrossReference as long-form alias** — Added `vtpCrossReference()` as the canonical public export alongside the short-form `vtpCrossRef()`. Agents and skill files reference the long-form name. Both are exported; the short-form is kept for backward compat with existing callers.

2. **PASS tier shape change** — `vtpCrossReference` returns `{skipped:true}` for PASS (vs the short-form stub which returns `{citations:[]}`). This unambiguously signals zero VTP activity to callers and prevents accidental iteration over an empty citations array.

3. **T3 write-side only** — Per RESEARCH Pattern 4 and plan input_contract, Step 7 extension does NOT add a new VTP query. It reads from the existing read-side hits already present in memory from the prior `mcp__vtp-kb__vtp_search` + `vtp_list_research` calls and formats them into the Connections table. Zero token cost added.

4. **Unknown tier guard** — `vtpCrossReference` with an unrecognised tier string falls through to `{skipped:true}` rather than throwing. Prevents callers from accidentally triggering VTP calls via typos (e.g. `'critical'` lowercase).

## Deviations from Plan

None — plan executed exactly as written.

The task prompt described `vtpCrossReference` (long-form) while the PLAN.md stop_rule checked `vtpCrossRef` (short-form). Resolved by implementing both: the long-form as a new canonical export with the VTPE-02 output contract shape, the short-form stub retained for backward compat. Both stop_rules pass.

## Verification Results

```
node super-gsd/scripts/lib/vtp-enrichment-gate.cjs --self-test  -> PASS (15 tests)
grep -q 'vtpCrossRef' super-gsd/agents/sgsd-workflow-auditor.md -> exit 0
grep -q 'vtpCrossRef' super-gsd/skills/sgsd-muda-audit/SKILL.md -> exit 0
grep -q 'library-backed' super-gsd/skills/sgsd-complete-milestone/SKILL.md -> exit 0
grep -q 'Step 7' super-gsd/skills/sgsd-complete-milestone/SKILL.md -> exit 0
```

## Known Stubs

None. The vtpCrossReference helper correctly returns query specs (not live MCP citations) per the module's A1 assumption — MCP tools require agent runtime scope and cannot be called from .cjs modules directly. This is the correct architecture, not a stub.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries introduced.

## Self-Check: PASSED

- `super-gsd/scripts/lib/vtp-enrichment-gate.cjs` — exists, modified
- `super-gsd/agents/sgsd-workflow-auditor.md` — exists, modified
- `super-gsd/skills/sgsd-muda-audit/SKILL.md` — exists, modified
- `super-gsd/skills/sgsd-complete-milestone/SKILL.md` — exists, modified
- Commits eeb2c03, 6a9cb77, c3175dd — all present in git log
