---
phase: 121
phase_name: Chronicle Data-Model Upgrade
milestone: v3.2
created: 2026-05-22
status: queued-planning-only
implementation_status: not-started
source: DLB-12.2 — Operator Comprehension System; WS-A phase 1
predecessor: v3.2 P120 PASS (shared design system + conformance checker)
---

# Phase 121 — Chronicle Data-Model Upgrade

> Adds the data fields the gold-reference renderer (P122) needs. Upgrades `chronicle.schema.json` (P113) + `build-context-pack.cjs` (P114) so a CHRONICLE-CONTEXT.json carries an answer-first shape: a Big Idea, per-section signal weighting, the dominant fog driver, a split next-action, and SCQA slots.

## Goal

Ship the schema + builder changes that make the chronicle context pack answer-first. P122's renderer consumes these fields; without them the gold-reference layout cannot be produced from real data. The v3.1 chronicle self-test (96 assertions) must stay green — this is a frozen-substrate upgrade, not a rewrite.

## Binding invariants (from DLB-12)

1. **Answer-first data model (DLB-12 invariant 2).** The new fields exist so the renderer can lead with the decision. `big_idea` + `next.primary_action` are the data behind the Operator Decision Panel.
2. **Projection, never opinion (DLB-11 R3 carried forward).** Every new field is derived deterministically from existing evidence. `big_idea` is composed from the verdict + denominators; `fog.dominant_signal` is the arg-max of the existing fog breakdown. No new agent prose, no new authority.
3. **Zero regression.** The v3.1 chronicle `run-self-test.cjs` (96 assertions) stays ≥96 green. New schema fields + updated fixtures must not break any prior assertion.
4. **Book-grounded.** The fields trace to design rules: `big_idea` → R01 (lead with the decision); `signal` → R07 (declutter by default-folding); `fog.dominant_signal` → R06 (metric + telling instance); `next.primary_action`/`alternatives` → R04 (one action, alternatives folded); SCQA slots → R03.

## Files this phase will modify/create

| Path | Op |
|---|---|
| `super-gsd/schemas/chronicle.schema.json` | modify — add the new fields; bump `chronicle_version` semantics to 1.1 |
| `super-gsd/tools/chronicle/build-context-pack.cjs` | modify — populate the new fields deterministically |
| `super-gsd/tools/chronicle/fixtures/sample-chronicle-context.json` | modify — carry the new fields (golden) |
| `super-gsd/schemas/fixtures/chronicle/good-*.json` | modify — update the 7 good fixtures to carry the new fields |
| `super-gsd/tools/chronicle/run-self-test.cjs` | modify — extend with SAC-P121-NN assertions |
| `super-gsd/schemas/fixtures/chronicle/good-with-answer-first.json` | create — new good fixture exercising every new field populated |

~5 modified + 1 created. Frozen-substrate upgrade.

## The new data fields (schema additions)

1. **`big_idea`** — root-level string, required, ≤200 chars. The single-sentence answer (R01). Builder composes it from the highest-authority promotion_decision/verdict + a one-clause denominator hint. Cited: carries a `big_idea_citation` companion (CMB id / file).
2. **`sections[].signal`** — enum `high | low` on every section node. Drives the renderer's default-collapse (R07). Builder heuristic: observations/claims/decisions/denominators = `high`; raw appendix/lineage = `low`.
3. **`fog`** — root object. Existing fog data plus `fog.dominant_signal` (string) = the single highest-weighted contributor from the fog breakdown (R06). Builder computes arg-max over the breakdown.
4. **`next`** — root object replacing any flat next-action list. `next.primary_action` (string, required) + `next.alternatives[]` (array of strings, may be empty). R04: one action prominent, alternatives folded.
5. **`why` / SCQA slots** — the why-section node gains `situation` / `complication` / `question` string sub-fields (complication optional). R03. Builder fills from CONTEXT.md predecessor + INTENT.md.

**Schema-optional, builder-required (revised 2026-05-22 after P121 executor surfaced a constraint).** The new fields are declared in `chronicle.schema.json` as OPTIONAL — making them schema-required would force churning ~23 fixtures including bad-fixtures, where a new "missing big_idea" violation would fire before each bad fixture's intended CHRONICLE-01..08 violation and break its SAC. Instead: the schema accepts the fields when present (and constrains their shape); `build-context-pack.cjs` ALWAYS emits them; the new `good-with-answer-first.json` fixture proves they validate. P123's validator enforces "a v3.2 chronicle MUST carry these fields" as a validator rule, not a schema rule. This keeps the schema backward-compatible — zero regression is then structural, not fixture-churn-dependent.

## Semantic acceptance criteria (target — 121-01 PLAN declares verbatim)

```yaml
semantic_acceptance_criteria:
  - id: SAC-P121-01
    input: "chronicle.schema.json after upgrade"
    expected_outcome: "schema declares big_idea, big_idea_citation, sections[].signal, fog.dominant_signal, next.primary_action, next.alternatives, and why SCQA slots as OPTIONAL properties with shape constraints; parses as valid JSON Schema; remains backward-compatible (a pre-v3.2 chronicle without the fields still validates)"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P121-01"
  - id: SAC-P121-02
    input: "good-with-answer-first.json fixture"
    expected_outcome: "validates against the upgraded chronicle.schema.json with every new field populated"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P121-02"
  - id: SAC-P121-03
    input: "build-context-pack.cjs run on the self-test sample phase"
    expected_outcome: "emitted CHRONICLE-CONTEXT.json carries a non-empty big_idea <=200 chars with a big_idea_citation"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P121-03"
  - id: SAC-P121-04
    input: "builder output sections"
    expected_outcome: "every section node carries signal in {high, low}"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P121-04"
  - id: SAC-P121-05
    input: "builder output fog object"
    expected_outcome: "fog.dominant_signal equals the arg-max key of the fog breakdown (deterministic)"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P121-05"
  - id: SAC-P121-06
    input: "builder output next object"
    expected_outcome: "next.primary_action is a non-empty string; next.alternatives is an array (may be empty)"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P121-06"
  - id: SAC-P121-07
    input: "builder output why section"
    expected_outcome: "why section carries situation + question slots; complication present or explicitly null"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P121-07"
  - id: SAC-P121-08
    input: "same builder inputs twice"
    expected_outcome: "all new fields are byte-identical across runs (deterministic projection, DLB-11 R3)"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P121-08"
  - id: SAC-P121-09
    input: "full chronicle self-test"
    expected_outcome: "all prior 96 assertions still green PLUS the P121 SAC additions — zero regression"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs"
```

9 SACs. SAC-P121-09 is the zero-regression keystone.

## Out of scope

- The renderer (P122 consumes these fields)
- Validator lints (P123)
- Cockpit (P124-P127)
- Changing the 7 CMB classes or the validator's verdict logic

## Cross-references

- `.planning/decisions/DLB-12-OPERATOR-COMPREHENSION-SYSTEM.md` — design lock
- `.planning/analyses/2026-05-22-chronicle-html-book-research.html` — design rules R01/R03/R04/R06/R07 the fields serve
- `super-gsd/tools/chronicle/templates/chronicle-gold-reference.html` — the render target whose data needs these fields
- `super-gsd/schemas/chronicle.schema.json` + `super-gsd/tools/chronicle/build-context-pack.cjs` — the frozen-substrate files upgraded here
- `.planning/milestones/v3.1/phases/114-context-pack-builder/114-VERIFICATION.md` — the builder's v3.1 contract
