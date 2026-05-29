---
schema_version: 2
schema: plan-schema-v2
status: PLAN-LOCKED
plan_id: P139-01-mission-telemetry-bodies
phase_id: 139-cockpit-mission-telemetry-bodies
phase_number: 139
milestone: v3.4
workstream: core
title: §1 Mission + §2 Telemetry — Component Bodies
created_by: orchestrator (Claude Opus 4.7, 1M context)
created_at: 2026-05-25
locked: true
expected_ATC_tier: FULL
skip_gates: []
depends_on:
  - P138-01-sticky-chrome-sse-keepalive
known_deadends: []
verification_cmd: node super-gsd/tools/cockpit-sidecar/run-self-test.cjs
lessons_path: null
tasks:
  - id: P139-T1
    agent: sgsd-exec-ui
    model: opus
    files_touched:
      - super-gsd/tools/cockpit-sidecar/client.js
    input_contract: "139-CONTEXT.md §Scope items for client.js renderers + design-pack/cockpit-bands.jsx as visual reference."
    output_contract: "client.js declares: renderMissionCard, renderPhaseRunway, renderExplanationBand, renderAgentLanes, renderMission (composes the 4), renderTelemetry (5 inline-SVG sparkline channels). renderAll calls renderMission(snap) and renderTelemetry(snap) on every snapshot. renderBand(1) and renderBand(2) early-return empty (sec-architecture's renderBand(3) preserved)."
    hypothesis: "Pure presentational renderers consuming P137 snapshot keys + the upgraded P139 attachers. Inline SVG sparklines avoid a new server endpoint."
    falsifier: "Self-test 80/80 regresses, OR R13/R14/R18 binding rules fail in browser-smoke."
    stop_rule: "Self-test 80/80 unchanged after T1 (SAC-P139-* not yet appended). client.js parses (Function() constructor) without syntax error."

  - id: P139-T2
    agent: sgsd-exec-backend
    model: opus
    files_touched:
      - super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs
    input_contract: "139-CONTEXT.md §Implementation decisions — stub-to-real wiring spec; .planning/STATE.md frontmatter shape; .planning/milestones/{m}/phases/{p}/{p}-CONTEXT.md presence."
    output_contract: "attachMission: read STATE.md frontmatter to derive milestone+phase, attempt to open the corresponding phase CONTEXT.md, populate output.mission.phase_id + objective + why_running. Fallback to stub when paths missing. attachPipeline: alias from output.stage_pipeline into output.pipeline (preserves additive contract). attachTelemetry: build 5 channels (fog/dispatches/tokens/context/elapsed) from existing fog_score + signals + token-log tail; history arrays bounded to last 30 samples."
    hypothesis: "Reading STATE.md frontmatter + a single CONTEXT.md per snapshot is O(2) file reads; bounded and safe."
    falsifier: "attachMission throws on missing files, OR attachTelemetry produces channels missing required fields, OR R19 (liveness) regresses."
    stop_rule: "Self-test 80/80 still green; attachAll() produces output.mission with non-empty phase_id + output.telemetry.fog with {value, target, history}."

  - id: P139-T3
    agent: sgsd-exec-ui
    model: opus
    files_touched:
      - super-gsd/tools/shared/sgsd-design-system.css
    input_contract: "139-CONTEXT.md §Scope items for CSS + design-pack/Cockpit.html for visual reference."
    output_contract: "css appends rules for: .mission-card (white surface, padding, big Big-Shoulders header), .northstar inside mission-card (loud teal strip), .phase-runway (5-cell horizontal strip), .stage-cell (active = teal border, done = green check, blocked = red), .explanation-band (italic muted), .agent-lanes (2-column grid), .agent-lane, .telemetry-rail (5-row grid), .sparkline-channel (label + value + delta + inline svg)."
    hypothesis: "CSS-only addition; no selector renames; no token changes."
    falsifier: "Existing P138.5 chrome CSS regresses visually, OR browser-smoke root_html_no_dark_gradient fails."
    stop_rule: "css parses (no syntax error in browser); browser-smoke run passes root_html_inline_light_palette."

  - id: P139-T4
    agent: orchestrator
    model: opus
    files_touched:
      - super-gsd/tools/cockpit-sidecar/run-self-test.cjs
    input_contract: "139-CONTEXT.md §Semantic Acceptance Criteria SAC-P139-01..10."
    output_contract: "10 new test entries appended after SAC-P138.5-01. Most are source-grep + grep against the served HTML fetched live via http.get against an ephemeral-port serve.cjs child (the same pattern browser-smoke.cjs uses)."
    hypothesis: "Source-grep + live-HTML-fetch SACs catch both code regressions and rendering regressions. The browser-smoke gate (SAC-P139-09) is the binding catch-all."
    falsifier: "Any SAC-P139-NN fails → upstream task incomplete."
    stop_rule: "90/90 PASS exit 0 (80 prior + 10 new). Per-SAC --sac SAC-P139-NN exits 0 each."

  - id: P139-T5
    agent: orchestrator
    model: opus
    files_touched:
      - .planning/runtime/cockpit-smoke-139.html
      - .planning/runtime/cockpit-smoke-139-verdict.json
    input_contract: "T1-T4 landed; client.js + cockpit-sidecar.cjs + css + run-self-test.cjs all in place."
    output_contract: "Ran node super-gsd/tools/cockpit-sidecar/browser-smoke.cjs --phase 139 --workspace .; verdict.json saved with verdict=PASS and every individual check ok=true; cockpit-smoke-139.html artifact saved."
    hypothesis: "T1-T4 produced a healthy cockpit; the browser-smoke gate confirms mechanically."
    falsifier: "browser-smoke exit != 0 → identify failing check, route back to upstream task."
    stop_rule: "browser-smoke exits 0; verdict=PASS; .planning/runtime/cockpit-smoke-139-verdict.json + cockpit-smoke-139.html exist."

  - id: P139-T6
    agent: orchestrator
    model: opus
    files_touched:
      - .planning/runtime/cockpit-smoke-139.html
    input_contract: "T5 PASS; HTML artifact saved at .planning/runtime/cockpit-smoke-139.html."
    output_contract: "SendUserFile invoked with the HTML artifact path so operator can open it in a browser for visual confirmation. Phase does NOT close until operator acknowledges visual OK."
    hypothesis: "Per feedback_browser_smoke_mandatory.md, the gate proves structure; operator review is the perceptual gate."
    falsifier: "Operator flags a visual problem → fix in a follow-up task or P139.5 hotfix; do NOT mark phase PASS."
    stop_rule: "Operator confirms visual OK (explicitly or by accepting the next 'go')."

  - id: P139-T7
    agent: orchestrator
    model: opus
    files_touched:
      - .planning/milestones/v3.4/phases/139-cockpit-mission-telemetry-bodies/139-VERIFICATION.md
      - .planning/milestones/v3.4/phases/139-cockpit-mission-telemetry-bodies/PHASE-CAPSULE.json
    input_contract: "T1-T6 evidence + browser-smoke verdict.json."
    output_contract: "VERIFICATION + PHASE-CAPSULE per v3.4 shape. PHASE-CAPSULE.gates.browser_smoke references the verdict.json with verdict=PASS. STATE.md advances to P140 PENDING."
    hypothesis: "Deterministic given T1-T6 evidence."
    falsifier: "Capsule omits browser_smoke gate ref → SAC-P138.5-01 will fail on next self-test run."
    stop_rule: "Files exist; commit lands; self-test still 90/90."

semantic_acceptance_criteria:
  - id: SAC-P139-01
    input: "read client.js"
    expected_outcome: "source declares renderMission AND renderTelemetry AND renderMissionCard AND renderPhaseRunway AND renderExplanationBand AND renderAgentLanes functions"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P139-01"

  - id: SAC-P139-02
    input: "read client.js"
    expected_outcome: "renderAll calls renderMission(snap) AND renderTelemetry(snap)"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P139-02"

  - id: SAC-P139-03
    input: "read sgsd-design-system.css"
    expected_outcome: "css declares .mission-card AND .phase-runway AND .agent-lane AND .telemetry-rail AND .sparkline-channel rules"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P139-03"

  - id: SAC-P139-04
    input: "read cockpit-sidecar.cjs"
    expected_outcome: "source includes attachMission reading STATE.md frontmatter + the 5-channel attachTelemetry shape"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P139-04"

  - id: SAC-P139-05
    input: "attachAll() applied to a p127 sample output"
    expected_outcome: "output.mission has non-empty phase_id; output.telemetry has fog + dispatches + tokens + context + elapsed each with {value, target, history} shape"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P139-05"

  - id: SAC-P139-06
    input: "rendered cockpit HTML from a live ephemeral server"
    expected_outcome: "html contains class=mission-card AND class=phase-runway AND class=agent-lane AND class=telemetry-rail"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P139-06"

  - id: SAC-P139-07
    input: "rendered cockpit HTML from a live ephemeral server"
    expected_outcome: "html contains exactly 5 <svg class=sparkline> elements"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P139-07"

  - id: SAC-P139-08
    input: "rendered cockpit HTML from a live ephemeral server"
    expected_outcome: "html still satisfies R13 (exactly 1 northstar OR recommended-action class) AND R14 (5 stage cells) AND R18 (3 data-band placeholders)"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P139-08"

  - id: SAC-P139-09
    input: "node super-gsd/tools/cockpit-sidecar/browser-smoke.cjs --phase 139"
    expected_outcome: "exit 0; verdict=PASS; all checks ok=true"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/browser-smoke.cjs --phase 139 --workspace ."

  - id: SAC-P139-10
    input: "full self-test suite"
    expected_outcome: "exit 0; total PASS >= 90/90 (80 prior + 10 new); zero regression on SAC-P125..P138.5"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs"
---

# Phase 139 — §1 Mission + §2 Telemetry Bodies — PLAN-LOCKED

## Scope

Fill the two visible-by-default IA sections with real component bodies. §1 Mission
renders MissionCard + PhaseRunway + ExplanationBand + AgentLanes. §2 Telemetry renders
5 inline-SVG sparkline channels. Browser-smoke gate runs and operator reviews the HTML
artifact before close — per the 2026-05-25 memory rule, no more shipping behind grep.

## Authoritative Inputs

- v3.4 INTENT.md (invariants #10 liveness + #11 browser-smoke)
- design-pack/HANDOFF-PROMPT.md §IA + §Data Contracts
- design-pack/Cockpit.html (canonical components)
- design-pack/cockpit-bands.jsx (~446 lines reference)
- 139-CONTEXT.md
- existing client.js (post-P138.5 chrome) + cockpit-sidecar.cjs (post-P137 attachers) +
  sgsd-design-system.css (post-P138.5 chrome CSS)

## File Operations

| Op | Path | Purpose |
|---|---|---|
| MODIFY | `super-gsd/tools/cockpit-sidecar/client.js` | 5 component renderers + renderAll wire |
| MODIFY | `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` | attachMission/Pipeline/Telemetry upgrade |
| MODIFY | `super-gsd/tools/shared/sgsd-design-system.css` | component CSS |
| EXTEND | `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` | SAC-P139-01..10 |
| RUN | `super-gsd/tools/cockpit-sidecar/browser-smoke.cjs --phase 139` | MANDATORY |
| CREATE | phase VERIFICATION + PHASE-CAPSULE | T7 |

## Verification

`node super-gsd/tools/cockpit-sidecar/run-self-test.cjs` → 90/90 PASS exit 0
PLUS `node super-gsd/tools/cockpit-sidecar/browser-smoke.cjs --phase 139` → exit 0 verdict=PASS
PLUS operator visual confirmation on the saved HTML artifact.

## Success Criteria

- All 10 SACs PASS.
- 90/90 self-test green; SAC-P125..P138.5 unchanged.
- browser-smoke verdict PASS; verdict.json + cockpit-smoke-139.html artifacts on disk.
- Operator confirms the HTML artifact visually shows MissionCard + PhaseRunway +
  AgentLanes filled with real data and TelemetryRail showing 5 sparkline channels.
- Lock-13 respected; phase capsule + verification authored; STATE.md advances.
