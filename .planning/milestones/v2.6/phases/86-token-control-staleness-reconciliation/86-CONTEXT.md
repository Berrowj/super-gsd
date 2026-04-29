---
phase: 86
phase_name: Token Control + Staleness Reconciliation (operator-override re-scope)
milestone: v2.6
created: 2026-04-29
status: in-progress
deviation_from_standard: re-scoped at operator override (was Remote Monitor Packet — already shipped via Phase 64 + Phase 79)
operator_override: 2026-04-29T21:20Z
---

# Phase 86 -- Token Control + Staleness Reconciliation (CONTEXT)

## Background

Operator override at Phase 85 close (2026-04-29T21:20Z) flagged:

1. **STATE.md staleness contagion** — recovery packet reads STATE.md as
   truth; STATE.md was 90 min stale; recovery packet emitted "ROADMAP
   COMPLETE" while v2.6 P85 was actively shipping.
2. **Codex unavailability** — Phase 84/85 ATC reviews are Claude-only.
3. **context-packet-log.jsonl 24h+ stale** — Phase 45 builder NOT firing
   in current Warp run.
4. **Token burn ~21.5M** — orchestrator alone ~18M; root context turns
   ~775k tokens.
5. **Token-waste/check + context-packet/build NOT wired into orchestrator
   path** — only fire in benchmarks.
6. **No 200k/500k context warning** in cockpit/MCP.
7. **No fresh-session resume guidance** for long autopilot chains.
8. **v1.9 CONTEXT-BENCH-RESULTS.md ledger-only / unproven** — full-mode
   reduction claim not validated.

Originally Phase 86 was "Remote Monitor Packet" — but that work shipped
via Phase 64 workflow (`sgsd-remote-monitor-packet.yaml`) + Phase 79
operator skill. Phase 86 is re-scoped to the operator override.

## Locked Scope (D86.1-D86.6)

**In scope (this phase ships)**:

- **D86.1**: Recovery packet staleness detection. Extend Phase 85
  `_tool_sgsd_recovery_packet` to compute STATE.md mtime drift vs latest
  orchestrator-pulse mtime; emit `_state_staleness: { stale: bool,
  state_md_age_minutes: N, latest_pulse_age_minutes: N, drift_minutes: N }`
  field. If drift > 30 min, set `stale: true`.

- **D86.2**: warp-doctor 2 new probes:
  - `state_md_freshness` — checks STATE.md mtime vs latest orchestrator-pulse.jsonl mtime; PASS if drift <= 30 min, MISSING if >= 30 min, NOT-APPLICABLE if pulse log absent.
  - `context_packet_builder_freshness` — checks `.planning/metrics/context-packet-log.jsonl` mtime vs now; PASS if <= 24h, MISSING if > 24h.
  PROBE_NAMES extends from 16 to 18.

- **D86.3**: Cockpit-state adapter (Phase 76) gains a `staleness`
  section:
  ```json
  { "staleness": {
      "state_md": { "stale": bool, "drift_minutes": N },
      "context_packet_builder": { "live": bool, "last_emit_age_hours": N }
  } }
  ```
  Snapshot envelope sections grow from 10 to 11.

- **D86.4**: Context-size warning thresholds. Add `sgsd_context_size`
  MCP tool (or extend `sgsd_token_spend`) to compute current root
  context usage estimate. Emit `warning_level` ∈ {ok, soft_200k,
  hard_500k}. Recovery packet includes warning_level + recommendation.

- **D86.5**: Fresh-session resume guidance. When recovery packet's
  warning_level >= soft_200k, append to `resume_command`:
  `"# CONSIDER FRESH SESSION: context > 200k tokens; pause + restart Warp tab"`.

- **D86.6**: CRIT-BACKLOG entries for v2.6 debt — items that CANNOT be
  fixed in Phase 86 (Codex unavailability, token-waste/context-packet
  wire-in to orchestrator path, CONTEXT-BENCH full-mode rerun) get
  explicit rows so v2.6 milestone close knows the debt.

**Out of scope (deferred to Phase 87+ or v2.6 close debt)**:

- Token-waste/check + context-packet/build wire-in to ACTUAL orchestrator
  path (substantial integration; Phase 87 or v2.6 patch).
- CONTEXT-BENCH full-mode rerun (needs Claude CLI presence + clean
  environment; operator-led).
- New milestone-close gate that blocks v2.6 SHIPPED if any of these
  remain unaddressed (would require new gate definition; better as
  Phase 87 or v2.6 close addendum).

## Inputs

- Phase 85 `_tool_sgsd_recovery_packet` — substrate
- Phase 67 warp-doctor — 16-probe set (extending to 18)
- Phase 76 cockpit-state adapter — 10-section envelope (extending to 11)
- Phase 71 sgsd_token_spend — current context-size proxy
- Operator override message (verbatim above)

## Outputs

- super-gsd/tools/warp-mcp/server.cjs (UPDATED — recovery packet staleness; new sgsd_context_size tool OR extended token_spend)
- super-gsd/tools/warp-doctor/check.cjs (UPDATED — 2 new probes; PROBE_NAMES len=18)
- super-gsd/tools/cockpit-state/adapter.cjs (UPDATED — staleness section)
- super-gsd/scripts/lib/render-cockpit-snapshot.ps1 (UPDATED — render staleness)
- .planning/metrics/crit-backlog.jsonl (UPDATED — v2.6 debt rows)
- 5 Phase 86 standard artifacts

## Acceptance

1. Recovery packet returns `_state_staleness` field; live test confirms STATE.md drift visible.
2. warp-doctor PROBE_NAMES len=18; both new probes return real verdicts.
3. Cockpit adapter snapshot has 11 sections; staleness section populated.
4. Context-size warning threshold logic works (verified via fixture).
5. Resume command includes fresh-session recommendation when context > 200k.
6. CRIT-BACKLOG.jsonl gains rows for v2.6 unaddressed items.
7. All existing self-tests still PASS (warp-mcp 44 → 45+; warp-doctor 15 → 17+; cockpit-state 18 → 19+).

## Hard rule (operator override)

DO NOT advance to Phase 87 until Phase 86 is committed. The operator's
7-point list is the work. Phase 86 addresses 5 of 7 in scope; 2 of 7
become explicit v2.6 debt records.
