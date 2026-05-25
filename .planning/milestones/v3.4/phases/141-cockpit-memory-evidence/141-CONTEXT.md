---
phase: 141
phase_name: §5 Memory + §6 Evidence — Component Bodies
milestone: v3.4
ws: core
status: PENDING
created_at: 2026-05-25
predecessor: v3.4/P140 (Architecture + Milestone textual diagrams)
successor: v3.4/P142 (§7 Event tape enhancements + 5-sec test conformance)
---

# Phase 141 — §5 Memory + §6 Evidence — CONTEXT

## Goal

Fill §5 Memory (typed mesh from .planning/memory/MEMORY.md) and §6 Evidence
(gate flow + summary cards from the latest cockpit-smoke verdict + recent gate
runs).

**Minimum-viable scope.** Full argument-map mesh visualisation is deferred
to v3.5. Operator needs at least: visible memory entries by type + visible
evidence summary by surface.

## Scope

**In:**
- attachMemoryGraph: read `.planning/memory/MEMORY.md` index entries; map
  each to a memory_graph.sources[] entry with type derived from the path
  prefix (workflow/feedback/ → 'claim', architecture/patterns/ → 'observation',
  architecture/decisions/ → 'decision').
- attachLineage: emit a 5-step CMB chain illustration with phase ID + stage.
- Enhance attachEvidence: already reads newest cockpit-smoke verdict; extend
  to enumerate all P*-verdict.json files for a gate-flow timeline.
- attachGateFlow: stages (CONTEXT → PLAN → EXECUTE → VERIFY → CLOSE) with
  per-stage verdict derived from existing artefacts in the active phase dir.
- client.js renderMemory: emit memory mesh as a typed-card grid.
- client.js renderEvidence: emit GateFlowPanel + EvidenceCards.
- 6 SACs covering rendering + data shape + gates.

**Out:**
- Full force-directed mesh layout (v3.5).
- Live CMB ingestion (P142+).
- Bidirectional links between memory cards (v3.5).

## SACs (locked)

```
- id: SAC-P141-01
  input: "read client.js"
  expected_outcome: "source declares renderMemory AND renderEvidence functions"

- id: SAC-P141-02
  input: "rendered DOM via JSDOM"
  expected_outcome: "sec-memory contains class containing 'memory-card' (>=3 cards)"

- id: SAC-P141-03
  input: "rendered DOM via JSDOM"
  expected_outcome: "sec-evidence contains class containing 'gate-stage' (5 stages) AND class containing 'evidence-card' (>=1)"

- id: SAC-P141-04
  input: "attachAll() applied to sample output"
  expected_outcome: "output.memory_graph.sources >= 3; output.gate_flow.stages.length === 5"

- id: SAC-P141-05
  input: "browser-smoke --phase 141"
  expected_outcome: "exit 0; verdict=PASS"

- id: SAC-P141-06
  input: "full self-test"
  expected_outcome: ">= 102/102; no regression"
```

## Files

- MODIFY cockpit-sidecar.cjs (attachMemoryGraph, attachLineage, attachGateFlow, attachEvidence-extend)
- MODIFY client.js (renderMemory, renderEvidence)
- MODIFY sgsd-design-system.css (memory + evidence CSS)
- EXTEND run-self-test.cjs (SAC-P141-01..06)
- RUN browser-smoke + visual-validate
