---
phase: 137
phase_name: Snapshot Data Contract + Cockpit Source Registry + Liveness Heartbeat
milestone: v3.4
ws: core
status: PENDING
created_at: 2026-05-24
predecessor: v3.4/P136 (closed PASS — DOM hooks reserved)
successor: v3.4/P138 (sticky chrome + SSE keep-alive + reconnect badge)
---

# Phase 137 — Snapshot Data Contract + Cockpit Source Registry + Liveness Heartbeat — CONTEXT

## Goal

Wire the data plumbing the v3.4 cockpit depends on. Three deliverables:

1. **Snapshot expansion** — extend `cockpit-sidecar.cjs` (and `serve.cjs` snapshot
   composition) to emit ~14 new top-level keys per the design-pack data contract.
2. **Cockpit Source Registry** — author `super-gsd/registry/cockpit-sources.yaml`
   enumerating every cockpit-rendered source with its write path, expected refresh cadence,
   staleness thresholds, and rendering surface. This is the operator-visible source of
   truth for "what feeds the cockpit and when does it go stale".
3. **Liveness heartbeat** — attach a `_sources` block to every snapshot with per-source
   freshness state (fresh/degraded/stale/dead based on registry thresholds + mtime). Add a
   `gate.liveness.all-sources-fresh` conformance check that fires on every snapshot render.

This is invariant #10 of v3.4 — the operator's "parts must not silently go stale" concern
made mechanical. P136 reserved the DOM hooks (`<span data-conn="state">` + per-section
`data-source`); P137 emits the data those hooks render; P138 lights them up via the chrome.

## Authoritative inputs

- **`.planning/milestones/v3.4/INTENT.md`** — invariant #10 verbatim (liveness contract).
- **`.planning/milestones/v3.4/design-pack/HANDOFF-PROMPT.md`** §"DATA CONTRACTS the sidecar
  must publish" — canonical 14-key shape table with field-level subkeys.
- **`.planning/milestones/v3.4/design-pack/Cockpit.html`** — embedded sample snapshot
  shows actual shapes for `pipeline`, `agents`, `architecture`, `milestone_map`,
  `memory_graph`, `lineage`, `gate_flow`, `evidence`, `telemetry`, `alarms`, `events`,
  `learnings`, `rationale`.
- **`.planning/milestones/v3.4/design-pack/DESIGN-THESIS.md`** §"Memory typing" — defines
  the 3 source types (observation/claim/decision) baked into `memory_graph`.
- **`super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs`** — current snapshot composer
  (composeOutput / attachStagePipeline / attachRationale / etc).
- **`super-gsd/tools/cockpit-sidecar/serve.cjs`** — current http+SSE+fs.watch server;
  snapshot delivery path is here.
- **`super-gsd/tools/shared/conformance-check.cjs`** — gate registry where
  `gate.liveness.all-sources-fresh` registers.

## Binding invariants

1. **Additive contract.** Every NEW key is OPTIONAL on read. Existing consumers
   (`renderText`/`renderHtml`/`renderBrief`/sidecar JSON output) must not throw when a key
   is missing. SAC-P127-* + SAC-P128-* + SAC-P134-03 continue to pass.
2. **Frozen field shapes.** Each new top-level key has a locked field-level shape per
   §"Data contract field shapes" below. Codex must NOT invent fields or rename.
3. **Lock-13.** Changes confined to `super-gsd/tools/cockpit-sidecar/` +
   `super-gsd/tools/shared/conformance-check.cjs` + NEW file
   `super-gsd/registry/cockpit-sources.yaml`. Zero touches to `cockpit-state/*`,
   `tests/cockpit-acceptance/*`, `tests/cockpit-regression/*`.
4. **Liveness gate is BINDING.** `gate.liveness.all-sources-fresh` is a new binding
   conformance rule (registered as R19) — every snapshot rendered through `renderHtml`
   that carries a `_sources` block must pass it (all enumerated sources fresh or
   explicitly excused via `excused: true` per-entry).
5. **Registry is authoritative.** If a section emits live data without a corresponding
   `cockpit-sources.yaml` entry, the registry coverage SAC fails. The YAML drives the
   liveness probe, not the snapshot shape.
6. **No SSE keep-alive yet.** P138 wires the 15s ping + reconnect. P137 only emits
   `_sources` data; the connection-state hook (`data-conn="state"`) is filled later.

## Scope

**In:**
- Author `super-gsd/registry/cockpit-sources.yaml` with one entry per section
  (mission, telemetry, architecture, milestone, memory, evidence, events) + per-entry:
  `id`, `section_id`, `write_path` (string OR `derived: true`), `cadence_ms` (expected
  refresh), `stale_after_ms`, `dead_after_ms`, `description`.
- Extend `cockpit-sidecar.cjs` snapshot composer to emit the 14 keys per §"Data contract
  field shapes" below. Use minimal-content stubs for fields that have no upstream data
  source yet (P138-P142 fill them) — fields exist with `null` or `[]` defaults.
- Attach `_sources` block to every snapshot composed: object keyed by registry `id`,
  value `{ tier: 'fresh'|'degraded'|'stale'|'dead', age_ms, last_seen, excused }`.
  Compute via `liveness.cjs` (NEW module) that reads cockpit-sources.yaml + statxs the
  write_paths.
- Register R19 (`gate.liveness.all-sources-fresh`) in `design-rules.json` + the matching
  `checkR19` in `conformance-check.cjs`. Fires on JSON snapshot input only (not HTML).
- Append SAC-P137-01..08 tests.

**Out:**
- SSE keep-alive ping (P138).
- EventSource client reconnect + visible reconnect badge (P138).
- Sticky chrome rendering of staleness pills (P138).
- Component bodies for the 14 new keys (P139-P142).
- Migration of dark cockpit deletion (P143).

## Data contract field shapes (LOCKED — Codex must not deviate)

```yaml
# Each is OPTIONAL on read; PRESENT on write when sidecar composes a snapshot.
mission:
  phase_id: string         # "P137"
  phase_title: string
  objective: string
  why_running: string
  unlocks: string
  risk_tier: "low"|"medium"|"high"|"critical"
  risk_reasons: [string]
  operator_decision_required: boolean
  decision_prompt: string|null
  success_criteria: [{ code: string, text: string, status: "pending"|"done"|"blocked" }]

pipeline:
  active_index: number
  blocker: string|null
  why_running: string|null
  unlocks: string|null
  stages: [{ name: string, owner: string, sla_min: number, elapsed_sec: number,
             status: "pending"|"active"|"done"|"blocked", blocking_gate: string|null,
             next_action: string|null }]

agents:
  claude: { handle: string, model: string, role: string, status: string, task: string,
            since_sec: number, last_action: string, recent_actions: [{ kind, detail, age_sec }] }
  codex:  { handle: string, model: string, effort: string|null, role: string,
            status: string, task: string, since_sec: number, last_action: string,
            recent_actions: [{ kind, detail, age_sec }] }
  last_handoff: { from: string, to: string, payload: string, t_off: string, kind: string }

architecture:
  nodes: [{ id: string, label: string, kind: string, x: number, y: number }]
  edges: [{ from: string, to: string, kind: string, viaX: number|null, viaY: number|null }]

milestone_map:
  milestones: [{ id: string, label: string, status: string }]
  current: string
  phases: [{ id: string, label: string, status: string, sub: string|null,
             current: boolean, note: string|null }]
  unlocks: string|null
  details: { [phaseId]: { title, eli5, why, context, unlocks, outcome, files: [string],
                          duration: string, owner: string } }

memory_graph:
  sources: [{ id: string, type: "observation"|"claim"|"decision", kind: string,
              label: string, detail: string, consumed_by: [string],
              validation: "pending"|"validated"|"refuted"|null,
              pending: boolean, active: boolean }]
  current_consumer: string|null
  current_action: string|null

lineage:
  title: string
  steps: [{ id: string, stage: string, type: string,
            validation: string|null, label: string, detail: string,
            meta: object, icon: string, terminal: boolean, pending: boolean }]

gate_flow:
  stages: [{ id: "context"|"plan"|"execute"|"verify"|"close",
             name: string, verdict: "green"|"warn"|"severe"|"fail"|"pending",
             blocking: boolean, summary: string,
             gates: [{ name: string, mode: string, sampling: string,
                       status: string, concept: "ATC"|"MUDA"|null,
                       detail: string, repair: string|null, blocking: boolean }] }]
  atc_history: [{ dispatch: string, tier: "SKIP"|"LITE"|"FULL"|"GATE",
                  verdict: string, tokens: number, note: string|null }]
  muda_probes: [{ name: string, status: string, detail: string, waste_class: string }]

evidence:
  last_run_at_sec_ago: number
  summary: string
  categories: [{ name: string, items: [{ code: string, status: string,
                                          detail: string, last_run_sec: number|null }] }]
  unresolved: [{ code: string, tier: string, detail: string, age_sec: number }]

telemetry:
  fog:        { value, target, max, normal_max, attn_max, severe_max,
                history: [number], label: string, unit: string }
  dispatches: { value, target, max, normal_max, attn_max, severe_max, history, label, unit }
  tokens:     { value, target, max, normal_max, attn_max, severe_max, history, label, unit }
  context:    { value, target, max, normal_max, attn_max, severe_max, history, label, unit }
  elapsed:    { value, target, max, normal_max, attn_max, severe_max, history, label, unit }

alarms: [{ signal, tier, severity_label, since_sec, detail, threshold, cause,
           consequence, action, evidence: [string] }]

events: [{ t_off: string, type: string, tier: string, detail: string, created_at: number }]

learnings: [{ kind: "bug"|"regression"|"gotcha"|"lesson"|"precedent",
              age_sec: number, title: string, detail: string,
              phase: string, resolved: boolean, fix: string }]

rationale:
  why_this_phase: string
  what_changed: string
  what_could_go_wrong: string
  what_evidence_supports: string
  what_happens_next: string
  evidence_trail: [string]

_sources:
  # AUTOMATICALLY GENERATED — do NOT hand-author per-snapshot
  mission:      { tier, age_ms, last_seen, excused }
  telemetry:    { tier, age_ms, last_seen, excused }
  architecture: { tier, age_ms, last_seen, excused }
  milestone:    { tier, age_ms, last_seen, excused }
  memory:       { tier, age_ms, last_seen, excused }
  evidence:     { tier, age_ms, last_seen, excused }
  events:       { tier, age_ms, last_seen, excused }
```

## Cockpit Source Registry shape

`super-gsd/registry/cockpit-sources.yaml`:

```yaml
schema_version: 1
sources:
  - id: mission
    section_id: sec-mission
    write_path: ".planning/STATE.md"
    cadence_ms: 5000
    stale_after_ms: 30000
    dead_after_ms: 120000
    description: "Mission card — current phase objective, owner, risk tier"

  - id: telemetry
    section_id: sec-telemetry
    derived: true
    cadence_ms: 5000
    stale_after_ms: 15000
    dead_after_ms: 60000
    description: "5-channel sparkline rail derived from metrics + state"

  - id: architecture
    section_id: sec-architecture
    write_path: ".planning/milestones/{milestone}/phases/{phase}/CONTEXT.md"
    cadence_ms: 60000
    stale_after_ms: 300000
    dead_after_ms: 1800000
    description: "Phase dataflow diagram derived from CONTEXT + plan files"

  - id: milestone
    section_id: sec-milestone
    write_path: ".planning/milestones/{milestone}/INTENT.md"
    cadence_ms: 60000
    stale_after_ms: 600000
    dead_after_ms: 3600000
    description: "Milestone dependency map + phase strip"

  - id: memory
    section_id: sec-memory
    write_path: ".planning/memory/MEMORY.md"
    cadence_ms: 30000
    stale_after_ms: 300000
    dead_after_ms: 1800000
    description: "Cognitive memory graph — observations, claims, decisions"

  - id: evidence
    section_id: sec-evidence
    write_path: ".planning/metrics/"
    cadence_ms: 10000
    stale_after_ms: 60000
    dead_after_ms: 300000
    description: "Gate flow + ATC history + MUDA probes + verification cards"

  - id: events
    section_id: sec-events
    write_path: ".planning/metrics/token-log.jsonl"
    cadence_ms: 5000
    stale_after_ms: 30000
    dead_after_ms: 180000
    description: "Streaming event tape — token usage, dispatches, commits"
```

## Implementation decisions (locked)

- **`liveness.cjs` is a new module.** Pure function: `computeLiveness(registry, now) →
  _sources block`. Stats files via `fs.statSync` with `null`-safety; derived sources
  resolve via a `compute_path` callback (P137 stubs them as always-fresh).
- **`gate.liveness.all-sources-fresh` is R19.** Adds to `design-rules.json` with
  `applies_to: ["cockpit-html","monitor","cockpit"]` — fires on cockpit snapshot JSON
  AND on rendered HTML that carries a `_sources` block. For HTML, R19 parses
  `<script id="snapshot" type="application/json">...</script>` if present.
- **All 14 new keys are optional on read.** `cockpit-sidecar.cjs` adds an `attachAll()`
  composer that runs each `attachX(out)` in sequence; existing single-purpose attachers
  (`attachStagePipeline`, `attachRationale`) stay intact.
- **Stub-and-fill strategy.** P137 writes the attachers but they emit stubs (empty
  arrays, null fields) where upstream data isn't wired yet. P139-P142 fill them with
  real composition. This lets the data contract land before the components.
- **Source registry is single source of truth.** Both the snapshot `_sources` block AND
  the conformance gate R19 read from this YAML. No duplication.

## Semantic Acceptance Criteria (locked — verbatim in PLAN-LOCKED)

```
- id: SAC-P137-01
  input: "read super-gsd/registry/cockpit-sources.yaml"
  expected_outcome: "yaml parses; schema_version=1; sources array has exactly 7 entries with section_id matching sec-mission/sec-telemetry/sec-architecture/sec-milestone/sec-memory/sec-evidence/sec-events"

- id: SAC-P137-02
  input: "require('./liveness.cjs').computeLiveness with mocked registry"
  expected_outcome: "returns object keyed by registry ids; each value has {tier, age_ms, last_seen, excused} where tier ∈ {fresh,degraded,stale,dead}"

- id: SAC-P137-03
  input: "cockpit-sidecar attachAll() applied to a v3.3-shaped p127 sample output"
  expected_outcome: "output has all 14 new top-level keys (mission, pipeline, agents, architecture, milestone_map, memory_graph, lineage, gate_flow, evidence, telemetry, alarms, events, learnings, rationale) AND _sources block"

- id: SAC-P137-04
  input: "p127 sample output + attachAll(), then JSON.stringify + JSON.parse round-trip"
  expected_outcome: "round-trip survives; every v3.3 pre-existing key remains present (additive contract preserved)"

- id: SAC-P137-05
  input: "p127 sample output + attachAll(), then sidecar.renderText / renderHtml / renderBrief"
  expected_outcome: "no renderer throws on the new keys; output strings remain well-formed; SAC-P127-* + SAC-P134-03 conformance pre-checks still PASS"

- id: SAC-P137-06
  input: "design-rules.json after R19 added"
  expected_outcome: "rules array contains entry with id R19 and applies_to includes 'cockpit-html' and 'monitor'; R13..R18 still present"

- id: SAC-P137-07
  input: "conformance-check.cjs after R19 wired"
  expected_outcome: "source contains 'function checkR19'; existing checkR13..checkR18 still present"

- id: SAC-P137-08
  input: "checkConformance on a snapshot JSON with _sources block where every entry is tier='fresh'"
  expected_outcome: "binding_fail = 0; R19 passes; existing R16 still passes"
```

## Files

- **CREATE** `super-gsd/registry/cockpit-sources.yaml` — 7-entry registry.
- **CREATE** `super-gsd/tools/cockpit-sidecar/liveness.cjs` — computeLiveness function.
- **MODIFY** `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` — `attachAll()` +
  per-key stub attachers for the 14 new top-level keys + `_sources` attach.
- **MODIFY** `super-gsd/tools/shared/design-rules.json` — append R19.
- **MODIFY** `super-gsd/tools/shared/conformance-check.cjs` — register `checkR19`.
- **MODIFY** `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` — append SAC-P137-01..08.

## Tasks

- **T1** — CREATE `cockpit-sources.yaml` (registry).
- **T2** — CREATE `liveness.cjs` (computeLiveness).
- **T3** — MODIFY `cockpit-sidecar.cjs` — add `attachAll` + 14 stub attachers + `_sources`.
- **T4** — MODIFY `design-rules.json` + `conformance-check.cjs` — R19.
- **T5** — APPEND SAC-P137-01..08 to `run-self-test.cjs`.
- **T6** — Phase-close artefacts.

## Provider routing

T1+T4 (YAML/JSON edits) — Codex GPT-5.5/xhigh.
T2+T3 (new + modified CJS modules) — Codex GPT-5.5/xhigh.
T5 (test append) — orchestrator-direct (established pattern; cheaper than Codex).
T6 (phase close) — orchestrator.
