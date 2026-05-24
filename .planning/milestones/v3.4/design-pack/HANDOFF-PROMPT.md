# SGSD Cockpit · Master Handoff Prompt

> Paste this into a fresh Claude (or Codex) session along with the design-pack zip.
> The zip contains the working prototype (`Cockpit.html` + JSX modules + thesis doc + state snapshot)
> and `DESIGN-THESIS.md` covering the full information-architecture rationale.

---

## ROLE

You are implementing the SGSD operator cockpit at `super-gsd/tools/cockpit-sidecar/`.
The design has been finalised through several iterations and is captured in the attached pack.
Your job is to port the prototype's IA + visual language into the live cockpit-sidecar so the
operator can open `localhost:7777` and read the live execution state in 5 seconds.

The prototype is a single-page React-via-Babel proof-of-concept simulating real SSE updates.
Production should not depend on Babel-in-browser. Translate to your existing render pipeline
(`render-html.cjs::renderShell` + a leaner `client.js`) without losing the IA or the data
contracts.

---

## DESIGN THESIS (1-line version)

> The cockpit is not a dashboard. It is a model of the live execution system, rendered.
> Within 5 seconds, an operator must answer: **what is happening, why, what just changed,
> what risk is rising, what to do next, what evidence backs it.**

Full thesis with palette + hierarchy + component list + success checklist lives in
`DESIGN-THESIS.md`.

---

## NON-NEGOTIABLES

1. **Light command-room palette.** Page bg `#F6F7F4`, primary surface `#FFFFFF`, ink `#151A1E`,
   lines `#D6DBD2`. Semantic colour only — no purple/blue gradients, no glassmorphism, no
   decorative gradients. Color appears only on state:
   - `--live` `#006D77` (deep teal-blue) — happening now
   - `--done` `#2F7D5C` — normal / completed
   - `--attn` `#B7791F` — attention
   - `--severe` / `--crit` `#B42318` — severe / critical
   - `--indigo` `#515E9C` — rationale / decisions accent

2. **Typography.** IBM Plex Sans (body), IBM Plex Mono (data/numbers — tabular numerals),
   Big Shoulders Display 900 (section headers + mission phase ID). No Inter, no Roboto.

3. **5-second test.** The sticky ScanBar must answer all six canonical questions (NOW · WHY ·
   JUST CHANGED · RISK · DO NEXT · EVIDENCE) without scrolling. JUST CHANGED carries a live
   `Xs / Xm ago` tag.

4. **Progressive disclosure.** Mission and Telemetry are always visible. Architecture,
   Milestone, Memory, Evidence, Event tape are collapsible — open/closed state persists per
   section in `localStorage` (`sgsd-sec-{id}`).

5. **Orthogonal connectors.** Every flow-chart edge routes as right-angle elbow. NO bezier
   curves crossing through node boxes. `DiagramEdge` accepts `viaX` / `viaY` for explicit
   gutter routing — use them when source and target are on different "rows".

6. **Memory typing.** Three node types with distinct visuals:
   - **observation** — solid fill, teal/done
   - **claim** — outlined (pending), solid (validated), crossed/red (refuted)
   - **decision** — yellow accent stripe, terminal node feel
   Plus the lineage chain `execution_receipt → review_finding → evidence_verdict →
   decision_recommendation → promotion_decision`.

7. **Alarms carry threshold + cause + consequence + corrective action + linked evidence.**
   No bare "high" / "low" alerts.

8. **Domain language only.** milestone · phase · band · dispatch · fog · token · SLA · blocker
   · unlock · rationale · verification · evidence · audit trail. Never "status / details /
   info / overview".

9. **Gates are stage-keyed.** Five stages CONTEXT → PLAN → EXECUTE → VERIFY → CLOSE, each
   rolling up its registered sub-gates from `gates.yaml`. The two concept gates **ATC** (per-
   dispatch at EXECUTE + per-phase at CLOSE) and **MUDA** (CLOSE, 5 waste probes) get explicit
   badges so the operator sees where they fire.

---

## INFORMATION ARCHITECTURE (sections in reading order)

| # | Section | Default | Contents |
|---|---|---|---|
| chrome | `localhost:7777 / cockpit · v3.3 · P135 · SSE LIVE · hotkeys` | always | sticky |
| command | objective · next-action · owner · risk · time-left · controls | always | sticky |
| ScanBar | 6 cells answering the canonical questions | always | sticky |
| sec-nav | jump-to-section tabs | always | sticky beneath ScanBar |
| §1 Mission | MissionCard + PhaseRunway + ExplanationBand + AgentLanes | **open** | visual anchor |
| §2 Telemetry | sparkline rail (fog / dispatches / tokens / ctx / elapsed) | **open** | live instruments |
| §3 Architecture | phase dataflow / SGSD orchestration (subtabs) | collapsed | |
| §4 Milestone | dependency DAG + permanent dossier column (tabbed) | collapsed | |
| §5 Memory | argument-map mesh / lineage chain (subtabs) | collapsed | |
| §6 Evidence | gate flow → registry → ATC history + MUDA probes → tests/lint/audit cards → learnings | collapsed | |
| §7 Event tape | streaming events, monospace, secondary | collapsed | |
| bottom | Alarms (HMI drawer) + Rationale (5 sections) | collapsed | |

---

## DATA CONTRACTS the sidecar must publish

The prototype consumes a single snapshot object. The live sidecar should expose this same
shape via the existing SSE channel (push deltas, snapshot on connect). Keys the cockpit
depends on:

### Top-level
- `milestone` / `phase` / `phase_name`
- `objective`, `next_action { verb, target, hotkey }`
- `owner { handle, secondary }`
- `risk { tier, label, reason }`
- `time_left_sec`

### Mission
- `mission { phase_id, phase_title, objective, why_running, unlocks, risk_tier, risk_reasons[],
  operator_decision_required, decision_prompt, success_criteria[{ code, text, status }] }`

### Pipeline / runway
- `pipeline { active_index, blocker, why_running, unlocks, stages[{ name, owner, sla_min,
  elapsed_sec, status, blocking_gate, next_action }] }`

### Agents
- `agents.claude` and `agents.codex` each: `{ handle, model, effort?, role, status, task,
  since_sec, last_action, recent_actions[{ kind, detail, age_sec }] }`
- `agents.last_handoff { from, to, payload, t_off, kind }`

### Architecture / milestone / memory
- `architecture { nodes[], edges[] }` (P135 dataflow — for the SVG diagram)
- `milestone_map { milestones[], current, phases[{ id, label, status, sub?, current?, note? }],
  unlocks, details: { [phaseId]: { title, eli5, why, context, unlocks, outcome, files[],
  duration, owner } } }`
- `memory_graph { sources[{ id, type: 'observation'|'claim'|'decision', kind, label, detail,
  consumed_by[], validation?, pending?, active }], current_consumer, current_action }`
- `lineage { title, steps[{ id, stage, type, validation?, label, detail, meta, icon,
  terminal?, pending? }] }`

### Gates
- `gate_flow.stages[]` — 5 entries (`context` / `plan` / `execute` / `verify` / `close`), each:
  ```
  { id, name, verdict: 'green'|'warn'|'severe'|'fail'|'pending',
    blocking?, summary,
    gates: [{ name, mode, sampling, status, concept?: 'ATC'|'MUDA',
              detail, repair, blocking? }] }
  ```
- `gate_flow.atc_history[]` — `[{ dispatch, tier: 'SKIP'|'LITE'|'FULL'|'GATE', verdict,
  tokens, note? }]`
- `gate_flow.muda_probes[]` — `[{ name, status, detail, waste_class }]`

Map registry → stages per `135-GATES-EXPLAINER.md`:
- CONTEXT: gate.context.completeness · context-selector-haiku · sgsd-recall-queries ·
  intent-injection · vtp-enrichment
- PLAN: plan-schema-v2 · gate.plan.operator-approval · classifier-haiku
- EXECUTE: per-dispatch-ATC (concept ATC) · gate.execute.dispatch-ceiling · token-log
- VERIFY: gate.verify.self-test · verifier-row-arithmetic · verifier-detail-vs-summary
- CLOSE: phase-level-ATC (concept ATC) · MUDA-waste-audit (concept MUDA) ·
  qualitative-waste-audit (concept MUDA) · sgsd-curate-learnings · gate.close.operator-promote

### Evidence + telemetry + alarms + events + learnings + rationale
- `evidence { last_run_at_sec_ago, summary, categories[{ name, items[{ code, status, detail,
  last_run_sec? }] }], unresolved[{ code, tier, detail, age_sec }] }`
- `telemetry { fog, dispatches, tokens, context, elapsed }` each with `{ value, target, max,
  normal_max, attn_max, severe_max, history[], tier_for(v), label, unit, formatter? }`
- `alarms[{ signal, tier, severity_label, since_sec, detail, threshold, cause, consequence,
  action, evidence[] }]`
- `events[{ t_off, type, tier, detail, created_at }]` — stamp `created_at` on emit so the
  cockpit can compute live ages
- `learnings[{ kind: 'bug'|'regression'|'gotcha'|'lesson'|'precedent', age_sec, title,
  detail, phase, resolved, fix }]`
- `rationale { why_this_phase, what_changed, what_could_go_wrong, what_evidence_supports,
  what_happens_next, evidence_trail }` (no ELI5 in the rationale layer — ELI5 lives in the
  per-phase dossier)

---

## IMPLEMENTATION PRIORITY

1. **Lift the design tokens** into `shared/sgsd-design-system.css` (light palette + type stack
   + spacing). Replace the existing dark tokens.
2. **Refactor `renderShell`** to emit the new IA scaffold: chrome → command → ScanBar → sec-
   nav → main sections → bottom drawer.
3. **Implement the live components** in plain JS (no Babel). Start with:
   - CommandStrip · ScanBar · ExplanationBand · MissionCard · PhaseRunway
   - TelemetryRail (sparkline.cjs + serve.cjs::attachSparklines as already planned)
   - AlarmList drawer with threshold/cause/consequence/action
4. **Add the diagrams** as SVG. Use the `DiagramEdge` orthogonal-routing pattern (HVH default,
   `viaX`/`viaY` for fork edges).
5. **Wire the SSE channel** to push delta-merged snapshots. The cockpit re-renders on each.
6. **Persist** `localStorage` keys `sgsd-sec-{id}` for collapsibles and `sgsd-rationale` for
   the bottom drawer.

---

## DO NOT

- recreate the dark palette
- add Inter / Roboto / system-ui as primary type
- use marketing copy or generic "Overview" / "Status" labels
- nest cards inside cards
- let any flow-chart edge cross through a node box
- treat all sections as equal weight (Mission and Telemetry visibly anchor; tape/telemetry
  visibly recede)
- ship without the 5-second test passing (`A` approve · `P` pause hotkeys live · ScanBar
  answers all 6 questions)

---

## WORKING REFERENCE

Open `Cockpit.html` from the pack and scroll. Every IA decision, every component, every
visual treatment that should ship is rendered there in working form against simulated data.
When in doubt, mirror it.
