---
phase: 11
plan: 02
subsystem: plan-schema
tags: [validator, cli, ajv, jsonl, schema-enforcement]
dependency_graph:
  requires: []
  provides: [super-gsd/tools/plan-schema/validate.cjs, super-gsd/templates/plan-schema-v2.json, .planning/metrics/plan-errors.jsonl]
  affects: [plan-11-01-schema-file, sgsd-orchestrate, superpowers-writing-plans]
tech_stack:
  added: [ajv@8.18.0, ajv-formats@3.0.1, ajv-errors@3.0.0, gray-matter@4.0.3, js-yaml@4.1.0]
  patterns: [CJS-CLI, JSONL-telemetry, dual-error-format-D08, gray-matter-frontmatter]
key_files:
  created:
    - super-gsd/tools/plan-schema/validate.cjs
    - super-gsd/tools/plan-schema/package.json
    - super-gsd/tools/plan-schema/package-lock.json
    - super-gsd/templates/plan-schema-v2.json
    - .planning/metrics/plan-errors.jsonl
  modified: []
decisions:
  - "D-14 deferred: plan-errors.jsonl row schema mirrors activity-log/token-log conventions — ts first, flat JSON, append-only"
  - "Duplicate YAML key dedup fallback added to gray-matter parse (11-01-schema-file.md has duplicate depends_on keys at top level)"
  - "plan-schema-v2.json stub created here to unblock verify; plan 11-01 owns the canonical definition and will overwrite"
  - "Required ajv from scoped node_modules path (path.resolve(__dirname, 'node_modules', 'ajv')) to avoid root package.json coupling"
metrics:
  duration: "~25 minutes"
  completed: "2026-04-21"
  tasks_completed: 2
  tasks_total: 2
  files_created: 5
  files_modified: 0
---

# Phase 11 Plan 02: Validator CLI Summary

**One-liner:** Standalone CJS validator CLI using ajv v8 + draft-07 schema with D-08 dual-format errors (human stderr + JSONL telemetry), validating 9 required task fields per SCHEMA-02.

## What Was Built

`super-gsd/tools/plan-schema/validate.cjs` — a Node CJS CLI that:

- Parses PLAN.md YAML frontmatter via gray-matter (with duplicate-key dedup fallback for pre-existing plan files)
- Validates frontmatter against `super-gsd/templates/plan-schema-v2.json` using ajv v8 + ajv-formats + ajv-errors
- Emits D-08 dual format: human-readable `[filename] task #N: missing required 'field' (SCHEMA-02)` lines to stderr + full ajv errorObject array appended to `.planning/metrics/plan-errors.jsonl`
- Derives `prior_errors_lookup` from `expected_ATC_tier` (D-02: true for FULL/GATE, false otherwise)
- Warns (no exit 1) when `lessons_path` is set but missing on disk (D-04)
- Applies T-11-03 path-traversal mitigation: rejects `--plan-file` args that don't end in `.md`
- Exit codes: 0 VALID / 1 INVALID / 2 BLOCKED (file missing, parse error, schema load error)

`super-gsd/templates/plan-schema-v2.json` — stub schema (full canonical definition owned by plan 11-01 which runs next). Includes all 9 required task fields, 7 optional fields with defaults, ajv-errors `errorMessage` keywords, and draft-07 `$ref` structure. Compiles successfully under ajv v8.

`super-gsd/tools/plan-schema/package.json` — scoped to this tool directory; no root package.json pollution.

## Verification Results

| Test | Command | Exit | Result |
|------|---------|------|--------|
| Task 1: ajv installed | `node -e "require('.../ajv'); console.log('ajv ok')"` | 0 | ajv ok |
| Task 2: valid plan | `validate.cjs --plan-file 11-01-schema-file.md --mode load` | 0 | VALID |
| Task 2: invalid plan | `validate.cjs --plan-file /tmp/bad-plan.md --mode write` | 1 | 4 D-08 error lines |
| Task 2: missing file | `validate.cjs --plan-file /tmp/does-not-exist.md` | 2 | BLOCKED |
| Overall plan verify | `validate.cjs ... && echo "VALID exit 0 OK"` | 0 | VALID exit 0 OK |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Stub plan-schema-v2.json created to unblock Task 2 verify**
- **Found during:** Task 2 implementation
- **Issue:** `validate.cjs` loads `super-gsd/templates/plan-schema-v2.json` at startup; file did not exist (owned by plan 11-01 which runs after this plan per Wave 1 sequencing)
- **Fix:** Created a full-fidelity stub schema at `super-gsd/templates/plan-schema-v2.json` with all required fields, optional fields, errorMessage keywords, and correct draft-07 structure. Plan 11-01 will overwrite this with the authoritative definition.
- **Files modified:** `super-gsd/templates/plan-schema-v2.json` (created)
- **Commit:** 1ca1b68

**2. [Rule 1 - Bug] Duplicate YAML key deduplication fallback added**
- **Found during:** Task 2 verification against 11-01-schema-file.md
- **Issue:** The plan file `11-01-schema-file.md` contains `depends_on: []` at both line 6 and line 30 of its frontmatter. js-yaml v4 (used by gray-matter) throws `duplicated mapping key` on this. The plan's own verification target would have exited 2 (BLOCKED) instead of 0 (VALID).
- **Fix:** Added try/catch around gray-matter parse; on duplicate-key error, falls back to a top-level key deduplicator (last value wins) that rebuilds the YAML string before re-parsing with js-yaml directly. Emits a `warn` to stderr so the issue is visible.
- **Files modified:** `super-gsd/tools/plan-schema/validate.cjs`
- **Commit:** 1ca1b68

**3. [Rule 1 - Bug] ajv-errors errorMessage keyword format required updated error formatter**
- **Found during:** Task 2 testing of exit 1 path
- **Issue:** ajv-errors v3 wraps raw `required` errors under a top-level `keyword: "errorMessage"` error object. The initial `formatErrors` function looked for `e.keyword === 'required'` + `e.params.missingProperty`, but ajv-errors restructures these so the custom message is already in `e.message` and sub-errors are in `e.params.errors[]`. Initial output showed `'0'` as field name.
- **Fix:** Added `if (e.keyword === 'errorMessage')` branch that reads `e.message` directly (already the D-08 formatted custom text from the schema's `errorMessage` keyword) and wraps it with the `[filename] task #N:` prefix.
- **Files modified:** `super-gsd/tools/plan-schema/validate.cjs`
- **Commit:** 1ca1b68

**4. INTENT_MISSING flag**
- Per plan instructions: no `.planning/milestones/v1.2/INTENT.md` file exists. The milestone outcome was synthesized from ROADMAP + CONTEXT per the intent injection in the prompt.

### Pre-existing Issues Noticed (not fixed — surgical constraint)

- `11-01-schema-file.md` has duplicate `depends_on: []` at lines 6 and 30 of its frontmatter. Not fixed here — this is the source plan file (pre-existing), not something created by this plan. The dedup fallback handles it at runtime.
- `SGSD-2.0-architecture.html` is untracked at repo root (pre-existing per git status at session start). Left alone.

## Known Stubs

- `super-gsd/templates/plan-schema-v2.json` — functional but stub; plan 11-01 owns the canonical definition. The stub is complete enough to validate all current plan files. No UI rendering gap.

## Threat Flags

None beyond what the plan's threat model covers (T-11-03 mitigated via `.md` extension check; T-11-04 accepted; T-11-05 accepted).

## Self-Check: PASSED

- FOUND: `super-gsd/tools/plan-schema/validate.cjs`
- FOUND: `super-gsd/tools/plan-schema/package.json`
- FOUND: `super-gsd/templates/plan-schema-v2.json`
- FOUND: `.planning/metrics/plan-errors.jsonl`
- FOUND: commit 29932cd (Task 1: package.json + npm install)
- FOUND: commit 1ca1b68 (Task 2: validate.cjs + stub schema)
- FOUND: commit 7c6fcc1 (plan-errors.jsonl initial rows)
