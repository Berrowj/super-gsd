---
phase: 132
phase_name: Localhost-Live HTML Cockpit
milestone: v3.3
ws: core
created: 2026-05-24
status: queued-planning
implementation_status: not-started
source: v3.3 brief P132 (PRIMARY SURFACE) + plan P132 scoped summary
predecessor: P131 PASS (ELI5 upgraded; 42/42 self-test)
unlocks: [P134 (conformance covers all 4 surfaces including localhost-live)]
---

# Phase 132 — Localhost-Live HTML Cockpit

> **PRIMARY OPERATOR SURFACE.** Node http server with Server-Sent Events (SSE) + `fs.watch` serving the 3-band cockpit as a live HTML SPA at `localhost:7777`. DOM-diff client (vanilla JS, no framework). Reuses v3.2 `--html` renderer + v3.2 `sgsd-design-system.css`. PowerShell monitor demoted to terminal fallback during transition.

## Goal

After P132:
- `node super-gsd/tools/cockpit-sidecar/serve.cjs --port 7777` starts an http server serving:
  - `GET /` → the HTML shell with inlined design-system CSS
  - `GET /events` → SSE stream emitting cockpit JSON snapshots
  - `GET /snapshot` → on-demand JSON
- `fs.watch` on 5 ledger files (`.planning/STATE.md`, `chronicle/INDEX.jsonl`, `metrics/chronicle-validation-log.jsonl`, `metrics/codex-executor-log.jsonl`, `metrics/token-attribution.jsonl`) triggers re-render + SSE broadcast within 500ms of any change.
- Browser-side `client.js` subscribes to `/events`, diffs against last snapshot, replaces only changed `data-band="N"` elements (no full-page repaint).
- `super-gsd/scripts/start-cockpit-server.ps1` boots the server, writes PID to `.planning/runtime/cockpit-server.pid`, polls health for ≤5s.
- v3.2 `--html` static snapshot mode preserved (Codex executor reports still work).
- 8 SAC tests.

## Binding invariants

1. **Lock-13 untouched** — all work in `super-gsd/tools/cockpit-sidecar/` (new files) + `super-gsd/scripts/start-cockpit-server.ps1` (new boot).
2. **`--json` and `--html` contracts preserved** — extracting renderHtml to a module is mechanical; old call sites still work.
3. **No external dependencies** — pure Node built-ins (`http`, `fs`, `path`, `child_process`). Browser JS uses native EventSource + DOM APIs. NO React/Vue/framework.
4. **Offline-survivable** — design-system CSS inlined; no external font/CDN/JS.
5. **Deterministic SSE payloads** — server emits the same cockpit-sidecar.cjs `--json` output; pure projection.
6. **Graceful shutdown** — SIGTERM closes all SSE connections + removes PID file.
7. **Port conflict handling** — second invocation on same port exits non-zero with clear EADDRINUSE message.

## What ships

### `super-gsd/tools/cockpit-sidecar/render-html.cjs` (new)

Exports `renderHtml(output)` and `renderShell(opts)`. `renderHtml` is the existing implementation from cockpit-sidecar.cjs (extracted). `renderShell` returns the static HTML scaffold the SPA loads first (inlines design-system CSS + `<main>` skeleton with `data-band="1|2|3"` placeholders + `<script>` loading `/client.js`).

### `super-gsd/tools/cockpit-sidecar/serve.cjs` (new)

Node http server. Entry point.
- Endpoints: `GET /` (shell), `GET /client.js` (browser script), `GET /events` (SSE), `GET /snapshot` (JSON).
- `fs.watch` on 5 ledger files (debounced 100ms).
- On change → re-run cockpit-sidecar.cjs --json (via `require` + `run`) → broadcast updated snapshot via SSE.
- Graceful SIGTERM: write `[]` to clients, end connections, remove PID file, exit 0.
- Args: `--port N` (default 7777), `--workspace DIR` (default cwd).

### `super-gsd/tools/cockpit-sidecar/client.js` (new)

Browser-side. Vanilla JS.
- On load: fetch `/snapshot`, render the 3 bands into `data-band` placeholders.
- Subscribe to `/events` via `EventSource`. On message: parse JSON, diff against last snapshot, replace only changed `data-band` element innerHTML.
- ~150 lines max.

### `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` (modified, minimal)

Replace inline `renderHtml()` with `require('./render-html.cjs').renderHtml(...)`. Keep `--html` flag working as snapshot path.

### `super-gsd/scripts/start-cockpit-server.ps1` (new)

Boot wrapper. Reads `--Port` (default 7777). Spawns `node serve.cjs --port {Port}`. Writes PID to `.planning/runtime/cockpit-server.pid`. Polls `http://localhost:{port}/snapshot` up to 5s for 200 response; exits 0 on success, non-zero on timeout.

### `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` (extended, pure append)

SAC-P132-01..08 appended.

## Semantic acceptance criteria

```yaml
semantic_acceptance_criteria:
  - id: SAC-P132-01
    input: "spawn serve.cjs on ephemeral port; GET / returns 200; Content-Type: text/html; body length > 1000 bytes; body inlines design-system CSS markers"
    expected_outcome: "shell page served correctly with inlined CSS"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P132-01"
  - id: SAC-P132-02
    input: "spawn serve.cjs; GET /events; first event received within 200ms; Content-Type: text/event-stream"
    expected_outcome: "SSE stream connects and emits initial snapshot"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P132-02"
  - id: SAC-P132-03
    input: "spawn serve.cjs; touch .planning/STATE.md (no-op fs.utimes); within 1000ms an SSE event is delivered"
    expected_outcome: "fs.watch-driven SSE push works"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P132-03"
  - id: SAC-P132-04
    input: "GET /snapshot"
    expected_outcome: "200; Content-Type application/json; parseable; contains north_star + stage_pipeline + rationale keys"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P132-04"
  - id: SAC-P132-05
    input: "spawn serve.cjs with --port 0; let it pick port; send SIGTERM; observe PID file removed and process exited cleanly within 2s"
    expected_outcome: "graceful shutdown"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P132-05"
  - id: SAC-P132-06
    input: "renderHtml on a sample cockpit output (post-extraction)"
    expected_outcome: "still returns valid HTML containing the design-system inline styles; matches v3.2 --html behavior byte-for-byte for the same input (no regression)"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P132-06"
  - id: SAC-P132-07
    input: "spawn serve.cjs on a fixed port; spawn a second instance on the same port"
    expected_outcome: "second instance exits non-zero with EADDRINUSE-related stderr; first instance remains alive"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P132-07"
  - id: SAC-P132-08
    input: "GET /client.js"
    expected_outcome: "200; Content-Type application/javascript; body contains EventSource + at least one data-band selector"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P132-08"
```

## Files touched

| Operation | Path |
|---|---|
| CREATE | `super-gsd/tools/cockpit-sidecar/render-html.cjs` (T1) |
| CREATE | `super-gsd/tools/cockpit-sidecar/serve.cjs` (T2) |
| CREATE | `super-gsd/tools/cockpit-sidecar/client.js` (T3) |
| MODIFY | `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` (T4) |
| CREATE | `super-gsd/scripts/start-cockpit-server.ps1` (T5) |
| EXTEND | `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` (T6) |
| CREATE | `132-VERIFICATION.md` + `PHASE-CAPSULE.json` (T7) |

## Out of scope

- No PowerShell monitor keep/kill migration (P133).
- No conformance gate changes (P134).
- No authentication / TLS / cross-host serving — strictly `localhost:7777`.
- No persistence layer — SSE is ephemeral; server holds last snapshot in memory only.

## Source references

- v3.3 brief P132 spec
- v3.3 plan P132 scoped summary
- v3.2 `--html` static snapshot (predecessor renderer to extract)
- v3.2 `sgsd-design-system.css` (P120 shared design system)
