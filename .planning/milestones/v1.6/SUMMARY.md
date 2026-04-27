---
milestone: v1.6
name: Cockpit 2.0 + Startup Verification
status: SHIPPED-WITH-DEBT-18
shipped: 2026-04-27
phases: 5
plans: 8 (T1+T2+T3 across phases — 26:1, 27:1, 28:3, 29:2, 30:1)
mode: full-roadmap-autopilot-run-2 (after run-1 reset)
controlling_principle: Autonomy continues; evidence tells the truth.
---

# v1.6 Summary — Cockpit 2.0 + Startup Verification

## Phases Shipped

| Phase | Status | Closed at | Backlog rows |
|------:|--------|-----------|-------------:|
| 26 — Operator Question Contract | PASS-WITH-DEFERRED-1 | cec7126 | 1 |
| 27 — Data Source + Objective Tree | PASS-WITH-DEFERRED-1 | 7c3b1cc | 1 |
| 28 — Mission Control 2.0 Layout | PASS-WITH-DEFERRED-9 | b2f0300 | 9 |
| 29 — Agent + Codex Visibility | PASS-WITH-DEFERRED-4 | a861d95 | 4 |
| 30 — Startup + Cockpit Acceptance | PASS-WITH-DEFERRED-3 | 8ee945e | 3 |

**Total backlog: 18 rows**. Zero edge_guard_miss. Zero CRIT. Zero CANDIDATE-WITH-DEBT.

## Real code shipped

- `super-gsd/scripts/lib/sgsd-mission-strip.ps1` — 382-line PS 5.1-safe ASCII-only lib renders 6-line Mission Strip (Q1-Q8) + Phase 29 surgical hardening (5-line diff)
- `super-gsd/scripts/sgsd-mission-control.ps1` — 13-line wire (soft-load + render-call); cockpit boots clean
- `super-gsd/hooks/sgsd-activity-logger.js` — phase stamper fix (env-var primary + anchored YAML fallback + null on failure + `^[0-9]+$` validation guard); replaces broken regex that wrote `"\"26\":"` literal corruption
- `super-gsd/tests/mission-strip/` — 12 deterministic offline fixtures + runner (12/12 pass in 634ms via dot-sourced production lib)
- `super-gsd/tests/cockpit-acceptance/` — 6 acceptance fixtures + 3 harness scripts (10/10 + 18/18 + boot timing 3000-3438ms)
- `super-gsd/docs/COCKPIT-ACCEPTANCE-EVIDENCE.md` — 9-section evidence package backing all 8 acceptance scenarios

## Decisions locked (carried into v1.7)

1. **Status vocabulary** (DISCUSS 26.1): 8 closed states — `active, waiting, blocked, reviewing, timed-out, stale, complete, unavailable`. No collapse.
2. **Freshness boundaries** (DISCUSS 26.2): no-gap. `<30s active / 30-599s waiting / ≥600s stale` for generic; `<120s/3600s` for Codex; `<24h fresh` for audit-log/backlog.
3. **`repair_command` discipline** (DISCUSS 26.3): text mandatory; command optional only if deterministic AND safe AND local AND auth-free.
4. **No new state file** (DISCUSS 27.1): cockpit derives from existing 13 metric streams every refresh.
5. **`phase` stamping** (DISCUSS 27.2): orchestrator-side `SGSD_ACTIVE_PHASE` env var primary; anchored frontmatter fallback; null on failure.
6. **Mission Strip layout** (DISCUSS 28.1, 28.2): top of mission-control; 6 lines (mission/objective+unlock/model/blocker/codex+agents/next).
7. **Codex 1h staleness** (DISCUSS 29.1): mtime > 3600s → demote to idle/stale regardless of state field.
8. **Agents pane = current phase only** (DISCUSS 29.2).
9. **All 8 acceptance scenarios mandatory** (DISCUSS 30.1); fixture-based permitted for the 3 hard ones (codex-timeout/forced-restart/codex-warned).

## Backlog summary (18 rows; 7 verifier_fail + 11 phase_atc)

### Codex unavail (7 rows; carry-forward until auth restored)
- 4 per-dispatch ATC events (Phase 28 T1+T2+T3) — auth FAIL throughout session
- 4 phase-level ATC events (one per phase 26/27/28/29/30 → all 5 phases)

### Phase_atc WARN/NIT (11 rows)
- T1 unused `$StateOverride` param (Phase 28+29; YAGNI; frozen in API)
- T2 insertion-vs-replacement title-bar (Phase 28; PLAN preserved title bar; DISCUSS 28.1 said replace; reasonable ambiguity)
- T2 `$CLEAR_LINE` scope comment cosmetic (Phase 28)
- PLAN truth #4 text contradicts shipped (Phase 28; says silent-skip, code hard-fails — text-only correction)
- Deployed hook `~/.claude/hooks/sgsd-activity-logger.js` re-install untracked (Phase 28; live stamping remains corrupted until manually re-installed)
- Path schema drift (Phase 29; PLAN said `super-gsd/scripts/tests/`, executor shipped at `super-gsd/tests/mission-strip/`)
- MUDA codex_qualitative_waste — fixture overproduction (Phase 29)
- BOOT-03 README quick-start `sg` block deferred to v1.7 (Phase 30)
- Q5 agent-freshness gap (Phase 30; lib enumerates only, no mtime gating)

## What's different from run-1 (the cosplay run)

- **Every phase ran the full SGSD workflow** (pattern-mapper / researcher / discuss / planner / plan-checker / executor(s) / per-dispatch ATC / MUDA / verifier / phase-level ATC / curate). Real Agent dispatches throughout.
- **Status-consistency check enforced** before every phase close — caught two cases (Phase 28 + Phase 29) where status didn't match backlog reality, both corrected in-loop.
- **Codex provider_unavailable honestly logged** as `verifier_fail` per Patch 4, never silenced.
- **Every `PASS-WITH-DEFERRED-N` claim has N = actual non-edge_guard backlog count** (verified by status-consistency; would FAIL otherwise).
- **MUDA actually fired** in Phase 29 (codex_qualitative_waste WARN curated to memory).
- **Empirical verification**: not narrative; runnable evidence (fixture runners, boot timing, parse-checks).

## Operator action items (manual)

1. **Restore Codex auth** (~/.codex/auth.json or similar). 7 backlog rows clear when codex-exec.sh --self-test exits 0.
2. **Re-install deployed hook**: copy `super-gsd/hooks/sgsd-activity-logger.js` → `~/.claude/hooks/sgsd-activity-logger.js`. After this, live activity-log rows stamp correctly.
3. **v1.7 docs cleanup**: BOOT-03 README quick-start block; PLAN truth #4 text correction; path schema doc update.

## Verification (re-runnable)

```bash
# 1. Per-phase status consistency (must all pass)
for p in 26 27 28 29 30; do
  node super-gsd/tools/status-consistency/check.cjs --phase $p --milestone v1.6
done

# 2. Mission Strip lib smoke
powershell.exe -NoProfile -Command "
  . 'super-gsd/scripts/lib/sgsd-mission-strip.ps1'
  Render-MissionStrip -State (Get-MissionStripState -ProjectDir '.')
"

# 3. Phase 29 unit fixtures (12/12)
powershell.exe -NoProfile -File super-gsd/tests/mission-strip/run-mission-strip-fixtures.ps1

# 4. Phase 30 acceptance fixtures (10/10)
powershell.exe -NoProfile -File super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1

# 5. Phase 30 boot flag matrix (18/18)
powershell.exe -NoProfile -File super-gsd/tests/cockpit-acceptance/verify-boot-flags.ps1

# 6. Phase 30 boot timing (3 runs)
powershell.exe -NoProfile -File super-gsd/tests/cockpit-acceptance/measure-boot.ps1

# 7. CRIT-BACKLOG sanity
node super-gsd/scripts/lib/crit-backlog.cjs --self-test
node super-gsd/scripts/lib/crit-backlog.cjs --list  # 18 unresolved rows tagged across phases 26-30
```

## v1.7 readiness

v1.7 (Stable Command Contracts + Route Intelligence; Phases 31-35) is the
next milestone. Audit warning: 4 contracts already exist (review-providers,
handover-contract-v2, plan-schema-v2, code-reviewer-v1); v1.7 must NOT
collide. The DISCUSS file already locks v1.7 design decisions per the
mass-table.

Carry-forward into v1.7:
- BOOT-03 README quick-start (could be folded into v1.7 Phase 35 generated-system-map work)
- 7 Codex unavail rows clear automatically once auth restored (no v1.7 dependency)

## Status

`SHIPPED-WITH-DEBT-18` — v1.6 functionally complete; 18 deferred items
tracked in `.planning/metrics/crit-backlog.jsonl` (and rendered at
`.planning/CRIT-BACKLOG.md`).
