---
phase: 11-plan-schema-v2
plan: 01
subsystem: plan-schema
tags: [schema, ajv, draft-07, validation, SCHEMA-02, SCHEMA-03, SCHEMA-04]
dependency_graph:
  requires: [11-02 (ajv v8 + validate.cjs installed)]
  provides: [super-gsd/templates/plan-schema-v2.json canonical schema]
  affects: [validate.cjs, sgsd-orchestrate classifier-skip path, superpowers:writing-plans enforcement]
tech_stack:
  added: []
  patterns: [JSON Schema draft-07, ajv errorMessage keyword, fixture-driven verification]
key_files:
  created:
    - super-gsd/templates/plan-schema-v2.json
    - .planning/phases/11-plan-schema-v2/fixtures/good-plan.md
    - .planning/phases/11-plan-schema-v2/fixtures/bad-plan.md
  modified: []
decisions:
  - D-01 expected_ATC_tier default=LITE baked into schema default keyword
  - D-02 prior_errors_lookup has no schema default — description documents tier-sensitive derivation in parser
  - D-03 skip_gates default=[] at both root and task levels
  - D-04 lessons_path type=[string,null] default=null; validate.cjs handles warn+continue at runtime
  - D-05 depends_on/known_deadends/verification_cmd defaults in task properties
  - D-13 this file is canonical; stub description updated to remove bridge note
metrics:
  duration: ~8 minutes
  completed: 2026-04-21T20:05:02Z
  tasks_completed: 1
  tasks_total: 1
  files_created: 3
  files_modified: 1
---

# Phase 11 Plan 01: Schema File Summary

**One-liner:** Canonical JSON Schema draft-07 for v2 PLAN.md frontmatter — 9 required task fields enforced with ajv-errors errorMessage keywords, 7 optional fields with defaults, validated exit-0/exit-1 against good/bad fixtures.

## What Was Built

`super-gsd/templates/plan-schema-v2.json` is the authoritative v2 plan schema. It overwrites the 11-02 bridge stub with the full canonical definition:

- **Root required:** `schema_version` (integer, enum [2]) + `tasks` (array, minItems 1)
- **Root optional with defaults:** `expected_ATC_tier` (LITE), `skip_gates` ([]), `depends_on` ([]), `lessons_path` (null), `prior_errors_lookup` (no default — parser derives from tier per D-02)
- **Task definition (definitions/task):** 9 required fields + 7 optional fields with defaults
- **errorMessage keywords:** All 9 required task fields carry custom human-readable messages (`"task must declare 'X' (SCHEMA-02)"`) consumed by ajv-errors v3 and surfaced by validate.cjs D-08 stderr format

## Verification Results

| Check | Command | Result |
|-------|---------|--------|
| Schema compiles under ajv v8 + ajv-errors | `node -e "...ajv.compile(s)..."` | exit 0, "schema compiles OK" |
| Root required fields present | `node -e "...s.required.includes('schema_version')..."` | exit 0 |
| 9 task required fields printed | `node -e "...console.log(s.definitions.task.required)..."` | all 9 listed |
| Good fixture validates | `validate.cjs --plan-file good-plan.md` | exit 0, "[good-plan.md] VALID (no errors)" |
| Bad fixture (missing falsifier+stop_rule) | `validate.cjs --plan-file bad-plan.md` | exit 1, D-08 lines for both fields |

## Deviations from Plan

### Stub overwrite — expected, not a deviation

The 11-02 stub was already structurally complete (all 9 required fields, 7 optional fields, errorMessage block). The canonical overwrite:
1. Removed the bridge description ("Stub created by 11-02; full definition shipped by 11-01")
2. Added `description` fields to all properties for inline documentation
3. Used `>=1` in files_touched errorMessage (stub used `>= 1` with space — minor cosmetic alignment)

### Pre-existing validate.cjs dead-code warnings

validate.cjs has 3 dead-code warnings (noted in 11-02 ATC review). Not fixed — flagged per surgical constraint. Phase-level ATC will batch-clean.

### Inline verify command required ajv-errors

The plan's `<verify>` command (`node -e "...ajv.compile(s)..."`) fails with `strict mode: unknown keyword: "errorMessage"` when ajv-errors is not loaded. Root cause: bare `new Ajv()` without `addErrors(ajv)` rejects `errorMessage` as an unknown keyword in strict mode. Resolution: ran the verify using the full ajv-errors setup (same as validate.cjs does), which is the semantically correct check. The plan's verify intent (schema compiles under ajv v8) was satisfied — the bare command was underspecified. Logged as Rule 1 auto-fix (investigation + correct verify path used).

## Known Stubs

None. The schema is fully wired — all fields defined, errorMessage populated, defaults set, validate.cjs reads this file at startup.

## Threat Flags

None. The schema file contains only structural definitions and string literals (field names, SCHEMA-xx references). No credentials, no network endpoints, no new trust boundaries beyond what the plan's threat model already covers (T-11-01: sha256 boot-time check catches post-write drift; T-11-02: errorMessage strings accepted as information-disclosure accepted risk).

## Self-Check: PASSED

- super-gsd/templates/plan-schema-v2.json: FOUND
- .planning/phases/11-plan-schema-v2/fixtures/good-plan.md: FOUND
- .planning/phases/11-plan-schema-v2/fixtures/bad-plan.md: FOUND
- commit 9396414: FOUND
