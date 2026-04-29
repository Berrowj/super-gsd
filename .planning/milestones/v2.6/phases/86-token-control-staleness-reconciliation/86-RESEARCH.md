---
phase: 86
artifact: research
authored_by: orchestrator (Opus); code by gsd-executor (Sonnet) agentIds a46b3a6e05ab0fd85 (initial 29ea0cd) + abc782a7a6fe59ef1 (hardening 977acfd)
operator_override: 2026-04-29T21:20Z + 2026-04-29T21:35Z (clarification)
---

# Phase 86 -- Research: Token Control + Staleness Reconciliation

## Operator override sequence

1. **2026-04-29T21:20Z initial override**: Phase 85 close revealed 3
   gaps; pause advancement; address before Phase 86.
2. **2026-04-29T21:35Z clarification**: detection alone is insufficient
   — Phase 86 must add hard runtime boundary (do_not_continue + v2.6
   close gate) and auto-create Phase 87 for the live wire-in.

Phase 86 covers detection + hardening; Phase 87 covers live wire-in
(auto-authored, queued).

## Source pattern

- Phase 85 _tool_sgsd_recovery_packet (substrate for staleness extension)
- Phase 67 warp-doctor (PROBE_NAMES extension pattern)
- Phase 76 cockpit-state adapter (section addition pattern)
- v2.0 Phase 57 release-readiness/score.cjs (CRIT-BACKLOG-as-block-gate pattern for v2.6 close gate)

## Key decisions

### D1 — Two-commit split (29ea0cd initial + 977acfd hardening)

29ea0cd shipped detection (staleness probes / context-size warnings /
fresh-session resume guidance / 3 v2.6 debt rows). 977acfd shipped
hardening per operator clarification (do_not_continue:true semantic +
v2.6 close gate enforcement). Atomic per-aspect commits.

### D2 — do_not_continue:true is a hard semantic, not just text

`hard_500k` branch returns explicit `do_not_continue: true` field in
addition to recommendation text. Future consumers (cockpit / Warp Agent /
ACP adapter) can mechanically gate on this field rather than parse text.
Soft `200k` keeps `do_not_continue: false`.

### D3 — v2.6 close gate uses regex on summary, not new kind enum

Adding a new `kind:edge_guard_miss` would have required broader gate
logic. Instead, the v2.6 close gate matches on `kind:v2_6_debt` AND
summary regex `context_packet_builder_dormant|context_bench_full_mode_unproven`.
Surgical; doesn't disturb existing close gates.

### D4 — Phase 87 auto-authored at Phase 86 close

Per operator override item 4. CONTEXT + PLAN files for "Live Orchestrator
Context-Packet Enforcement" written alongside Phase 86's own artifacts;
both commit together. Phase 87 dispatch awaits operator confirmation OR
auto-mode resumption. The auto-creation is documented in Phase 87
CONTEXT.md as a record of why this phase exists.

### D5 — Self-test READ-ONLY discipline

Executor's first A47 draft used `fs.writeFileSync` to synthesize a fixture;
caught immediately by A10 READ-ONLY invariant scan. Refactored to source-
literal + synth-shape no-write proof. The failure-and-fix is itself
evidence the self-test machinery is doing its job.

## Live results

```
warp-mcp self-test       46/46 (29ea0cd) -> 47/47 (977acfd)
warp-doctor self-test    15/15 -> 17/17 (PROBE_NAMES len 16 -> 18)
cockpit-state self-test  18/18 -> 19/19 (sections 10 -> 11)
sgsd-complete-milestone self-test (NEW)  6/6 PASS
live recovery packet     _state_staleness {drift_minutes:1, threshold:30, stale:false}
                         _context_warning {level:ok, estimated_root_tokens:63694, do_not_continue:false}
live warp-doctor probe   state_md_freshness PASS reason=state_md_within_threshold
                         context_packet_builder_freshness MISSING reason=context_packet_builder_stale
live cockpit adapter     staleness section: state_md{drift_minutes:1} + context_packet_builder{live:false, age_hours:28}
crit-backlog rows        +3 v2_6_debt (codex_unavailable / context_packet_builder_dormant / context_bench_full_mode_unproven)
v2.6 close gate          synthetic blocker leg → exit 1 with milestone_close_blocked:v2_6_debt_unresolved
v2.6 close gate          no-blocker leg → exit 0 green
backward compat v2.0     unchanged path
```

## Forward (Phase 87 — auto-authored, queued)

- D87.1: Wire token-waste/check.cjs into orchestrator dispatch loop
- D87.2: Wire context-packet/build.cjs into orchestrator dispatch path
- D87.3: NEW v2.6 milestone-close gate that asserts context_packet_builder_freshness PASS at close
- D87.4: Re-run v1.9 context-bench full mode if Claude CLI; else mark unproven=accepted-environmental
- D87.5: Self-test for the new live-wire-in enforcement

Phase 87 CONTEXT + PLAN authored at `.planning/milestones/v2.6/phases/87-live-orchestrator-context-packet-enforcement/`.
