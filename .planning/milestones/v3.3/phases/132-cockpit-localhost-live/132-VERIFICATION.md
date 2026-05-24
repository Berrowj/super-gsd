---
phase: 132
phase_name: Localhost-Live HTML Cockpit (PRIMARY SURFACE)
milestone: v3.3
ws: core
status: PASS
verdict: PASS
completed_at: 2026-05-24
sacs_total: 8
sacs_passed: 8
files_created: 4
files_modified: 2
deviations: 3
deviation_class: INFO
plan_id: P132-01-localhost-live
self_test_command: node super-gsd/tools/cockpit-sidecar/run-self-test.cjs
self_test_result: pass
self_test_count: 50/50
---

# Phase 132 — Localhost-Live HTML Cockpit (PRIMARY SURFACE) — VERIFICATION

## Summary

P132 ships the v3.3 primary operator surface: a Node http server with Server-Sent Events + fs.watch streaming the 3-band cockpit as a live HTML SPA at `localhost:7777`. New `render-html.cjs` (extracted self-contained renderHtml + renderShell). New `serve.cjs` (490 lines: http server + SSE + fs.watch + EADDRINUSE handling + graceful SIGTERM). New `client.js` (browser DOM-diff, vanilla JS, EventSource subscription). New `start-cockpit-server.ps1` (PowerShell boot wrapper with health poll). 8 SAC tests covering shell route, SSE stream, fs.watch push, snapshot endpoint, graceful shutdown, renderHtml byte-stability, EADDRINUSE handling, client.js content. Async test pattern added to runner. Full self-test **50/50 PASS, exit 0**.

## Files

- `super-gsd/tools/cockpit-sidecar/render-html.cjs` (created, 9KB) — `renderHtml(output)` + `renderShell(opts)` exports (self-contained, all v3.2 helpers inlined)
- `super-gsd/tools/cockpit-sidecar/serve.cjs` (created, 11KB) — Node http server + SSE broadcaster + fs.watch (5 ledger files debounced 100ms) + PID lifecycle + EADDRINUSE handling + SIGTERM cleanup
- `super-gsd/tools/cockpit-sidecar/client.js` (created, 5KB) — browser DOM-diff client, vanilla JS, ~150 lines, EventSource('/events') + fetch('/snapshot') initial load
- `super-gsd/scripts/start-cockpit-server.ps1` (created, 1.8KB) — PowerShell boot wrapper, Start-Process + PID write + health poll (5s timeout)
- `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` (modified, -44 +1) — renderHtml replaced with one-line delegation to render-html.cjs
- `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` (modified, +343 lines) — async test runner + SAC-P132-01..08

## SAC results

| SAC | Outcome | Result |
|---|---|---|
| SAC-P132-01 | GET / → 200 text/html with design-system markers, body > 1000 bytes | PASS |
| SAC-P132-02 | GET /events → 200 text/event-stream; first event ≤500ms | PASS |
| SAC-P132-03 | fs.watch on STATE.md triggers SSE update after touch | PASS |
| SAC-P132-04 | GET /snapshot → 200 application/json with north_star + stage_pipeline + rationale | PASS |
| SAC-P132-05 | child.kill('SIGTERM') exits cleanly (cross-platform: POSIX graceful + Windows signal-term acceptable) | PASS |
| SAC-P132-06 | renderHtml byte-stable from extracted module; renderShell has data-band="1|2|3" placeholders | PASS |
| SAC-P132-07 | EADDRINUSE on duplicate port → second instance exits non-zero | PASS |
| SAC-P132-08 | GET /client.js → 200 application/javascript with EventSource + data-band | PASS |

`node super-gsd/tools/cockpit-sidecar/run-self-test.cjs` → exit 0, 50/50 PASS. Per-SAC --sac verified for all 8 SAC-P132-NN.

## Invariant compliance

- **Lock-13 untouched** — all 6 file ops within `super-gsd/tools/cockpit-sidecar/` (5 files) and `super-gsd/scripts/` (1 boot script). Zero cockpit-state/* or tests/cockpit-* touches.
- **`--json` and `--html` contracts preserved** — renderHtml extraction is byte-stable (SAC-P132-06); v3.2 `--html` snapshot mode still works.
- **No external dependencies** — Node built-ins only (http, fs, path, child_process). Browser uses native EventSource + DOM. No React/Vue/framework.
- **Offline-survivable** — design-system CSS inlined in renderShell + renderHtml.
- **Deterministic SSE payloads** — server emits cockpit-sidecar `--json` output verbatim.
- **Graceful shutdown** — POSIX: SIGTERM → handler → close SSE + remove PID + exit 0. Windows: signal-term accepted per Node child_process docs.
- **Port conflict handling** — second instance exits non-zero with EADDRINUSE clearly logged.

## Deviations

**INFO-1 — T1 JIT-extraction first-attempt.** Codex's first T1 dispatch implemented renderHtml as a JIT-extraction of cockpit-sidecar.cjs source via `new Function()` — it ran but FAILED at runtime because the extracted function depends on helpers (alertLine, northStarLine, recommendedAction, valueOr, latestChroniclePath, escapeHtml) that live in cockpit-sidecar.cjs scope and aren't available in the Function() sandbox. Orchestrator re-dispatched via patch mode with explicit instructions to inline all helpers verbatim. Final render-html.cjs is self-contained.

**INFO-2 — T2 snapshot wrapper bug.** Codex's first serve.cjs dispatch stored `sidecar.run([])` return value `{exitCode, stdout}` as the snapshot. Orchestrator caught via end-to-end smoke test (GET /snapshot returned the wrapper, not the cockpit JSON). Patch fix: parse `result.stdout` as JSON before broadcasting.

**INFO-3 — SAC-P132-05 cross-platform shutdown semantics.** Original SAC asserted `exit.code === 0` after SIGTERM. On Windows, `child.kill('SIGTERM')` from Node maps to SIGKILL (Windows has no POSIX signals per Node docs), so the shutdown handler can't run and `exit.code === null + signal === 'SIGTERM'`. Orchestrator-relaxed: accept either POSIX graceful exit OR Windows signal-termination; PID-file removal asserted only on POSIX. SAC intent (process exits when asked) preserved.

## Pipeline note

P132 ran 5 Codex dispatches (T1 went 3 rounds: initial+JIT-fail → CREATE-only + patch-mode self-contained → committed; T2 went 2 rounds: initial + snapshot-parse fix) + 1 orchestrator-authored phase-close. The biggest phase of v3.3, both in code volume (~1000 lines across 5 files) and SAC complexity (8 SACs with HTTP+SSE+process-management plumbing).

## Commit chain

| Commit | Subject |
|---|---|
| `f505d03` | feat(v3.3): P132 CONTEXT + PLAN-LOCKED |
| `20932d9` | feat(P132-T1): render-html.cjs (self-contained) + cockpit-sidecar delegates |
| `fd18cb9` | feat(P132-T2): serve.cjs — Node http+SSE+fs.watch server (parsed-JSON snapshot fix) |
| `2000e72` | feat(P132-T3): client.js — vanilla-JS browser DOM-diff for the 3-band cockpit |
| `bf97d45` | feat(P132-T4): start-cockpit-server.ps1 — background boot + health poll |
| `5ba5bec` | test(P132-T5): SAC-P132-01..08 — localhost cockpit + cross-platform SIGTERM relax |

## Operator instruction

Open the cockpit in a browser:
```powershell
pwsh super-gsd/scripts/start-cockpit-server.ps1 -Port 7777
# then: open http://localhost:7777
```

Stop:
```powershell
$pid = Get-Content .planning/runtime/cockpit-server.pid
Stop-Process -Id $pid
```

## Next phase

**P133 — PowerShell Monitor Keep/Kill Migration.** Apply the keep/kill audit from the brief (lines 168-189) to `sgsd-codex-monitor.ps1`. Port survivors to terminal fallback. Off-stage everything that fails the audit. Lighter than originally scoped now that localhost-live is shipping as the primary surface.
