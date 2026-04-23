---
phase: 11-plan-schema-v2
verified: 2026-04-21T22:00:00Z
status: passed
score: 5/5
overrides_applied: 0
---

# Phase 11: Plan Schema v2 — Verification Report

**Phase Goal:** Publish the canonical v2 plan schema as YAML frontmatter, enforce required task fields at plan-load, support documented optional fields with defaults, and establish a backward-compatible fallback so the 146 existing v1 plans keep running unchanged.

**Verified:** 2026-04-21T22:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Overall Verdict: PASS-WITH-DEVIATIONS

**Coverage:** 5/5 SCHEMA success criteria DELIVERED. 14/14 context decisions DELIVERED.
Two deviations assessed — both ACCEPTABLE (see Deviations section below).

---

## Criterion Coverage Table

### ROADMAP Success Criteria (SCHEMA-01..05)

| Criterion | Artifact(s) | Verdict | Evidence |
|-----------|-------------|---------|----------|
| **SCHEMA-01** `plan-schema-v2.json` exists with `schema_version:2` + `tasks:[]` contract | `super-gsd/templates/plan-schema-v2.json` | **DELIVERED** | File exists. `$schema: draft-07`, `required: [schema_version, tasks]`, `schema_version enum: [2]`, `tasks minItems: 1`. Probe: `node -e "s.required; s.properties.schema_version.enum"` → `["schema_version","tasks"]`, `[2]` ✓ |
| **SCHEMA-02** 9 required task fields enforced at plan-load time; malformed plan rejected before dispatch | `plan-schema-v2.json` (schema), `validate.cjs` (enforcement), `sgsd-orchestrate` Step 6.2 (load-time gate) | **DELIVERED** | Required task fields: `id, agent, model, files_touched, input_contract, output_contract, hypothesis, falsifier, stop_rule` (count: 9 ✓). Runtime probe: `validate.cjs --plan-file bad-plan.md` → exit 1 + D-08 error lines for missing `falsifier` and `stop_rule`. Telemetry row confirmed in `plan-errors.jsonl`. Load-time gate wired in orchestrator Step 6.2 (ANCHOR: RULE-8.5). |
| **SCHEMA-03** Optional fields (`depends_on`, `known_deadends`, `lessons_path`, `prior_errors_lookup`, `expected_ATC_tier`, `verification_cmd`, `skip_gates`) with documented defaults | `plan-schema-v2.json`, `validate.cjs` (D-02 derivation, D-04 warn+continue) | **DELIVERED** | Root defaults: `expected_ATC_tier: "LITE"`, `skip_gates: []`, `depends_on: []`, `lessons_path: null`. Task-level defaults: `depends_on: []`, `known_deadends: []`, `verification_cmd: null`, `expected_ATC_tier: "LITE"`, `skip_gates: []`, `lessons_path: null`. D-02 derivation proven: 5/5 tier cases pass. D-04 `lessons_path` warn+continue confirmed at `validate.cjs:369-377`. Note: `prior_errors_lookup` has no JSON Schema `default` keyword (correct per D-02 — parser derives it; default is not baked into schema). |
| **SCHEMA-04** Plans with no `schema_version` or `schema_version:1` route through Haiku classifier; v2 plans skip; no bulk migration of 146 v1 plans | `super-gsd/skills/sgsd-orchestrate/SKILL.md` Step 2 | **DELIVERED** | Step 2 classifier-skip branch: `IF plan frontmatter has schema_version == 2` → synthesizes `{complexity, model, atc_tier, deliberate, reason}` from frontmatter fields, no Haiku spawn. `ELSE (schema_version absent or == 1)` → existing Haiku path unchanged. Logs `classifier_skip` event to `token-log.jsonl`. No migration scripts created. |
| **SCHEMA-05** `superpowers:writing-plans` emits v2 by default; `sgsd-orchestrate` consumes v2 natively; schema version pinned identically in both repos | `super-gsd/skills/sgsd-write-plan/SKILL.md` (write-time enforcement), `sgsd-orchestrate` Step 2 + Step 3.5 (consume + drift check), `.planning/config.json` `workflow.schema_v2_hash` | **DELIVERED** | `sgsd-write-plan/SKILL.md` created as Option B replacement skill. Step 4 (validate.cjs --mode write) is mandatory before Step 5 (Write tool). Orchestrator Step 2 reads `schema_version` and routes. Boot-time hash: `config.json workflow.schema_v2_hash = "5867692d..."`. Runtime probe confirms hash match: `expected === actual → YES`. Drift mutation test: mutated hash `7b5cc768...` differs from pinned → drift would fire. |

### Context Decisions (D-01..D-14)

| Decision | Artifact | Verdict | Evidence |
|----------|----------|---------|----------|
| **D-01** `expected_ATC_tier` default = `LITE` | `plan-schema-v2.json` | DELIVERED | `properties.expected_ATC_tier.default: "LITE"` + task-level same. Probe confirms. |
| **D-02** `prior_errors_lookup` tier-sensitive (true FULL/GATE, false LITE/SKIP) | `validate.cjs:363-366` | DELIVERED | `derivePriorErrorsLookup` function proven 5/5 cases. Not in JSON Schema (correct — parser derives). |
| **D-03** `skip_gates` default = `[]` | `plan-schema-v2.json` | DELIVERED | Root and task-level `skip_gates.default: []` confirmed. |
| **D-04** `lessons_path` set-but-missing = warn + continue | `validate.cjs:369-377` | DELIVERED | `checkLessonsPath` warns to stderr, never exits 1. Called at line 448 after validation pass. |
| **D-05** `depends_on: []`, `known_deadends: []`, `verification_cmd: null` defaults | `plan-schema-v2.json` | DELIVERED | Probe confirms all three at task level. |
| **D-06** Validator at `super-gsd/tools/plan-schema/validate.cjs` | File system | DELIVERED | File exists. `super-gsd/tools/plan-schema/` directory structure confirmed (package.json, package-lock.json, node_modules, validate.cjs). |
| **D-07** Validation at both write-time and load-time | `sgsd-write-plan` Step 4 (write), orchestrator Step 6.2 (load) | DELIVERED | Write-time: `sgsd-write-plan` Step 4 mandatory before Step 5. Load-time: orchestrator Step 6.2 RULE-8.5 runs `validate.cjs --mode load` before executor dispatch. |
| **D-08** Dual error format: D-08 stderr lines + JSONL telemetry | `validate.cjs:302-357`, `plan-errors.jsonl` | DELIVERED | Probe shows `[bad-plan.md] task #1: task must declare 'falsifier' (SCHEMA-02)` on stderr. `plan-errors.jsonl` has 8 rows including pass and fail runs with full `errors[]` array. |
| **D-09** Fix-schema preserves `task.id`, `task.goal`, `task.files_touched` | `gsd-planner.md:825-895` | DELIVERED | `<fix_schema_mode>` LOCKED CONSTRAINT section present. Orchestrator extracts `locked_fields` before dispatch. Planner 5-point self-check enforces field immutability. |
| **D-10** 3-attempt retry cap + checkpoint on cap | `sgsd-orchestrate/SKILL.md:340-358` | DELIVERED | Loop condition `WHILE schema_fix_attempt < 3`. On cap: writes `ORCHESTRATOR-CHECKPOINT.md` with all 3 envelopes + attempt file contents, exits as Exit #3 Blocker. |
| **D-11** Sibling `.fix-attempt-K.md` staging | `sgsd-orchestrate/SKILL.md:315`, `gsd-planner.md OUTPUT` | DELIVERED | Orchestrator writes to `{plan_file_path}.fix-attempt-{schema_fix_attempt}.md`; promotes only on re-validation pass. |
| **D-12** sha256 boot-hash check | `sgsd-orchestrate/SKILL.md:58-99`, `config.json workflow.schema_v2_hash` | DELIVERED | Step 3.5 Node crypto block in orchestrator cold-start. Hash pinned at `5867692d...`. Runtime probe confirms match. Mutation test confirms mismatch would fire. |
| **D-13** GSDedits canonical; `sgsd-write-plan` consumes | `sgsd-write-plan/SKILL.md:95` | DELIVERED | "D-13 canonical schema: `super-gsd/templates/plan-schema-v2.json` in this repo (GSDedits) is the single source of truth." Stub description removed from schema per 11-01 SUMMARY. |
| **D-14** Drift warn + continue + readiness-log.jsonl | `sgsd-orchestrate/SKILL.md:101-105`, `.planning/metrics/readiness-log.jsonl` | DELIVERED | Non-blocking path confirmed in orchestrator code. `readiness-log.jsonl` contains 1 test drift row with correct shape: `{ts, type:"schema_pin_drift", expected_hash, actual_hash}`. |

---

## Runtime Probes

All probes run from `C:/Users/jack.berrow/GSDedits`:

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| Schema structure | `node -e "s.required; s.definitions.task.required.length"` | `["schema_version","tasks"]`, count=9 | PASS |
| Good plan validates | `validate.cjs --plan-file good-plan.md --mode load` | exit 0, `VALID (no errors)` | PASS |
| Bad plan rejected | `validate.cjs --plan-file bad-plan.md --mode load` | exit 1, D-08 lines for `falsifier`, `stop_rule` | PASS |
| Hash pin matches | `node crypto sha256(plan-schema-v2.json)` vs config | `expected === actual → YES` | PASS |
| Drift detects mutation | sha256 of schema + " " | `different: YES (drift would trigger)` | PASS |
| D-02 derivation | 5 tier cases in-process | `5/5 pass` | PASS |
| Optional defaults present | probe all 7 optional fields | root: 4/4; task-level: 6/6 with defaults | PASS |
| D-04 warn+continue wired | `grep checkLessonsPath validate.cjs` | function at :369, called at :448, no exit 1 | PASS |
| Rule 8.5 in orchestrator | `grep "RULE-8.5\|6.2"` | Step 6.2 at line 261, 3-attempt loop present | PASS |
| fix_schema_mode in planner | `grep fix_schema_mode gsd-planner.md` | `<fix_schema_mode>` at :825-895 | PASS |
| Classifier skip-path wired | `grep "SCHEMA-04" sgsd-orchestrate/SKILL.md` | Step 2 skip branch at lines 149-170 | PASS |
| sgsd-write-plan created | `ls super-gsd/skills/sgsd-write-plan/SKILL.md` | EXISTS | PASS |
| plan-errors.jsonl exists | file contents | 8 rows of telemetry including pass+fail runs | PASS |
| readiness-log.jsonl exists | file contents | 1 test drift row with correct shape | PASS |

---

## Deviations Assessment

### Deviation 1 — `addFormats` loaded but schema has no `format` keywords

**Description:** `validate.cjs` loads `ajv-formats` via `addFormats(ajv)` at line 148. The schema `plan-schema-v2.json` has zero `"format"` keywords (count: 0, confirmed by grep). So `addFormats` is dead code for the current schema.

**Assessment: ACCEPTABLE (non-blocking)**

Rationale: `addFormats` is loaded defensively so the validator does not silently fail if a future schema version adds format keywords (e.g., `"format": "date-time"` on a timestamp field). The cost is one `require()` call at startup — negligible. This is a pre-emptive compatibility measure, not a bug. The 11-02 SUMMARY already flagged this as one of 3 dead-code ATC warnings. No functional gap.

Follow-up: Batch-clean with other dead-code warnings in a future ATC LITE pass.

---

### Deviation 2 — `gsd-planner.md` lives at `~/.claude/agents/gsd-planner.md` (outside this repo, gitignored)

**Description:** The canonical `gsd-planner.md` framework file is not tracked in this repo. Changes made by plan 11-03 were applied to `~/.claude/agents/gsd-planner.md`. A gitignored extract copy exists at `custom-gsd-extract/claude-agents/gsd-planner.md`.

**Assessment: ACCEPTABLE with noted limitation**

Evidence for runtime correctness: The canonical file at `~/.claude/agents/gsd-planner.md` contains `<fix_schema_mode>` section at lines 825-895 with LOCKED CONSTRAINT, 5-point self-check, and DO NOT list. The extract copy at `custom-gsd-extract/claude-agents/gsd-planner.md` is synchronized and confirms the same. Claude invokes agents from `~/.claude/agents/` at runtime, so the fix-schema mode is operational for this operator.

Distribution gap: Other users cloning this repo would NOT get the planner update — the extract copy in `custom-gsd-extract/` is gitignored (per repo convention for framework files). SCHEMA-05 scope was `sgsd-orchestrate` + `sgsd-write-plan`, both of which ARE in git. The planner is a framework-level agent, consistent with the project's established pattern of keeping framework agent files in `~/.claude/agents/` and distributing via the framework install process.

Follow-up: If cross-user distribution is a hard requirement, a future phase should establish a framework-file sync mechanism. For Phase 11 scope as defined, this is acceptable — the planner is operational for the operator who executed Phase 11.

---

## Artifact Summary

| Artifact | Status | Notes |
|----------|--------|-------|
| `super-gsd/templates/plan-schema-v2.json` | EXISTS, SUBSTANTIVE, WIRED | 9 required task fields, all optional fields with defaults, draft-07 errorMessage keywords |
| `super-gsd/tools/plan-schema/validate.cjs` | EXISTS, SUBSTANTIVE, WIRED | 459 lines; full D-02/D-04/D-08 implementation; called by orchestrate Step 6.2 and sgsd-write-plan Step 4 |
| `super-gsd/tools/plan-schema/package.json` | EXISTS | ajv@8.18.0, ajv-formats@3.0.1, ajv-errors@3.0.0, gray-matter@4.0.3, js-yaml@4.1.0 |
| `super-gsd/skills/sgsd-write-plan/SKILL.md` | EXISTS, SUBSTANTIVE | Option B replacement skill; Step 4 validate.cjs mandatory before Step 5 |
| `super-gsd/skills/sgsd-orchestrate/SKILL.md` | MODIFIED — Step 2 classifier-skip + Step 3.5 drift check + Step 6.2 Rule 8.5 | All three Phase 11 insertions present; ANCHOR markers intact |
| `.planning/config.json` `workflow.schema_v2_hash` | EXISTS | `5867692d...` (64-char sha256); `plan_fix_retry_cap: 3` also present |
| `.planning/metrics/plan-errors.jsonl` | EXISTS | 8 telemetry rows; correct JSONL shape |
| `.planning/metrics/readiness-log.jsonl` | EXISTS | 1 test drift row; correct shape `{ts, type, expected_hash, actual_hash}` |
| `~/.claude/agents/gsd-planner.md` | EXISTS (outside repo) | `<fix_schema_mode>` section present; operational at runtime |
| `.planning/phases/11-plan-schema-v2/fixtures/good-plan.md` | EXISTS | Validates exit 0 ✓ |
| `.planning/phases/11-plan-schema-v2/fixtures/bad-plan.md` | EXISTS | Validates exit 1 ✓ |

---

## Recommendations

1. **ATC dead-code batch-clean (non-blocking):** 3 dead-code warnings in `validate.cjs` (including `addFormats` no-op). Clean in the next ATC LITE pass on this file — not a Phase 11 blocker.

2. **gsd-planner distribution story (future phase):** If the framework-file distribution gap is a concern for multi-user setups, a future governance or infrastructure phase should define the sync mechanism for `~/.claude/agents/` framework files. Out of scope for Phase 11.

3. **schema_version: 2 enforcement in sgsd-write-plan (reminder):** The skill's Constraint 3 explicitly requires `schema_version: 2`. Authors must not omit it — without it, the orchestrator's classifier skip-path (SCHEMA-04) will not fire. Worth calling out in any onboarding docs.

---

## Commit Trail Verified

| Commit | Plan | Content |
|--------|------|---------|
| 29932cd | 11-02 | scaffold package.json + npm install |
| 1ca1b68 | 11-02 | validate.cjs + stub schema |
| 7c6fcc1 | 11-02 | plan-errors.jsonl initial rows |
| 9396414 | 11-01 | canonical plan-schema-v2.json |
| c582d23 | 11-03 | Rule 8.5 in sgsd-orchestrate SKILL.md |
| dc77ac5 | 11-04 | schema_v2_hash in config.json |
| fec6d7a | 11-04 | boot-time drift check in orchestrator cold-start + readiness-log.jsonl |
| 6575298 | 11-05 | sgsd-write-plan SKILL.md created |
| 77adaaf | 11-05 | SCHEMA-04 classifier skip-path in orchestrator Step 2 |

All 9 Phase 11 feature commits confirmed in `git log`.

---

_Verified: 2026-04-21T22:00:00Z_
_Verifier: Claude (gsd-verifier)_
