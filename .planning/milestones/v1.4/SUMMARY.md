---
milestone: v1.4
name: Clean Close + Codex Visibility + Autonomous Handoff
status: complete
shipped_date: 2026-04-24
phases: [17, 18, 19, 20]
plans_shipped: 10
requirements_delivered: 17
categories: [CLEAN, CXOPS, MC, HANDOFF]
vtp_classification_used: gap-tier-3
vtp_research_id: pending
prior_milestone: v1.3
next_milestone: v1.5 (pending scoping)
codex_invocations: 16
codex_wall_clock_s: 1925
claude_tokens_saved_est: 32000
critical_raised: 4
critical_cleared: 4
fallbacks_triggered: 0
parse_failures_observed: 0
tags:
  - milestone:v1.4
  - complete:2026-04-24
  - codex:keep (CODEX-12 kill-condition NOT fired)
  - handoff:disabled-default
---

# Milestone v1.4 — Clean Close + Codex Visibility + Autonomous Handoff

## Mission

Close v1.3's tail (retroactive v1.2 ceremony + 7 carry-over debt items), harden Codex integration from "works" to "reliable under failure modes," wire Codex telemetry into the 5 mission-control visibility surfaces, and close the operator-intervention gap between emergency halt and fresh-session resume.

## What shipped (17 requirements across 10 plans across 4 phases)

### Phase 17 — Debt Sweep (CLEAN, 7 items, 3 plans, 2026-04-24)

- CLEAN-01 providers-registry.cjs JSDoc refresh + dead-code removal
- CLEAN-02 sgsd-muda-audit.sh WASTE.md display sync (two-edit-site fix + awk insert into probe table)
- CLEAN-03 15-01 + 15-03 plan SUMMARY backfill
- CLEAN-04 P5 codex-monitor retroactive artifact (SPEC + PLAN + SUMMARY under v1.3/phases/p5-codex-monitor/)
- CLEAN-05 REQUIREMENTS.md archive alignment verification (v1.2 + v1.3 archives both present)
- CLEAN-06 v1.2 retroactive milestone close — MILESTONES.md Shipped entry + v1.2-ROADMAP.md archive + ROADMAP collapse + `git tag -a v1.2 0191168`
- CLEAN-07 codex_timeout workload tiers — codex-exec.sh resolver + config.json tiers block + 3 SKILL.md call sites + muda-audit qualitative-probe site

### Phase 18 — Codex Hardening (CXOPS, 4 items, 2 plans, 2026-04-24)

- CXOPS-01 codex-exec.sh `--self-test` 4-probe harness (PATH/auth/timeout/contract → exits 10-13) + `--skip-network` offline mode
- CXOPS-02 validateContract hook in SKILL.md Steps 6.5 + 9.5 + parse_failure single-retry fallback to claude-sonnet-reviewer with fallback_reason telemetry
- CXOPS-03 dogfood evidence (per-dispatch ATC via Codex) — 5 rows from Phases 17+18 satisfying AC
- CXOPS-04 phase-level ATC via Codex — 17-ATC-REVIEW.md with provider: openai-codex + gate: phase-level-ATC frontmatter

### Phase 19 — Mission Control Visibility (MC, 5 items + 6 deferrals, 2 plans, 2026-04-24)

- MC-01 sgsd-mission-control.ps1 `SGSD-Codex-Tile` (state + 3 RECENT VERDICTS + metrics)
- MC-02 sgsd-statusline.ps1 `[x] cdx:<state>` 5-state ASCII segment
- MC-03 codex-exec.sh `append_narrative_event()` at 6 lifecycle call sites writing to narrative.md
- MC-04 sgsd-live-feed.ps1 dual-tail codex-log.jsonl + activity-log.jsonl with `[CDX]` prefix
- MC-05 sgsd-dashboard.ps1 Multimodal Review Offload tile (4 D-07 metrics via Get-CodexStats)
- 6 richer-output-contract deferrals addressed (D-05 #3 phase-level-ATC→analysis tier, #4 FINDINGS_DETAIL optional footer, #5 --retry-on-timeout-escalate, #6 --self-test-exit-priority, #7 validateContract regex tightening, #9 parse-rigor fixture dir + fuzz runner 7/7 PASS)

### Phase 20 — Autonomous Session Handoff (HANDOFF, 3 items, 3 plans, 2026-04-24)

- HANDOFF-01 sgsd-stop-handoff.sh Claude Code Stop hook + settings-overlay.json wiring (disabled by default for safety)
- HANDOFF-02 safety rails — cooldown (30s) + max_chain_depth (5) + operator-abort file (.planning/STOP-HANDOFF) + discuss-phase guard + config.json.handoff block
- HANDOFF-03 handoff-log.jsonl + SGSD-Handoff-Tile in mission-control + sgsd-session-start.js parent-child pairing (Windows path fix applied) + --MilestoneCloseCheck flag in sgsd-gate-verdict.ps1

## Evidence produced this milestone

**Codex dogfood (cross-vendor review)** — CXOPS-03/04 retroactively + prospectively satisfied:
- 16 invocations, ~1925s wall-clock
- 4 CRITICALs raised (2 Phase 17 content, 2 Phase 20 content) — ALL cleared via operator-directed fix-now cycles
- 0 fallbacks triggered — validateContract (Phase 18) reliable in practice
- 0 parse_failures observed (despite 7 parse-rigor fixtures asserting the failure modes are detectable)
- ~32,000 Claude tokens saved via cross-vendor offload
- Richer-output contract: partial adoption (Phase 20 Round 3 Codex spontaneously emitted file:line detail in ONE_LINER)

**Mission Control visibility surfaces** — Codex + Claude harmonious across 3 panes per operator design intent:
- Mission Control pane: Codex tile coexists with existing Claude agent/commit tracking
- Narrative pane: `> CODEX` status line + CODEX-tagged live tool stream
- Codex Monitor pane (dedicated): RECENT VERDICTS + RECENT CODEX EVENTS + RUN HISTORY — all populated from live telemetry

**Governance artifacts**:
- `muda-recurrence.md` — audit of recurrence patterns (Phase 17 MUDA pipe fix validated end-to-end)
- `codex-kill-check.md` — CODEX-12 kill-condition NOT fired; Codex stays enabled
- `gate-drift-audit.md` — edge-guard layer not wired in this project (Phase 21 candidate)
- `integration-check.md` — cross-phase handoff review PASS

## Rules learned this session

1. **PS 5.1 UTF-8 parse behavior** — `ParseFile` defaults to system encoding (Windows-1252) and misreads UTF-8 multi-byte chars. Keep visible strings ASCII-only OR add BOM. Applied consistently from Phase 17 onwards.
2. **Codex timeout tier calibration** — `--timeout-tier review` (120s) insufficient for phase-level ATC scope (28-file summaries). Phase 18 CXOPS step-name map assumed review; Phase 19 D-05 #3 recalibrated to `analysis` tier at the resolver.
3. **Codex output contract discipline** — the 5-line contract hides per-finding detail. Operator interprets WARN/CRIT via ONE_LINER heuristics. Phase 19 D-05 #4 scaffolded FINDINGS_DETAIL optional footer; Codex began partial adoption in Phase 20 Round 3 (spontaneous file:line in ONE_LINER).
4. **Fail-closed > fail-open on safety-critical paths** — Phase 20 multi-round reviews surfaced progressively narrower edges. Defensive default: any log-integrity failure refuses handoff with explicit reason code, operator inspects.
5. **CLAUDE_SESSION_ID is NOT propagated to hook subprocesses** — use `$$` PID fallback in Stop hook context.
6. **Claude CLI non-interactive spawn requires `--dangerously-skip-permissions`** — otherwise spawned session hangs on permissions prompt.
7. **MUDA phase-dir resolution** — legacy flat `.planning/phases/` vs nested `.planning/milestones/*/phases/` — Phase 17 shipped flat-only; Phase 20 session fixed to search both (commit 1cef1b4). Every v1.4+ phase now audits correctly.

## Governance findings

- **Auto-orchestrator proved itself** — 4 phases shipped end-to-end in a single session via /sgsd-orchestrate go loop. Operator interventions: ~4 total (fix-now directives at CRITICAL moments, MC monitor restart, MUDA fix-now). All other dispatches autonomous.
- **Cross-vendor review validated** — Codex consistently caught bugs Claude's self-review missed (WASTE.md row duplication, hardcoded tier values, chain-depth accounting bug, pairing false-positive). Zero fallback activations means validateContract is reliable under normal load.
- **Safety-first pays off** — Phase 20 handoff ships DISABLED. Multi-round Codex review surfaced 3 CRITICALs; all cleared before operator opt-in. Zero production incidents possible since feature is off.
- **Richer-output contract** — partial adoption (Phase 20 Round 3) is encouraging gradient. Not step-change. Phase 21 prompt-engineering follow-up candidate.

## Next-milestone seed (v1.5 candidates)

**Phase 21 security-hardening sub-scope (from Phase 20 acknowledged WARNs):**
- Symlink canonicalize on handoff-log path
- fs flock or equivalent concurrent-write guard
- Edge-guard layer wiring (was Phase 21 candidate even before v1.4)

**Carry-over from Phase 19 deferrals NOT addressed in v1.4:**
- Dashboard offload math accuracy audit (19-01 ATC WARN)
- Narrative race conditions under multi-session handoff (Phase 19 ATC WARN)
- Timeout unreliability compounding (Phase 19 phase-level ATC observation)

**Carry-over from Phase 17/18 deferrals NOT addressed (3 of 9):**
- awk anchor brittleness in muda-audit qualitative insert (Phase 17 WARN)
- T1 providers-registry JSDoc narrative drift (Phase 17 WARN)
- Dogfood audit strictness (Phase 18 phase-level WARN)

**MUDA calibration work (Phase 17 + 18 + 19 accumulated findings):**
- 5-probe aggregation loop completeness (inventory + extra_processing verdicts hidden from counters)
- inventory probe threshold recalibration (warn>3 fail>8 too strict for multi-milestone project)
- sgsd-muda-probe.sh flat-path bug (mirror of Phase 17 audit-script fix)
- Summary text accuracy vs raw JSON verdict

**Richer-output contract full adoption:**
- FINDINGS_DETAIL footer prompt engineering
- validateContract extension to parse per-finding lines when present
- ATC-REVIEW.md artifact rendering with detail (operator sees specifics not interpretations)

**New scope candidates:**
- v1.5 scoping session to triage Phase 21 items into coherent requirements

## VTP Integration

See `.planning/milestones/v1.4/VTP-CLASSIFICATION-GAP.md` for tier-3 classification fallback details. VTP publication deferred until tier-1/tier-2 API fields land.

## Connections

- Prior milestone: **v1.3 Multimodal Review** (shipped 2026-04-24, same day) — established Codex CLI provider substrate + routed gates. v1.4 consumes that foundation.
- Retroactive milestone: **v1.2 Evidence-First Sharpening** (originally Phases 9-13) — formally closed as part of v1.4 CLEAN-06 (tagged v1.2 at 0191168).

## Commit range

`75f8cbd docs(17): capture Phase 17 Debt Sweep context` (session start) → `44a9241 phase-close(20): Autonomous Handoff ✓ SHIPPED — v1.4 MILESTONE COMPLETE` (this close).

~120 commits across the milestone session.
