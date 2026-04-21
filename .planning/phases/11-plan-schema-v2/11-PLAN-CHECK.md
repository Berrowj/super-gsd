# Phase 11: Plan Schema v2 - Plan Check Report

Checker: gsd-plan-checker
Date: 2026-04-21
Plans checked: 11-01, 11-02, 11-03, 11-04, 11-05
Verdict: PASS-WITH-GAPS

---

## Success Criterion Coverage

SCHEMA-01 (plan-schema-v2.json with schema_version:2 + tasks[]) - COVERED
  11-01 Task 1. All 9 required fields, definitions/task block, errorMessage keywords.
  Verify compiles schema under ajv v8.

SCHEMA-02 (required task fields enforced at plan-load; rejects malformed) - COVERED
  11-01 T1 (schema) + 11-02 T2 (validate.cjs exits 1 on schema errors)
  + 11-03 T2 (orchestrator Rule 8.5 invokes validate.cjs at load-time).

SCHEMA-03 (optional fields with documented defaults) - COVERED
  11-01 T1 (JSON Schema default keywords for all 7 optional fields)
  + 11-02 T2 (D-02 prior_errors_lookup derivation in validator interfaces block).

SCHEMA-04 (v1 routes to Haiku classifier; v2 skips; no bulk migration) - COVERED
  11-05 Task 2. Pre-Step-2 branch on schema_version==2 synthesizes classifier result
  matching sgsd-classifier.md contract. v1 path unchanged.
  No migration tasks in plan set. 146-plans-sacred constraint honoured.

SCHEMA-05 (writing-plans emits v2; schema pinned in both repos) - COVERED
  Write-time: 11-05 T1 (sgsd-write-plan calls validate.cjs before Write).
  Pinning: 11-04 T1 (config.json schema_v2_hash) + 11-04 T2 (sha256 drift check).
  DEVIATION (info): external superpowers:writing-plans not patched; operators switch
  to /sgsd-write-plan. External skill cannot be mechanically patched per RQ-3.
  Planner documented Option B rationale in 11-PLAN.md. Not a contradiction of D-13.

---

## Context Decision Coverage D-01..D-14

D-01 expected_ATC_tier LITE default: 11-01 (schema default) + 11-02 - COVERED
D-02 prior_errors_lookup tier-derived: 11-02 Task 2 interfaces - COVERED
D-03 skip_gates default []: 11-01 - COVERED
D-04 lessons_path warn+continue: 11-02 Task 2 action - COVERED
D-05 depends_on/known_deadends/verification_cmd defaults: 11-01 - COVERED
D-06 validate.cjs at super-gsd/tools/plan-schema/: 11-02 - COVERED
D-07 write-time + load-time validation: 11-02 + 11-05 T1 + 11-03 T2 - COVERED
D-08 dual error format (stderr + plan-errors.jsonl): 11-02 Task 2 - COVERED
D-09 fix-schema preserves task.id/goal/files_touched: 11-03 Task 1 - COVERED
D-10 3-attempt cap + checkpoint: 11-03 Task 2 - COVERED
D-11 sibling .fix-attempt-K.md staging: 11-03 Task 2 - COVERED
D-12 sha256 boot-hash check: 11-04 Task 2 - COVERED
D-13 GSDedits canonical; writing-plans consumes: 11-05 Task 1 - COVERED
D-14 drift warn+continue+readiness-log.jsonl: 11-04 Task 2 - COVERED

All 14 decisions covered. No decision contradicted. No deferred idea implemented.

---

## Execution Sequencing

Wave 1 parallelization (11-01 and 11-02):
  11-01 writes only: super-gsd/templates/plan-schema-v2.json
  11-02 writes only: super-gsd/tools/plan-schema/validate.cjs + package.json
  Zero file overlap. Fully parallel. PASS.

Wave 2 serialization (11-03 then 11-04 then 11-05):
  All three modify super-gsd/skills/sgsd-orchestrate/SKILL.md.
  11-PLAN.md documents contention; mandates order 11-03 > 11-04 > 11-05.
  11-04 T1 writes .planning/config.json (no contention). PASS.
  11-05 T1 writes new super-gsd/skills/sgsd-write-plan/SKILL.md (no contention). PASS.

---

## Verification Command Audit

11-01-T1: PRESENT - WARNING: requires ajv from parallel 11-02 npm install (see GAP-1)
11-02-T1: PRESENT - runnable after npm install
11-02-T2: PRESENT - runnable after validate.cjs written
11-03-T1: PRESENT - grep only, no external deps
11-03-T2: PRESENT - grep only, no external deps
11-04-T1: PRESENT - Node built-in only
11-04-T2: PRESENT - grep only, no external deps
11-05-T1: PRESENT - test + grep, no external deps
11-05-T2: PRESENT - grep only, no external deps
All 9 verify commands present. 8/9 independently runnable. 1 has sequencing hazard.

---

## SCHEMA-05 Option B Mechanical Verification

sgsd-write-plan Step 4 runs validate.cjs via bash BEFORE Step 5 Write tool.
Skill marks Step 4 mandatory (never skip). Exit codes 0/1/2 are deterministic.
No LLM compliance required for the gate to hold.
CONFIRMED: Option B is mechanical enforcement. PASS.

---

## Settings.json Mutation Check

Option C (PreToolUse hook) rejected in 11-05 known_deadends: requires settings.json
mutation, violating the global CLAUDE.md rule from the 2026-04-21 key-exposure incident.
No plan task references settings.json anywhere. PASS.

---

## Deferred Ideas Check

Classifier-skip formal discussion: absent from all plans. PASS.
Auto-suggest fixes inline: absent from all plans. PASS.
v1-to-v2 migration tool: absent from all plans. PASS.
Schema evolution beyond v2: absent from all plans. PASS.
146 existing v1 plans: no migration task anywhere in the plan set. PASS.

---

## Research Resolution (Dimension 11)

11-RESEARCH.md Open Questions section is missing the (RESOLVED) suffix.
All 3 questions resolved within the plan set:
  1. writing-plans sync mechanism (RQ-3): Option B chosen in 11-PLAN.md
  2. planner-fix-schema reference file location (RQ-5): inline fix_schema_mode per 11-03
  3. Error envelope delivery to fix-planner (RQ-5): inline JSONL row per 11-03 T2
GAP-2 (info): heading missing (RESOLVED) marker. No execution impact.

---

## Scope Sanity

11-01: 1 task, 1 file, Wave 1 - Within budget
11-02: 2 tasks, 2 files, Wave 1 - Within budget
11-03: 2 tasks, 2 files, Wave 2 - Within budget
11-04: 2 tasks, 2 files, Wave 2 - Within budget
11-05: 2 tasks, 2+dir files, Wave 2 - Within budget
All plans well below 5-task blocker threshold.

---

## Issues

GAP-1 (warning) - task_completeness - 11-01 Task 1 verify
The 11-01 verify runs require(ajv).default to compile the schema, but ajv is installed
by the parallel Wave 1 plan 11-02 Task 1 (npm install). If executor verifies 11-01
before 11-02 Task 1 completes, verify fails with MODULE_NOT_FOUND.
Fix A (no plan change): run 11-02 Task 1 first in Wave 1, then verify 11-01.
Fix B (plan change): replace 11-01 verify with JSON.parse-only check (no npm dep).

GAP-2 (info) - research_resolution - 11-RESEARCH.md
Open Questions heading missing (RESOLVED) marker. No execution impact.

DEVIATION (info) - context_compliance - SCHEMA-05 approach
ROADMAP says superpowers:writing-plans emits v2 by default. Plan delivers replacement
skill sgsd-write-plan rather than patching the external skill. RESEARCH.md confirmed
external skill cannot be mechanically patched from this repo. Planner documented Option B
rationale in 11-PLAN.md. Not a contradiction of D-13. Operator awareness only.

---

## Final Verdict

PASS-WITH-GAPS
5/5 SCHEMA success criteria: COVERED
14/14 context decisions: COVERED
MISSING: 0 | PARTIAL: 0
Blockers: 0 | Warnings: 1 (GAP-1) | Info: 2 (GAP-2 + DEVIATION)

GAP-1 requires only an executor briefing note, not a plan revision. Executor must run
11-02 Task 1 (npm install) before verifying 11-01, or substitute the 11-01 verify
command with a JSON.parse-only check. The plan set is ready to execute.
