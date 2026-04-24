# Phase 19: Mission Control Visibility — Context

**Gathered:** 2026-04-24 (inline from REQUIREMENTS.md + Phase 17/18 accumulation)
**Status:** Ready for research
**Milestone:** v1.4 — Clean Close + Codex Visibility + Autonomous Handoff

<domain>
## Phase Boundary

Complete the Codex→operator feedback loop. Phase 17 shipped MC visibility FOUNDATIONS (Codex Monitor pane, narrative CODEX line, mission-control Codex status loading, heartbeat hook, gate-verdict board). Phase 18 produced the RAW TELEMETRY (codex-live.json + codex-log.jsonl + commit-reviews.jsonl across 8 invocations). Phase 19 finishes the feedback loop by wiring that telemetry into the 5 remaining MC surfaces — mission-control tile, statusline indicator, narrative event capture, live-feed interleaving, dashboard offload metrics.

**5 items in scope (REQUIREMENTS.md MC-01..05):**
- MC-01: `sgsd-mission-control.ps1` → Codex tile from codex-live.json + codex-log.jsonl
- MC-02: `sgsd-statusline.ps1` → `⚙ codex:idle/running/timeout/error/fallback` indicator
- MC-03: `sgsd-narrative.ps1` → write Codex event entries into `narrative.md` (latest + lastfail)
- MC-04: `sgsd-live-feed.ps1` → tail `codex-log.jsonl` alongside `activity-log.jsonl`
- MC-05: `sgsd-dashboard.ps1` → Multimodal Review Offload tile (tokens saved, invocations, fallback_rate, avg_duration)

**Early credit already shipped (from Phase 17 session, commits e0c74c7 + df17733):**
- Codex Monitor pane RECENT VERDICTS section reading commit-reviews.jsonl — partial MC-05 ancestor (dashboard-tile-shaped data already aggregated)
- Narrative `> CODEX` line + CODEX tool-color + CODEX prefix on Bash commands — partial MC-03 (summary line exists; full event capture into narrative.md fields remains)
- Mission Control pane loads lib/sgsd-codex-status.ps1 + Get-CodexCommitCount — partial MC-01 (status helper wired; dedicated tile remains)
- sgsd-heartbeat.js PostToolUse hook + settings-overlay entry — supporting infrastructure
- sgsd-gate-verdict.ps1 (P5 Gate Verdict Board, 279 new lines) — adjacent visibility surface, not directly MC-* scope but operational

**Non-goals:**
- New telemetry sources — v1.4 Codex telemetry (codex-live.json, codex-log.jsonl, commit-reviews.jsonl) is complete and authoritative. Phase 19 consumes, not produces.
- New visualization frameworks — extend existing PS scripts only.
- Web dashboards — cockpit/terminal surfaces only.
- Mobile or external reporting — scope-disciplined out.

## Phase 18 deferral queue (Phase 19 sub-scope: richer-output-contract)

Phase 17 + 18 accumulated 9 WARNINGs, all sharing root-cause of the 5-line Codex contract hiding finding detail:

1. awk anchor brittleness in muda-audit qualitative insert (Phase 17)
2. T1 providers-registry JSDoc narrative drift (Phase 17)
3. step-name tier calibration — phase-level-ATC should map to analysis (Phase 17)
4. Richer output contract for phase-level Codex reviews (Phase 17)
5. Dual-gate timeout policy (Phase 17)
6. self-test exit precedence audit (Phase 18)
7. parse-fallback gating edge-case coverage (Phase 18)
8. dogfood audit strictness (Phase 18)
9. parse-rigor test corpus (Phase 18)

**Phase 19 scope decision (D-05 below):** tackle #3, #4, #5, #6, #7, #9 — the ones that touch Codex output contract or parse/dispatch hygiene. Defer #1, #2, #8 to Phase 21 post-v1.4 work.

</domain>

<decisions>
## Implementation Decisions (locked inline)

### D-01: 2 plans by surface character
- **19-01 Core tiles + statusline** (FULL tier): MC-01 mission-control Codex tile + MC-02 statusline indicator + MC-05 dashboard offload metrics. All three touch PS scripts at terminal-UI layer.
- **19-02 Event capture + live feed + richer-output hardening** (FULL tier): MC-03 narrative.md Codex event writes + MC-04 live-feed codex-log.jsonl interleave + address Phase 18 deferred WARNINGs #3-#7 (step-name tier recal, FINDINGS_DETAIL optional contract lines, validateContract regex tightening, dual-retry timeout policy).

Serialize 19-01 → 19-02. Plans independent at the tile level, but 19-02 wants 19-01's MC-01 tile live as proof surface before richer-output contract rolls out (so operator sees the new signals immediately).

### D-02: MC-01 tile layout (mission-control Codex section)
Adopt Codex Monitor pane's RECENT VERDICTS shape but compressed to 3 rows for mission-control density. Tile header shows state (idle/running/timeout/error/fallback) with updated_age_sec. Last 3 invocations: `plan | tier | c=N w=N | one_liner`. Explicit metrics row: `invocations={N} | avg_duration={Ns} | fallback_rate={P%}`.

Reads:
- `.planning/metrics/codex-live.json` → current state + updated_at
- `.planning/metrics/codex-log.jsonl` tail 5 → invocations/duration/exit
- commit-reviews.jsonl across milestone phase dirs → one_liners + verdicts

### D-03: MC-02 statusline segment shape
5 discrete states with glyph + color:
- `⚙ codex:idle` (Gray) — no active run
- `⚙ codex:running [Ns]` (Yellow) — mid-flight, N = seconds since start
- `⚙ codex:timeout` (Red) — last run hit 124
- `⚙ codex:error` (Red) — last run non-zero other
- `⚙ codex:fallback` (DarkYellow) — last run triggered GATE_PROVIDER_FALLBACK

State read from codex-live.json (single source of truth). 5-10Hz refresh tolerable — statusline already polls.

### D-04: MC-03 narrative.md event schema
Narrative.md has `latest` (current focus) + `lastfail` (most recent failure) + an event list. Phase 19 adds Codex event writers:
- `codex_started`: appends to event list with ts + scope (phase/plan/step)
- `codex_completed`: appends with ts + duration_ms + verdict summary (from commit-reviews.jsonl row the invocation produced) + updates `latest` to reflect new completion
- `codex_timeout`: appends + updates `lastfail`
- `codex_fallback`: appends + updates `lastfail` (even though orchestrator continues, the fallback is a signal)

Integration point: either codex-exec.sh writes an event shim (simple) or orchestrator dispatches a narrative writer post-codex (cleaner boundary). D-04 locks: **codex-exec.sh writes events directly** — eliminates orchestrator coupling, matches pattern of codex-log.jsonl already being codex-exec.sh's responsibility.

### D-05: Phase 18 deferral queue sub-scope
Phase 19 addresses the 6 deferrals that touch output contract / parse hygiene / dispatch policy:
- #3 step-name tier recalibration (phase-level-ATC → analysis tier in the resolver map)
- #4 Richer output contract — **optional FINDINGS_DETAIL: lines**. Codex prompts gain a trailing instruction: "After the 5 required lines, optionally emit `FINDINGS_DETAIL:` lines — one per finding, format `[severity] [dimension] <description>`." Orchestrator validateContract accepts but does not require. ATC-REVIEW.md artifacts render them if present.
- #5 Dual-gate timeout policy — if `--timeout-tier review` hits exit 5, auto-retry once with `analysis` tier before falling back to Claude. codex-exec.sh gains `--retry-on-timeout-escalate` flag (default off for now); SKILL.md phase-level-ATC gate enables it explicitly.
- #6 self-test exit precedence — document the current behaviour (PATH wins over auth when both fail) in codex-exec.sh comments, add a `--self-test-exit-priority` diagnostic flag that exits 0 with a table showing probe order.
- #7 parse-fallback gating — validateContract gains stricter regex (FINDINGS must parse as integer, PASS_RATE must match `\d+/\d+`, CRITICAL/WARNINGS must be non-negative integers). Malformed values → parse_failure fallback (same path as missing fields).
- #9 parse-rigor test corpus — `super-gsd/tests/codex-contract-fixtures/` dir with 6 malformed-contract fixtures + `bash super-gsd/tests/run-parse-fuzz.sh` runner that feeds each to validateContract and asserts parse_failure is correctly detected. Plug into CXOPS-01 self-test probe #5 (optional extension).

**Deferred to Phase 21 / post-v1.4 (not Phase 19 scope):**
- #1 awk anchor brittleness (muda-audit qualitative insert) — MUDA calibration work stream
- #2 T1 providers-registry JSDoc narrative drift — minor, accept
- #8 dogfood audit strictness — audit doc methodology, not code

### D-06: MC-04 live-feed interleave scheme
`sgsd-live-feed.ps1` currently tails `activity-log.jsonl`. Phase 19 adds a second tail source (`codex-log.jsonl`) with distinct prefix and color. Event arrival order preserved (merged by timestamp). Legend line explains prefixes. Keep existing activity-log rendering untouched.

### D-07: MC-05 dashboard tile metrics
`claude_tokens_saved_by_codex`: sum of est_input + est_output from token-log.jsonl rows where `model = "codex"` (proxy — actual Codex tokens not visible to us, so "tokens saved" = estimate of what Claude would have used on the same prompt)
`codex_invocations_this_milestone`: count of codex-log.jsonl rows where ts within milestone boundary
`fallback_rate`: % of codex-log.jsonl rows with `fallback_triggered=true`
`avg_codex_duration_ms`: mean(duration_ms) from codex-log.jsonl rows this milestone

Refresh cadence: on dashboard render (not live).

### Claude's Discretion
- Exact tile color palette for mission-control Codex section (coordinate with existing tile aesthetic)
- Exact glyph for statusline (⚙ vs 🔄 vs text `[Codex]`) — D-03 proposes ⚙, planner may suggest alternatives
- FINDINGS_DETAIL line format specifics (bracketed severity style vs indented bullets)
- Test fixture content for parse-rigor corpus (as long as 6 distinct failure modes covered)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements + roadmap
- `.planning/REQUIREMENTS.md` §MC-01..05 — AC verbatim
- `.planning/ROADMAP.md` §"Phase 19: Mission Control Visibility" — phase structure

### Source files in scope (19-01)
- `super-gsd/scripts/sgsd-mission-control.ps1` — MC-01 target (add Codex tile block; already loads sgsd-codex-status.ps1 from Phase 17 work)
- `super-gsd/scripts/sgsd-statusline.ps1` — MC-02 target (add Codex segment)
- `super-gsd/scripts/sgsd-dashboard.ps1` — MC-05 target (add Multimodal Review Offload tile)
- `super-gsd/scripts/lib/sgsd-codex-status.ps1` — helper already exposing Get-SgsdCodexStatus, Get-SgsdCodexEvents, Get-SgsdCodexLogRows, Get-SgsdCodexVerdicts. Phase 19 consumers.

### Source files in scope (19-02)
- `super-gsd/scripts/sgsd-live-feed.ps1` — MC-04 target (extend tail sources)
- `super-gsd/scripts/sgsd-narrative.ps1` — MC-03 narrative.md Codex event writers (already has narrative-rendering CODEX line from Phase 17; now ALSO writes narrative.md fields)
- `super-gsd/scripts/codex-exec.sh` — richer-output contract prompt footer (D-05 #4) + `--retry-on-timeout-escalate` flag (D-05 #5)
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` — validateContract regex tightening (D-05 #7) + phase-level-ATC gate recalibration (D-05 #3) + opt-in for timeout-escalate retry (D-05 #5)
- `super-gsd/tests/codex-contract-fixtures/*` — NEW parse-rigor fixture dir (D-05 #9)

### Telemetry sources (read-only)
- `.planning/metrics/codex-live.json` — current Codex lifecycle state
- `.planning/metrics/codex-log.jsonl` — 9 rows as of Phase 18 close (2 smoke/timeout + 8 real invocations)
- `.planning/metrics/activity-log.jsonl` — hook-written tool-call events
- `.planning/metrics/token-log.jsonl` — invocation token accounting
- `.planning/milestones/v1.4/phases/*/commit-reviews.jsonl` — per-ATC verdict rows

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`lib/sgsd-codex-status.ps1` helper** — already exposes Get-SgsdCodexStatus, Get-SgsdCodexEvents, Get-SgsdCodexLogRows, Get-SgsdCodexVerdicts. Phase 19 tiles use these directly; no new helpers needed.
- **Codex Monitor pane RENDER structure** — existing tile layout in `sgsd-codex-monitor.ps1` is the prototype for mission-control Codex section. Copy the rendering shape, compress to 3-row tile density.
- **codex-exec.sh append_jsonl** — usable for narrative event writes (D-04) via either a new sibling function `append_narrative_event` or reusing append_jsonl to a different file.

### Established Patterns
- **Atomic commit per task** — `feat(19-NN/TX): MC-NN ...`
- **ASCII-only shell strings** — Phase 17 learned PS 5.1 `ParseFile` misreads UTF-8 em-dash bytes; keep visible text ASCII-safe or add UTF-8 BOM (chose ASCII in Phase 17).
- **Node read-mutate-write for config/metrics** — never cat/head/echo.

### Integration Points
- **MC-01 tile** consumes `sgsd-codex-status.ps1` helpers → already loaded by mission-control per Phase 17 wiring — adding the tile is layout-only, no new imports
- **MC-03** event capture from codex-exec.sh — write events to BOTH codex-log.jsonl (existing) AND narrative.md event list (new) within same append path
- **MC-04** live-feed must not double-render codex events that already appear in activity-log via the hook — dedup by ts + command_kind
- **MC-05** dashboard tile should not duplicate sgsd-token-audit's metrics — reuse the same calculation functions where possible

</code_context>

<specifics>
## Specific Ideas

- Operator wants Codex + Claude "harmonious across 3 panes" per Phase 17 feedback. Phase 19 must preserve that design — MC-01 tile is a compact Codex section WITHIN the mission-control pane; it does not dominate the pane.
- The 9-WARNING deferral queue is opportunity, not debt: Phase 19 richer-output-contract work closes 6 of them. This is a conscious quality-push WITH new features, not a separate cleanup phase.
- Codex Monitor pane (dedicated) stays as the deep-dive surface; mission-control tile is the at-a-glance surface. Don't duplicate work — delegate via the shared helpers.

</specifics>

<deferred>
## Deferred Ideas

- Phase 21 / post-v1.4 cleanup: WARNINGs #1 + #2 + #8 (awk brittleness, JSDoc drift, dogfood strictness) — not Phase 19 scope.
- Web/mobile dashboards — not v1.4.
- New telemetry sources (e.g. per-file file-read counts, per-plan cost breakdown) — out of scope.
- Milestone-close auto-archive of codex-log.jsonl — out of scope (handled by sgsd-complete-milestone if at all).

</deferred>

---

*Phase: 19-mc-visibility*
*Milestone: v1.4 Clean Close + Codex Visibility*
*Context gathered: 2026-04-24 (inline — no discuss-phase run)*
