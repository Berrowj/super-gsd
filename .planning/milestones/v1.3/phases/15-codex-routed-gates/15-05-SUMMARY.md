---
phase: 15
plan: "05"
plan_id: 15-05
subsystem: sgsd-token-audit + sgsd-complete-milestone
tags: [codex, kill-condition, milestone-close, lifecycle, CODEX-12]
dependency_graph:
  requires: [15-03, 15-04]
  provides: [milestone-close-kill-condition, verify-mjs-phase-15]
  affects: [sgsd-token-audit/SKILL.md, sgsd-complete-milestone/SKILL.md]
tech_stack:
  added: []
  patterns:
    - empty-milestone guard (never-exercised != failed-threshold)
    - BOTH-conditions-must-fail kill evaluation (D-20a)
    - disable-not-delete retirement pattern (AGP-P-04)
    - explicit lifecycle event at milestone close (AGP-P-07)
key_files:
  created:
    - .planning/milestones/v1.3/phases/15-codex-routed-gates/verify.mjs
  modified:
    - super-gsd/skills/sgsd-token-audit/SKILL.md
    - super-gsd/skills/sgsd-complete-milestone/SKILL.md
decisions:
  - "Empty-milestone guard: Codex never exercised -> KEEP (not RETIRE). Never fire kill on no-op milestone."
  - "inv4 noTypo check scoped to Steps 6.5/9.5 sections only. 15-04 introduced invocation_type in Step 9.6 adversarial challenger — full-file check was overly broad."
  - "WARNING-2 empirically resolved: all 3 cross-ref greps returned 0 matches. No external callers reference sgsd-complete-milestone steps by number."
metrics:
  duration_minutes: ~20
  completed_date: "2026-04-24"
  tasks_completed: 3
  files_changed: 3
---

# Phase 15 Plan 05: Kill Condition + Milestone Wire Summary

Milestone-close kill condition (CODEX-12) fully wired: `sgsd-token-audit --milestone-close-check` subcommand specified, `sgsd-complete-milestone` renumbered Steps 3-8 to Steps 4-9 with new Step 3 = CODEX-12 kill check, and Phase 15 `verify.mjs` exits 0 on all 9 invariants.

## What Was Built

### T1: sgsd-token-audit --milestone-close-check subcommand

Added `<milestone_close_check>` section to `super-gsd/skills/sgsd-token-audit/SKILL.md` specifying a 6-step mode:

1. **Empty-milestone guard** — if zero Codex rows exist for the milestone, emit KEEP verdict and exit 0 (never-exercised is not the same as failed-threshold; deviation from plan spec which did not define this edge case explicitly — Rule 2 auto-add missing critical functionality)
2. **Metric computation** — `critical_count_delta` (codex crits minus claude crits across `commit-reviews.jsonl` + `{NN}-ATC-REVIEW.md`) and `claude_tokens_saved` (token-log filter: provider=openai-codex, role in code_reviewer/adversarial_verifier)
3. **Kill threshold evaluation** — BOTH `critical_count_delta < 5` AND `claude_tokens_saved < 50000` must fail (D-20a: either condition passing alone keeps Codex active)
4. **Dry-run mode** — `--dry-run` flag emits JSON verdict `{"kill": ..., "critical_count_delta": ..., "claude_tokens_saved": ..., "reason": ...}`, exits 0 always
5. **Kill actions D-21** in order: config flip → curate anti-pattern → MILESTONES.md append → no-delete rule
6. **Auto-mode advisory** — DEVIATION log in auto mode (no block); interactive mode pauses for confirmation

Default thresholds documented in SKILL.md match config.json values: `kill_critical_count_delta: 5`, `kill_claude_tokens_saved: 50000`. `-1` sentinel disables a dimension.

### T2: sgsd-complete-milestone step renumber + CODEX-12 step insertion

Renamed all XML step tags and section headings in `super-gsd/skills/sgsd-complete-milestone/SKILL.md`:

- Step 3 NEW: `<step_3_codex_kill_check>` — invokes `sgsd-token-audit --milestone-close-check`; skips if `codex_enabled===false`; auto mode logs DEVIATION, interactive mode pauses
- Step 4 (was 3): Gate Drift Audit
- Step 5 (was 4): Cross-Phase Integration Check
- Step 6 (was 5): Generate SUMMARY.md
- Step 7 (was 6): VTP Bidirectional Integration
- Step 8 (was 7): Archive Phase Artifacts
- Step 9 (was 8): State Bump

File now has 10 step headers (Steps 0–9). Placement rationale (D-23a) documented inline.

### T3: Phase 15 verify.mjs

Created `.planning/milestones/v1.3/phases/15-codex-routed-gates/verify.mjs` — pure Node.js, no test framework, exits 0 on all 9 invariants (or exits N on first failing invariant N).

`node verify.mjs` output:
```
✓ inv1: gates.yaml ATC rows declare codex-cli-reviewer
✓ inv2: gates.yaml qualitative-waste-audit row exists
✓ inv3: sgsd-muda-audit.sh invokes codex-exec.sh
✓ inv4: SKILL.md Steps 6.5+9.5 reference resolveReviewerProvider + shellDispatch
✓ inv5: SKILL.md Step 11 token-log schema includes provider field
✓ inv6: sgsd-token-audit declares claude_tokens_saved_by_codex
✓ inv7: SKILL.md Step 9.6 challenger uses non-primary-vendor
✓ inv8: sgsd-complete-milestone includes --milestone-close-check
✓ inv9: (bonus) sgsd-token-audit --milestone-close-check --dry-run exits 0

Phase 15 verify.mjs: 9 passed, 0 failed
PASS Phase 15
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Empty-milestone guard for kill condition**
- **Found during:** T1 implementation
- **Issue:** Plan spec did not define behavior when Codex was never exercised during a milestone. Without a guard, the kill condition would fire on any milestone where `critical_count_delta=0` and `claude_tokens_saved=0` — both below threshold — retiring Codex purely because it was never used, not because it underperformed.
- **Fix:** Added Step 1 (Codex history guard) to `--milestone-close-check` mode: if zero Codex rows exist in token-log + commit-reviews for the active milestone, emit `VERDICT: KEEP` and exit 0 with reason "Codex never exercised this milestone — kill condition requires at least one Codex dispatch."
- **Files modified:** `super-gsd/skills/sgsd-token-audit/SKILL.md`
- **Commit:** b0ef1fb

**2. [Rule 1 - Bug] verify.mjs inv4 noTypo check overly broad**
- **Found during:** T3 first run (8/9 passing, inv4 failing)
- **Issue:** inv4's `noTypo = !skill.includes('invocation_type')` check scanned the entire sgsd-orchestrate SKILL.md. Plan 15-04 legitimately introduced `challengerProvider.invocation_type` in Step 9.6's adversarial challenger dispatch path. The W-3 intent was only that Steps 6.5 and 9.5 (the ATC review gates) use `provider.invocation` not `invocation_type`. The full-file check produced a false failure.
- **Fix:** Scoped the noTypo check to extracted Step 6.5 and Step 9.5 sections only, with fallback to full-file if section extraction yields < 50 chars. Comment added explaining the scoping rationale.
- **Files modified:** `.planning/milestones/v1.3/phases/15-codex-routed-gates/verify.mjs`
- **Commit:** 35180c3

## WARNING-2 Resolution (empirical)

Per plan mandate, three grep commands were run to verify no external callers reference sgsd-complete-milestone steps by number:

```
grep -rn 'sgsd-complete-milestone.*[Ss]tep [3-8]' super-gsd/  → 0 matches (exit 1)
grep -rn 'complete.*milestone.*[Ss]tep [3-8]' super-gsd/      → 0 matches (exit 1)
grep -rn 'milestone.*archive.*[Ss]tep' super-gsd/             → 0 matches (exit 1)
```

RESEARCH A2 assumption confirmed: no external callers reference steps by number. No additional file edits required.

## Acceptance Criteria Verification

| Criterion | Result |
|-----------|--------|
| A1: `grep -c 'milestone-close-check' sgsd-token-audit/SKILL.md` >= 2 | 3 ✓ |
| A2: dry-run JSON format `{"kill":..., "critical_count_delta":..., "claude_tokens_saved":..., "reason":...}` | ✓ (lines 225, 229) |
| A3: BOTH conditions must fail to fire kill (D-20a) | ✓ ("Kill condition fires if AND ONLY IF BOTH") |
| A4: Kill actions D-21 in order: config → curate → MILESTONES.md → no-delete | ✓ (steps 1-4 in order) |
| A5: `grep -c 'milestone-close-check' sgsd-complete-milestone/SKILL.md` >= 1 | 1 ✓ |
| A6: Steps 0-9 (10 total), Step 3 = kill check, Step 9 = state bump | ✓ |
| A7: `node verify.mjs` exits 0, 9/9 invariants pass | ✓ "PASS Phase 15" |
| A8: Auto-mode: DEVIATION logged, no block; interactive: pause for confirm | ✓ |
| A9: Thresholds 5 and 50000 documented in SKILL.md (matches config.json) | ✓ (lines 263-264) |

## VTP Citation Compliance

- **AGP-P-07** (explicit lifecycle events): `--milestone-close-check` is the lifecycle event that triggers kill evaluation — cited in evidence lineage
- **AGP-P-04** (rollback safety via disable not delete): kill actions retire Codex by flipping `codex_enabled: false` and documenting, never by deleting `codex-exec.sh` or registry entries

## Known Stubs

None. All documented behavior is fully specified. Kill actions are documented as agent-executed write operations (not bash stubs).

## Self-Check: PASSED

- `super-gsd/skills/sgsd-token-audit/SKILL.md` — exists, 267 lines ✓
- `super-gsd/skills/sgsd-complete-milestone/SKILL.md` — exists, 147 lines, Steps 0-9 ✓
- `.planning/milestones/v1.3/phases/15-codex-routed-gates/verify.mjs` — exists, exits 0 ✓
- Commits b0ef1fb, 5b6df30, 35180c3 — all in git log ✓
