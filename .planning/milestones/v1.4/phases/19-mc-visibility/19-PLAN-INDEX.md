# Phase 19: Mission Control Visibility — Plan Index

**Milestone:** v1.4 Clean Close + Codex Visibility
**Phase goal:** Wire codex-live.json / codex-log.jsonl / commit-reviews.jsonl telemetry into all 5 remaining MC surfaces + close 6 Phase 17/18 richer-output-contract deferrals.

## Wave Structure

| Wave | Plan | Objective | MC-IDs | ATC tier |
|------|------|-----------|--------|----------|
| 1 | 19-01 | Core tiles: mission-control Codex tile + statusline indicator + dashboard offload tile | MC-01, MC-02, MC-05 | FULL |
| 2 | 19-02 | Event capture + live-feed + richer-output hardening (6 deferrals) | MC-03, MC-04, D-05 #3/4/5/6/7/9 | FULL |

## Plans

### 19-01-core-tiles-PLAN.md (wave 1)
Wire 3 PS script surfaces to live telemetry. No new helpers needed — sgsd-codex-status.ps1 already dot-sourced in mission-control. State normalization ("ok" → "idle") applied at render time.

- **T1 MC-01** — 3-row RECENT VERDICTS Codex tile in sgsd-mission-control.ps1; uses Get-SgsdCodexVerdicts + Get-SgsdCodexLogRows; compressed to mission-control pane density
- **T2 MC-02** — Codex state segment appended to sgsd-statusline.ps1 render path; 5 states + color via existing C() ANSI helper; reads codex-live.json directly (latency-sensitive)
- **T3 MC-05** — Multimodal Review Offload tile in sgsd-dashboard.ps1 after token-audit section; extends Get-TokenStats to filter model="codex"; 4 D-07 metrics from codex-log.jsonl

### 19-02-event-capture-richer-output-PLAN.md (wave 2, depends on 19-01)
Net-new write path for narrative.md + dual-source live-feed + 6 SKILL.md/codex-exec.sh hardening items. super-gsd/tests/ dir created (RESEARCH gap 7: dir was missing).

- **T1 MC-03** — append_narrative_event() in codex-exec.sh alongside append_jsonl; 5 call sites paired; writes latest/lastfail fields + event list entries
- **T2 MC-04** — sgsd-live-feed.ps1 refactored from single Get-Content -Wait to polling loop; dual sources merged by ts; dedup by ts+step to avoid double-rendering heartbeat events
- **T3 D-05 #3+#5** — SKILL.md lines 513+945 timeoutTier 'review' → 'analysis'; codex-exec.sh gains --retry-on-timeout-escalate flag + internal retry logic for SKILL.md phase-level-ATC gate
- **T4 D-05 #4+#7** — SKILL.md prompt composer FINDINGS_DETAIL optional footer; validateContract regex tightening (FINDINGS/CRITICAL/WARNINGS must be /^\d+$/, PASS_RATE must be /^\d+\/\d+$/)
- **T5 D-05 #6+#9** — codex-exec.sh --self-test-exit-priority diagnostic flag; super-gsd/tests/codex-contract-fixtures/ dir + 6 malformed fixtures; run-parse-fuzz.sh runner

## Coverage (MC-01..05 + D-05 deferrals)

| Req ID | Plan | Task | Status |
|--------|------|------|--------|
| MC-01 | 19-01 | T1 | planned |
| MC-02 | 19-01 | T2 | planned |
| MC-05 | 19-01 | T3 | planned |
| MC-03 | 19-02 | T1 | planned |
| MC-04 | 19-02 | T2 | planned |
| D-05 #3 (tier recal) | 19-02 | T3 | planned |
| D-05 #5 (timeout-escalate) | 19-02 | T3 | planned |
| D-05 #4 (FINDINGS_DETAIL) | 19-02 | T4 | planned |
| D-05 #7 (validateContract regex) | 19-02 | T4 | planned |
| D-05 #6 (exit-precedence doc) | 19-02 | T5 | planned |
| D-05 #9 (parse-rigor fixtures) | 19-02 | T5 | planned |

**Deferred (not Phase 19 scope per D-05):** D-05 #1 (awk brittleness), D-05 #2 (JSDoc drift), D-05 #8 (dogfood audit strictness) → Phase 21 post-v1.4.

## Dependencies

- 19-01 depends_on: [] (wave 1, autonomous)
- 19-02 depends_on: [19-01] (wave 2; wants MC-01 tile live before richer-output contract rolls)
