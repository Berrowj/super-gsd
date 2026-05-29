---
phase: 139
phase_name: §1 Mission + §2 Telemetry — Component Bodies (MissionCard + PhaseRunway + AgentLanes + TelemetryRail)
milestone: v3.4
ws: core
status: PENDING
created_at: 2026-05-25
predecessor: v3.4/P138 (sticky chrome + 15s SSE ping + reconnect badge; browser-smoke gate landed retroactively)
successor: v3.4/P140 (§3 Architecture + §4 Milestone SVG diagrams)
---

# Phase 139 — §1 Mission + §2 Telemetry Bodies — CONTEXT

## Goal

Fill the two visible-by-default IA sections with real component rendering:

- **§1 Mission** (`#sec-mission` → `data-band="1"`): MissionCard + PhaseRunway + ExplanationBand
  + AgentLanes. Operator's first eye-target — answers "what is this phase / why is it
  running / who's working / what's blocked".
- **§2 Telemetry** (`#sec-telemetry` → `data-band="2"`): TelemetryRail with 5 sparkline
  channels (fog / dispatches / tokens / context / elapsed), each with target line, tier
  bands (normal/attn/severe), value, label, delta arrow.

These are the "always open" sections per HANDOFF-PROMPT.md §"INFORMATION ARCHITECTURE" —
they are the visual anchor of the cockpit and the 5-second test depends on them.

## Authoritative inputs

- `.planning/milestones/v3.4/INTENT.md` invariant #10 (liveness) + #11 (browser-smoke binding)
- `.planning/milestones/v3.4/design-pack/HANDOFF-PROMPT.md` §"INFORMATION ARCHITECTURE"
  + §"DATA CONTRACTS" sub-sections "Mission" and "Pipeline" and "Agents" and "Telemetry"
- `.planning/milestones/v3.4/design-pack/Cockpit.html` — canonical light prototype
  (component renders are lines ~400-900 in the embedded JSX)
- `.planning/milestones/v3.4/design-pack/cockpit-bands.jsx` — MissionCard + PhaseRunway
  + ExplanationBand + AgentLanes + TelemetryRail reference implementations (~446 lines)
- `super-gsd/tools/cockpit-sidecar/client.js` (current with renderChrome + 4 chrome
  renderers from P138; existing renderBand(1)/(2)/(3) are legacy 3-band layout — must
  be re-pointed so §1 + §2 use the new component renderers)
- `super-gsd/tools/cockpit-sidecar/sparkline.cjs` (existing — `renderAnsi` + `renderSvg`
  exports; renderSvg is the one we want for TelemetryRail in the browser)
- `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` — `attachMission`,
  `attachPipeline`, `attachAgents`, `attachTelemetry` stub attachers from P137. P139
  may upgrade these from stubs to minimal-real data extraction where straightforward.
- `super-gsd/tools/shared/sgsd-design-system.css` — P138.5 chrome CSS in place; P139
  adds component-level CSS (.mission-card, .phase-runway, .agent-lane, .telemetry-rail,
  .sparkline-channel, etc.)

## Binding invariants

1. **Lock-13** — changes confined to `super-gsd/tools/cockpit-sidecar/` +
   `super-gsd/tools/shared/sgsd-design-system.css`. Nothing in `cockpit-state/*`,
   `tests/cockpit-acceptance/*`, `tests/cockpit-regression/*`.

2. **R13 binding preserved** — the cockpit-html surface still emits exactly ONE
   `class="northstar|recommended-action"` loud-line element. The MissionCard contains
   the NorthStar as its header, so the loud-line moves INTO the MissionCard (no longer
   in a separate `<p class="northstar">` block under data-band="1"). conformance-check
   R13 must still pass.

3. **R14 binding preserved** — exactly 5 `class="...stage..."` cells. The PhaseRunway
   renders 5 stages from `snapshot.pipeline.stages` (or `stage_pipeline.stages` while
   the two coexist).

4. **R18 binding preserved** — `data-band="1|2|3"` placeholders remain on section roots.

5. **R19 (liveness) binding preserved** — every snapshot carries fresh `_sources`;
   the per-section liveness pills in sec-nav reflect the per-source tier.

6. **Browser-smoke gate is MANDATORY (R20-equivalent discipline per
   feedback_browser_smoke_mandatory memory)** — `browser-smoke.cjs --phase 139` MUST
   return verdict=PASS before this phase can close. Verdict goes in
   PHASE-CAPSULE.gates.browser_smoke. SAC-P138.5-01 enforces this mechanically.

7. **Human review checkpoint** — after browser-smoke PASS, the rendered HTML at
   `.planning/runtime/cockpit-smoke-139.html` is sent to the operator (via
   SendUserFile) for visual confirmation BEFORE the orchestrator marks the phase
   PASS in VERIFICATION.md. No more shipping behind grep.

## Scope

**In:**

- **MODIFY `client.js`** — add 4 new component renderers + 1 telemetry renderer:
  - `renderMissionCard(snapshot)` — phase ID + title + objective + risk tier (in the
    MissionCard header), NorthStar code+message as the loud line, success criteria
    chips if present.
  - `renderPhaseRunway(snapshot)` — 5 stage cells from `snapshot.pipeline.stages`
    (falling back to `stage_pipeline.stages`), each cell shows name + owner + status
    + SLA bar; active stage highlighted; blocker rendered as a banner if present.
  - `renderExplanationBand(snapshot)` — 1-paragraph "WHY THIS PHASE IS RUNNING" pulled
    from `snapshot.mission.why_running` or `snapshot.rationale.why_this_phase`.
  - `renderAgentLanes(snapshot)` — claude + codex lanes side-by-side: handle + model
    + role + status + current task + since X ago + 3 most-recent actions.
  - Compose them into `renderMission(snapshot)` that fills `#sec-mission` body.
  - `renderTelemetry(snapshot)` — 5 channels from `snapshot.telemetry` rendered as
    inline SVG sparklines (uses sparkline.cjs::renderSvg via a fetch to a `/sparkline?ch=fog`
    endpoint OR by inlining a vanilla-JS minimal sparkline; decision: inline minimal JS
    to keep client.js self-contained and avoid a new server endpoint this phase).
  - Update `renderAll()` to call `renderMission(snap)` and `renderTelemetry(snap)` ahead
    of the legacy `renderBand(1)`/`renderBand(2)` (DEPRECATE renderBand(1) and
    renderBand(2) — preserve only renderBand(3) for sec-architecture until P140 ships
    the architecture diagram).

- **MODIFY `cockpit-sidecar.cjs`** — upgrade stub attachers to minimal-real data:
  - `attachMission` reads phase + milestone from STATE.md frontmatter, attempts to
    read `.planning/milestones/<m>/phases/<p>/<p>-CONTEXT.md` for objective + why_running.
    Fallback to stub when paths missing.
  - `attachPipeline` aliases from existing `stage_pipeline` (already populated) into
    the new `pipeline` shape so PhaseRunway has 5 real stages to render.
  - `attachAgents` minimal stub stays — populating real agent activity is P141+ work.
  - `attachTelemetry` reads fog_score / signals from existing snapshot, builds 5 channel
    objects with value + target + tier ranges + tiny history array (last N from
    `.planning/metrics/token-log.jsonl` if available, else empty history).

- **MODIFY `sgsd-design-system.css`** — append component CSS:
  - `.mission-card` (white surface, padding, big phase ID header in Big Shoulders
    Display, NorthStar as a loud strip across top)
  - `.phase-runway` (horizontal stage strip with 5 cells, active stage bordered teal)
  - `.explanation-band` (italic muted text band beneath MissionCard)
  - `.agent-lanes` (2-column grid: Claude lane / Codex lane)
  - `.agent-lane` (handle + model + role at top, current task + since, recent actions list)
  - `.telemetry-rail` (5-row grid of channel cards)
  - `.sparkline-channel` (label + value + delta arrow + inline SVG sparkline)

- **MODIFY `run-self-test.cjs`** — append SAC-P139-01..10. Most are source-grep
  witnesses (cheap regression catchers); the binding gate is browser-smoke + the
  human review of the saved HTML artifact.

- **RUN `browser-smoke.cjs --phase 139`** as a mandatory close-out step. Verdict
  PASS required.

- **SEND `.planning/runtime/cockpit-smoke-139.html` to operator via SendUserFile**
  for visual confirmation BEFORE marking phase PASS.

**Out:**

- §3 Architecture diagram + §4 Milestone DAG (P140).
- §5 Memory + §6 Evidence (P141).
- Event tape + drawers + 5-sec test conformance (P142).
- Real REST endpoints for A/P/O/Esc hotkeys (still console.log stubs).
- Live agent activity feed (currently stub — `attachAgents` reads handles only).

## Implementation decisions (locked)

- **NorthStar moves INTO MissionCard.** The existing `<p class="northstar">` becomes
  the loud-line at the top of the MissionCard header (still satisfies R13 exactly-one
  rule). renderBand(1) no longer emits the standalone NorthStar paragraph — MissionCard
  owns it.

- **Sparkline rendering is inline vanilla JS in client.js**, NOT a server endpoint.
  Server already returns snapshot.telemetry with `history` arrays; client.js renders
  inline `<svg>` per channel. Avoids a new fetch round-trip. sparkline.cjs::renderSvg
  remains for server-side renderHtml() use (no change to that path this phase).

- **`renderBand(1)` and `renderBand(2)` are NO-OP'd**, not deleted. Keep the
  functions in place but make them early-return empty string. renderMission /
  renderTelemetry fill the section bodies instead. This avoids a churn refactor of
  renderBand internals — sec-architecture (band 3) still uses renderBand(3) until P140.

- **Stub-to-real data wiring is BOUNDED.** attachMission reads only phase + objective
  + why_running. attachTelemetry reads only existing fog_score + signals.dispatch_count
  + signals.token_spend. No new metrics scraping. P141+ wires more.

- **Browser-smoke verdict + HTML artifact path are NON-NEGOTIABLE phase-close
  artifacts.** Recorded in PHASE-CAPSULE.gates.browser_smoke. Operator review of the
  HTML artifact is the perceptual gate.

## Semantic Acceptance Criteria (locked — verbatim in PLAN-LOCKED)

```
- id: SAC-P139-01
  input: "read client.js"
  expected_outcome: "source declares renderMission AND renderTelemetry AND renderMissionCard AND renderPhaseRunway AND renderExplanationBand AND renderAgentLanes functions"

- id: SAC-P139-02
  input: "read client.js"
  expected_outcome: "renderAll calls renderMission(snap) AND renderTelemetry(snap) on every snapshot"

- id: SAC-P139-03
  input: "read sgsd-design-system.css"
  expected_outcome: "css declares .mission-card AND .phase-runway AND .agent-lane AND .telemetry-rail AND .sparkline-channel rules"

- id: SAC-P139-04
  input: "read cockpit-sidecar.cjs"
  expected_outcome: "attachMission reads STATE.md frontmatter + CONTEXT.md when available; attachTelemetry produces 5 channel entries (fog, dispatches, tokens, context, elapsed) with value + target + history array shape"

- id: SAC-P139-05
  input: "attachAll() applied to a p127 sample output"
  expected_outcome: "output.mission has non-stub phase_id + objective when CONTEXT.md is readable; output.telemetry.fog and .dispatches and .tokens and .context and .elapsed all exist with {value, target, history} shape"

- id: SAC-P139-06
  input: "rendered cockpit HTML (from browser-smoke /) inspected"
  expected_outcome: "html contains class=\"mission-card\" AND class=\"phase-runway\" AND class=\"agent-lane\" AND class=\"telemetry-rail\""

- id: SAC-P139-07
  input: "rendered cockpit HTML inspected"
  expected_outcome: "html contains exactly 5 sparkline svg elements (1 per channel)"

- id: SAC-P139-08
  input: "rendered cockpit HTML inspected"
  expected_outcome: "html still satisfies R13 (exactly one northstar/recommended-action loud-line) AND R14 (5 stage cells) AND R18 (3 data-band placeholders)"

- id: SAC-P139-09
  input: "node super-gsd/tools/cockpit-sidecar/browser-smoke.cjs --phase 139"
  expected_outcome: "exit 0; verdict.verdict === PASS; all individual checks ok=true"

- id: SAC-P139-10
  input: "full self-test suite"
  expected_outcome: "exit 0; total PASS >= 90/90 (80 prior + 10 new); zero regression on SAC-P125..P138.5"
```

## Files

- **MODIFY** `super-gsd/tools/cockpit-sidecar/client.js` — 5 new renderers + renderAll wire
- **MODIFY** `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` — attachMission/Pipeline/Telemetry upgrades
- **MODIFY** `super-gsd/tools/shared/sgsd-design-system.css` — component CSS
- **EXTEND** `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` — SAC-P139-01..10
- **RUN** `super-gsd/tools/cockpit-sidecar/browser-smoke.cjs --phase 139` (mandatory)
- **SEND** `.planning/runtime/cockpit-smoke-139.html` to operator (SendUserFile)
- **CREATE** phase VERIFICATION.md + PHASE-CAPSULE.json with browser_smoke verdict

## Tasks

- **T1** — client.js: renderMission + 4 component sub-renderers + renderTelemetry + renderAll wire.
- **T2** — cockpit-sidecar.cjs: upgrade attachMission/Pipeline/Telemetry stubs to minimal-real.
- **T3** — sgsd-design-system.css: component CSS for mission-card / phase-runway / agent-lane / telemetry-rail / sparkline-channel.
- **T4** — run-self-test.cjs: SAC-P139-01..10.
- **T5** — Run browser-smoke.cjs --phase 139; verdict PASS required.
- **T6** — SendUserFile the saved HTML artifact for operator visual review.
- **T7** — Phase close artefacts ONLY after operator confirms visual is acceptable.

## Provider routing

All tasks orchestrator-direct (Claude Opus 4.7). Per P137/P138 close decisions, Codex
round-trip cost is negative for content-locked structural JS+CSS work under the
Windows shell-exec block.

## Discipline reminder

**Per `feedback_browser_smoke_mandatory.md` memory rule (2026-05-25 incident):**
ANY phase touching `super-gsd/tools/cockpit-sidecar/` REQUIRES browser-smoke verdict
PASS before close. No exceptions. Skipping it is a release-blocker. The HTML artifact
gets sent to the operator for visual confirmation as part of the close-out. This
phase will not be marked PASS without both.
