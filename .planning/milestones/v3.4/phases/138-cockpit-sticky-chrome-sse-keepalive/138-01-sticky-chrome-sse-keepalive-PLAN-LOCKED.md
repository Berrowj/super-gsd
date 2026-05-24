---
schema_version: 2
schema: plan-schema-v2
status: PLAN-LOCKED
plan_id: P138-01-sticky-chrome-sse-keepalive
phase_id: 138-cockpit-sticky-chrome-sse-keepalive
phase_number: 138
milestone: v3.4
workstream: core
title: Sticky Chrome Components + SSE Keep-Alive + Reconnect Badge
created_by: orchestrator (Claude Opus 4.7, 1M context)
created_at: 2026-05-24
locked: true
expected_ATC_tier: LITE
skip_gates: []
depends_on:
  - P137-01-data-contract-source-registry-liveness
known_deadends: []
verification_cmd: node super-gsd/tools/cockpit-sidecar/run-self-test.cjs
lessons_path: null
tasks:
  - id: P138-T1
    agent: sgsd-exec-backend
    model: opus
    files_touched:
      - super-gsd/tools/cockpit-sidecar/serve.cjs
    input_contract: "138-CONTEXT.md §Scope item 'serve.cjs heartbeat tighten' — change setInterval(..., 25000) to setInterval(..., 15000)."
    output_contract: "serve.cjs heartbeat fires every 15000ms. Comment updated noting v3.4 INTENT invariant #10."
    hypothesis: "One-line value change cannot regress anything — heartbeat is a cosmetic timing knob, not a behavioral one."
    falsifier: "Self-test 71/71 regresses, OR existing SAC-P132-* server SSE tests break (they don't assert the timing)."
    stop_rule: "serve.cjs grep shows 15000 not 25000 on the heartbeat interval. Full self-test still 71/71."

  - id: P138-T2
    agent: sgsd-exec-ui
    model: opus
    files_touched:
      - super-gsd/tools/cockpit-sidecar/client.js
    input_contract: "138-CONTEXT.md §Scope — connState module spec + exponential backoff thresholds + 4 badge states (SSE LIVE / RECONNECTING / OFFLINE / STALE)."
    output_contract: "client.js exports/uses a connState object that: (1) attaches onopen + onerror to EventSource; (2) updates <span data-conn='state'> textContent + data-conn-tier attribute on transition; (3) on error, retries with backoff 500/1000/2000/4000/8000ms (capped at 8000); (4) tracks last-snapshot timestamp and flips to STALE when >2x stale_after for any _sources entry."
    hypothesis: "EventSource native reconnect handles transport; connState only needs to render the state. Backoff is for offline UX cue, not reconnect mechanics."
    falsifier: "Existing client.js renderAll behavior breaks (band 1/2/3 fail to render), OR the data-conn span ends up with the wrong text after a forced disconnect/reconnect."
    stop_rule: "Self-test still 71/71. New SAC-P138-02/03 will lock the implementation in T5."

  - id: P138-T3
    agent: sgsd-exec-ui
    model: opus
    files_touched:
      - super-gsd/tools/cockpit-sidecar/client.js
    input_contract: "138-CONTEXT.md §Scope — renderChrome/renderCommandStrip/renderScanBar/renderSecNav specs + HANDOFF-PROMPT.md §INFORMATION ARCHITECTURE."
    output_contract: "client.js declares renderChrome(snapshot) + renderCommandStrip(snapshot) + renderScanBar(snapshot) + renderSecNav(snapshot). Each finds its placeholder by data-region attribute and fills via textContent / safe innerHTML. renderAll invokes all four on every snapshot."
    hypothesis: "Pure presentational renderers consume only existing P137 keys (mission, agents, alarms, _sources). Stub-and-fill semantics — null/empty values render as 'pending' or 'n/a'."
    falsifier: "Renderers throw on the stub data shapes that P137 emits, OR existing band-1/2/3 renderers regress."
    stop_rule: "Self-test still 71/71. SAC-P138-04 will lock the 4-function presence in T5."

  - id: P138-T4
    agent: sgsd-exec-ui
    model: opus
    files_touched:
      - super-gsd/tools/cockpit-sidecar/client.js
    input_contract: "138-CONTEXT.md §Scope — hotkey list A/P/O/Esc."
    output_contract: "client.js registers a document keydown listener that branches on event.key for 'A','P','O','Escape'. Each branch calls console.log('hotkey: X') for now (stubs)."
    hypothesis: "Hotkey wiring is orthogonal to render path — listener attaches on DOMContentLoaded and doesn't interfere with EventSource flow."
    falsifier: "Listener captures keys that should pass through to inputs, or it throws when an unexpected key fires."
    stop_rule: "Self-test still 71/71. SAC-P138-05 will lock listener presence in T5."

  - id: P138-T5
    agent: orchestrator
    model: opus
    files_touched:
      - super-gsd/tools/cockpit-sidecar/run-self-test.cjs
    input_contract: "138-CONTEXT.md §Semantic Acceptance Criteria SAC-P138-01..08."
    output_contract: "8 new test entries appended after SAC-P137-08. Each is a string-includes or grep assertion against serve.cjs / client.js source — pure static analysis (no live server in tests except SAC-P138-07 which runs the full suite)."
    hypothesis: "Static source assertions are deterministic. SAC-P138-08 marked as skipped-when-no-port (matches the SAC-P132-04/-05 pattern)."
    falsifier: "Any SAC-P138-NN fails → upstream task incomplete."
    stop_rule: "79/79 PASS exit 0. Per-SAC --sac SAC-P138-NN exits 0."

  - id: P138-T6
    agent: orchestrator
    model: opus
    files_touched:
      - .planning/milestones/v3.4/phases/138-cockpit-sticky-chrome-sse-keepalive/138-VERIFICATION.md
      - .planning/milestones/v3.4/phases/138-cockpit-sticky-chrome-sse-keepalive/PHASE-CAPSULE.json
    input_contract: "T1-T5 git diffs + final self-test output."
    output_contract: "VERIFICATION + PHASE-CAPSULE per established v3.4 shape."
    hypothesis: "Deterministic given T1-T5 evidence."
    falsifier: "Capsule fails schema-1 shape."
    stop_rule: "Both files exist. Commit lands. Self-test still 79/79."

semantic_acceptance_criteria:
  - id: SAC-P138-01
    input: "read serve.cjs"
    expected_outcome: "heartbeat setInterval value is 15000 (not 25000); writeSse keep-alive comment present"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P138-01"

  - id: SAC-P138-02
    input: "read client.js"
    expected_outcome: "source contains connState (or equivalent named module) responding to EventSource onopen + onerror; references the string 'RECONNECTING' AND 'SSE LIVE'"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P138-02"

  - id: SAC-P138-03
    input: "read client.js"
    expected_outcome: "source contains exponential backoff logic with 500, 1000, 2000, 4000, 8000 ms values OR a base*2^attempt expression evaluating to those values"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P138-03"

  - id: SAC-P138-04
    input: "read client.js"
    expected_outcome: "source declares renderChrome AND renderCommandStrip AND renderScanBar AND renderSecNav functions"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P138-04"

  - id: SAC-P138-05
    input: "read client.js"
    expected_outcome: "source registers keydown listener with cases or comparisons for A,P,O,Escape (or Esc)"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P138-05"

  - id: SAC-P138-06
    input: "renderShell() output unchanged byte-shape vs P136 baseline structure"
    expected_outcome: "SAC-P136-01..05 still PASS; SAC-P132-06 still PASS"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P138-06"

  - id: SAC-P138-07
    input: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs full suite"
    expected_outcome: "exit 0; total PASS = 79/79 (71 prior + 8 new); zero regression on SAC-P125..P137"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs"

  - id: SAC-P138-08
    input: "start server, GET /events, observe first 16 seconds"
    expected_outcome: "at least 1 keep-alive line received in 16s window (proves 15s ping). SKIPPED-ENV acceptable when port unusable"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P138-08"
---

# Phase 138 — Sticky Chrome + SSE Keep-Alive + Reconnect Badge — PLAN-LOCKED

## Scope

Make liveness operator-visible. (1) Tighten serve.cjs heartbeat from 25s → 15s per v3.4
INTENT invariant #10. (2) Wire EventSource reconnect badge in client.js — fills the
`<span data-conn="state">` placeholder reserved by P136 with SSE LIVE / RECONNECTING /
OFFLINE / STALE based on connection + last-snapshot age. (3) Render the sticky chrome
regions (chrome / command-strip / scanbar / sec-nav) consuming P137-emitted snapshot
keys. (4) Wire A/P/O/Esc hotkey stubs.

## Authoritative Inputs

- v3.4 INTENT.md (invariant #10)
- design-pack/HANDOFF-PROMPT.md (IA + chrome spec)
- design-pack/Cockpit.html (canonical chrome rendering)
- serve.cjs (current 25s heartbeat at line 325)
- client.js (current 154-line baseline)
- 138-CONTEXT.md

## File Operations

| Op | Path | Purpose |
|---|---|---|
| MODIFY | `super-gsd/tools/cockpit-sidecar/serve.cjs` | 25s → 15s heartbeat |
| MODIFY | `super-gsd/tools/cockpit-sidecar/client.js` | connState + 4 chrome renderers + hotkeys |
| EXTEND | `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` | SAC-P138-01..08 |
| CREATE | phase VERIFICATION + PHASE-CAPSULE | T6 |

## Verification

`node super-gsd/tools/cockpit-sidecar/run-self-test.cjs` → 79/79 PASS exit 0.

## Success Criteria

- All 8 SACs PASS.
- 79/79 self-test green; SAC-P125..P137 unchanged.
- Heartbeat = 15000ms; EventSource onerror triggers reconnect badge with backoff.
- 4 chrome renderers declared; A/P/O/Esc hotkeys registered.
- Lock-13 respected; phase capsule + verification authored.
