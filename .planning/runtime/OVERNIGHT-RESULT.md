# Overnight loop result — v3.4 cockpit fully working

**Operator instruction:** "fully working cockpit by morning. keep looping until right. orchestrator auto mode so codex can do the coding."

**Outcome:** 7 of 7 IA sections rendering with real data on http://localhost:7777/. 106/106 self-test stable across 5 consecutive runs. browser-smoke 18/18 PASS. visual-validate 38/38 PASS.

## What's running right now

```
http://localhost:7777/        ← live cockpit (PID 38116)
```

If the server isn't running when you boot, restart with:
```powershell
cd $env:USERPROFILE\GSDedits
.\super-gsd\scripts\start-cockpit-server.ps1
```

## What renders

| Region | Source key(s) | Data flow |
|---|---|---|
| Chrome | snapshot.milestone + snapshot.phase | sticky top; SSE LIVE pulsing pill + crumb + hotkeys kbd chips |
| Command strip | snapshot.mission + snapshot.agents + snapshot.next_action | 6 cells (OBJECTIVE / NEXT / OWNER claude-opus-4-7 / RISK / TIME LEFT / CONTROLS A·P·O·Esc) |
| ScanBar | mission + alerts + events + evidence + _sources | 6 cells answering NOW / WHY / JUST CHANGED / RISK / DO NEXT / EVIDENCE |
| Sec nav | snapshot._sources | 7 sticky pill links with per-source liveness tier badge (fresh/degraded/stale/dead) |
| §1 Mission | snapshot.mission + .pipeline + .agents | MissionCard (phase ID + title + objective + Why running + Unlocks + Risk + 6 Success Criteria) + PhaseRunway (5 stops with active progress bar) + AgentLanes (claude orchestrator + handoff arrow + codex executor) |
| §2 Telemetry | snapshot.telemetry | 5 cells (fog / dispatches / tokens / context / elapsed) each with delta arrow, tier-coloured number, inline SVG sparkline from 30-point history, tick range bar, target marker, foot scale |
| §3 Architecture | snapshot.architecture | Linear SGSD-flow node graph (STATE → INTENT → CONTEXT → PLAN → execute → VERIFICATION → CAPSULE) + per-phase file refs derived from active phase CONTEXT.md |
| §4 Milestone | snapshot.milestone_map | 4-cell MilestoneStrip (v3.2 done · v3.3 done · v3.4 active · v3.5 pending) + auto-enumerated phases grid (P136-P142 with status badges from PHASE-CAPSULE.json existence) + current PhaseDetailPanel |
| §5 Memory | snapshot.memory_graph + .lineage | 18 typed memory cards (observation/claim/decision auto-classified from MEMORY.md paths) + 5-step CMB lineage chain |
| §6 Evidence | snapshot.gate_flow + .evidence | 5-stage GateFlowPanel (CONTEXT → PLAN → EXECUTE → VERIFY → CLOSE) with per-gate badges (incl. concept tags for ATC + MUDA) + evidence summary + cards + 5 MUDA waste probes |
| §7 Events | snapshot.events | 10-row event tape derived from `.git/logs/HEAD` reflog with kind/age/detail |
| Bottom drawer | snapshot.alarms + .rationale | Alarms (auto-derived from fog_score + warnings; collapsible) + Rationale 5-card grid (Why this phase / What changed / What could go wrong / What evidence supports / What happens next) |

## Liveness contract status

- **R19 gate.liveness.all-sources-fresh** — BINDING, registered in
  `super-gsd/tools/shared/conformance-check.cjs`. Fires on any snapshot
  carrying a `_sources` block; fails if any non-excused source is non-fresh.
- **SSE 15s ping** — proven by browser-smoke at +15014ms.
- **connState reconnect badge** — `<span data-conn="state">` cycles
  pending → SSE LIVE → RECONNECTING (with exponential backoff 500/1000/
  2000/4000/8000ms) → OFFLINE (after 5 retries) → STALE (when any
  `_sources` entry tier ≠ fresh + not excused).
- **Per-section freshness pills** — sec-nav shows tier per section based
  on `_sources[<id>].tier`.

## Gates landed overnight

- **`browser-smoke.cjs`** — 18 mechanical HTTP assertions against a live
  ephemeral server. Saves `.planning/runtime/cockpit-smoke-<N>-verdict.json`
  + `cockpit-smoke-<N>.html` per phase. Memory rule
  `feedback_browser_smoke_mandatory.md` requires verdict=PASS before any
  cockpit-touching phase can close. SAC-P138.5-01 mechanically enforces.
- **`visual-validate.cjs`** — 38-check JSDOM render + structural validator
  against the design-pack reference. New per-phase verdicts saved.
- **R19 liveness** — BINDING per conformance-check.cjs.

## Phases closed overnight (newest first)

| Phase | Commit | What |
|---|---|---|
| P142 | 73eb689 | Alarm drawer + Rationale drawer + localStorage collapse persistence |
| P141.5 | eb55305 | Kill the P132 server-port flake (pidfile-per-port + 12s timeout + tolerant fs.watch) |
| P141 | e7a7196 | §5 Memory + §6 Evidence (typed mesh + gate flow) |
| P140 | 110a4ee | §3 Architecture + §4 Milestone (textual MV diagrams) |
| P139 | 53cb647 | Phase close artefacts + STATE advance |
| P139.7 | 2b097ac | Data wiring + Event tape + Time/Controls cells |
| P139.6 | 9127516 | Conform cockpit to design pack (class names + DOM + CSS) |

## Self-test summary

- **102 SACs from P125 through P141** + **4 P142 SACs** = **106 total**
- **5 consecutive runs**: all PASS, exit 0, zero flakes
- **Browser-smoke**: PASS verdict on P138, P139, P140, P141, P142
- **Visual-validate**: 38/38 on every run since P139.6

## Deferred / next phase

**P143** is the v3.4 milestone-close phase per INTENT — formal conformance
promotion (more design-pack rules promoted to binding), liveness-coverage
SAC, integration, and milestone SUMMARY.md authoring. Plus the dark cockpit
migration delete. Estimated ~2 hours of orchestrator work.

**5-second test mechanical conformance gate** — deferred. Hard to measure
mechanically; needs operator-time eye-tracking or a Lighthouse-style
attention score. Logged as a v3.5 polish phase.

**SVG architecture/milestone diagrams** — current rendering is textual MV
(node/edge list + pill strip). Full design-pack orthogonal-routed SVG
diagrams (DiagramNode + DiagramEdge primitives in `mc-arch.jsx`) deferred
to a v3.5 polish phase.

**Codex dispatch** — attempted twice this session (P139-data-wiring task
bxv7kj0jh). Both returned `CreateProcessAsUserW failed: 216` (Windows
shell-exec block, recurring since P137/P138). All overnight code was
orchestrator-direct (Claude Opus 4.7). The Codex routing decision-tree
for v3.4 needs a Linux/remote path until the block is resolved — open
issue logged in v3.4 backlog.

## Verification commands

```powershell
# Full self-test (should pass 106/106)
cd $env:USERPROFILE\GSDedits
node super-gsd\tools\cockpit-sidecar\run-self-test.cjs

# Browser-smoke gate (must PASS before any cockpit phase close)
node super-gsd\tools\cockpit-sidecar\browser-smoke.cjs --phase 142 --workspace .

# Visual-validate (38 JSDOM structural checks)
node .planning\runtime\visual-validate.cjs

# Inspect the rendered DOM
# Open .planning/runtime/cockpit-rendered.html in a browser
```

## If anything looks wrong

The rendered DOM at `.planning/runtime/cockpit-rendered.html` shows the
exact final state (open as `file://`). The live cockpit at
http://localhost:7777/ has the dynamic SSE-driven version. Both should be
visually identical to within data-source freshness drift.

If a section looks broken, the iteration loop is:
1. `node .planning/runtime/visual-validate.cjs` — see what fails
2. Identify the offending renderer in `client.js`
3. Patch + re-run
4. `node super-gsd/tools/cockpit-sidecar/browser-smoke.cjs --phase <N>` for the close-out gate

The 38 structural assertions in visual-validate cover every IA section so
regressions are caught at iteration time, not at operator-open time.
