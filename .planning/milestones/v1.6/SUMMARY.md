---
milestone: v1.6
name: Cockpit 2.0 + Startup Verification
status: SHIPPED-WITH-DEBT-10
shipped: 2026-04-27
phases: 5
plans: 8 (T1+T2+T3 across phases — 26:1, 27:1, 28:3, 29:2, 30:1)
mode: full-roadmap-autopilot-run-2 (after run-1 reset)
controlling_principle: Autonomy continues; evidence tells the truth.
---

# v1.6 Summary — Cockpit 2.0 + Startup Verification

## Phases Shipped (post-rerun)

| Phase | Status | Closed at | Initial backlog | Codex rerun cleared | Final unresolved |
|------:|--------|-----------|----------------:|--------------------:|-----------------:|
| 26 — Operator Question Contract | PASS | cec7126 | 1 | 1 | **0** |
| 27 — Data Source + Objective Tree | PASS | 7c3b1cc | 1 | 1 | **0** |
| 28 — Mission Control 2.0 Layout | PASS-WITH-DEFERRED-5 | b2f0300 | 9 | 4 (3 per-dispatch + 1 phase-level) | **5** |
| 29 — Agent + Codex Visibility | PASS-WITH-DEFERRED-3 | a861d95 | 4 | 1 (phase-level) | **3** |
| 30 — Startup + Cockpit Acceptance | PASS-WITH-DEFERRED-2 | 8ee945e | 3 | 1 (phase-level) | **2** |

**Total final backlog: 10 rows**. Zero edge_guard_miss. Zero CRIT. Zero CANDIDATE-WITH-DEBT.

### Codex rerun (post-self-test fix)

The self-test probe `super-gsd/scripts/codex-exec.sh --self-test` was lying:
Probe 2 (auth) checked for `~/.codex/config.json` but Codex CLI 0.x had moved
to `~/.codex/config.toml`. Codex was actually authenticated (`codex login
status` → "Logged in") and reachable. **8 backlog rows that read
"Codex unavailable" were filed under a false cause.**

Fix sequence (per architectural rule: provider-related backlog clears only
when missing review evidence is produced — not by fixing the cause):

1. Replaced Probe 2 with behavioral check (`codex login status` primary,
   contract canary secondary); file checks demoted to diagnostic-only
2. Built `super-gsd/tools/provider-health/check.cjs` (--self-test 14/14)
3. Built `super-gsd/tools/backlog-schema/check.cjs` (--self-test 11/11)
4. Built `super-gsd/tools/codex-rerun/rerun-missing-reviews.cjs`
5. Re-ran 8 missing Codex ATC reviews — 8/8 PASS with the contract
6. **Phase 28 T1 Codex review surfaced a real CRIT** Claude reviewer missed:
   "status emits `shipped-with-debt`, violating the documented closed
   8-state vocabulary." Fixed at commit a39204b — `complete` state stays
   in the vocab; debt is signaled via missionColor=Yellow + suffix
7. 8 `kind: cleared` rows appended to crit-backlog.jsonl referencing the
   evidence path (commit-reviews.jsonl per phase)
8. Status-consistency PASS at every phase + milestone level after status updates

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

### Codex review (cleared) — 8 rows resolved post-rerun
All 8 "Codex unavailable" rows that were filed under the false self-test
auth probe have now been cleared. Each was resolved by rerunning the actual
missing review and appending the evidence to the appropriate
`commit-reviews.jsonl`. Cleared rows reference the original ID in
`crit-backlog.jsonl` with `kind: cleared`.

### Phase_atc WARN/NIT (10 unresolved)
- T1 unused `$StateOverride` param (Phase 28; YAGNI; frozen in API)
- T2 insertion-vs-replacement title-bar (Phase 28; PLAN preserved title bar; DISCUSS 28.1 said replace; reasonable ambiguity)
- T2 `$CLEAR_LINE` scope comment cosmetic (Phase 28)
- PLAN truth #4 text contradicts shipped (Phase 28; says silent-skip, code hard-fails — text-only correction)
- Deployed hook `~/.claude/hooks/sgsd-activity-logger.js` re-install untracked (Phase 28; live stamping remains corrupted until manually re-installed)
- Path schema drift (Phase 29; PLAN said `super-gsd/scripts/tests/`, executor shipped at `super-gsd/tests/mission-strip/`)
- MUDA codex_qualitative_waste — fixture overproduction (Phase 29)
- $StateOverride frozen in API (Phase 29 carry-forward)
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

1. **Re-install deployed hook**: copy `super-gsd/hooks/sgsd-activity-logger.js` → `~/.claude/hooks/sgsd-activity-logger.js`. After this, live activity-log rows stamp correctly. (Codex auth was already fine; the previous run's "restore Codex auth" item was a false-cause artifact of the broken self-test probe.)
2. **v1.7 docs cleanup**: BOOT-03 README quick-start block; PLAN truth #4 text correction; path schema doc update.
3. **Optional: review 10 remaining backlog rows** for v1.7-class fixes (`$StateOverride` removal, Q5 agent-freshness implementation, fixture trim, etc.).

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
node super-gsd/scripts/lib/crit-backlog.cjs --list  # 10 unresolved rows (post-rerun) tagged across phases 28-30
node super-gsd/tools/backlog-schema/check.cjs       # validate row schema

# 8. Provider health (behavioral)
node super-gsd/tools/provider-health/check.cjs --self-test
node super-gsd/tools/provider-health/check.cjs --provider codex --behavioral
```

## v1.7 readiness

v1.7 (Stable Command Contracts + Route Intelligence; Phases 31-35) is the
next milestone. Audit warning: 4 contracts already exist (review-providers,
handover-contract-v2, plan-schema-v2, code-reviewer-v1); v1.7 must NOT
collide. The DISCUSS file already locks v1.7 design decisions per the
mass-table.

Carry-forward into v1.7 (post-rerun, 10 rows):
- BOOT-03 README quick-start (could be folded into v1.7 Phase 35 generated-system-map work)
- $StateOverride YAGNI removal (Phase 28 carry-forward)
- Q5 agent-freshness gating (Phase 30 finding)
- Deployed hook re-install (operator action, not a v1.7 phase)
- 6 minor cosmetic/doc-fix WARNs across phases 28-29

(Codex auth was actually fine — the original "Codex unavailable" rows were
filed under a false cause; all 8 cleared via post-hoc rerun on commits
a39204b/21ecbba.)

## Status

`SHIPPED-WITH-DEBT-10` — v1.6 functionally complete; 10 deferred items
tracked in `.planning/metrics/crit-backlog.jsonl`. Status-consistency PASS
at every phase + milestone level. Zero edge_guard_miss. Zero CRIT.
Zero CANDIDATE-WITH-DEBT.
