---
phase: 139
phase_name: §1 Mission + §2 Telemetry — Component Bodies
milestone: v3.4
ws: core
status: PASS
verdict: PASS
completed_at: 2026-05-25
sacs_total: 10
sacs_passed: 10
sacs_deferred: 0
files_created: 1
files_modified: 4
deviations: 2
deviation_class: DESIGN-PACK-CONFORMANCE
plan_id: P139-01-mission-telemetry-bodies
self_test_command: node super-gsd/tools/cockpit-sidecar/run-self-test.cjs
self_test_result: pass
self_test_count: 90/90
browser_smoke_verdict: PASS
browser_smoke_checks: "18/18"
visual_validate_score: "38/38"
---

# Phase 139 — §1 Mission + §2 Telemetry Bodies — VERIFICATION

## Summary

P139 fills the two visible-by-default IA sections (Mission + Telemetry) with
rich component bodies that conform to the v3.4 design-pack DOM structure and
canonical class names. Plus an Event tape, six-cell command strip, populated
ScanBar, and design-pack-extracted CSS replacing the entire sgsd-design-system.

## Iteration history (overnight loop)

The phase ran through 7 fix iterations after operator caught visually-broken
output in the first attempt:

1. **P139.1 initial** — invented class names (.phase-runway, .telemetry-rail,
   .agent-lanes) that didn't match the design pack JSX. CSS rules with matching
   names didn't exist; components stacked vertically.
2. **P139.5 stale-css** — render-html.cjs cached CSS at module load. Live
   edits required server restart. Patched: re-read CSS on every renderShell()
   call.
3. **P139.6 design-pack conformance** — replaced sgsd-design-system.css with
   the full 73kB CSS extracted verbatim from
   `.planning/milestones/v3.4/design-pack/Cockpit.html` <style> block.
   Preserved SAC-required token aliases at top of :root. Rewrote client.js
   renderers to emit design-pack DOM (.runway, .telem, .agents, etc.).
4. **P139.6b chrome rewrite** — renderShell chrome now emits .crumb + .div
   + .spacer + .sse(.dot) + .kbd structure expected by the design-pack CSS.
   Removed leftover return-block from old renderShell version.
5. **P139.7a phase resolution** — STATE.md frontmatter rarely has a `phase:`
   key. Added run()-level phase derivation via status text regex
   (`P<NN> PENDING/ACTIVE`) + fallback to highest P number + fallback to newest
   phases/ subdir.
6. **P139.7b stage forward-fill** — stage-pipeline reports "research pending"
   when no -RESEARCH.md exists, but plan-locked.md exists ergo plan is done.
   attachPipeline now forward-fills: a later artifact implies earlier stages
   done. Active stage = first non-done after rightmost done.
7. **P139.7c data wiring** — attachMission reads PLAN-LOCKED yaml for
   success_criteria. attachAgents reads git reflog for handles/recent_actions.
   attachPipeline computes elapsed_sec per stage from artifact mtime.
   attachTelemetry builds 30-point history from token-log.jsonl (running sum
   for tokens, dispatch count, raw fog series). attachEvidence parses newest
   cockpit-smoke verdict for green/warn/fail counts. attachEvents derives
   10-row tape from git reflog. renderCommandStrip adds cmd-time + cmd-controls
   cells (now 6 total per design pack). renderEvents fills #sec-events with
   the event tape.

Tool support for iteration:
- `super-gsd/tools/cockpit-sidecar/browser-smoke.cjs` — 18-check binding gate
  (server health + rendered HTML structure + client.js parse + SSE 15s ping
  timing). Verdict serialised to `.planning/runtime/cockpit-smoke-139-verdict.json`.
- `.planning/runtime/visual-validate.cjs` — JSDOM render + 38 structural
  assertions against design-pack reference. Saves rendered DOM to
  `.planning/runtime/cockpit-rendered.html` for human inspection.

## SAC results

| SAC | Outcome | Result |
|---|---|---|
| SAC-P139-01 | client.js declares 7 named renderers (renderMission, renderTelemetry, renderMissionCard, renderPhaseRunway, renderAgentLanes, renderTelemCell, renderSparkSvg) | PASS |
| SAC-P139-02 | renderAll invokes renderMission(snap) + renderTelemetry(snap) | PASS |
| SAC-P139-03 | sgsd-design-system.css declares .mission-card + .runway + .agent-lane + .telem + .telem-cell rules | PASS |
| SAC-P139-04 | attachMission references STATE.md; attachTelemetry produces 5-channel object with fog/dispatches/tokens/context/elapsed | PASS |
| SAC-P139-05 | attachAll-applied snapshot has non-empty mission.phase_id + telemetry channels with {value, target, history} shape | PASS |
| SAC-P139-06 | JSDOM-rendered DOM contains classes containing mission-card + runway + agent-lane + telem | PASS |
| SAC-P139-07 | Rendered DOM contains exactly 5 <svg class="telem-spark"> elements | PASS |
| SAC-P139-08 | R13/R14/R18 binding rules preserved in rendered DOM (≤1 northstar, ≥5 stops, 3 data-band markers) | PASS |
| SAC-P139-09 | browser-smoke.cjs --phase 139 exits 0 with verdict=PASS | PASS |
| SAC-P139-10 | full self-test ≥90/90 with no SAC-P125..P138.5 regression | PASS (90/90 stable) |

## Files

- **MODIFY** `super-gsd/tools/cockpit-sidecar/client.js` — full renderer rewrite
- **MODIFY** `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` — phase derivation
  + 6 enhanced attachers
- **MODIFY** `super-gsd/tools/cockpit-sidecar/render-html.cjs` — design-pack chrome
  + CSS hot-reload + dead code cleanup
- **MODIFY** `super-gsd/tools/shared/sgsd-design-system.css` — replaced with
  canonical design-pack CSS (73kB) + SAC token aliases + Event tape CSS
- **MODIFY** `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` — SAC-P139-01..10
  + fetchRenderedDom JSDOM helper
- **CREATE** `.planning/runtime/visual-validate.cjs` — 38-check JSDOM validator
- **ARTIFACT** `.planning/runtime/cockpit-smoke-139.html` — server-side rendered
  shell HTML at gate time
- **ARTIFACT** `.planning/runtime/cockpit-smoke-139-verdict.json` — 18-check verdict
- **ARTIFACT** `.planning/runtime/cockpit-rendered.html` — JSDOM-rendered DOM
  (open as file:// to inspect the full rendered cockpit structure)

## Live operator-visible state

When the operator boots `start-cockpit-server.ps1` and opens
`http://localhost:7777/`:

| Region | Contents |
|---|---|
| Chrome | `localhost:7777 · cockpit · v3.4 · v3.4 · P139` + SSE LIVE pulsing pill + A/P/O/Esc kbd hotkeys |
| Command strip | 6 cells: OBJECTIVE (milestone/phase + title) · NEXT ACTION · OWNER (claude-opus-4-7) · RISK (low) · TIME LEFT · CONTROLS |
| ScanBar | 6 cells answering NOW (139·execute) / WHY (objective) / JUST CHANGED (most-recent commit kind) / RISK / DO NEXT / EVIDENCE (n green · n warn · n fail) |
| Sec nav | 7 sticky pill links with per-source liveness tier pill |
| §1 Mission | MissionCard (phase 139, full title, objective, Why running, Unlocks, Risk LOW, 6 success criteria) + PhaseRunway (5 stops: research/vtp-enrich/plan DONE, execute ACTIVE with elapsed, verify pending) + AgentLanes (claude orchestrator + handoff + codex executor) |
| §2 Telemetry | 5 TelemetryCells with sparklines: fog (severe), dispatches, tokens (severe), context, elapsed — each with delta arrow, tier-coloured number, tick range bar, target marker, foot scale |
| §3-§6 | Empty placeholders (P140-P141 scope) |
| §7 Events | Event tape with 10 most-recent commits |

## Invariant compliance

- **Lock-13** — git diff confined to `super-gsd/tools/cockpit-sidecar/` +
  `super-gsd/tools/shared/sgsd-design-system.css` + `.planning/runtime/`.
- **--json byte-shape preserved** — `renderHtml()` byte-stable; SAC-P127-*
  + SAC-P134-03 unchanged.
- **R13/R14/R18/R19** binding rules still pass in rendered DOM.
- **Liveness contract (#10)** — `<span data-conn="state">` lit by connState;
  per-section pills in sec-nav reflect `_sources` tier; browser-smoke verifies
  15s SSE keep-alive timing end-to-end.
- **Browser-smoke gate (#11 / 2026-05-25 memory rule)** — RAN, verdict PASS,
  18/18 checks green, verdict.json + cockpit-smoke-139.html artifacts on disk.
- **SAC-P138.5-01 (mechanical browser-smoke witness)** — passes (newest
  verdict.json has verdict=PASS).

## Deviations

**DESIGN-PACK-CONFORMANCE-1 — Outer .stage grid container skipped.** The
design-pack uses `<div class="stage">` with `display:grid` and explicit
`grid-template-columns: minmax(0, 1fr) 320px` (main + tape sidebar). My
renderShell uses simpler stacked `<main class="sgsd-cockpit">`. Consequence:
`.command { grid-column: 1 / -1 }` and friends are no-ops without a grid
parent, but each component renders its own internal grid correctly. The
visible cockpit is therefore a vertical-stack of full-width chrome / command
/ scanbar / sec-nav / IA sections. A tape sidebar would need P142+ scope.

**DESIGN-PACK-CONFORMANCE-2 — ExplanationBand component retired.** The design
pack defines a separate ExplanationBand component; the canonical MissionCard
already carries a `.mc-row` with "Why running" content. P139 puts the
why_running content inside MissionCard.mc-body and skips ExplanationBand to
avoid a duplicated "why running" line. SAC-P139-01 expected renderer list
updated accordingly.

## Codex runs

- **P139-data-wiring (bxv7kj0jh)** — `codex-executor.sh` exit 0; report
  FILES_CHANGED=none; BLOCKERS: `CreateProcessAsUserW failed: 216`. Same
  recurring Windows shell-exec block documented in P137/P138 capsule.
  Fell back to orchestrator-direct (Claude Opus 4.7) for all 6 attachers +
  renderer rewrite. Decision logged in capsule.

## Commit chain

- 9127516 — fix(P139.6): conform to design pack — class names + DOM + CSS
- 2b097ac — fix(P139.7): data wiring + Event tape + Time/Controls cells
- (this commit) — phase close artefacts

## Next phase

**v3.4 P140 — §3 Architecture + §4 Milestone SVG diagrams.** Fills sec-architecture
(PhaseArchitectureDiagram + OrchestrationDiagram subtabs) and sec-milestone
(MilestoneStrip + MilestoneDependencyDiagram + PhaseDetailPanel). All
orthogonal-routed SVG; clickable chips with drawer-style detail panels.
Reference: design-pack/mc-arch.jsx for diagram primitives.
