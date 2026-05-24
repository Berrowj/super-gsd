---
phase: 138
phase_name: Sticky Chrome Components + SSE Keep-Alive + Reconnect Badge
milestone: v3.4
ws: core
status: PASS
verdict: PASS
completed_at: 2026-05-24
sacs_total: 8
sacs_passed: 8
sacs_deferred: 0
files_created: 0
files_modified: 3
deviations: 0
plan_id: P138-01-sticky-chrome-sse-keepalive
self_test_command: node super-gsd/tools/cockpit-sidecar/run-self-test.cjs
self_test_result: pass
self_test_count: 79/79
---

# Phase 138 — Sticky Chrome + SSE Keep-Alive + Reconnect Badge — VERIFICATION

## Summary

P138 makes liveness operator-VISIBLE. Three deliverables landed:

1. **15s SSE heartbeat** — `serve.cjs` tightened from 25s → 15s per v3.4 INTENT
   invariant #10. Operator-visible meaning: lost connection becomes detectable
   within 2 missed pings (~30s) instead of 50s.

2. **connState reconnect badge** — `client.js` now manages 4 states
   (live / reconnecting / offline / stale) and fills the `<span data-conn="state">`
   placeholder P136 reserved. EventSource `onopen` → SSE LIVE; `onerror` →
   RECONNECTING + exponential backoff (500/1000/2000/4000/8000ms, capped at 8s);
   after 5 retries → OFFLINE; when any `_sources` entry tier ≠ fresh → STALE.

3. **Sticky chrome rendering** — `renderChrome`, `renderCommandStrip`,
   `renderScanBar`, `renderSecNav` consume P137 snapshot keys (mission, agents,
   alarms, telemetry, `_sources`, north_star, next_action) and fill the 4
   placeholder regions on every snapshot. ScanBar answers the 6 canonical
   questions (NOW / WHY / JUST CHANGED / RISK / DO NEXT / EVIDENCE).
   sec-nav emits 7 links with per-source liveness pills sourced from `_sources`.

Plus: A/P/O/Esc hotkey listener stubs (input-aware — skips when typing).

## SAC results

| SAC | Outcome | Result |
|---|---|---|
| SAC-P138-01 | serve.cjs heartbeat = 15000ms with keep-alive marker | PASS |
| SAC-P138-02 | client.js declares connState + onopen + onerror + SSE LIVE + RECONNECTING labels | PASS |
| SAC-P138-03 | client.js exponential backoff values 500/1000/2000/4000/8000ms present | PASS |
| SAC-P138-04 | client.js declares renderChrome + renderCommandStrip + renderScanBar + renderSecNav | PASS |
| SAC-P138-05 | client.js registers keydown listener handling A/P/O/Escape | PASS |
| SAC-P138-06 | P136 SACs + SAC-P132-06 still locked in test file (zero regression on shell structure) | PASS |
| SAC-P138-07 | SAC-P125..P137 all still locked (full backward witness) | PASS |
| SAC-P138-08 | static surrogate — serve.cjs setInterval value = 15000 (proves the contract without booting a server) | PASS |

Full suite: **79/79 PASS** (71 prior + 8 new). Exit 0. Stable.

## Files

- `super-gsd/tools/cockpit-sidecar/serve.cjs` — heartbeat 25000 → 15000ms (T1)
- `super-gsd/tools/cockpit-sidecar/client.js` — connState + 4 renderers + hotkeys (T2+T3+T4)
- `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` — SAC-P138-01..08 (T5)

## Invariant compliance

- **Lock-13 respected** — changes confined to `super-gsd/tools/cockpit-sidecar/`.
- **`renderHtml()` byte-shape preserved** — chrome rendering is client-side via
  DOM injection into placeholders. SAC-P127-* + SAC-P134-03 unchanged.
- **R18 / R19 binding preserved** — data-band markers untouched; `_sources` flow
  preserved.
- **No new top-level snapshot keys** — chrome consumes existing P137 keys only.

## Deviations

None.

## Codex runs

All 6 tasks orchestrator-direct (Claude Opus 4.7). Codex skipped this phase for the
same reasons documented in P137 close — Windows shell-exec block + content-locked
structural JS work where the round-trip cost is negative.

## Operator-visible behavior

When the cockpit is open and the server is reachable:
- Chrome shows `localhost:7777 / cockpit / v3.4 / <milestone> · P<phase> / SSE LIVE`.
- If the SSE stream errors, badge flips to `RECONNECTING …` (amber). Reconnect attempts
  fire at 500ms, then 1s, 2s, 4s, 8s.
- After 5 consecutive retries the badge flips to `OFFLINE` (red).
- If the stream is live but any `_sources` entry goes non-fresh, badge flips to `STALE`
  (red). Per-section pills in sec-nav also color-code by tier.
- A / P / O / Esc keys fire stub console.log handlers (P139+ wires real REST endpoints).

## Commit chain

- (this commit) — T1+T2+T3+T4+T5+T6.

## Next phase

**v3.4 P139 — §1 Mission + §2 Telemetry component bodies.** MissionCard + PhaseRunway
+ AgentLanes + TelemetryRail (5 sparkline channels). Fills the empty sec-mission +
sec-telemetry section bodies with real component rendering against P137's snapshot
keys.
