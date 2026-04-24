---
phase: 21
milestone: v1.5
status: complete
date: 2026-04-24
plans_shipped: 4
tasks_shipped: 12
commits: ~22
vtpe_items_delivered: 6
codex_invocations: 6
critical_raised: 4
critical_cleared: 4
warnings_total: 8
warnings_accepted: 7
verifier_verdict: passed
phase_atc_verdict: pass (after 3-CRIT fix)
muda_status: ran — 1 WARN inventory (non-blocking)
tags:
  - milestone:v1.5
  - category:VTPE
  - dogfood:first-VTP-gate-shipped
  - auto-advance:proved-out
---

# Phase 21 — VTP Enrichment Gates Complete

## What shipped

Elevated VTP library from passive MCP server into active enrichment gate on research→planning boundary, audit workflows, milestone close, and deliberation (5th board voice).

**6 VTPE items delivered across 4 plans, 12 tasks, ~22 commits.**

### 21-01 research→planning boundary gate (VTPE-01)
- New `super-gsd/scripts/lib/vtp-enrichment-gate.cjs` (sibling to vtp-context-composer)
- `super-gsd/registry/gates.yaml` `vtp-enrichment` row (halt on api_error)
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` Step 6.b.5 insertion
- `custom-gsd-extract/claude-agents/gsd-planner.md` VTP-ENRICHMENT.md in files_to_read (artifact-theater prevention)

### 21-02 audit + milestone-close cross-reference (VTPE-02 + VTPE-03)
- `vtpCrossReference(findingText, tier, opts)` helper with tier-based batching (CRIT per-finding, WARN batched, PASS skip)
- Wired into sgsd-workflow-auditor + sgsd-muda-audit SKILL
- sgsd-complete-milestone Step 7 "Connections (library-backed)" extension

### 21-03 config + empty-hit discipline + D-08 degraded mode (VTPE-04 + VTPE-05)
- `.planning/config.json.vtp_enrichment` additive block (enabled:false default per D-07)
- 3-path artifact writer (success/empty_hit/api_error) — 18-test self-test passes
- SKILL.md Step 3.7 cold-start `vtp_health` probe with cached vtp_available flag
- Degraded-mode bypass at Step 6.b.5 when vtp_available=false

### 21-04 sgsd-board-researcher 5th deliberation voice (VTPE-06)
- New `super-gsd/agents/sgsd-board-researcher.md` with VTP tool allowlist
- config.deliberation.board append "researcher" (4→5 voices)
- sgsd-ceo.md vote-math N-relative (board.length), no more hardcoded N=4

## Phase-level ATC 5-round Codex review (halt-on-CRIT proved out)

| Round | Event | Outcome |
|---|---|---|
| 1 | Phase-level ATC initial | 2 CRIT + 3 WARN → **HALT** |
| 2 | Operator directive "fix now + make it default" | Memory saved feedback_auto_fix_on_critical |
| 3 | Surgical investigation | 3 bugs identified: missing `sgsd-vtp-enrichment.md` agent file + unprefixed artifact filename + planner glob mismatch |
| 4 | 3 CRIT fixes applied (`682847e`) | Module self-test 18/18 PASS |
| 5 | Phase-level ATC re-review | 0 CRIT + 1 WARN (spec drift) → PASS |
| 6 | WARN fix (`cf2f9aa`) | dispatch_contract doc aligned with module output |

**Halt-on-CRIT escalation proved out** — the safety net correctly blocked a genuinely-broken dispatch path. Auto-fix-on-CRIT memory now makes the fix-first response the default for all future halts.

## Verification verdict

`21-VERIFICATION.md` → PASS: 6/6 VTPE REQs evidence-verified. REQUIREMENTS.md VTPE-01..06 all `[x]`.

## Phase ATC verdict (Step 6.5)

Pass after 3-CRIT fix cycle. 1 residual WARN resolved by `cf2f9aa`. No unresolved CRITs.

## MUDA (Step 6.55) — ran

3 mechanical probes PASS. `inventory` probe: 1 WARN (non-blocking per DLB-02). Post-MUDAC-01/03/04 fix (commit `b2773a8`), 5-probe aggregation is working end-to-end.

## Codex dogfood evidence (Phase 21)

| # | Plan | Scope | Tier | Duration | Verdict |
|---|---|---|---|---|---|
| 1 | 21-01 | 4-commit diff | custom:300 (after analysis timeout) | 252.5s | 2C + 2W |
| 2 | 21-02 | 4-commit diff | analysis | 160.5s | 0C + 4W |
| 3 | 21-03 | 4-commit diff | skipped (timeout) | — | — |
| 4 | 21 phase-level initial | phase summary | custom:480 (after 2 timeouts) | 406.4s | 2C + 3W HALT |
| 5 | 21 phase-level re-review | fix commit | custom:540 (after 300 timeout) | 182.4s | **0C + 1W PASS** |

**5 Codex invocations, ~1000s Phase 21 wall-clock, all CRITs ultimately cleared.**

Codex 5.5 + xhigh reasoning is genuinely slower — 3 of 5 runs hit timeout on initial tier, needed custom: escalation. Real cost of the quality boost.

## Operator directives captured as memory

This phase established 2 load-bearing autonomy behaviors:

1. **`feedback_auto_advance_phase_stages`** — stage completions chain forward automatically; never ask "what next?"
2. **`feedback_auto_fix_on_critical`** — ATC CRIT in auto mode = investigate+fix+re-verify, never operator-menu

These are structural corrections to how the orchestrator responds to operator autonomy directives. Proven out in Phase 21 itself (3-CRIT fix cycle ran without operator intervention after memory was saved).

## Commit range

Phase 21 CONTEXT (`e18b499`) → phase SUMMARY (this commit) — 22+ commits across research + 4 plans + CRIT-fix cycle + phase artifacts.

## Next

Phase 22 — Security Hardening (SEC-01 symlink canonicalize + SEC-02 fs flock). 2 REQs, 2 plans. Self-contained handoff-path hardening — zero VTP dependency, zero shared surface with Phase 21, runs clean as independent wave.
