---
phase: 138
phase_name: Sticky Chrome Components + SSE Keep-Alive + Reconnect Badge
milestone: v3.4
ws: core
status: PENDING
created_at: 2026-05-24
predecessor: v3.4/P137 (PASS — _sources data emitted; data-conn placeholder reserved)
successor: v3.4/P139 (§1 Mission + §2 Telemetry component bodies)
---

# Phase 138 — Sticky Chrome + SSE Keep-Alive + Reconnect Badge — CONTEXT

## Goal

Make liveness operator-visible. Three deliverables:

1. **Sticky chrome components** rendered into the placeholders P136 reserved
   (chrome / command-strip / scanbar / sec-nav / bottom-drawer). Pure presentational
   client-side renderers consuming the snapshot keys P137 emits.
2. **15s SSE keep-alive ping** in `serve.cjs` (currently 25s — per v3.4 INTENT
   invariant #10 the contract is 15s; tightening makes "lost connection" detectable
   faster).
3. **EventSource auto-reconnect + visible badge** in `client.js`. The
   `<span data-conn="state">` placeholder reserved by P136 lights up with:
   - `SSE LIVE` (teal `var(--live)`) when connection is healthy
   - `RECONNECTING …` (amber `var(--attn)`) during reconnect attempts
   - `OFFLINE` (red `var(--severe)`) after N failed retries (N=5)
   - `STALE` (red `var(--severe)`) when last snapshot age > registry stale_after for any source
   Exponential backoff: 500ms, 1s, 2s, 4s, 8s, capped at 8s.

## Authoritative inputs

- `.planning/milestones/v3.4/INTENT.md` invariant #10 (liveness contract, 15s ping)
- `.planning/milestones/v3.4/design-pack/HANDOFF-PROMPT.md` §"INFORMATION ARCHITECTURE"
  (chrome / command / ScanBar / sec-nav layout)
- `.planning/milestones/v3.4/design-pack/Cockpit.html` — canonical chrome rendering
  (lines 90-300 cover the sticky chrome JS components)
- `super-gsd/tools/cockpit-sidecar/serve.cjs` (current 25s heartbeat at line 325-327)
- `super-gsd/tools/cockpit-sidecar/client.js` (current EventSource attach line 11)
- `super-gsd/tools/cockpit-sidecar/render-html.cjs` (renderShell — P136 baseline,
  has the placeholders this phase fills)

## Binding invariants

1. **Lock-13** — changes confined to `super-gsd/tools/cockpit-sidecar/`. Nothing in
   `cockpit-state/*`, `tests/cockpit-acceptance/*`, `tests/cockpit-regression/*`.
2. **Self-test stays ≥71/71 + 8 new P138 SACs = 79/79.**
3. **Renderer additive contract preserved** — chrome / command / scanbar render
   client-side via DOM injection. `renderHtml()` byte-shape unchanged.
   SAC-P127-* + SAC-P134-03 stay green.
4. **R18 / R19 binding preserved** — `data-band` markers unchanged; `_sources` fresh
   when test runs.
5. **No new top-level snapshot keys** — chrome consumes existing P137 keys
   (mission, agents, alarms, telemetry, _sources). P139-P142 emit real data; P138
   uses stubs.
6. **15s ping is the contract.** Reconnect threshold = 30s of silence
   (i.e. 2 missed pings) before the badge shows RECONNECTING.

## Scope

**In:**
- MODIFY `serve.cjs` — heartbeat 25000 → 15000ms.
- MODIFY `client.js` — add `connState` module: tracks EventSource state
  (live/reconnecting/offline/stale) via `onopen` + `onerror` + last-snapshot-age timer.
  Fills `<span data-conn="state">` textContent + sets `data-conn-tier` attribute on
  span for CSS color binding.
- MODIFY `client.js` — add `renderChrome(snapshot)` that fills the chrome region
  with milestone / phase / phase_name from snapshot (no innerHTML — textContent only
  to avoid XSS).
- MODIFY `client.js` — add `renderCommandStrip(snapshot)` filling command-strip with
  objective / next-action / owner / risk / time-left.
- MODIFY `client.js` — add `renderScanBar(snapshot)` filling scanbar with 6 cells:
  NOW / WHY / JUST CHANGED / RISK / DO NEXT / EVIDENCE.
- MODIFY `client.js` — add `renderSecNav(snapshot)` with 7 jump-to-section links
  plus a tiny per-section liveness pill (fresh/degraded/stale/dead from snapshot._sources).
- MODIFY `client.js` — wire hotkeys A (approve) / P (pause) / O (open) / Esc (abort).
  Stubs only — they `console.log` for now; P139+ wires real handlers.
- APPEND SAC-P138-01..08 to run-self-test.cjs.

**Out:**
- Component bodies for the 7 main sections (P139-P142).
- Server-side push of action commands from chrome controls (P141-P142).
- Real handler implementations for A/P/O/Esc (P139+ — they need REST endpoints).
- localStorage persistence of section collapsed state (P142).

## Semantic Acceptance Criteria (locked — verbatim in PLAN-LOCKED)

```
- id: SAC-P138-01
  input: "read serve.cjs"
  expected_outcome: "heartbeat setInterval value is 15000 (not 25000); writeSse keep-alive comment present"

- id: SAC-P138-02
  input: "read client.js"
  expected_outcome: "source contains connState (or equivalent named module) that responds to EventSource onopen + onerror; references the string 'RECONNECTING' AND 'SSE LIVE'"

- id: SAC-P138-03
  input: "read client.js"
  expected_outcome: "source contains exponential backoff logic with at least 500, 1000, 2000, 4000, 8000 ms values; OR a base*2^attempt expression evaluating to those values"

- id: SAC-P138-04
  input: "read client.js"
  expected_outcome: "source declares renderChrome AND renderCommandStrip AND renderScanBar AND renderSecNav functions"

- id: SAC-P138-05
  input: "read client.js"
  expected_outcome: "source registers keydown listener with cases or comparisons for 'A','P','O','Escape' (or 'Esc')"

- id: SAC-P138-06
  input: "renderShell() output unchanged byte-shape vs P136 (no new structural changes)"
  expected_outcome: "SAC-P136-01..05 still PASS; SAC-P132-06 still PASS"

- id: SAC-P138-07
  input: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs full suite"
  expected_outcome: "exit 0; total PASS = 79/79 (71 prior + 8 new); zero regression on SAC-P125..P137"

- id: SAC-P138-08
  input: "start server with start-cockpit-server.ps1, GET /events, observe first 16 seconds"
  expected_outcome: "at least 1 keep-alive line ': keep-alive' received in 16s window (proves 15s ping). SAC may be SKIPPED-ENV when running without a usable port (CI/headless); regular suite passes via static read of serve.cjs"
```

## Files

- **MODIFY** `super-gsd/tools/cockpit-sidecar/serve.cjs` — heartbeat 25s → 15s.
- **MODIFY** `super-gsd/tools/cockpit-sidecar/client.js` — connState + 4 renderers + hotkeys.
- **EXTEND** `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` — SAC-P138-01..08.

## Tasks

- **T1** — serve.cjs heartbeat tighten (one-line change).
- **T2** — client.js connState module + reconnect badge wiring.
- **T3** — client.js renderChrome + renderCommandStrip + renderScanBar + renderSecNav.
- **T4** — client.js hotkey listener (A/P/O/Esc stubs).
- **T5** — APPEND SAC-P138-01..08.
- **T6** — Phase-close artefacts.

## Provider routing

All 6 tasks orchestrator-direct. P137 close documented the Codex-skip rationale; the
client.js work is content-locked structural JS (no architectural ambiguity) and
Codex's Windows shell-block makes verification a round-trip burden.
