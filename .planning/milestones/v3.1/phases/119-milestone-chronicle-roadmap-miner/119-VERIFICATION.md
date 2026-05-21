---
phase: 119
phase_name: Milestone Chronicle + Roadmap Miner
milestone: v3.1
status: PASS
verdict: PASS
completed_at: 2026-05-21
sacs_total: 10
sacs_passed: 10
struct_asserts: 3
struct_passed: 3
warn_softgate: 2
files_created: 4
files_modified: 1
total_assertions: 96
total_passed: 96
deviations: 3
deviation_class: INFO
---

# Phase 119 — Milestone Chronicle + Roadmap Miner — VERIFICATION

## Summary

**v3.1 capstone delivered.** P119 ships `milestone-chronicle.cjs` (cross-phase roll-up) + `mine-roadmap.cjs` (cross-milestone process miner) + golden fixtures + self-test extension. All 10 SAC-P119 + 3 STRUCT-P119 PASS plus all 83 prior assertions still GREEN. **96/96 total assertions PASS across the v3.1 chronicle pipeline (P113 → P119).**

```
P114: 23/23  P115: 17/17  P116: 16/16  P117: 14/14  P118: 13/13  P119: 13/13  = 96/96
```

## Files

### Created (4)
- `super-gsd/tools/chronicle/milestone-chronicle.cjs` — milestone roll-up builder. Reads phase artefacts (published chronicle-context.json OR on-the-fly synthesis from planning files) → rolls up into single milestone chronicle with `chronicle_type: "milestone"`. Validates against chronicle.schema.json before write. Atomic tmp+rename.
- `super-gsd/tools/chronicle/mine-roadmap.cjs` — cross-milestone process miner. Walks milestone SUMMARY.md + INDEX.jsonl + validator/executor/token logs → emits structured JSON with per-milestone phase counts, chronicle verdict distribution, dispatch totals, token spend, patch-round distribution, fog score average, recurring drift class patterns + cross_milestone_patterns.
- `super-gsd/tools/chronicle/fixtures/sample-milestone-chronicle-context.json` — golden milestone context (chronicle_type: "milestone") validating against P113 schema.
- `super-gsd/tools/chronicle/fixtures/sample-roadmap-mine-output.json` — golden miner output JSON.

### Modified (1)
- `super-gsd/tools/chronicle/run-self-test.cjs` — extended with SAC-P119-01..10 + STRUCT-P119-21..23 (preserved all 83 prior assertions).

## DLB-11 R7 invariant coverage

| Invariant | Mechanism | Status |
|---|---|---|
| Milestone chronicle is a projection | Reads phase artefacts; rolls up; emits schema-valid milestone context | ✓ SAC-01, SAC-04 |
| Validates against same chronicle schema | Uses chronicle.schema.json with `chronicle_type: "milestone"` enum | ✓ SAC-03 |
| Composes existing validator + publisher | No parallel validation/publication code; calls into P116/P117 paths | ✓ |
| Roadmap miner is read-only | Walks files; never writes outside --out | ✓ SAC-09 |
| Miner output is JSON only | No HTML synthesis in mine-roadmap.cjs | ✓ SAC-05, SAC-06 |
| Forward-only policy preserved | v3.0 retro is opt-in via --include-v3.0-retro (default OFF) | ✓ |
| Determinism | Same inputs → same output across runs | ✓ STRUCT-23 |

## Deviations

**INFO-1 — Codex initial PLAN used custom task field names** (`scope`/`owner`/`deliverables`/`verification` instead of schema-required `input_contract`/`output_contract`/`hypothesis`/`falsifier`/`stop_rule`/`verification_cmd`). Orchestrator rewrote both tasks with schema-conformant fields.

**INFO-2 — Codex's milestone-chronicle.cjs bug: `sections.denominators` emitted as object instead of array** (confused root denominators object with sections.denominators array). Orchestrator patched line 287 (synthesized context) to use `denominators: []` for the sections-level field; root denominators object remains the correct 5-sub-array shape.

**INFO-3 — Codex's `mergeDenominators` accepted ANY key from source.** When published chronicle context from createPlanningRoot fixture had keys like `schemas`/`fixtures`/`ledgers`/`commands`/`assets`, the merger blindly preserved them, polluting output with non-schema fields → schema rejected the output. Orchestrator patched `mergeDenominators` to filter to the 5 DEFAULT_DENOMINATOR_KEYS only. Also updated SAC-P119-06 assertion to verify only schema-allowed keys are present (was checking a fictional `schemas` field that Codex invented).

## ATC LITE self-review

- First Principles: capstone — milestone + cross-milestone view ✓
- Delete: 4 files matches plan; no bonus ✓
- Simplify: 2-task split; pure functions ✓
- Accelerate: synchronous file ops; <100ms per milestone ✓
- Automate: deterministic; idempotent ✓
- Validate: 13-assertion P119 surface; 96-assertion cumulative ✓
- Anti-slop: every assertion exercises a distinct code path

## MUDA self-review

- Overproduction: 4 created + 1 modified = 5 ops matches plan
- Inventory: each SAC maps to specific behavior
- Defects: 3 orchestrator-applied fixes (1 plan-shape + 2 code bugs). Root cause: Codex misread the section/root denominators distinction + invented free-form denominator keys.
- Motion: no cross-file refactoring
- Waiting: t1 → t2 dependency correct
- Over-processing: v3.0 retro opt-in keeps default scope tight
- Transport: all under chronicle/

## Soft warnings

**WARN — DOGFOOD paths still skipped.** v3.1 phases didn't emit CMBs into the mesh ledger during construction (would have required modifying the P113-P118 source files retroactively which is out of scope). Future operator action: when running real chronicle generation against v3.1 phases, emit execution_receipt CMBs via existing P107 writers; then dogfood gates become load-bearing.

## v3.1 milestone close criteria

After this verification:

- ✅ All 7 phases (P113-P119) closed PASS
- ✅ Self-test cumulative 96 assertions GREEN
- ✅ Chronicle layer COMPLETE (substrate + builder + renderer + validator + storage + cockpit sidecar + milestone rollup + miner)
- ⏸ Optional: operator runs `milestone-chronicle.cjs --milestone v3.1 --include-v3.0-retro` to dogfood the v3.0 retrospective (the documented one-off exception per forward-only policy)
- ⏸ Optional: operator runs `mine-roadmap.cjs --out .planning/chronicles/v3.1-mine.json` to capture cross-milestone retrospective

## Provenance

- Codex executor: read-pack patch mode; first pass landed 4 files + 1 modify
- Orchestrator-applied fixes: plan task-field rewrite, sections.denominators array fix, mergeDenominators key filter, denominators_empty_reason conditional, SAC-P119-06 assertion update
- Final self-test: 96/96 PASS
