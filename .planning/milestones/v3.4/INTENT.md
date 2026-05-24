---
milestone: v3.4
title: Operator Cockpit IA Rewrite (Editorial Light)
why: >-
  v3.3 closed with a tight 405-line answer-first cockpit-sidecar (P125-P132) and
  a Node http+SSE+fs.watch server (P132) that operator opens at localhost:7777
  during autonomous runs. v3.3 P135 attempted a visual-polish pass on top of
  that 3-band dark layout. Operator feedback identified the layout itself as
  the bottleneck: minimal text rendering, no scannable IA, hidden architecture,
  flat memory list. Operator engaged Claude Design which produced a full
  IA-rewrite design pack (1791-line Cockpit.html + 6 JSX modules + DESIGN-THESIS
  + HANDOFF-PROMPT, ~5900 lines total). The pack defines a 7-section editorial
  light cockpit grounded in the 5-second test: open the page, in 5s know
  WHAT IS HAPPENING / WHY / WHAT JUST CHANGED / WHAT RISK / WHAT TO DO NEXT /
  WHAT EVIDENCE backs it. v3.4 implements the pack.
outcome_delivered: >-
  Operator opens localhost:7777 and within 5 seconds answers the six canonical
  questions from the sticky ScanBar. The cockpit reads top to bottom as a
  comprehension funnel: chrome → command strip → 5-sec scan → §1 Mission →
  §2 Telemetry → §3 Architecture → §4 Milestone → §5 Memory → §6 Evidence →
  §7 Event tape → bottom drawers (Alarms / Rationale). Three SVG diagrams
  (phase dataflow / SGSD orchestration / milestone dependency) replace prose.
  Typed memory mesh (observation / claim {pending|validated|refuted} /
  decision) with the 5-step CMB lineage chain. Gate flow as stage-keyed
  predicate chain with ATC and MUDA badges. Light command-room palette;
  IBM Plex Sans + IBM Plex Mono + Big Shoulders Display 900. No part of SGSD
  goes silently stale or loses connection — every cockpit source is registered,
  heartbeat-tracked, and visibly tier-marked (fresh / degraded / stale / dead).
parent_project: Super GSD Framework
created_at: 2026-05-24
closed_at: null
predecessor: v3.3 ALL-PHASES-CLOSED (P128-P134 closed; P135 closed PASS-WITH-DEFERRED-IMPLEMENTATION-TO-v3.4)
design_pack: .planning/milestones/v3.4/design-pack/
authoritative_design_doc: .planning/milestones/v3.4/design-pack/DESIGN-THESIS.md
authoritative_handoff_doc: .planning/milestones/v3.4/design-pack/HANDOFF-PROMPT.md
authoritative_prototype: .planning/milestones/v3.4/design-pack/Cockpit.html
entry_criteria:
  - v3.3 ALL-PHASES-CLOSED
  - Claude Design pack committed into repo at .planning/milestones/v3.4/design-pack/
  - DESIGN-THESIS.md + HANDOFF-PROMPT.md read and understood by orchestrator
  - cockpit-sidecar.cjs --json contract still byte-stable (v3.3 P128-P130 keys all present)
exit_criteria:
  - 5-second test passes on every render — sticky ScanBar answers NOW/WHY/JUST-CHANGED/RISK/DO-NEXT/EVIDENCE
  - 7-section IA implemented at production quality matching the prototype Cockpit.html
  - Snapshot JSON shape extended additively with ~14 new top-level keys (mission, pipeline, agents, architecture, milestone_map, memory_graph, lineage, gate_flow, evidence, telemetry, alarms, events, learnings, rationale)
  - Light palette + IBM Plex + Big Shoulders Display 900 typography stack live; no purple gradients, no glassmorphism
  - Orthogonal SVG connectors in all diagrams (no bezier crossing nodes)
  - Memory typing visually distinct (observation solid / claim outlined-validated-refuted / decision yellow stripe)
  - Gates rendered as stage-keyed predicate chain CONTEXT → PLAN → EXECUTE → VERIFY → CLOSE with ATC + MUDA badges
  - Alarms carry threshold + cause + consequence + corrective action + linked evidence (no bare "high" alerts)
  - Hotkeys live (A approve / P pause / O open / Esc abort)
  - All collapsible sections persist state per section in localStorage (sgsd-sec-{id})
  - Liveness contract enforced — see binding invariants below
  - No regression in v3.3 self-test (53/53 must still pass after each phase commits)
non_goals:
  - No dark theme this milestone (Cockpit Dark.html exists in the pack but deferred to v3.5+)
  - No new external framework dependencies (no React in production; Babel-in-browser is forbidden)
  - No marketing copy or generic "status / details / info / overview" labels
  - No removal or modification of the existing chronicle HTML surface (v3.1) or the sidecar --html snapshot (v3.2) — those remain valid surfaces; v3.4 evolves only the live cockpit SPA
  - No external CDN beyond Google Fonts (IBM Plex Sans/Mono + Big Shoulders Display)
binding_invariants:
  - id: design-pack-is-canonical
    statement: When in doubt, mirror Cockpit.html. The prototype is the working reference for every IA decision, component, and visual treatment.
  - id: light-palette-only
    statement: Page bg #F6F7F4, primary surface #FFFFFF, ink #151A1E, lines #D6DBD2. Semantic color tokens only — --live #006D77, --done #2F7D5C, --attn #B7791F, --severe/--crit #B42318, --indigo #515E9C. No decorative gradients.
  - id: typography-stack-locked
    statement: IBM Plex Sans (body), IBM Plex Mono (data + numbers with tabular numerals), Big Shoulders Display 900 (section headers + mission phase ID). No Inter, Roboto, or system-ui as primary type.
  - id: five-second-test
    statement: The sticky ScanBar must answer NOW · WHY · JUST CHANGED · RISK · DO NEXT · EVIDENCE without scrolling. JUST CHANGED carries a live age tag.
  - id: orthogonal-connectors
    statement: Every flow-chart edge routes as right-angle elbow. No bezier curves crossing through node boxes. DiagramEdge accepts viaX/viaY for explicit gutter routing.
  - id: memory-typing
    statement: Three node types with distinct visuals — observation (solid fill, teal/done), claim (outlined pending / solid validated / crossed-red refuted), decision (yellow accent stripe, terminal feel). Lineage chain — execution_receipt → review_finding → evidence_verdict → decision_recommendation → promotion_decision.
  - id: rich-alarms
    statement: Every alarm carries threshold + cause + consequence + corrective action + linked evidence. No bare "high" / "low" alerts.
  - id: domain-language
    statement: milestone · phase · band · dispatch · fog · token · SLA · blocker · unlock · rationale · verification · evidence · audit trail. Never "status / details / info / overview".
  - id: stage-keyed-gates
    statement: CONTEXT → PLAN → EXECUTE → VERIFY → CLOSE. Each rolls up its sub-gates from gates.yaml. ATC (per-dispatch EXECUTE + per-phase CLOSE) and MUDA (CLOSE, 5 probes) get explicit badges.
  - id: liveness-contract
    statement: >-
      Every SGSD subsystem that writes to the cockpit is enumerated in
      super-gsd/registry/cockpit-sources.yaml with {name, expected_refresh_interval,
      freshness_threshold, write_path}. The cockpit shows source freshness per
      section (fresh / degraded / stale / dead) via a staleness pill in each
      section header. SSE disconnects are visible to the operator via a chrome
      indicator (● SSE LIVE → ● RECONNECTING → ● DISCONNECTED). Server emits an
      SSE ping event every 15s as keep-alive. Client auto-reconnects via
      EventSource with exponential backoff on disconnect. Sources that stop
      updating are flagged stale at 2× expected_refresh_interval and dead at
      5×. A new gate.liveness.all-sources-fresh fires every snapshot and WARNs
      on any stale source / FAILs on any dead source. No source can silently go
      stale.
phase_list:
  - P136 · Design tokens + IA scaffold — light palette into sgsd-design-system.css; renderShell refactor to chrome → command → ScanBar → sec-nav → main sections; IBM Plex + Big Shoulders Display loaded
  - P137 · Snapshot data contract expansion + Cockpit Source Registry — extend cockpit-sidecar.cjs + serve.cjs to publish the ~14 new top-level keys; author super-gsd/registry/cockpit-sources.yaml; attach _sources heartbeat to every snapshot; implement gate.liveness.all-sources-fresh
  - P138 · Sticky chrome components + SSE keep-alive — CommandStrip + ScanBar + ExplanationBand + sec-nav + hotkeys (A approve / P pause / O open / Esc abort); server keep-alive ping every 15s; client EventSource auto-reconnect with exponential backoff + visible RECONNECTING badge
  - P139 · §1 Mission + §2 Telemetry — MissionCard + PhaseRunway + AgentLanes + TelemetryRail (5 sparkline channels with target + tier ranges + delta arrow)
  - P140 · §3 Architecture + §4 Milestone — PhaseArchitectureDiagram + OrchestrationDiagram + MilestoneStrip + MilestoneDependencyDiagram + PhaseDetailPanel; all orthogonal-routed SVG; clickable chips with drawer-style detail panels
  - P141 · §5 Memory + §6 Evidence — MemoryGraph (typed mesh with observation/claim/decision visuals) + LineageChain (5-step CMB) + EvidencePanel (gate-flow predicate chain + ATC tier history + MUDA 5-probe + 4-category evidence cards + reviewer + unresolved findings + learnings)
  - P142 · §7 Event tape + Alarm drawer + Rationale drawer + localStorage persistence + 5-second test conformance — EventTape (monospace streaming) + AlarmList (HMI rows with threshold/cause/consequence/action expansion) + RationaleLayer (5 sections) + per-section collapse persistence
  - P143 · Conformance promotion + liveness coverage SAC + integration — extend conformance-check.cjs with new rules covering the new IA; add liveness coverage SAC verifying every cockpit-sources.yaml entry resolves to a real write path; final 5-second test mechanical verification; migration of old dark cockpit → new light cockpit (delete dark variant from prod path; preserve in design pack)
open_questions:
  - id: Q-v34-A
    question: Should the dark variant (Cockpit Dark.html) ship as an optional operator preference in v3.4 or be deferred to v3.5+?
    default: defer-to-v3.5
  - id: Q-v34-B
    question: Should the tweaks-panel.jsx design-tuning UI ship as an operator-only debug surface or be excluded from production?
    default: exclude
  - id: Q-v34-C
    question: cockpit-sources.yaml — should source entries be runtime-tunable (operator can adjust freshness thresholds without a code deploy) or compile-time only?
    default: compile-time-only (changes require a phase + commit)
  - id: Q-v34-D
    question: When a source goes "dead" (>5× refresh interval), should the cockpit auto-attempt-recovery (re-invoke the write path) or surface to operator only?
    default: surface-only (no auto-recovery without operator approval)
---

# Milestone v3.4 — Operator Cockpit IA Rewrite (Editorial Light)

> v3.3 shipped a working cockpit; v3.4 ships a cockpit operators trust as a model of the live execution system. The 5-second test is the contract.

## Why now

v3.3 P135's polish-pass uncovered the truth: incremental polish couldn't lift the 3-band dark layout to operator-grade. Claude Design produced a full IA rewrite (1791-line prototype). The design pack defines a 7-section editorial-light cockpit grounded in the 5-second test. v3.4 implements it.

## The liveness contract — the operator's first concern

The operator's primary worry: parts of SGSD silently going stale, losing the SSE connection, or never being wired to the cockpit. v3.4's response: **every cockpit source is enumerated, heartbeat-tracked, and visibly tier-marked**. The cockpit reveals its own liveness state.

Mechanically:
1. **Cockpit Source Registry** at `super-gsd/registry/cockpit-sources.yaml` — every SGSD subsystem that writes to the cockpit, with `{name, expected_refresh_interval, freshness_threshold, write_path}`.
2. **Per-source heartbeat** in `snapshot._sources` — `{ [source_id]: { last_updated_at, age_seconds, tier: fresh|degraded|stale|dead } }`.
3. **Staleness pills** rendered per section header — fresh sources are silent, stale/dead sources are loud.
4. **SSE keep-alive** — server pings every 15s; client EventSource auto-reconnects with exponential backoff.
5. **Chrome SSE indicator** — `● SSE LIVE` becomes `● RECONNECTING` then `● DISCONNECTED` if retries exhausted.
6. **Liveness gate** — `gate.liveness.all-sources-fresh` fires every snapshot. WARN on stale, FAIL on dead.
7. **Liveness coverage SAC** — verifies every registry entry resolves to a real write path in the codebase. Catches "we forgot to wire X" at test time.

## 8 phases

| Phase | Title | Maps to handoff implementation priority |
|---|---|---|
| **P136** | Design tokens + IA scaffold | Priority 1 + 2 |
| **P137** | Snapshot data contract + Cockpit Source Registry + liveness heartbeat | Data prerequisite + liveness contract |
| **P138** | Sticky chrome + SSE keep-alive + reconnect | Priority 3 + liveness contract |
| **P139** | §1 Mission + §2 Telemetry | Priority 3 |
| **P140** | §3 Architecture + §4 Milestone | Priority 4 |
| **P141** | §5 Memory + §6 Evidence | Priority 4 + 5 |
| **P142** | §7 Event tape + Alarm drawer + Rationale drawer + localStorage + 5-sec test | Priority 5 + 6 |
| **P143** | Conformance promotion + liveness coverage SAC + integration + migration | Priority 5 + 6 + cleanup |

## Constraints summary

- Light palette only this milestone (dark deferred)
- IBM Plex Sans + IBM Plex Mono + Big Shoulders Display 900 — no other type families
- Vanilla JS only — no React/Vue/framework runtime; the JSX prototype is reference, not production
- Orthogonal SVG connectors only
- 5-second test passes on every section
- Liveness contract enforced via registry + heartbeat + gate + SAC

## References

- `.planning/milestones/v3.4/design-pack/DESIGN-THESIS.md` — design rationale
- `.planning/milestones/v3.4/design-pack/HANDOFF-PROMPT.md` — implementation instructions
- `.planning/milestones/v3.4/design-pack/Cockpit.html` — canonical working prototype (1791 lines)
- `.planning/milestones/v3.4/design-pack/mc-*.jsx` — JSX component sources (~3600 lines; translated to vanilla JS during implementation)
- `.planning/milestones/v3.3/phases/135-cockpit-visual-polish/` — v3.3 P135 scoping memos
- `super-gsd/registry/gates.yaml` — existing gate registry (extended in P137 to register the new gate.liveness.* gates)
