---
schema_version: 2
schema: plan-schema-v2
status: PLAN-LOCKED
plan_id: P132-01-localhost-live
phase_id: 132-cockpit-localhost-live
phase_number: 132
milestone: v3.3
workstream: core
title: Localhost-Live HTML Cockpit (PRIMARY SURFACE)
created_by: sgsd-write-plan (operator + Claude Opus 4.7)
created_at: 2026-05-24
locked: true
expected_ATC_tier: LITE
skip_gates: []
depends_on:
  - P131-01-eli5-upgraded
tasks:
  - id: P132-T1
    agent: sgsd-exec-backend
    model: codex
    files_touched:
      - super-gsd/tools/cockpit-sidecar/render-html.cjs
      - super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs
    input_contract: |-
      Reads existing cockpit-sidecar.cjs (post-P131; has renderHtml function
      around line 312). Reads 132-CONTEXT.md "render-html.cjs" section.
    output_contract: |-
      Creates render-html.cjs exporting renderHtml(output) (extracted from
      cockpit-sidecar.cjs verbatim) AND renderShell(opts) (returns static
      HTML scaffold with inlined sgsd-design-system.css + <main> with
      data-band='1', data-band='2', data-band='3' placeholders + <script
      src='/client.js'></script>).
      Modifies cockpit-sidecar.cjs: replaces inline renderHtml body with
      `return require('./render-html.cjs').renderHtml(output);`. Preserves
      the existing escapeHtml helper inline (or moves it to render-html.cjs).
      v3.2 --html flag behavior unchanged byte-for-byte for the same input.
    hypothesis: |-
      Extracting renderHtml is a pure refactor; cockpit-sidecar.cjs already
      delegates from `run()` so extracting the implementation to a module
      doesn't change call semantics.
    falsifier: |-
      If renderShell or renderHtml outputs differ byte-for-byte from v3.2
      for the same input, SAC-P132-06 fails.
    stop_rule: |-
      render-html.cjs exists with both exports; cockpit-sidecar.cjs --html
      still produces valid HTML; SAC-P132-06 passes (byte-stable renderHtml
      against fixture).

  - id: P132-T2
    agent: sgsd-exec-backend
    model: codex
    files_touched:
      - super-gsd/tools/cockpit-sidecar/serve.cjs
    input_contract: |-
      Requires P132-T1 render-html.cjs to exist. Requires cockpit-sidecar.cjs
      run() to be importable as a module. Reads 132-CONTEXT.md "serve.cjs"
      section + SAC-P132-01..05/07.
    output_contract: |-
      Creates serve.cjs as a Node http server. Entry point #!/usr/bin/env node.
      Args: --port (default 7777, accepts 0 for ephemeral), --workspace (default
      cwd).
      Routes:
        - GET / → renderShell() result; Content-Type: text/html
        - GET /client.js → readFileSync of ./client.js; Content-Type:
          application/javascript
        - GET /events → SSE stream; Content-Type: text/event-stream;
          send initial 'event: snapshot\ndata: {JSON}\n\n' within 100ms;
          keep-alive; on update broadcast 'event: snapshot\ndata: {JSON}\n\n'
        - GET /snapshot → application/json; body = current snapshot
        - Any other → 404
      Snapshot generation: invoke cockpit-sidecar.run([...]) or call
      .run({...json mode...}) — reuse existing logic to compute the full JSON
      output. Cache last snapshot in memory.
      Watching: fs.watch on 5 ledger files (paths derived from --workspace +
      relative paths from cockpit-sidecar DEFAULTS). Debounce 100ms.
      Lifecycle: write PID to .planning/runtime/cockpit-server.pid on start;
      SIGTERM → close all SSE conns, remove PID file, exit 0.
      Errors: EADDRINUSE → log to stderr, exit 1.
    hypothesis: |-
      Node built-in http + native fs.watch is sufficient for the cockpit's
      grain (1-2s freshness). SSE (HTTP-native) doesn't need websocket
      libraries. In-memory snapshot cache acceptable given single-user
      localhost use.
    falsifier: |-
      If fs.watch on Windows misses events for STATE.md frontmatter changes
      (known WSL/Windows fs.watch glitch on some hosts), SAC-P132-03 fails.
      Mitigation: 2-second polling fallback when fs.watch fires zero events
      in 5 seconds since last known mtime.
    stop_rule: |-
      serve.cjs starts; SAC-P132-01 (GET /) passes; SAC-P132-02 (GET /events)
      passes; SAC-P132-03 (fs.watch SSE) passes; SAC-P132-04 (GET /snapshot)
      passes; SAC-P132-05 (graceful shutdown) passes; SAC-P132-07
      (EADDRINUSE) passes.

  - id: P132-T3
    agent: sgsd-exec-ui
    model: codex
    files_touched:
      - super-gsd/tools/cockpit-sidecar/client.js
    input_contract: |-
      Requires P132-T1 render-html.cjs renderShell to define data-band
      placeholders. Reads 132-CONTEXT.md "client.js" section + SAC-P132-08.
    output_contract: |-
      Creates client.js (vanilla JS, ~150 lines max). On page load:
        - fetch('/snapshot').then(parse JSON) → render initial 3 bands by
          building HTML fragments for each band from the JSON
          (use template-literal HTML, write into element[data-band="N"].innerHTML).
        - new EventSource('/events') → onmessage: parse JSON; for each band
          (1, 2, 3): compute the band's HTML string; if different from last
          known, replace innerHTML.
      Band-render functions live inside client.js (parallel to server-side
      renderText logic but emitting HTML). Be pragmatic — use the renderHtml
      shape as a template if helpful.
    hypothesis: |-
      EventSource + DOM-diff at the band granularity (3 swap targets) is
      simple enough for vanilla JS without a framework. The grain is so
      small that any framework would be overkill.
    falsifier: |-
      If a band's HTML changes every event (e.g. timestamp inclusion) the
      "diff and only-replace-changed" check fires every time — not a
      correctness bug, just a slight performance non-optimization.
      Acceptable for v3.3.
    stop_rule: |-
      client.js exists; contains 'EventSource' string and 'data-band'
      selector (or querySelector with that attribute). SAC-P132-08 passes.

  - id: P132-T4
    agent: sgsd-exec-config
    model: codex
    files_touched:
      - super-gsd/scripts/start-cockpit-server.ps1
    input_contract: |-
      Reads 132-CONTEXT.md "start-cockpit-server.ps1" section.
    output_contract: |-
      Creates start-cockpit-server.ps1. Accepts -Port (default 7777),
      -Workspace (default cwd). Behavior:
        1. Ensure .planning/runtime/ exists.
        2. Spawn `node super-gsd/tools/cockpit-sidecar/serve.cjs --port $Port
           --workspace $Workspace` as a background process. Capture PID.
        3. Write PID to .planning/runtime/cockpit-server.pid.
        4. Poll http://localhost:$Port/snapshot up to 5 seconds (1 attempt/500ms);
           if 200 → write success message + exit 0; else kill the process,
           remove PID file, exit non-zero.
      No PSScriptAnalyzer dependencies; native PowerShell only.
    hypothesis: |-
      Background process pattern with PID + health-poll is the standard
      SGSD bootstrap shape (mirrors gsd-monitor.sh and other launch scripts).
    falsifier: |-
      Windows PowerShell's `Start-Process -PassThru` may return a process
      object whose Id is the wrapper, not the actual node child. Mitigation:
      use Invoke-Expression or Start-Job with explicit child PID capture.
    stop_rule: |-
      Script exists. Manual invocation (orchestrator runs once)
      lands a running server with a healthy /snapshot endpoint within 5s.

  - id: P132-T5
    agent: sgsd-exec-test
    model: codex
    files_touched:
      - super-gsd/tools/cockpit-sidecar/run-self-test.cjs
    input_contract: |-
      Requires P132-T1..T4 complete. Reads 132-CONTEXT.md SAC-P132-01..08
      verbatim.
    output_contract: |-
      EXTEND run-self-test.cjs (pure append). Add SAC-P132-01..08 entries
      after the SAC-P131-04 block. Each test spawns serve.cjs as a child
      process on an ephemeral port (--port 0; server logs the bound port
      to stdout/stderr first line), runs the assertion via http(s) requests
      from inside the test, tears down via SIGTERM, asserts the resource
      cleanup.
      Use Node http module for client requests (no fetch polyfill needed).
      Each test should be self-contained: spawn, assert, kill, cleanup.
      Allow up to 3 seconds per test for the SSE-driven ones.
    hypothesis: |-
      Spawn+http-probe is a reliable test pattern for this kind of server.
    falsifier: |-
      If ephemeral-port mode is hard to parse from serve.cjs stdout, tests
      need explicit port parameter. Mitigation: serve.cjs prints
      "listening port: NNNN" to stderr on bind so tests can read+parse.
    stop_rule: |-
      Full self-test: 50/50 PASS exit 0; per-SAC --sac SAC-P132-NN exits 0
      for each NN in 01..08.

  - id: P132-T6
    agent: sgsd-exec-docs
    model: codex
    files_touched:
      - .planning/milestones/v3.3/phases/132-cockpit-localhost-live/132-VERIFICATION.md
      - .planning/milestones/v3.3/phases/132-cockpit-localhost-live/PHASE-CAPSULE.json
    input_contract: |-
      Green self-test + git log. Mirror P131 VERIFICATION/CAPSULE shape.
    output_contract: |-
      VERIFICATION verdict=PASS, 8/8 SACs, deviations recorded.
      CAPSULE with SHA-256 hashes.
    hypothesis: |-
      Deterministic projection.
    falsifier: |-
      Self-test not green.
    stop_rule: |-
      Both files exist; verdict=PASS; valid JSON capsule.
    depends_on:
      - P132-T1
      - P132-T2
      - P132-T3
      - P132-T4
      - P132-T5
semantic_acceptance_criteria:
  - id: SAC-P132-01
    input: "spawn serve.cjs on ephemeral port; GET /"
    expected_outcome: "200 OK; Content-Type: text/html; body length > 1000; body contains v3.2 design-system CSS markers (e.g. --gold or sgsd-design-system literal)"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P132-01"
  - id: SAC-P132-02
    input: "GET /events"
    expected_outcome: "200 OK; Content-Type: text/event-stream; first 'event: snapshot' frame received within 500ms of connect"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P132-02"
  - id: SAC-P132-03
    input: "spawn serve.cjs; touch .planning/STATE.md; wait up to 2000ms for new SSE event"
    expected_outcome: "an additional 'event: snapshot' frame is delivered after the touch (fs.watch-driven push)"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P132-03"
  - id: SAC-P132-04
    input: "GET /snapshot"
    expected_outcome: "200; Content-Type application/json; JSON.parse succeeds; result contains north_star + stage_pipeline + rationale keys"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P132-04"
  - id: SAC-P132-05
    input: "spawn serve.cjs; send SIGTERM"
    expected_outcome: "process exits within 2000ms; .planning/runtime/cockpit-server.pid file is removed; exit code 0"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P132-05"
  - id: SAC-P132-06
    input: "renderHtml from the extracted render-html.cjs invoked on a fixture cockpit output object"
    expected_outcome: "returns valid HTML string containing v3.2 design-system markers AND data-band attributes for bands 1, 2, 3; no regression from v3.2 behavior"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P132-06"
  - id: SAC-P132-07
    input: "spawn serve.cjs on fixed port; spawn second instance on same port"
    expected_outcome: "second instance exits non-zero within 2000ms with EADDRINUSE-related stderr; first instance remains alive"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P132-07"
  - id: SAC-P132-08
    input: "GET /client.js"
    expected_outcome: "200; Content-Type application/javascript; body contains 'EventSource' substring AND a 'data-band' attribute selector"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P132-08"
---

# P132-01 Localhost-Live HTML Cockpit PLAN (PRIMARY SURFACE)

## Scope

Build the primary live operator surface. Node http server + SSE + fs.watch + DOM-diff browser SPA + boot wrapper. Extracts renderHtml to a module so v3.2 `--html` snapshot still works. 8 SAC tests; biggest phase of v3.3.

## Authoritative Inputs

132-CONTEXT.md, v3.2 cockpit-sidecar.cjs (renderHtml extraction source), sgsd-design-system.css (P120 shared), all post-P131 cockpit-sidecar modules.

## Binding Invariants

Per 132-CONTEXT.md (7 invariants).

## File Operations

6 task-level operations; full table in 132-CONTEXT.md "Files touched".

## Tasks

6 tasks; full contracts in frontmatter.

## Phase Verification

`node run-self-test.cjs` → exit 0; 50/50 PASS (42 pre + 8 SAC-P132-NN).

## Out of Scope

Per 132-CONTEXT.md.

## References

132-CONTEXT.md; v3.3 brief P132; v3.2 `--html` predecessor.
