---
phase: 29
title: Agent + Codex Visibility Lanes — Research
researched: 2026-04-26
domain: cockpit Mission Strip Q5/Q6 lane verification
confidence: HIGH (Q6 lib-side), MEDIUM (Q5 — empirical verification gated on hook re-install per Phase 28 deferred row)
controlling_principle: Autonomy continues; evidence tells the truth.
upstream_sources:
  - super-gsd/scripts/lib/sgsd-mission-strip.ps1                 # the Phase 28 lib being audited
  - super-gsd/scripts/sgsd-codex-monitor.ps1                     # full Codex pane (already on disk)
  - super-gsd/hooks/sgsd-activity-logger.js                      # post-Phase-28 source-of-truth for phase stamper
  - .planning/discussions/2026-04-26-mass-discuss.md             # DISCUSS 29.1 + 29.2
  - .planning/milestones/v1.6/phases/26-cockpit-question-contract/26-01-operator-question-contract-PLAN.md  # Q5/Q6 contract
  - .planning/milestones/v1.6/phases/27-cockpit-data-tree/27-01-cockpit-data-contract-PLAN.md               # data sources
  - .planning/milestones/v1.6/phases/28-mission-control-layout/28-VERIFICATION.md                           # Phase 28 status (PASS-WITH-DEFERRED-9)
  - .planning/metrics/codex-live.json                            # live state at research time
  - .planning/metrics/activity-log.jsonl                         # live rows at research time
---

# Phase 29 — Agent + Codex Visibility Lanes — Research

> Phase 29 is **NOT a rewrite**. It is an audit + targeted hardening of the
> Phase 28 lib `super-gsd/scripts/lib/sgsd-mission-strip.ps1` for the Q5
> (agents) and Q6 (codex) lanes, plus DISCUSS 29.1 (1h codex stale) and
> DISCUSS 29.2 (current-phase-only agent scope) verification.

---

## User Constraints (from CONTEXT — locked)

### Locked Decisions

- **DISCUSS 29.1:** Codex stale threshold = **1 hour** mtime delta on `.planning/metrics/codex-live.json`. The stale band overrides the in-file `state` field.
- **DISCUSS 29.2:** Agents pane is **current-phase-only**. Global `last-6h` scope is removed. Filter `activity-log.jsonl` rows where `String(row.phase) === String(activePhase)` AND `/^[0-9]+$/.test(row.phase)`.
- **Phase 26 §Q5/§Q6 contract:** verbatim from `26-01-operator-question-contract-PLAN.md` §Q5/§Q6. Phase 29 does not re-define vocabulary, freshness, or repair-path discipline — those are owned by Phase 26.
- **Phase 27 §Stamping Spec rule 8 (consumer-side):** strict `^[0-9]+$` validation on `row.phase` is mandatory; corrupt or null rows render Q5 `unavailable`.
- **Phase 28 §Mission Strip lib API:** `Get-MissionStripState($ProjectDir, $ActivityTail, $StateOverride, $PhaseOverride)` is locked. Phase 29 must edit *inside* that signature, not redesign it.

### Claude's Discretion

- Per-lane label wording within the closed 8-state vocabulary (active, waiting, blocked, reviewing, timed-out, stale, complete, unavailable).
- Truncation widths for codex/agents portions of the codexAgents row (currently 60 char agents-side; ASCII-safe `_Truncate-Ascii` helper).
- Color choice within the existing 16-color palette already used by the strip.
- Test-fixture shape for golden-file verification.

### Deferred Ideas (out of scope for Phase 29)

- Rewriting the strip lib (Phase 28 owns its shape).
- Adding new metric streams (DISCUSS 27.1 = NO).
- Backfilling the 5,727 corrupt activity-log rows (Phase 27 §Backwards-Compat = no retroactive cleanup).
- Re-installing the deployed hook at `~/.claude/hooks/sgsd-activity-logger.js` (Phase 28 deferred row #9; runtime, not Phase 29 code work).
- Cross-milestone or cross-phase Codex aggregation (Q6 is single-active-phase scoped).

---

## Phase Requirements (from upstream)

| ID | Description | Research support |
|----|-------------|------------------|
| REQ-29-Q5 | Mission Strip agents portion shows ≥1 agent slug for active phase when `activity-log.jsonl` has stamped rows | §"Q5 Empirical Verification" + §"Q5 Lib Audit" |
| REQ-29-Q5-EMPTY | When no stamped rows exist for active phase, agents portion renders `"--"` (truncated empty) and codexAgents color falls back per codex-state | §"Q5 Lib Audit" line 288 |
| REQ-29-Q5-SCOPE | Filter MUST be current-phase-only; pre-stamp / cross-phase rows MUST NOT bleed in (DISCUSS 29.2) | §"Q5 Lib Audit" line 200-202 |
| REQ-29-Q6 | Mission Strip codex portion maps `codex-live.json.state` to closed vocabulary with mtime band override | §"Q6 Lib Audit" lines 254-285 |
| REQ-29-Q6-STALE | mtime ≥ 3600s (1h) renders codex label `"stale"` regardless of state field (DISCUSS 29.1) | §"Q6 Lib Audit" line 266 |
| REQ-29-Q6-LINK | Strip codex 1-line summary does NOT duplicate full `sgsd-codex-monitor.ps1` pane content | §"Pane Linkage" |

---

## Architectural Responsibility Map (Q5 + Q6 only)

| Capability | Primary owner (post-Phase-29) | Existing owner | Rationale |
|------------|-------------------------------|----------------|-----------|
| Q5 agents 1-line summary (current-phase scoped) | Mission Strip line 5 (codexAgents row, agents portion) | Phase 28 lib (already implemented) | Phase 29 audits + tightens; no relocation |
| Q5 full agent log / role resolution | `sgsd-narrative.ps1` body pane (existing) | unchanged | Strip surfaces, narrative provides detail |
| Q6 codex state 1-line summary | Mission Strip line 5 (codex portion) | Phase 28 lib (already implemented) | Phase 29 audits + tightens; no relocation |
| Q6 full codex pane (state + report path + summary + history) | `sgsd-codex-monitor.ps1` (existing, 29550 bytes, last touched 2026-04-24) | unchanged | Strip is 1-line link; full pane is authoritative |

**Linkage:** the strip's codex portion shows state + label only; the operator opens `sgsd-codex-monitor.ps1` for `report_path`, `started_at`, `duration_ms`, prompt brief, verdict counts, history rows. **No data duplication** — the strip cites the same `.planning/metrics/codex-live.json` mtime + state field that the full pane does.

---

## Q6 Lib Audit (codex portion)

**Code under review:** `super-gsd/scripts/lib/sgsd-mission-strip.ps1` lines 251–299.

### Behaviors verified against Phase 26 §Q6 + DISCUSS 29.1

| Behavior | Lib lines | Phase 26 / DISCUSS expectation | Verdict |
|----------|-----------|--------------------------------|---------|
| Reads `.planning/metrics/codex-live.json` mtime + parses `state` field | 258-264 | Phase 27 §Data Source Matrix Q6 row | PASS |
| Computes `deltaSec = (now - mtime).TotalSeconds` as integer | 261 | Phase 26 §Freshness `Δ` semantics | PASS |
| Stale band override at `Δ ≥ 3600` regardless of state field | 266-269 | DISCUSS 29.1 (verbatim "1 hour mtime") | PASS — sets `codexState=stale`, `codexLabel="stale"` |
| Active band at `Δ < 120` AND `state=running` | 270-272 | Phase 26 §Freshness Codex row "<120s active(running)" | PASS |
| Mid-band (`120 ≤ Δ < 3600`) defers to state field via switch -Regex | 273-284 | Phase 26 §Freshness Codex row "120-3599s state-field decides" | PASS |
| Closed-vocabulary mapping for `state` values | 275-282 | Phase 26 §Status Vocabulary 8 closed states | PASS — see table below |
| Color assignment per closed state | 290-299 | Phase 26 §Status Vocabulary terminal/non-terminal | PASS |
| Defaults to `unavailable` when codex-live.json missing | 256, 286 | Phase 26 §Q6 empty_state | PASS — initial `$codexState="unavailable"`, `$codexLabel="--"` survives |

### State-field → closed-vocabulary mapping (lib lines 275-282)

| `codex-live.json.state` value | Lib regex match | `codexState` (closed) | `codexLabel` (label) | Verdict vs. Phase 26 §Q6 |
|-------------------------------|-----------------|------------------------|----------------------|--------------------------|
| `running` | `^running$` | `active` | `running` | PASS |
| `reviewing` | `^reviewing$` | `reviewing` | `reviewing` | PASS |
| `timeout`, `timed-out` | `^(timeout\|timed-out)$` | `timed-out` | `timed-out` | PASS |
| `ok`, `ready`, `done`, `success` | `^(ok\|ready\|done\|success)$` | `complete` | `ready` | PASS (label drift acknowledged below) |
| `error`, `auth-denied`, `contract-violation` | `^(error\|auth-denied\|contract-violation)$` | `blocked` | `<rawState>` | PASS |
| `not-fired`, `idle` | `not-fired\|^idle$` | `waiting` | `idle` | PASS |
| anything else | `default` | `waiting` | `<rawState>` | PASS — degrades to safe waiting |

### Acknowledged label drift (intentional, not a gap)

The full `sgsd-codex-monitor.ps1` pane uses raw state names (`OK`, `RUNNING`, etc.) per `Get-CodexStatusSummary` (lines 140–154 of the monitor). The strip's regex deliberately maps `ok` → label `"ready"` to align with operator-readable English. **This is a presentation choice, not a data inconsistency** — both surfaces read the same state field; the strip applies a translation layer for compactness.

### Live snapshot (research-time, 2026-04-27 ~00:22Z)

```
codex-live.json mtime: 2026-04-26 23:06Z  →  Δ ≈ 1h 16m  →  Δ ≥ 3600s
expected strip render: codex stale  > agents <agents>
expected color:        DarkGray (stale band)
```

The lib's stale band override (line 266) governs. The in-file `state="ok"` is intentionally suppressed — the worker has not refreshed the heartbeat for over an hour, so Codex is treated as stale regardless of last reported state. **DISCUSS 29.1 is honored by the existing Phase 28 lib code without modification.**

### Q6 gaps inventory

| Gap | Severity | Phase 29 action |
|-----|----------|-----------------|
| Lib does not emit `report_path` link in the strip | NONE — by design | Strip is 1-line; report_path lives in `sgsd-codex-monitor.ps1`. No action. |
| Lib does not surface Codex `duration_ms` | NONE — by design | Same reason. No action. |
| Lib's switch-regex `not-fired\|^idle$` is not anchored on the `not-fired` branch — would also match `not-fired-yet` etc. | LOW | Tighten to `^(not-fired\|idle)$` for symmetry with neighboring branches. **Targeted edit candidate.** |
| Default branch (line 282) labels with raw state field — could leak unexpected long strings into the strip | LOW | Truncate via `_Truncate-Ascii ... 20` on the default-branch label. **Targeted edit candidate.** |
| No fixture-based test for stale-band override | MEDIUM | Add fixture under `super-gsd/scripts/tests/` exercising `(mtime=now-3700s, state="running")` → expect label `"stale"`. **Phase 29 test work.** |
| No fixture for default-branch fall-through | MEDIUM | Add fixture `(state="frobnicated")` → expect label truncated + `codexState=waiting`. **Phase 29 test work.** |

---

## Q5 Lib Audit (agents portion)

**Code under review:** `super-gsd/scripts/lib/sgsd-mission-strip.ps1` lines 192–213, 288–289.

### Behaviors verified against Phase 26 §Q5 + DISCUSS 29.2

| Behavior | Lib lines | Phase 26 §Q5 / DISCUSS 29.2 expectation | Verdict |
|----------|-----------|------------------------------------------|---------|
| Reads `.planning/metrics/activity-log.jsonl` via shared cache | 154-160 | Phase 27 §Cockpit Derivation Rule 7 (tail-bounded reads) | PASS |
| Tail bound configurable via `$ActivityTail` (default 500) | 35, 158 | Phase 27 §Cockpit Derivation Rule 7 | PASS |
| Filters rows where `row.phase === activePhase` (string compare) | 199-202 | DISCUSS 29.2 + Phase 27 §Stamping Spec rule 8 | PARTIAL — string compare via `-ne` works but does not strictly enforce `/^[0-9]+$/` on row.phase |
| De-duplicates `subagent_type` to a stable list | 198, 204-207 | Phase 26 §Q5 "agents dispatched in current phase" | PASS |
| Skips rows with null/empty `subagent_type` | 203-204 | Phase 26 §Q5 (Q5 is about agents, not all tools) | PASS |
| Skips rows where `subagent_type === "null"` (string-coerced PowerShell artifact) | 203 | implicit — `"$($e.subagent_type)"` of JSON null becomes `""`; explicit `"null"` guard catches PS5.1 string-coercion edge | PASS |
| Truncates joined name list to 60 chars with ASCII `~` marker | 209-210 | Phase 26 §Q5 (1-line strip cap) + ASCII guard | PASS |
| Renders `"--"` when no rows match | 288 | Phase 26 §Q5 empty_state | PASS — `$agentsList=""` → `$agentsPart="--"` |
| Excludes rows where row.phase does not match `^[0-9]+$` | (implicit only) | Phase 27 §Stamping Spec rule 8 (consumer-side mandate) | **GAP — see below** |

### Q5 gaps inventory

| Gap | Severity | Phase 29 action |
|-----|----------|-----------------|
| **Lib filter does not explicitly reject row.phase values that fail `/^[0-9]+$/`** — relies on inequality with `$out.activePhase` (which is itself stamped clean by the Phase 28 stamper fix). For an active phase like `"29"`, a corrupt row carrying `"\"26\":"` will simply not match `-ne "29"` and is dropped. **Behaviorally correct today, but not defensive against the consumer rule mandated by Phase 27 §Stamping Spec rule 8.** | MEDIUM | Add explicit guard: `if ($rowPhase -notmatch '^[0-9]+$') { continue }` between current lines 200-201. **Targeted edit candidate — single line.** |
| `$rowPhase = "$($e.phase)"` coerces `null` to empty string `""`, which then `-ne $out.activePhase` correctly drops the row. **Behaviorally correct.** Documenting only because the next reviewer will look at it. | INFO | None. Documentation in §"Subtle correctness". |
| No agent role/status/last-artifact resolution (per Phase 26 §Q5 "agents dispatched + last status/artifact") | LOW | The strip is **1-line**; full role/status/artifact lives in `sgsd-narrative.ps1` body pane (per ARM table). The strip surfaces slugs only by design. **No action — consistent with Q6 strip-vs-pane split.** |
| No fixture-based test for current-phase filter | HIGH | Add fixture exercising mixed phases (rows for 26, 27, 28, 29) with active=29 → expect strip agents portion lists ONLY 29's agents. **Phase 29 test work.** |
| No fixture for corrupt-phase rejection (Phase 27 §Stamping Spec rule 8) | HIGH | Add fixture with row carrying `phase: "\"29\":"` → expect row REJECTED even though string-truncation might appear to match. **Phase 29 test work.** |
| No fixture for empty case (no rows match) | MEDIUM | Add fixture with active=99 (no rows) → expect `> agents --`. **Phase 29 test work.** |
| **Empirical verification gated** on Phase 28 deferred row #9 (deployed hook re-install) | EXTERNAL | Live activity-log at research-time still writes corrupt `"phase":"\"26\":"` from the un-redeployed deployed hook. Source-of-truth at `super-gsd/hooks/sgsd-activity-logger.js` is fixed (verified — `readActivePhase` + anchored regex + `^[0-9]+$` guard at lines 72-91, 165-166). **Phase 29 verification path: use fixtures, not live data**, until hook is re-deployed. |

### Subtle correctness notes (for the planner)

1. The lib's `$rowPhase = "$($e.phase)"` PowerShell pattern produces `""` for JSON `null`, the literal string `"\"26\":"` for the corrupt-stamper output, and clean digits like `"29"` for post-fix rows. The downstream `-ne $out.activePhase` correctly drops the first two cases when active phase is e.g. `"29"`.
2. The proposed `-notmatch '^[0-9]+$'` guard is **defense-in-depth**, not a behavioral fix. Without it, the lib relies on the activePhase value being clean digits (which it is — Phase 28 stamps STATE.md and the lib reads STATE.md the same way). With it, the lib continues to render correctly even if a future regression corrupts STATE.md.
3. `$agentsList = ($names -join ",")` uses `,` as separator (no space). Phase 28 chose this for minimum width. **No action — operator-readable.**

---

## Pane Linkage (strip ↔ full Codex pane)

| Surface | Owner | Content |
|---------|-------|---------|
| Mission Strip line 5 — `> codex {label}  > agents {slugs}` | `super-gsd/scripts/lib/sgsd-mission-strip.ps1` | 1-line state summary; closed-vocabulary label; truncated agents list |
| `sgsd-codex-monitor.ps1` full pane | `super-gsd/scripts/sgsd-codex-monitor.ps1` (29550 bytes) | Status header, scope (phase/plan/step), state colored, started_at, duration, prompt brief, report fields (FINDINGS/CRITICAL/WARNINGS/PASS_RATE/ONE_LINER), recent history rows from `codex-log.jsonl` |
| `sgsd-narrative.ps1` body pane | (existing — out of Phase 29 scope) | Per-agent dispatch detail, role resolution from `agents.jsonl`, last artifact reference |

**No duplication.** The strip never writes a report path; the full pane never writes a 1-line stale-band summary. Both read the same source files. The strip is a *visibility lane*; the full pane is a *detail surface*. Phase 29 must NOT add report-path or duration text to the strip.

---

## Empirical Probes (research-time)

| Probe | Result | Interpretation |
|-------|--------|----------------|
| `ls codex-live.json` | mtime = 2026-04-26 23:06Z; size = 1418 bytes | Δ ≈ 1h 16m at research time → stale band |
| `cat codex-live.json` | `state: "ok"` (legacy from 2026-04-24 smoke); `phase: "21"`; report file is the smoke run | Stale state field — proves DISCUSS 29.1 override is the right call |
| `tail -5 activity-log.jsonl` | All 5 rows carry `"phase":"\"26\":"` | Deployed hook still pre-fix (Phase 28 deferred row #9). Lib's filter would correctly REJECT these rows when active phase is "29" — they fail string-equality. |
| `grep readActivePhase super-gsd/hooks/sgsd-activity-logger.js` | function exists at line 72; called at line 165; `/^[0-9]+$/` guard at line 166 | **Source-of-truth IS fixed.** Re-install the deployed hook and Q5 will work end-to-end. |
| `ls super-gsd/scripts/sgsd-codex-monitor.ps1` | 29550 bytes, last touched 2026-04-24 | Full pane is on disk, untouched by Phase 28; no Phase 29 code edits required to it |
| `ls .planning/milestones/v1.6/phases/29-agent-codex-lanes/` | empty | Phase 29 deliverables not yet written; this RESEARCH.md is the first |

---

## Phase-29-Specific Gap Inventory

### Required code edits (lib hardening — single file: `sgsd-mission-strip.ps1`)

1. **Q5 defensive guard (lines 199-202):** insert `if ($rowPhase -notmatch '^[0-9]+$') { continue }` after `if (-not $rowPhase) { continue }`. Single line; honors Phase 27 §Stamping Spec rule 8 explicitly.
2. **Q6 default-branch truncation (line 282):** wrap `$rawState` label with `_Truncate-Ascii ... 20` so a malformed state field cannot blow out the strip width.
3. **Q6 not-fired anchoring (line 281):** change `'not-fired|^idle$'` to `'^(not-fired|idle)$'` for symmetry with neighbor branches. Behavior change is zero for current state values; defense against future state names that contain `not-fired-X`.

These three edits are surgical, total ~3 lines added/modified.

### Required test fixtures (under `super-gsd/scripts/tests/` per Phase 28 PATTERNS.md scaffold)

| Fixture | Inputs | Expected strip output |
|---------|--------|------------------------|
| F1: codex stale band | codex-live mtime=now-3700s, state="running" | `> codex stale` (DISCUSS 29.1) |
| F2: codex active | mtime=now-30s, state="running" | `> codex running` |
| F3: codex reviewing | mtime=now-200s, state="reviewing" | `> codex reviewing` |
| F4: codex timed-out | mtime=now-200s, state="timeout" | `> codex timed-out` |
| F5: codex complete | mtime=now-200s, state="ok" | `> codex ready` (label drift documented) |
| F6: codex unavailable | codex-live.json absent | `> codex --` |
| F7: codex unknown state | mtime=now-200s, state="frobnicated" | `> codex frobnica~` (truncated default branch) |
| F8: agents current-phase only | rows for phases 26, 27, 28, 29 mixed; active=29 | `> agents <only-29-agents>` |
| F9: agents corrupt-phase rejection | row with phase=`"\"29\":"`; active=29 | row REJECTED, `> agents --` |
| F10: agents empty | active=99, no rows | `> agents --` |
| F11: agents dedup | 5 rows same agent slug, active phase | agent listed once |
| F12: agents truncation | 30 unique agents, all active phase | comma-joined, truncated to 60 chars + `~` |

### Documentation updates

- Update `28-PATTERNS.md` test scaffold note: extend with Q5/Q6 fixtures.
- Update `28-VERIFICATION.md` deferred row #9 — Phase 29 verifier should NOT remove this row; it's a runtime dependency that lives until operator re-deploys the hook.

### Out of scope for Phase 29

- Re-installing the deployed hook (operator action, Phase 28 deferred runtime).
- Rewriting `sgsd-codex-monitor.ps1` (Phase 28 left it untouched; Phase 29 confirms no edits needed).
- Backfilling 5,727 corrupt activity-log rows (Phase 27 §Backwards-Compat lock).
- Adding report-path / duration / verdict to the strip (pane-vs-strip split).

---

## Open Questions for the Planner

1. **Should Phase 29 plan include a "redeploy hook" wave 0 task?** Recommendation: **NO**. The deployed hook re-install is an operator runtime step, not a phase deliverable. Phase 28 already filed it as a backlog row. Phase 29 should plan around fixture-based verification and let the deferred row stay open until operator action. (Cited Phase 28 §Step 9 deferred row #9.)

2. **Should the test scaffold be Pester or plain `.ps1` smoke runs?** Recommendation: **plain `.ps1` smoke runs** matching Phase 28 §`Render-MissionStrip` smoke — keeps the test surface consistent and avoids new dev-tool dependencies for v1.6. Pester is a v1.7+ consideration.

3. **Should Q5 surface agent *role* (e.g., `gsd-phase-researcher` vs `executor`) or only the slug?** Recommendation: **slug only on the strip** (current behavior). Role + last-artifact resolution belongs in the body narrative pane per the ARM table. The strip is 1-line by contract.

4. **Should Q6 distinguish between `error`, `auth-denied`, `contract-violation` in the label?** Recommendation: **YES (current behavior)** — the lib renders the raw state field as the label for these three (line 280, `$codexLabel = $rawState`), so the operator sees which failure mode hit. closedState is `blocked` (red) for all three. **Current behavior is correct.**

5. **Should the strip retry-read codex-live.json if the first ConvertFrom-Json fails (truncated mid-write)?** Recommendation: **NO**. Phase 28 wraps the parse in try/catch with empty-default; the lib will render `unavailable` for one tick, then refresh in 10s. Adding retry doubles the read amplification for a 1-second visual blip. Honest unavailable is correct.

---

## Kill / Defer Conditions

Phase 29 should **STOP and reverse course** if any of the following surface during planning or implementation:

| Trigger | Action |
|---------|--------|
| Audit reveals the Phase 28 lib is fundamentally wrong on Q5 or Q6 (not just hardening gaps) | Stop. File CRIT row. Reopen Phase 28 with a follow-up plan, not a Phase 29 patch. |
| DISCUSS 29.1 or 29.2 is contradicted by a downstream phase's needs | Stop. Operator escalation per `.planning/discussions/UNRESOLVED-QUESTIONS.md`. |
| Test fixtures reveal the lib's filter passes corrupt rows when active phase is also corrupt | Treat as Phase 28 follow-up, not Phase 29. The Phase 28 stamper is the source-of-truth — fixing the lib without fixing the stamper masks the bug. |
| `sgsd-codex-monitor.ps1` is found to require edits | Stop. Reassess pane-vs-strip split. Phase 29 must not modify the full pane. |
| Phase 29 lib edits exceed ~10 lines total | Stop. Re-review §"Required code edits" — anything more is a redesign and belongs in a new phase. |

Defer conditions (continue Phase 29 with degraded scope):

| Trigger | Action |
|---------|--------|
| Operator does not re-deploy the activity-logger hook before Phase 29 verifier runs | Verify against fixtures only. Note in VERIFICATION.md that live empirical verification is deferred to operator-runtime. Phase 29 status: PASS-WITH-DEFERRED-1 (carry forward Phase 28's row #9). |
| Codex live-auth still unavailable | Skip Q6 live empirical probe. Use fixture F1-F7 only. Note in VERIFICATION.md. |

---

## Sources

### Primary (HIGH confidence)

- `super-gsd/scripts/lib/sgsd-mission-strip.ps1` lines 192-213 (Q5 logic), 251-299 (Q6 logic), 288-289 (composition) — read in full this session.
- `super-gsd/hooks/sgsd-activity-logger.js` lines 72-91 (`readActivePhase`), 165-166 (call site + guard) — read in full this session.
- `super-gsd/scripts/sgsd-codex-monitor.ps1` lines 130-220 (Get-CurrentPhaseNum, Get-CodexStatusSummary, Get-CodexReportFields) — read this session.
- `26-01-operator-question-contract-PLAN.md` §Q5, §Q6, §Status Vocabulary, §Freshness Boundaries — read in full.
- `27-01-cockpit-data-contract-PLAN.md` §Data Source Matrix Q5/Q6 rows, §Stamping Spec rule 8 — read in full.
- `28-VERIFICATION.md` — Phase 28 status PASS-WITH-DEFERRED-9 with deferred row #9 (deployed hook re-install).
- `.planning/discussions/2026-04-26-mass-discuss.md` table rows 29.1 + 29.2 — read.

### Secondary (MEDIUM confidence)

- `.planning/metrics/codex-live.json` (live snapshot at research time, 2026-04-24 smoke run, 1h+ stale) — proves the stale-band override path is correct.
- `.planning/metrics/activity-log.jsonl` last 5 rows (live, all carry corrupt `"phase":"\"26\":"` from un-redeployed hook) — proves consumer-side guard matters.

### Tertiary (LOW — none required)

No web search or external docs needed; entire research scope is internal repo audit.

---

## Confidence Breakdown

| Area | Level | Reason |
|------|-------|--------|
| Q6 lib correctness | HIGH | Code read in full; mapping table verified line-by-line; live snapshot confirms stale-band override fires as designed. |
| Q5 lib correctness (current-phase filter) | HIGH | Code read in full; PowerShell string-coercion edges traced; defensive guard identified as hardening, not bug-fix. |
| Q5 empirical end-to-end verification | MEDIUM | Gated on Phase 28 deferred runtime row #9. Fixture path is reliable; live path is operator-blocked. |
| Pane linkage (strip ↔ full Codex pane) | HIGH | Both files read; no overlap in surfaced fields. |
| Phase 29 gap inventory completeness | HIGH | Three lib edits + 12 fixtures named; planner has executable scope. |
| DISCUSS 29.1 / 29.2 verbatim adherence | HIGH | Both decisions cited in §"User Constraints" and traced through lib lines. |

**Research date:** 2026-04-26
**Valid until:** 2026-05-26 (lib + contract are stable; only the deployed hook re-install can shift Q5 empirical reality)
