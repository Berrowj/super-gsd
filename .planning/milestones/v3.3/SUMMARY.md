---
milestone: v3.3
milestone_name: Live Contextual Awareness Cockpit
status: "v3.3 ALL-PHASES-CLOSED 2026-05-24 — 8/8 phases (P128-P135); cockpit data model + 3-band terminal + rationale layer + ELI5 Munroe lint + localhost SSE surface + monitor migration + conformance promotion shipped. P135 closes PASS-WITH-DEFERRED to v3.4 (operator engaged Claude Design for IA-rewrite design pack; implementation rescoped to v3.4 P136-P143). Cockpit self-test 57/57 PASS (53 pre-P134 + 4 P134 wiring); zero regression."
closed_at: 2026-05-24
phases_total: 8
phases_passed: 7
phases_pass_with_deferred: 1
self_test_total: "57/57"
deferred_to_next_milestone: v3.4
---

# Milestone v3.3 — Live Contextual Awareness Cockpit — SUMMARY

## Outcome

v3.3 extended the v3.2 answer-first cockpit into a live execution-state surface: data model
expansion (stage pipeline + rationale), terminal-band rewrite (3-band layout + sparklines),
ELI5 grounded in the Munroe common-words allowlist, a Node http+SSE+fs.watch localhost server
at port 7777 + DOM-diff client, monitor migration, and conformance promotion to binding rules
R13-R18 across two new surfaces (`cockpit-html`, `monitor`). The visual-polish phase (P135)
pivoted mid-flight when operator feedback drove a full IA-rewrite design pack via Claude
Design; that work is rescoped to milestone v3.4 (P136-P143).

## Shipped phases

| Phase | Topic | Evidence |
|---|---|---|
| P128 | Cockpit data model | `stage-pipeline.cjs` (5 frozen stages) + `attachStagePipeline` + additive `--json` keys |
| P129 | Band 1+2 terminal | `renderText` 3-band rewrite + `sparkline.cjs` (ANSI + SVG) + `palette_tier` on alerts |
| P130 | Band 3 rationale | `rationale.cjs` cascade reader (CONTEXT/INTENT/SUMMARY) + `succes-lint.cjs` WHY-block lint |
| P131 | ELI5 upgraded | `eli5-common-words.txt` (1539 words) + `eli5-lint.cjs` Munroe check + Duarte arc prompt |
| P132 | Localhost live | `render-html.cjs` extracted + `serve.cjs` (http+SSE+fs.watch) + `client.js` DOM-diff + `start-cockpit-server.ps1` |
| P133 | Monitor migration | `sgsd-codex-monitor.ps1` keep/kill audit + `-Drill` flag + BAND banners |
| P134 | Conformance promotion | R13-R18 binding in `design-rules.json` + `conformance-check.cjs` checkR13..checkR18 + `cockpit-html`/`monitor` surfaces |
| P135 | Visual polish (PASS-WITH-DEFERRED) | Design pack at `.planning/milestones/v3.4/design-pack/` (Cockpit.html 1791 lines + 6 JSX modules + DESIGN-THESIS + HANDOFF-PROMPT); implementation deferred to v3.4 |

## Cockpit self-test trajectory

- Pre-v3.3 baseline: 18/18 (P125-P127)
- After v3.3 close: **57/57 PASS** — 53 pre-P134 (P125-P127 + P128-P133) + 4 P134 wiring SACs
- Zero regression at every phase boundary

## Notable decisions

- **v3.4 scope shift (2026-05-24)** — P135 pivoted from in-place client.js polish to a
  full IA-rewrite design pack (Claude Design output); 8 new v3.4 phases scoped P136-P143.
- **Liveness contract baked into v3.4 INTENT** — operator's "parts cannot go stale or
  silently lose connection" concern becomes binding invariant #10: Cockpit Source Registry
  (`super-gsd/registry/cockpit-sources.yaml`) + per-source heartbeat + staleness pills +
  SSE keep-alive (15s ping) + EventSource auto-reconnect with backoff + reconnect badge +
  `gate.liveness.all-sources-fresh` conformance gate.
- **Codex executor fallback established** — `super-gsd/scripts/codex-patch-executor.sh`
  read-pack patch mode shipped as the canonical recovery for Windows CreateProcessAsUserW
  shell-exec blocks; orchestrator-author of SAC tests established as the recovery pattern
  for `review`-skill-conflict empty patches.

## Deferred to v3.4

- **P135 implementation** → 8 v3.4 phases:
  - P136 design tokens + IA scaffold (light editorial palette + IBM Plex)
  - P137 snapshot data contract expansion (~14 new top-level keys) + source registry + liveness heartbeat
  - P138 sticky chrome + SSE keep-alive + reconnect badge
  - P139 §1 Mission + §2 Telemetry (MissionCard · PhaseRunway · AgentLanes · TelemetryRail)
  - P140 §3 Architecture + §4 Milestone SVG diagrams (orthogonal connectors)
  - P141 §5 Memory + §6 Evidence (lineage + gate flow + ATC + MUDA)
  - P142 §7 Event tape + alarm drawer + rationale drawer + 5-second test conformance
  - P143 conformance promotion (R19+) + liveness coverage SAC + integration + migration

## Provider state at close

- Claude orchestration: AVAILABLE
- Codex execution: AVAILABLE (Windows shell-exec block worked around via patch-executor read-pack mode for 3 dispatches this milestone)

## Next milestone

**v3.4 — Operator Cockpit IA Rewrite (Editorial Light).** Scoped, 10 binding invariants
locked, 8 phases queued. INTENT.md at `.planning/milestones/v3.4/INTENT.md` (commit 6fea42f).
Liveness contract is the non-negotiable design constraint.
