---
schema_version: 2
schema: plan-schema-v2
status: PLAN-LOCKED
plan_id: P137-01-data-contract-source-registry-liveness
phase_id: 137-cockpit-data-contract-source-registry-liveness
phase_number: 137
milestone: v3.4
workstream: core
title: Cockpit Data Contract + Source Registry + Liveness Heartbeat
created_by: orchestrator (Claude Opus 4.7, 1M context)
created_at: 2026-05-24
locked: true
expected_ATC_tier: FULL
skip_gates: []
depends_on:
  - P136-01-design-tokens-ia-scaffold
known_deadends: []
verification_cmd: node super-gsd/tools/cockpit-sidecar/run-self-test.cjs
lessons_path: null
tasks:
  - id: P137-T1
    agent: sgsd-exec-config
    model: codex
    files_touched:
      - super-gsd/registry/cockpit-sources.yaml
    input_contract: |-
      Reads 137-CONTEXT.md §"Cockpit Source Registry shape" verbatim.
    output_contract: |-
      super-gsd/registry/cockpit-sources.yaml created with schema_version=1 + 7 source
      entries (mission/telemetry/architecture/milestone/memory/evidence/events) per the
      locked shape. Each entry has id + section_id + write_path (or derived: true) +
      cadence_ms + stale_after_ms + dead_after_ms + description.
    hypothesis: |-
      A static YAML file with 7 well-typed entries is byte-stable on read by both
      liveness.cjs (T2) and conformance-check.cjs R19 (T4). YAML.parse error caught at
      T2/T3/T4 runtime if shape drifts.
    falsifier: |-
      YAML fails to parse via `js-yaml`/`yaml` module, OR any of the 7 entries omits a
      required key (id, section_id, cadence_ms, stale_after_ms, dead_after_ms,
      description), OR section_ids do not match the locked P136 set.
    stop_rule: |-
      File exists at super-gsd/registry/cockpit-sources.yaml. `node -e
      "require('js-yaml').load(require('fs').readFileSync('super-gsd/registry/cockpit-sources.yaml','utf8'))"` exits 0.

  - id: P137-T2
    agent: sgsd-exec-backend
    model: codex
    files_touched:
      - super-gsd/tools/cockpit-sidecar/liveness.cjs
    input_contract: |-
      Reads 137-CONTEXT.md §"Implementation decisions" → §"liveness.cjs is a new module".
      Reads cockpit-sources.yaml shape from T1 output.
    output_contract: |-
      super-gsd/tools/cockpit-sidecar/liveness.cjs exports `computeLiveness(opts)` where
      opts = { registry_path?, now?, statFn? } (all optional for testability).
      Returns an object keyed by registry source id; each value:
      { tier: 'fresh'|'degraded'|'stale'|'dead', age_ms: number|null, last_seen: number|null, excused: boolean }
      Computation:
        - derived: true entries → tier='fresh', age_ms=0, last_seen=now, excused=true
        - write_path with glob → if any matching file's mtime is within cadence_ms → fresh;
                                  cadence..stale_after → degraded; stale..dead_after → stale;
                                  > dead_after → dead; missing → dead
        - Path-template substitution (e.g. {milestone}/{phase}) reads from STATE.md frontmatter; if STATE missing, treat as dead.
      Module also exports `loadRegistry(path?)` for testing.
    hypothesis: |-
      A pure function over (registry, statFn, now) is testable without filesystem
      mocking. Caller (cockpit-sidecar.cjs T3) injects statFn=fs.statSync or a mock.
    falsifier: |-
      computeLiveness throws on a missing write_path (instead of returning tier='dead'),
      OR returns a tier value not in {fresh,degraded,stale,dead}, OR omits a registry
      entry from the output object.
    stop_rule: |-
      File exists. `node -e "const l=require('./super-gsd/tools/cockpit-sidecar/liveness.cjs'); console.log(typeof l.computeLiveness)"` prints "function".

  - id: P137-T3
    agent: sgsd-exec-backend
    model: codex
    files_touched:
      - super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs
    input_contract: |-
      Reads 137-CONTEXT.md §"Data contract field shapes" verbatim — the 14 keys + shapes.
      Reads cockpit-sidecar.cjs to locate existing attachers (attachStagePipeline / attachRationale).
    output_contract: |-
      cockpit-sidecar.cjs exports:
        - attachAll(out, opts) — runs all attachers in sequence; out mutated in place; returns out.
        - 14 stub attachers: attachMission, attachPipeline (alias for existing attachStagePipeline
          if it covers pipeline; else stub), attachAgents, attachArchitecture, attachMilestoneMap,
          attachMemoryGraph, attachLineage, attachGateFlow, attachEvidence, attachTelemetry,
          attachAlarms, attachEvents, attachLearnings, attachRationale (already exists; reuse).
        - attachSources(out) — calls liveness.computeLiveness and assigns out._sources.
      Each NEW stub attacher emits a minimal valid shape per the 137-CONTEXT.md table:
        - Objects → all required fields present with sensible defaults (string='', number=0,
          arrays=[], booleans=false, nullable=null).
        - Arrays → empty arrays.
      Existing attachers (attachStagePipeline, attachRationale) unchanged.
    hypothesis: |-
      Stub-and-fill keeps the data contract additive (existing renderers ignore the new
      keys per JS object iteration semantics) while letting downstream P139-P142 fill the
      stubs with real composition without changing the contract shape.
    falsifier: |-
      Self-test 57/57 (pre-T3 baseline 63/63 from P136) regresses, OR renderText /
      renderHtml / renderBrief throws on the new keys, OR attachAll changes the byte-shape
      of pre-existing keys (milestone, phase, generated_at, latest_chronicle,
      binding_gate_status, fog_score, recent_chronicles, signals, warnings, north_star,
      alerts, stage_pipeline, rationale).
    stop_rule: |-
      Self-test still 63/63 PASS after T3 lands (SAC-P137-* tests not yet appended).
      attachAll() returns out with all 14 new keys + _sources block. git diff confined
      to cockpit-sidecar.cjs.

  - id: P137-T4
    agent: sgsd-exec-backend
    model: codex
    files_touched:
      - super-gsd/tools/shared/design-rules.json
      - super-gsd/tools/shared/conformance-check.cjs
    input_contract: |-
      Reads 137-CONTEXT.md §"Implementation decisions" → §"gate.liveness.all-sources-fresh
      is R19" + existing design-rules.json R13-R18 entries + conformance-check.cjs
      checkR13-checkR18 functions for the registration pattern.
    output_contract: |-
      design-rules.json appends:
        { "id":"R19", "name":"gate.liveness.all-sources-fresh",
          "tier":"binding",
          "applies_to":["cockpit-html","monitor","cockpit"],
          "intent":"every cockpit-sources.yaml-registered source is fresh",
          "expand_terms":[] }
      conformance-check.cjs adds:
        function checkR19(input):
          - If input is a string, try to parse as JSON; if parse fails AND input is HTML,
            look for <script id="snapshot" type="application/json">...</script> and parse;
            else return {ok:true} (R19 N/A on non-snapshot input).
          - If parsed obj has no _sources key, return {ok:true} (no liveness data → N/A).
          - For each source in _sources: if tier === 'fresh' or excused === true, OK;
            else collect into fails. Return {ok: fails.length === 0,
            reason: 'sources stale: ' + fails.join(',')} when not OK.
      Register R19 in the rules-to-function map exactly like R13-R18.
    hypothesis: |-
      R19 is structurally identical to R16 (also operates on JSON; also fails open on
      non-JSON). The N/A pass-through prevents R19 from breaking SAC-P127-* (chronicle
      surface) and SAC-P134-03 (synthetic HTML fixture without _sources).
    falsifier: |-
      SAC-P127-* regresses (R19 fires on chronicle HTML and fails), OR SAC-P134-03
      regresses (R19 fires on synthetic fixture without _sources and fails), OR R19
      passes a snapshot where any source tier ≠ fresh AND excused=false.
    stop_rule: |-
      design-rules.json validates as JSON. conformance-check.cjs requires + works. Full
      self-test still 63/63 PASS. SAC-P137-06/07 manual pre-checks pass.

  - id: P137-T5
    agent: orchestrator
    model: opus
    files_touched:
      - super-gsd/tools/cockpit-sidecar/run-self-test.cjs
    input_contract: |-
      Reads 137-CONTEXT.md §"Semantic Acceptance Criteria" SAC-P137-01..08 verbatim.
    output_contract: |-
      run-self-test.cjs has 8 new test entries appended after SAC-P136-06. Each
      assertion verbatim against 137-CONTEXT.md SAC outcomes. Required imports added
      at top (js-yaml for SAC-P137-01; liveness module for SAC-P137-02; ../shared/...
      for SAC-P137-06/07/08).
      Full self-test runs 71/71 PASS exit 0.
    hypothesis: |-
      Orchestrator-direct append is the established pattern for SGSD test work (P134-T3,
      P136-T3). Avoids the Codex Windows shell-block + review-skill risk.
    falsifier: |-
      Any SAC-P137-NN fails after T1-T4 landed → diagnosis routes back to upstream task.
      js-yaml not in node_modules → SAC-P137-01 must use a JSON-parseable subset or a
      hand-written line-reader (fall back to regex on key:value lines).
    stop_rule: |-
      71/71 PASS exit 0. Per-SAC --sac SAC-P137-NN exits 0 each. git diff confined to
      run-self-test.cjs.

  - id: P137-T6
    agent: orchestrator
    model: opus
    files_touched:
      - .planning/milestones/v3.4/phases/137-cockpit-data-contract-source-registry-liveness/137-VERIFICATION.md
      - .planning/milestones/v3.4/phases/137-cockpit-data-contract-source-registry-liveness/PHASE-CAPSULE.json
    input_contract: |-
      Reads all T1-T5 git diffs + final self-test output.
    output_contract: |-
      137-VERIFICATION.md + PHASE-CAPSULE.json authored per established v3.3+ shape.
    hypothesis: |-
      Deterministic given T1-T5 evidence.
    falsifier: |-
      Capsule fails schema-version-1 shape.
    stop_rule: |-
      Both files exist. Commit "feat(P137): ..." lands. Self-test re-run still 71/71.

semantic_acceptance_criteria:
  - id: SAC-P137-01
    input: "read super-gsd/registry/cockpit-sources.yaml"
    expected_outcome: "yaml parses; schema_version=1; sources array has exactly 7 entries with section_id matching sec-mission/sec-telemetry/sec-architecture/sec-milestone/sec-memory/sec-evidence/sec-events"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P137-01"

  - id: SAC-P137-02
    input: "require('./liveness.cjs').computeLiveness with mocked registry"
    expected_outcome: "returns object keyed by registry ids; each value has {tier, age_ms, last_seen, excused} where tier is one of fresh|degraded|stale|dead"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P137-02"

  - id: SAC-P137-03
    input: "cockpit-sidecar attachAll() applied to a v3.3-shaped p127 sample output"
    expected_outcome: "output has all 14 new top-level keys (mission, pipeline, agents, architecture, milestone_map, memory_graph, lineage, gate_flow, evidence, telemetry, alarms, events, learnings, rationale) AND _sources block"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P137-03"

  - id: SAC-P137-04
    input: "p127 sample output + attachAll(), then JSON.stringify + JSON.parse round-trip"
    expected_outcome: "round-trip survives; every v3.3 pre-existing key remains present (additive contract preserved)"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P137-04"

  - id: SAC-P137-05
    input: "p127 sample output + attachAll(), then sidecar.renderText / renderHtml / renderBrief"
    expected_outcome: "no renderer throws on the new keys; output strings remain well-formed"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P137-05"

  - id: SAC-P137-06
    input: "design-rules.json after R19 added"
    expected_outcome: "rules array contains entry with id R19 and applies_to includes cockpit-html and monitor; R13..R18 still present"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P137-06"

  - id: SAC-P137-07
    input: "conformance-check.cjs after R19 wired"
    expected_outcome: "source contains 'function checkR19'; existing checkR13..checkR18 still present"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P137-07"

  - id: SAC-P137-08
    input: "checkConformance on a snapshot JSON with _sources block where every entry has tier=fresh"
    expected_outcome: "binding_fail = 0; R19 passes; existing R16 still passes"
    verification_cmd: "node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P137-08"
---

# Phase 137 — Cockpit Data Contract + Source Registry + Liveness Heartbeat — PLAN-LOCKED

## Scope

P137 wires the data plumbing that v3.4 components depend on (P139-P142). Three deliverables:
(1) 14-key snapshot expansion in `cockpit-sidecar.cjs` via stub attachers; (2) Cockpit
Source Registry at `super-gsd/registry/cockpit-sources.yaml` enumerating every IA section's
write path + cadence + staleness thresholds; (3) liveness heartbeat via `liveness.cjs` +
new binding gate R19 (`gate.liveness.all-sources-fresh`) wired into the conformance
registry. Stub-and-fill strategy keeps the data contract additive; P139-P142 fill the
stubs with real composition.

## Authoritative Inputs

- `.planning/milestones/v3.4/INTENT.md` — invariant #10 (liveness contract)
- `.planning/milestones/v3.4/design-pack/HANDOFF-PROMPT.md` §"DATA CONTRACTS"
- `.planning/milestones/v3.4/design-pack/Cockpit.html` (canonical sample snapshot)
- `.planning/milestones/v3.4/design-pack/DESIGN-THESIS.md` (memory typing reference)
- `.planning/milestones/v3.4/phases/137-.../137-CONTEXT.md`
- `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` (current composer)
- `super-gsd/tools/cockpit-sidecar/serve.cjs` (snapshot delivery path)
- `super-gsd/tools/shared/design-rules.json` (R01-R18 baseline)
- `super-gsd/tools/shared/conformance-check.cjs` (gate registry)

## Binding Invariants

1. Additive contract — new keys are optional on read; SAC-P127/P128/P134 unchanged.
2. Frozen field shapes per 137-CONTEXT.md table.
3. Lock-13 (changes confined to `super-gsd/tools/cockpit-sidecar/` +
   `super-gsd/tools/shared/conformance-check.cjs` + new `super-gsd/registry/`).
4. R19 is BINDING on cockpit-html + monitor + cockpit surfaces.
5. Registry is single source of truth — no shape duplication.
6. No SSE keep-alive yet (P138).

## File Operations

| Op | Path | Purpose |
|---|---|---|
| CREATE | `super-gsd/registry/cockpit-sources.yaml` | 7-entry source registry |
| CREATE | `super-gsd/tools/cockpit-sidecar/liveness.cjs` | computeLiveness pure function |
| MODIFY | `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` | attachAll + 14 stub attachers + attachSources |
| MODIFY | `super-gsd/tools/shared/design-rules.json` | append R19 |
| MODIFY | `super-gsd/tools/shared/conformance-check.cjs` | register checkR19 |
| EXTEND | `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` | SAC-P137-01..08 |
| CREATE | `.planning/milestones/v3.4/phases/137-.../137-VERIFICATION.md` | phase close |
| CREATE | `.planning/milestones/v3.4/phases/137-.../PHASE-CAPSULE.json` | phase capsule |

## Verification

```
node super-gsd/tools/cockpit-sidecar/run-self-test.cjs
```

Expected: 71/71 PASS exit 0 (63 prior + 8 P137). Per-SAC `--sac SAC-P137-NN` exits 0 each.

## Success Criteria

- All 8 P137 SACs PASS.
- 71/71 self-test green; zero pre-existing SAC regressed (P125-P136).
- `cockpit-sidecar.attachAll()` emits all 14 new top-level keys + `_sources` block.
- R19 binding registered; `gate.liveness.all-sources-fresh` fires on cockpit-html/monitor.
- `super-gsd/registry/cockpit-sources.yaml` exists with 7 entries + valid YAML.
- git diff confined to Lock-13 paths + new `super-gsd/registry/`.
- Phase capsule + verification authored at close.
