# Phase 19: Mission Control Visibility — Research

**Researched:** 2026-04-24
**Mode:** Internal validation only (no external lookups)
**Confidence:** HIGH — all claims verified against live code

---

## Validation Results

| # | Claim | Result | Evidence |
|---|-------|--------|----------|
| 1 | All 5 target PS scripts exist + non-empty | PASS | Grepped all 5; matches returned |
| 2 | sgsd-mission-control.ps1 dot-sources sgsd-codex-status.ps1 | PASS | Line 93-95: `$__codex = Join-Path $PSScriptRoot "lib\sgsd-codex-status.ps1"` + error guard |
| 3 | sgsd-narrative.ps1 has CODEX rendering line from Phase 17 | PASS | Lines 311-313: `Write-Host "CODEX " + Get-SgsdCodexStatusLine`. NarrativeCache = `metrics\narrative.md` (line 42). WRITES: script reads narrative.md but does NOT write it — no Set-Content/Add-Content found |
| 4 | codex-exec.sh has `append_jsonl` function | PASS | Lines 400-404: defined at line 400, called at lines 459/468/474/511/525 |
| 5 | phase-level-ATC maps to `review` tier (wrong per D-05 #3) | PASS (claim confirmed wrong) | Line 513: `timeoutTier: 'review'` hardcoded. D-05 #3 wants `analysis`. No resolver map — it is a hardcoded string, not a lookup table |
| 6 | validateContract exists in SKILL.md | PASS | Lines 479-485: function defined; checks 5 required field prefixes via `startsWith`. No regex on values yet — D-05 #7 tightening is additive |
| 7 | super-gsd/tests/ dir exists | FAIL | Directory MISSING — Wave 0 must create it + codex-contract-fixtures/ |
| 8 | codex-live.json has state/updated_at/phase/plan/step | PASS | Confirmed: state="ok", updated_at present, phase="18", plan="", step="phase-level-ATC". Also has duration_ms, exit, fallback_triggered |

---

## Gaps Found

**GAP-1 (MC-03 write path):** CONTEXT.md D-04 says codex-exec.sh writes events to narrative.md. sgsd-narrative.ps1 currently only READS narrative.md (line 42 NarrativeCache read-only). No write path exists in either script. The D-04 design (codex-exec.sh as writer) is correct and is net-new — planner must create `append_narrative_event` in codex-exec.sh alongside `append_jsonl`.

**GAP-2 (phase-level-ATC tier):** Not a resolver map — `timeoutTier: 'review'` appears as a hardcoded string literal at SKILL.md line 513 (Step 6.5) and line 945 (Step 9.5). D-05 #3 fix requires changing both occurrences to `'analysis'` and updating the inline comment.

**GAP-3 (sgsd-dashboard.ps1 — no Codex code at all):** Zero Codex/multimodal references in dashboard. MC-05 tile is entirely new — no existing structure to extend. Planner should note the tile goes AFTER existing tiles (token-audit section is the natural anchor since D-07 reuses token-log.jsonl).

**GAP-4 (sgsd-live-feed.ps1 — single hardcoded path):** Line 14 hardcodes `activity-log.jsonl`; lines 92 and 102 use `$logPath` directly. MC-04 must refactor to a multi-source loop — cannot simply append a second `Get-Content -Wait` (PowerShell blocks). Pattern: collect both sources in a polling loop with short sleep, merge by ts.

**GAP-5 (codex-live.json `state` field value):** Live file shows `state: "ok"` not `state: "idle"`. D-03 specifies 5 states: idle/running/timeout/error/fallback. Current write_live_state calls use "running"/"timeout"/"auth-denied"/"error" — "ok" maps to idle post-completion but the label differs. MC-01/MC-02 consumers must normalize "ok" → "idle" or codex-exec.sh must write "idle" on clean exit.

---

## Planner Guidance

**MC-01 (mission-control tile):**
- No new dot-source needed — sgsd-codex-status.ps1 already loaded at line 93
- Get-SgsdCodexStatus, Get-SgsdCodexLogRows, Get-SgsdCodexVerdicts all available
- State normalization needed: "ok" from live.json → display as "idle"
- Tile must go WITHIN existing pane layout — find the Codex Monitor section boundary in sgsd-mission-control.ps1 and insert compact 3-row block below it

**MC-02 (statusline segment):**
- sgsd-statusline.ps1 uses ANSI escape function `C($code, $text)` at line 70 — use same pattern for color segments
- No dot-source for sgsd-codex-status.ps1 in statusline yet — must add (or inline the read from codex-live.json directly for simplicity; statusline is latency-sensitive)
- `state: "ok"` normalization same as MC-01

**MC-03 (narrative event writers):**
- narrative.md write path is ENTIRELY NEW in codex-exec.sh — create `append_narrative_event()` function alongside `append_jsonl()`
- Call sites: same 5 exit paths that call `append_jsonl` (lines 459/468/474/511/525) — each needs a paired `append_narrative_event` call with appropriate event type
- narrative.md format: CONTEXT D-04 defines latest/lastfail fields + event list — planner must specify exact file schema in task since no existing write exists to follow

**MC-04 (live-feed interleave):**
- Current single-source poll pattern (lines 92+102) cannot simply add a second `Get-Content -Wait`
- Recommended approach: polling loop with `Get-Content -Tail 0` snapshot diff on both files every 1-2s, merge rows by ts field, render with prefix
- Dedup guard required: codex events also appear in activity-log via heartbeat hook — match on ts+step to avoid double-render

**MC-05 (dashboard tile):**
- `Get-TokenStats` function exists at line 342 in sgsd-dashboard.ps1 — check if it already handles codex rows; if not, filter by `model="codex"` in the existing function rather than duplicating
- codex-log.jsonl has `duration_ms`, `fallback_triggered`, `ts` fields confirmed — all D-07 metrics computable from live data
- Milestone boundary for `codex_invocations_this_milestone`: need milestone start_ts from STATE.md or MILESTONES.md — planner must specify lookup

**D-05 richer-output hardening:**
- #3: Two SKILL.md locations to patch — line 513 (Step 6.5) and line 945 (Step 9.5). Both `timeoutTier: 'review'` → `'analysis'`
- #7: validateContract at line 479-485 uses `startsWith` string check only. Add regex guards: `FINDINGS:` value must match `/^\d+$/`, `PASS_RATE:` must match `/^\d+\/\d+$/`, `CRITICAL:` and `WARNINGS:` must match `/^\d+$/`
- #9: `super-gsd/tests/` dir MISSING — Wave 0 creates dir + 6 fixture files + run-parse-fuzz.sh runner

---

## Per-MC Commit Hints

```
feat(19-01/T1): MC-01 mission-control Codex tile from codex-live.json + codex-log.jsonl
feat(19-01/T2): MC-02 statusline codex state segment with 5-state color map
feat(19-01/T3): MC-05 dashboard Multimodal Review Offload tile
feat(19-02/T1): MC-03 append_narrative_event in codex-exec.sh + 5 call sites
feat(19-02/T2): MC-04 live-feed dual-source poll loop with ts-dedup
feat(19-02/T3): D-05-3 phase-level-ATC timeoutTier review->analysis (2 sites)
feat(19-02/T4): D-05-7 validateContract regex hardening for numeric fields
feat(19-02/T5): D-05-9 codex-contract-fixtures dir + run-parse-fuzz.sh + 6 fixtures
```
