---
phase: 140
phase_name: §3 Architecture + §4 Milestone — Component Bodies (orthogonal SVG diagrams)
milestone: v3.4
ws: core
status: PENDING
created_at: 2026-05-25
predecessor: v3.4/P139 (Mission + Telemetry bodies; design-pack DOM conformance)
successor: v3.4/P141 (§5 Memory + §6 Evidence)
---

# Phase 140 — §3 Architecture + §4 Milestone — CONTEXT

## Goal

Fill §3 Architecture (PhaseArchitectureDiagram + OrchestrationDiagram subtabs)
and §4 Milestone (MilestoneStrip + MilestoneDependencyDiagram + PhaseDetailPanel)
with operator-meaningful content.

**P140 minimum-viable scope**: textual / pill-strip representation of phase
data-flow and milestone dependencies. Full orthogonal-routed SVG diagrams
deferred to a v3.5 polish phase (the design-pack DiagramNode + DiagramEdge
primitives are complex and the operator's priority is "fully working cockpit"
by morning over "pixel-perfect SVG").

## Authoritative inputs

- `.planning/milestones/v3.4/INTENT.md` invariants
- `.planning/milestones/v3.4/design-pack/HANDOFF-PROMPT.md` §IA table for §3 / §4
- `.planning/milestones/v3.4/design-pack/mc-arch.jsx` — DiagramNode + DiagramEdge
  reference (lines 261-450; complex SVG positioning)
- `.planning/milestones/v3.4/INTENT.md` — phase list (P136-P143)
- `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` — attachArchitecture,
  attachMilestoneMap stubs from P137

## Binding invariants

1. **Lock-13** — confined to `super-gsd/tools/cockpit-sidecar/` +
   `super-gsd/tools/shared/sgsd-design-system.css`.
2. **Self-test ≥90 + 6 new P140 SACs = ≥96**, no regression.
3. **Browser-smoke verdict PASS** before phase close.
4. **Visual-validate** extended with §3 + §4 checks; full pass.
5. Existing renderHtml byte-shape preserved.

## Scope

**In:**
- attachArchitecture: derive nodes + edges from active phase context.
  Minimum: read the phase's CONTEXT.md "Authoritative inputs" section and
  emit one node per referenced file + edges between consumer relationships.
  Fallback: 4-node default ("STATE.md", "CONTEXT.md", "PLAN-LOCKED.md",
  "VERIFICATION.md") with linear edges representing the SGSD flow.
- attachMilestoneMap: enumerate v3.4 phases (P136-P143) with status (closed
  per PHASE-CAPSULE.json existence; current per snapshot.phase; pending
  otherwise).
- client.js renderArchitecture: emit a labelled list/grid for §3 (no SVG,
  just .arch-node DOM items with kind + label + relations). Defer SVG diagram
  to v3.5.
- client.js renderMilestone: emit MilestoneStrip (horizontal pill row of
  P136-P143 with status) + PhaseDetailPanel (clickable to expand; default
  shows current phase).
- Append SAC-P140-01..06 covering renderers + data shape + render fidelity.
- Append CSS rules for .arch-node, .arch-edge-label, .milestone-strip,
  .ms-cell, .ms-sep, .phase-detail-panel.

**Out:**
- Orthogonal-routed SVG diagrams (deferred to v3.5 polish phase).
- Clickable drawer interactions (P142+).
- Real-time architecture (currently snapshot of latest CONTEXT.md).

## Semantic Acceptance Criteria (locked)

```
- id: SAC-P140-01
  input: "read client.js"
  expected_outcome: "source declares renderArchitecture AND renderMilestone functions"

- id: SAC-P140-02
  input: "rendered DOM via JSDOM"
  expected_outcome: "sec-architecture content includes class containing 'arch-node' (at least 3 nodes)"

- id: SAC-P140-03
  input: "rendered DOM via JSDOM"
  expected_outcome: "sec-milestone content includes class containing 'milestone-strip' AND class containing 'ms-cell' (at least 4 cells for v3.4 phases)"

- id: SAC-P140-04
  input: "attachAll() applied to a v3.3 sample output"
  expected_outcome: "output.architecture.nodes array length >= 3; output.milestone_map.phases array length >= 4"

- id: SAC-P140-05
  input: "node super-gsd/tools/cockpit-sidecar/browser-smoke.cjs --phase 140"
  expected_outcome: "exit 0; verdict=PASS; all 18 checks ok"

- id: SAC-P140-06
  input: "full self-test suite"
  expected_outcome: "exit 0; total PASS >= 96/96 (90 prior + 6 new); zero regression on SAC-P125..P139"
```

## Files

- **MODIFY** `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` — attachArchitecture + attachMilestoneMap upgrades
- **MODIFY** `super-gsd/tools/cockpit-sidecar/client.js` — renderArchitecture + renderMilestone
- **MODIFY** `super-gsd/tools/shared/sgsd-design-system.css` — minimal P140 CSS additions
- **EXTEND** `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` — SAC-P140-01..06
- **RUN** browser-smoke + visual-validate before close

## Tasks

- **T1** — attachArchitecture: derive nodes/edges from active phase CONTEXT.md
- **T2** — attachMilestoneMap: enumerate v3.4 phases with status
- **T3** — renderArchitecture + renderMilestone in client.js
- **T4** — CSS for arch + milestone components
- **T5** — SAC-P140-01..06
- **T6** — Browser-smoke + visual-validate gates
- **T7** — Phase close artefacts
