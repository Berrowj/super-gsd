---
phase: 15
plan: 01
subsystem: provider-indirection
tags: [codex, provider-dispatch, skill-wiring, gates, config-flip]
depends_on: [15-02, 15-03]
provides: [CODEX-07]
affects: [providers-registry.cjs, sgsd-orchestrate/SKILL.md, codex-exec.sh, gates.yaml, config.json]
tech_stack:
  added: []
  patterns: [wave-sequenced-wiring, predicate-narrowing-before-switch-flip, three-task-ordered-commit]
key_files:
  modified:
    - super-gsd/scripts/lib/providers-registry.cjs
    - super-gsd/skills/sgsd-orchestrate/SKILL.md
    - super-gsd/scripts/codex-exec.sh
    - super-gsd/registry/gates.yaml
    - super-gsd/config/config.json
decisions:
  - "W-1 fix: resolveReviewerProvider predicate narrowed to require reviewer_provider field explicitly — prevents fallback-path bypass on gates without the field"
  - "T1 commits first (predicate fix) before T3 throws the switch — non-negotiable ordering per RESEARCH AD-04"
  - "SKILL.md Steps 6.5 + 9.5 provider-dispatch branch wired in T2 (Wave 2 execution, re-read SKILL.md at runtime to catch Wave 1 line changes)"
  - "codex-exec.sh W-4 fix included in T2 commit — sidecar correctness required before live invocation"
  - "gates.yaml flip: reviewer_provider changed from claude to codex-cli-reviewer + W-2 registry_version bump + config.json codex_enabled:true all in T3 atomic commit"
metrics:
  duration: ~30min
  completed: 2026-04-24T01:00:00Z
  tasks_completed: 3
  files_changed: 5
  commits: 4
---

# Phase 15 Plan 01: Provider Indirection Wire Summary

Wire the Phase 14 provider-indirection substrate into live dispatch — predicate narrowing (W-1), SKILL.md Steps 6.5/9.5 provider-dispatch branch + codex-exec.sh W-4 fix, then the live switch-flip (gates.yaml + config.json codex_enabled:true). CODEX-07 delivered.

## Commits

| Task | Commit | Files | Description |
|------|--------|-------|-------------|
| T1 | 6ea114d | providers-registry.cjs | narrow resolveReviewerProvider to require reviewer_provider — W-1 |
| T2 | 781bdfe | SKILL.md, codex-exec.sh | Steps 6.5+9.5 provider-dispatch branch + codex-exec.sh W-4 fix |
| T3 | bca28ec | gates.yaml, config.json | flip to codex-cli-reviewer + W-2 bump + codex_enabled:true |
| checkpoint | 2a0d5ae | — | Phase 15 Wave 1 shipped — Wave 2 next |

## Acceptance Criteria Results

| Criterion | Result |
|-----------|--------|
| W-1: resolveReviewerProvider requires reviewer_provider field | PASS |
| W-2: registry_version bumped in gates.yaml | PASS |
| W-4: codex-exec.sh sidecar correctness fix applied | PASS |
| SKILL.md Step 6.5 provider-dispatch branch present | PASS |
| SKILL.md Step 9.5 provider-dispatch branch present | PASS |
| gates.yaml reviewer_provider flipped to codex-cli-reviewer | PASS |
| config.json codex_enabled: true | PASS |

## Deviations from Plan

None — plan executed as specified. T1 committed before T3 per RESEARCH AD-04 ordering constraint.

## Known Stubs

None. All dispatch wiring is live. codex_enabled:true enables the live path in Step 9.5.

## Threat Flags

None. No new network endpoints. The provider-dispatch branch routes to codex-exec.sh which has its own auth-denied exit path (exit 3).

## Self-Check: PASSED

- Commit 6ea114d: FOUND
- Commit 781bdfe: FOUND
- Commit bca28ec: FOUND
- Commit 2a0d5ae: FOUND
