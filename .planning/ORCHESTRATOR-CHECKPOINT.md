---
created_at: "2026-04-29T23:10:00Z"
active_milestone: "v2.7"
active_phase: 91
phase_state: "complete"
last_completed: "phase 91 (Cloud-Safe SGSD Skills) closed PASS @ cad9f7d"
next_unit: "Phase 92 — Oz Environment Spec (docs phase; UNBLOCKED)"
units_this_session: 33
estimated_tokens_used: not_self_estimated
model_breakdown:
  opus: orchestrator (this session)
  sonnet: 7 (executor dispatches: P69 / P70 / P71 / P72 / P75 / P76 / P80 / P85 / P86 / P86-hardening / P87 / P90-01 / P90-02 = 13 dispatches; some agentIds reused)
  haiku: 0
context_percent_at_write: "not_self_estimated"
emergency_halt: false
exit_condition: "user said pause"
state_source: state-resolver (Phase 90-02); STATE.md raw is STALE (says v2.2 complete; resolver says v2.7 91)
state_md_drift: "v2.2 → v2.7 milestone drift; phase complete → 91 drift"
recommended_repair: "Re-sync STATE.md to milestone=v2.7 phase=91 ALL-CLOSED (operator-led OR follow-up phase auto-fires)"
operator_overrides_addressed:
  - 2026-04-29T21:20Z (Phase 85 deferrals + 7-point token control list)
  - 2026-04-29T21:35Z (Phase 86 hardening + Phase 87 auto-create + v2.6 close gate)
  - 2026-04-29 retroactive Phase 90 CONTEXT expansion (D90.0 + D90.6 — state-resolver mandatory)
---

# Orchestrator Checkpoint — paused at v2.7 Phase 91 close 2026-04-29T23:10Z

## Completed This Session (33 phases shipped)

### v2.2 — SGSD Warp Integration baseline (5/5 PASS)
- Phase 63 @ b5b46a8 — Warp Capability Smoke Test (PASS-WITH-DEFERRED-5; M1-M5 manual UI checks pending)
- Phase 64 @ 5ae2ba0 — Workflow Pack Completion (8 new + 1 fix + lint + docs index)
- Phase 65 @ c0201af — Agent Rules Context Pack (AGENTS.md + WARP.md Rule Hierarchy)
- Phase 66 @ 3b2186f — SGSD Warp Operator Guide (~280 lines / 12 sections)
- Phase 67 @ 018028e — Warp Doctor Probe Design (16→18 probes; 17/17 self-test)

### v2.3 — Read-only MCP central unlock (5/5 PASS)
- Phase 68 @ 31907c2 — SGSD MCP Contract (14 tools / ERROR_CODES len=11 / REDACTION_CATEGORIES len=7)
- Phase 69 @ 0211b0c+dcd039b — MCP server skeleton (15/15 self-test; JSON-RPC 2.0 stdio)
- Phase 70 @ 0905cbf+ebfaf7c — 5 core status tools (21/21 self-test)
- Phase 71 @ 11bb6bb+2ab84d7 — 9 operational tools (30/30 self-test; hash-match verified vs git log)
- Phase 72 @ 6f50232+1baf708 — Redaction (7 categories) + ERROR_CODES len=13 + setup docs

### v2.4 — Cockpit + live event + adapter (6/6 PASS)
- Phase 73 @ 6021fbb — 12 operator questions mapped to MCP tools
- Phase 74 @ ad5948d — ORCHESTRATOR-LIVE.jsonl contract + writer (16 event types frozen)
- Phase 75 @ 72e0d6b+5914be6 — Live event writer integration (--emit CLI + READ-ONLY reader)
- Phase 76 @ 6ba04f8+22aedd5 — Cockpit-state adapter (10-section snapshot; MCP tool 12 unification)
- Phase 77 @ a6b83c8 — Cockpit render helper (PSParser 0 errors; existing 3 panes UNTOUCHED)
- Phase 78 @ bd54eb3 — Warp launch config templates (operator-workspace + cockpit-only)

### v2.5 — Skills + plans + notebook + prompts + index (5/5 PASS)
- Phase 79 @ 5a74bda — 7 SGSD Warp skills (read-only by design)
- Phase 80 @ 8eb7de8+e69271e — Warp Plan converter (READ-ONLY on STATE.md verified)
- Phase 81 @ 7256a76 — SGSD Warp Operator Notebook (10 runnable PowerShell blocks)
- Phase 82 @ 350e101 — 7 Warp Agent prompt templates
- Phase 83 @ 19e544e — Asset cross-index + validator (47 paths cited; 0 missing)

### v2.6 — Review + recovery + sharing + remote monitoring (5/5 closed)
- Phase 84 @ 2e8ce85 — Code Review Integration Guide + workflow
- Phase 85 @ 8bad3ad+347c56a — Recovery Packet Upgrade (PASS-WITH-DEFERRED-3)
- Phase 86 @ 29ea0cd+977acfd+a59d5f0 — Token control + staleness reconciliation (PASS-WITH-DEFERRED-2 + Phase 87 auto-authored)
- Phase 87 @ b1c7259+689d38f — Live wire-in (token-waste + context-packet hooks; v2.6 close gate freshness assertion)
- Phase 88 @ a688018 — End-to-End Warp Operator Drill (7/0/4 PASS/FAIL/MANUAL; v2.6 close gate exit 0 green)

### v2.7 — Controlled actions + cloud-safe skills (3/5 PASS so far)
- Phase 89 @ 9d68ef3 — Controlled Action Contract (4 tiers / 5 candidates / 5 BLOCKED / 8 denial reasons)
- Phase 90 @ dae0550+55b25d8+6d31851 — Controlled-action MCP server + state-resolver (operator D90.0 + D90.6 added retroactively)
- Phase 91 @ cad9f7d — Cloud-Safe SGSD Skills (5 CS + 6 CU + decision matrix)

## Self-test totals (cumulative across session)

| Tool | Final |
|---|--:|
| warp-mcp | 47/47 |
| warp-mcp-actions (NEW v2.7) | 21/21 |
| warp-doctor | 17/17 (was 15; +2 probes Phase 86) |
| cockpit-state | 19/19 (was 18; +1 staleness section Phase 86) |
| state-resolver (NEW v2.7) | 14/14 |
| sgsd-complete-milestone (NEW v2.6) | 8/8 |
| orchestrator-hooks (NEW v2.6) | 9/9 |
| warp-workflow-lint | 7/7 |
| warp-asset-validator | 5/5 |
| warp-plan-converter | 17/17 |
| orchestrator-live-writer | 9/9 |
| orchestrator-live-reader | 12/12 |
| **NEW SELF-TESTS** | **185/185** |

Plus all v2.0-v2.1 sibling tests still PASS (chaos-restart 18+5, context-bench 33/33, failure-injection 24+10, installer-audit 12/12, release-readiness 15/15, scenario-suite 21+10/10, upgrade-drift 12/12, etc.).

## Operator overrides addressed

### Override 1 (2026-04-29T21:20Z): Phase 85 deferrals + 7-point token control list
- 5/7 SHIPPED (Phase 86)
- 1/7 accepted-environmental (context-bench full-mode rerun — operator follow-up)
- 1/7 environmental (codex_unavailable — Codex auth)

### Override 2 (2026-04-29T21:35Z): Phase 86 hardening + Phase 87 auto-create + v2.6 close gate
- 500k `do_not_continue: true` semantic SHIPPED (977acfd)
- v2.6 close gate refuses SHIPPED-clean on context_packet_builder_dormant + context_bench_full_mode_unproven (977acfd)
- Phase 87 CONTEXT+PLAN auto-authored (a59d5f0)
- Phase 87 wire-in shipped (b1c7259) — token-waste + context-packet hooks now live in SKILL.md + orchestrator-hooks.cjs
- v2.6 close gate live: exit 0 green

### Override 3 (Phase 90 CONTEXT.md retroactive D90.0 + D90.6): state-resolver mandatory
- super-gsd/tools/state-resolver/resolve.cjs SHIPPED (55b25d8) — priority-ordered effective-state
- 3 MCP tools wired (current_state / current_phase / recovery_packet)
- cockpit-state adapter wired (objective + staleness)
- Live: returns v2.7 P91 source=pulse, projection_stale=true, recommended_repair="Re-sync STATE.md to milestone=v2.7 phase=91"

## Next Action

**Phase 92 — Oz Environment Spec.** UNBLOCKED. Docs phase per roadmap:
- Draft environment requirements (repo clone + Node version + npm + PowerShell availability if needed + setup commands)
- `super-gsd/docs/SGSD-OZ-ENVIRONMENT-SPEC.md`
- No private VTP by default; consumes Phase 91 cloud-safe skills classification

Orchestrator-author appropriate (small docs).

## Remaining Work

### v2.7 (3/5 phases done)
- Phase 92 — Oz Environment Spec (UNBLOCKED, NEXT)
- Phase 93 — Scheduled Audit Design (UNBLOCKED)

### v2.8 — ACP / Native Warp Contribution Readiness (4 phases)
- Phase 94 — ACP Mapping Spec
- Phase 95 — ACP Adapter Spike (skip if ACP unavailable; record SKIPPED-WAITING-FOR-UPSTREAM)
- Phase 96 — Warp Upstream Issue/Spec Pack
- Phase 97 — SGSD Warp Integration Release Gate (final)

### Operator-led items (NOT blockers)
- M1-M5 manual UI checks from `.planning/milestones/v2.2/MANUAL-CHECKS.md` (5 items)
- STATE.md re-sync to v2.7 P91 ALL-CLOSED (resolver detects + recommends; not auto-fired)
- v2.6 SHIPPED-clean decision (gate green; codex_unavailable debt row environmental)
- v1.9 CONTEXT-BENCH-RESULTS.md flip from `accepted-environmental` to `proven` (operator runs full-mode bench)

## State Source Truth

**STATE.md is STALE.** Resolver detects:
- STATE.md says: milestone=v2.2 / phase=complete
- Reality: milestone=v2.7 / phase=91 (per pulse + phase folders + git)

This is BY DESIGN — Phase 90-02 wired the resolver to be authoritative. Cockpit / MCP / recovery packet all use the resolver, not raw STATE.md. The drift is detected, surfaced (`projection_stale: true`), and a `recommended_repair` is in every consumer envelope.

A future phase or operator action may write the recommended re-sync to STATE.md. For now, downstream consumers see the correct effective state.

## Resume Instructions

1. Read this checkpoint at session start (cold-start step 1).
2. Confirm via state-resolver that current state is still v2.7 P91 (no other auto-runs in flight).
3. Enter auto mode: dispatch Phase 92 (orchestrator-author docs phase).
4. Delete this file once read OR mark `resolved_by: <ISO>` to clear.

## Quick Operator Reference

```
# Resume:
/sgsd-orchestrate go

# Verify state truth:
node super-gsd/tools/state-resolver/resolve.cjs --project C:\Users\jack.berrow\GSDedits

# Check open todos:
ls .planning/todos/pending/

# Run drill:
& super-gsd/scripts/lib/run-operator-drill.ps1 -ProjectDir 'C:\Users\jack.berrow\GSDedits'

# Check v2.6 milestone close gate (currently exit 0 green):
node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.6
```
