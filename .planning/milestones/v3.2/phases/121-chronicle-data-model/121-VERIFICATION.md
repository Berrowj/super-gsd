---
phase: 121
phase_name: Chronicle Data-Model Upgrade
milestone: v3.2
status: PASS
verdict: PASS
completed_at: 2026-05-22
sacs_total: 9
sacs_passed: 9
struct_asserts: 3
struct_passed: 3
total_assertions: 108
total_passed: 108
prior_assertions_preserved: 96
files_modified: 3
files_created: 1
deviations: 1
deviation_class: INFO
---

# Phase 121 — Chronicle Data-Model Upgrade — VERIFICATION

## Summary

P121 upgrades the chronicle data model so a CHRONICLE-CONTEXT.json carries an answer-first shape. `chronicle.schema.json` gains the new fields as OPTIONAL (backward-compatible); `build-context-pack.cjs` always emits them. Chronicle self-test: **108/108 PASS** (96 prior preserved + 9 SAC-P121 + 3 STRUCT-P121) — zero regression. SAC-P121-09 keystone met.

## Files

### Modified (3)
- `super-gsd/schemas/chronicle.schema.json` — added `big_idea`, `big_idea_citation`, `sections[].signal` (enum high|low), `fog.dominant_signal`, `next.primary_action` + `next.alternatives[]`, why-section SCQA slots — all OPTIONAL properties with present-shape constraints
- `super-gsd/tools/chronicle/build-context-pack.cjs` — always emits the new fields deterministically (verified: lines 158/171-172/179/184 — `__p121SectionSignal`, `big_idea`/`big_idea_citation`, `__p121DominantSignal`, `next.primary_action`)
- `super-gsd/tools/chronicle/run-self-test.cjs` — extended with SAC-P121-01..09 + 3 STRUCT-P121

### Created (1)
- `super-gsd/schemas/fixtures/chronicle/good-with-answer-first.json` — good fixture with every new field populated

## DLB-12 invariant coverage

| Invariant | Mechanism | Status |
|---|---|---|
| 2 · Answer-first data model | `big_idea` + `next.primary_action` are the Operator Decision Panel's data | ✓ |
| DLB-11 R3 · projection never opinion | every field deterministic — `big_idea` composed from verdict+denominators, `fog.dominant_signal` = arg-max of breakdown | ✓ SAC-08 |
| Zero regression | schema fields OPTIONAL → backward-compatible; 96 prior assertions preserved | ✓ SAC-09 keystone |
| Book-grounded | fields serve R01/R03/R04/R06/R07 | ✓ |

## Deviations

**INFO-1 — Schema-required → schema-optional (executor-surfaced design correction).** The first P121 executor dispatch correctly refused: making the new fields schema-REQUIRED would force churning ~23 fixtures (including bad-fixtures, where a new "missing big_idea" violation would fire before each bad fixture's intended CHRONICLE-01..08 violation, breaking its SAC). Orchestrator corrected CONTEXT + plan to schema-optional / builder-required: the schema accepts the fields with shape constraints when present but tolerates absence; the builder always emits them; P123's validator will enforce "v3.2 chronicles MUST carry these fields" as a validator rule. This made zero-regression structural rather than fixture-churn-dependent. Re-dispatch landed clean.

## ATC LITE self-review

First Principles: data model needed for P122 renderer ✓ · Delete: 4 file ops, no bonus ✓ · Simplify: schema-optional avoids 23-fixture churn ✓ · Validate: 108/108, builder emission confirmed by direct source inspection ✓ · Anti-slop: every field deterministic, every SAC traces to a design rule ✓

## Next phase

P122 — Chronicle renderer rebuild. `render-html.cjs` + section templates → gold-reference: Operator Decision Panel, 11-section answer-first order, SCQA, evidence expanders, fog gauge, inline-SVG diagrams with takeaway figcaptions. Consumes the P121 data fields. Uses the P120 shared design system.

## Provenance

Codex executor read-pack patch mode. First dispatch refused with a correct design constraint (schema-required → 23-fixture churn); orchestrator corrected the schema-optional design; re-dispatch landed 4 file ops clean. Self-test 108/108 PASS exit 0. Builder field-emission verified by direct source inspection (build-context-pack.cjs:158-184).
