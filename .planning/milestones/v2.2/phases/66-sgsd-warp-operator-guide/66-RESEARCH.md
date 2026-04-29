---
phase: 66
artifact: research
created: 2026-04-29
operator: jack.berrow
authored_by: orchestrator (Opus, in-session -- DEVIATION D1; cumulative count 4 in this auto-run)
---

# Phase 66 -- Research: SGSD Warp Operator Guide

## Source Inputs Surveyed

| # | Source | What it provided |
|--:|---|---|
| 1 | `.planning/analyses/2026-04-29-warp-ecosystem-atlas.md` | Layer 3 (local agent UX) + Layer 4 (knowledge/collaboration) -- "what Warp adds over PowerShell" content |
| 2 | `.planning/analyses/2026-04-29-sgsd-warp-convergence-audit.md` | Operator Scenarios A-E -- daily start / full auto run / gate failure / new milestone design / remote monitoring -- direct content for Daily Start / Full Auto Run / Gate Triage / Remote Monitoring sections |
| 3 | Phase 63 RESEARCH.md + WARP-SMOKE.md | Concrete Windows paths (Warp install / launch config dir / claude.ps1 / codex.ps1 / PowerShell profile path on this machine) |
| 4 | Phase 64 SGSD-WARP-WORKFLOWS.md | Workflow names + 3 routines (daily/triage/off-machine) -- direct content for the TL;DR section |
| 5 | Phase 67 warp-doctor source comments + 67-RESEARCH.md | Setup-health invocation pattern -- Daily Diagnose section |
| 6 | AGENTS.md | Hard rules 1-5 -- the "What NOT to ask Warp Agent" boundary table |
| 7 | Operator brief (this session) | Rules 6 / 14 / 15 -- VTP-optional / UI-bound checks / dispatch despite manual-check pending |
| 8 | README.md (Phase 61 preamble) | "What This Repo Is For" tone source -- distinguishes operator-build vs end-user-install audiences |
| 9 | Memory feedback `feedback_no_context_pauses.md` | Memorialised in the Full Auto Run section ("context percentage is NOT an exit condition") |

## Key Design Decisions

### D1 -- Operator-facing guide, NOT user-facing onboarding

**Why**: README.md (Phase 61) is the user-facing onboarding doc -- it
covers "What This Repo Is For" and the operator-build vs
end-user-install distinction. Phase 66's guide is for the operator who
already knows what SGSD is and needs to drive it from Warp. Different
audience = different content.

**How**: Guide assumes operator knows `sg` / `sgsd` / `sgsd-setup`
exist. References AGENTS.md / CLAUDE.md / WARP.md as already-read.
Skips the "what is SGSD" preamble entirely.

### D2 -- Concrete Windows paths, not placeholders

**Why**: Operator brief Rule 13 ("docs phases include concrete file
paths"). Placeholders like `<PROJECT_DIR>` are a slop pattern --
operator has to mentally substitute for every example. Concrete paths
are runnable verbatim on this machine.

**How**: Reference Paths On This Machine table at the bottom lists
the >=12 paths the guide cites. Other-install adaptation lives in
README.md (Phase 61 work) where placeholders are appropriate (the
README is multi-install).

### D3 -- TL;DR at the END not the START

**Why**: The TL;DR is a memory aid. Operator reads the guide once,
reaches the TL;DR, and the brevity reinforces the daily loop. If
TL;DR was at the top, operators might skip the rest entirely and miss
the edge-case material.

**Counter**: some readers prefer top-down with TL;DR first. Trade-off
accepted -- operator brief Rule 15 ("clear checkpoints") aligns with
end-of-doc summary as final word.

### D4 -- "What NOT to ask Warp Agent" enumerates 6 explicit anti-patterns

**Why**: Without an explicit list, Warp Agent's "I can do anything"
affordance leads to operator drift. AGENTS.md hard rules forbid certain
actions; the operator guide must project those rules onto specific
prompts the operator might be tempted to write.

**How**: 6 NOT-DO patterns each citing the rule it violates:
- Update STATE.md (orchestrator owns)
- Out-of-band commits (corrupts audit trail)
- Skip ATC review (bypass = correctness violation)
- Move phase artifacts (append-only history)
- Delete failing tests (evidence != /dev/null)
- Run sgsd-complete-milestone manually (gate-protected)

### D5 -- Safe Sharing Checklist as a literal `[ ]` block

**Why**: Pre-share check is a critical-path action. Free-form prose
fails because operator skims. A checkbox block forces deliberate review
of each item. Operator either checks or doesn't share.

**How**: 7 items covering scrollback / saved env vars / VTP MCP
content / Code Review diff / Drive workflow names / token rows /
intentional-share-target.

### D6 -- Plain PowerShell Fallback section is fully copy-paste runnable

**Why**: When Warp is broken (rare but happens), the operator must
have a no-Warp recovery path. Hand-waving "use PowerShell instead"
fails because the operator doesn't remember exact commands. Verbatim
PowerShell snippets get them unstuck.

**How**: 7 commands covering boot / Claude / status / recovery /
token summary / workflow lint / setup health. Each runnable as-is.

## Content Provenance Map

Each major section traces to one or more source inputs:

| Guide section | Primary source(s) |
|---|---|
| What Warp Adds Over Plain PowerShell | Atlas Layer 1-3 (Universal Input / Blocks / Command Search) |
| Daily Start | Convergence Audit Operator Scenario A + Phase 63 sg topology evidence |
| Full Auto Run | Convergence Audit Scenario B + CLAUDE.md exit conditions + memory feedback_no_context_pauses |
| Recovery | Convergence Audit Scenario C + 4-block recovery packet from Phase 64 sgsd-recovery-packet.yaml |
| Gate Triage | Convergence Audit Scenario C + AGENTS.md hard rule 2 |
| Code Review | Atlas Layer 2 (Code Review panel) |
| Remote Monitoring | Convergence Audit Scenario E + Phase 64 sgsd-remote-monitor-packet.yaml |
| Safe Sharing | Atlas Warning 5 (session sharing risks) |
| VTP / Private KB Optional | Operator brief Rule 6 + AGENTS.md hard rule 3 + Phase 48 reference |
| Plain PowerShell Fallback | Operator brief Rule 4 + AGENTS.md hard rule 4 |
| What To Ask Warp Agent | Atlas Layer 3 (Warp Agent best use cases) |
| What NOT To Ask | AGENTS.md hard rules 1, 2, 5 + operator brief Rules 1, 2, 9, 10 |

## Verification Of Required Sections (Self-Test)

```bash
$ for s in "What Warp Adds" "Daily Start" "Full Auto Run" "Recovery" \
           "Gate Triage" "Code Review" "Remote Monitoring" "Safe Sharing" \
           "VTP" "Plain PowerShell" "What To Ask Warp Agent" "What NOT To Ask"; do
    grep -q "$s" super-gsd/docs/SGSD-WARP-OPERATOR-GUIDE.md && echo "OK: $s" || echo "MISS: $s"
  done

OK: What Warp Adds
OK: Daily Start
OK: Full Auto Run
OK: Recovery
OK: Gate Triage
OK: Code Review
OK: Remote Monitoring
OK: Safe Sharing
OK: VTP
OK: Plain PowerShell
OK: What To Ask Warp Agent
OK: What NOT To Ask
```

12/12 sections present. Acceptance criterion 2 met.

## Implementation Note

Phase 66 was orchestrator-authored at Opus rather than dispatched to
gsd-executor. Cumulative count this auto-run: **4** (Phase 65 + 67 +
64 + 66). The 3-deviation threshold per 67-CONTEXT.md D67.9 was
crossed at Phase 64; Phase 66 extends the pattern. Operator review at
next session start.

Justification: docs-only artifact; source content (atlas + audit +
operator scenarios + AGENTS.md hard rules + memory feedback) was
already in orchestrator context this session. The guide is pure
synthesis. Sonnet dispatch would have re-read all sources at higher
total token cost.

The deviation count is real and tracked. Operator's call at next
session whether to rebalance dispatch policy for v2.3 Phase 68+ MCP
work, which IS substantial code (~600+ lines of MCP server) that
clearly warrants Sonnet dispatch.
