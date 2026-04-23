---
phase: 11-plan-schema-v2
plan: 05
type: execute
wave: 2
depends_on:
  - "11-01"
  - "11-02"
files_modified:
  - super-gsd/skills/sgsd-write-plan/SKILL.md
  - super-gsd/skills/sgsd-orchestrate/SKILL.md
autonomous: true
requirements:
  - SCHEMA-04
  - SCHEMA-05

# v2 plan self-referential frontmatter
schema_version: 2
tasks:
  - id: t1
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/skills/sgsd-write-plan/SKILL.md
    input_contract: RESEARCH RQ-3 Option B, D-13, validate.cjs exists (plan 02)
    output_contract: sgsd-write-plan SKILL.md that emits v2 YAML frontmatter + calls validate.cjs before writing
    hypothesis: a replacement skill under super-gsd/skills/ is fully git-controlled and can call validate.cjs directly, giving tighter SCHEMA-05 compliance than an overlay
    falsifier: skill emits plan without calling validate.cjs, OR emits Markdown-prose format instead of YAML frontmatter
    stop_rule: skill instructions explicitly call validate.cjs before Write; output format is YAML frontmatter + free-form body
  - id: t2
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/skills/sgsd-orchestrate/SKILL.md
    input_contract: RESEARCH RQ-4, SCHEMA-04 classifier skip-path, sgsd-classifier.md contract
    output_contract: orchestrator Step 2 gains schema_version check; v2 plans skip Haiku classifier spawn
    hypothesis: a pre-Step-2 branch on schema_version==2 eliminates redundant Haiku classifier spawn for v2 plans
    falsifier: v2 plans still spawn Haiku classifier at Step 2 despite having model/expected_ATC_tier in frontmatter
    stop_rule: schema_version==2 branch present; synthetic classifier result built from frontmatter fields; no Agent spawn
expected_ATC_tier: FULL
skip_gates: []
depends_on:
  - "11-01"
  - "11-02"
known_deadends:
  - "Option A (overlay prompt) rejected — LLM compliance only, not mechanical enforcement"
  - "Option C (PreToolUse hook) rejected — hooks require settings.json mutation which violates NEVER head/cat settings.json rule"
  - "Do not modify the cached superpowers:writing-plans skill at ~/.claude/plugins/cache/ — not git-controlled"
verification_cmd: null
lessons_path: null

must_haves:
  truths:
    - "super-gsd/skills/sgsd-write-plan/SKILL.md exists as the canonical plan-authoring skill for SGSD"
    - "sgsd-write-plan calls validate.cjs before emitting any PLAN.md file"
    - "sgsd-write-plan outputs YAML frontmatter (not Markdown-prose checkboxes)"
    - "Orchestrator Step 2 skips Haiku classifier when schema_version==2"
    - "v1 plans (no schema_version or schema_version:1) still route through Haiku classifier"
  artifacts:
    - path: "super-gsd/skills/sgsd-write-plan/SKILL.md"
      provides: "SGSD-native plan-authoring skill emitting v2 YAML frontmatter"
      contains: "validate.cjs, schema_version: 2"
    - path: "super-gsd/skills/sgsd-orchestrate/SKILL.md"
      provides: "Classifier skip-path for v2 plans at Step 2"
      contains: "schema_version"
  key_links:
    - from: "super-gsd/skills/sgsd-write-plan/SKILL.md"
      to: "super-gsd/tools/plan-schema/validate.cjs"
      via: "node validate.cjs --plan-file PATH --mode write call before Write tool"
      pattern: "validate\\.cjs"
    - from: "sgsd-orchestrate Step 2"
      to: "sgsd-classifier.md"
      via: "conditional bypass when schema_version==2"
      pattern: "schema_version"
---

<goal>
Enforce v2 emission at write-time (new sgsd-write-plan skill) and v1 classifier bypass at load-time (orchestrator Step 2 skip-path).

Purpose: SCHEMA-05 requires the writing skill to emit v2 by default. SCHEMA-04 requires v2 plans to skip the Haiku classifier. This plan delivers both.

SCHEMA-05 option chosen: Option B (replacement skill sgsd-write-plan) — rationale below.

Option B rationale vs A and C:
- Option A (overlay) relies on LLM compliance, not mechanical enforcement. validate.cjs would not be called.
- Option C (PreToolUse hook on Write to *PLAN.md) requires mutating settings.json. The global CLAUDE.md rule "NEVER head/cat settings.json" was established after a key-exposure incident; mutating settings.json via file-write from a plan executor is in the same danger zone.
- Option B (new skill under super-gsd/skills/) is git-controlled, operator-invocable, calls validate.cjs explicitly before Write, and can be maintained alongside the schema. The user switches from `superpowers:writing-plans` to `/sgsd-write-plan` for SGSD plan authoring.

Output: sgsd-write-plan SKILL.md + orchestrator classifier skip-path.
</goal>

<context>
@.planning/phases/11-plan-schema-v2/11-CONTEXT.md
@.planning/phases/11-plan-schema-v2/11-RESEARCH.md
@super-gsd/skills/sgsd-orchestrate/SKILL.md
</context>

<interfaces>
<!-- sgsd-classifier.md output contract (RQ-4) -->
{
  "complexity": "light|standard|heavy",
  "model": "haiku|sonnet|opus",
  "atc_tier": "skip|lite|full|gate",
  "deliberate": false,
  "reason": "one sentence max"
}

<!-- v2 synthetic classifier result derivation (RQ-4) -->
// Read from plan frontmatter (already parsed for schema_version check)
const model = frontmatter.model  // required SCHEMA-02 field
const atc_tier = (frontmatter.expected_ATC_tier || 'LITE').toLowerCase()
const files_count = frontmatter.tasks.flatMap(t => t.files_touched).length
const complexity = files_count <= 3 ? 'light' : files_count <= 6 ? 'standard' : 'heavy'
const deliberate = frontmatter.depends_on?.length > 2 || files_count > 5
synthetic_classifier_result = { complexity, model, atc_tier, deliberate, reason: "v2 plan — classifier skip (SCHEMA-04)" }

<!-- v2 PLAN.md output format for sgsd-write-plan -->
---
schema_version: 2
tasks:
  - id: t1
    agent: <agent-name>
    model: sonnet
    files_touched: [path/to/file.ext]
    input_contract: <what the task receives>
    output_contract: <what the task produces>
    hypothesis: <why this approach works>
    falsifier: <what would prove it wrong>
    stop_rule: <when to stop and consider done>
  # ... more tasks
expected_ATC_tier: LITE
skip_gates: []
depends_on: []
known_deadends: []
verification_cmd: null
lessons_path: null
---

<free-form plan body in Markdown>
## Goal
...
## Context
...
## Tasks
...
</interfaces>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Create sgsd-write-plan/SKILL.md replacement skill</name>
  <files>super-gsd/skills/sgsd-write-plan/SKILL.md</files>
  <action>
Create directory super-gsd/skills/sgsd-write-plan/ and write SKILL.md.

The skill is invoked as `/sgsd-write-plan` by the operator when authoring a new SGSD plan.

SKILL.md structure:

```
# SKILL: sgsd-write-plan
Version: 1.0.0
Replaces: superpowers:writing-plans (for SGSD plan authoring)
Schema: v2 (plan-schema-v2.json)

## Purpose
Author v2-compliant PLAN.md files for SGSD phases. Emits YAML frontmatter
conforming to plan-schema-v2.json and calls validate.cjs before writing.

## Trigger
/sgsd-write-plan <phase-slug> <plan-NN> [goal]

## Steps

### Step 1: Gather context
Read phase CONTEXT.md and RESEARCH.md (if present) from .planning/phases/<phase>/.

### Step 2: Draft plan frontmatter (YAML)
Produce YAML frontmatter per plan-schema-v2.json required fields:
  schema_version: 2
  tasks:
    - id: t<N>
      agent: <agent-name>
      model: haiku|sonnet|opus
      files_touched: [<file paths>]
      input_contract: <what this task receives>
      output_contract: <what this task produces>
      hypothesis: <why this approach will work>
      falsifier: <observable condition that proves hypothesis wrong>
      stop_rule: <when the task is done>
  expected_ATC_tier: LITE|FULL|GATE|SKIP   # omit to default LITE
  skip_gates: []
  depends_on: []
  known_deadends: []
  verification_cmd: null
  lessons_path: null

### Step 3: Draft plan body (free-form Markdown)
Write goal, context, tasks, verification, success criteria below the closing ---.

### Step 4: Validate BEFORE writing
Run via bash:
  node super-gsd/tools/plan-schema/validate.cjs \
    --plan-file <tmp-path> \
    --project-dir . \
    --mode write
If exit 1: display ajv errors, revise frontmatter, retry Step 4.
If exit 2: report tool failure (schema file missing — run plan 01 first).
If exit 0: proceed.

### Step 5: Write the plan file
Write to .planning/phases/<phase>/<phase>-<NN>-PLAN.md using Write tool.
File name convention: {phase}-{NN}-PLAN.md (e.g. 11-01-PLAN.md).

### Step 6: Confirm
Report: plan file path, task count, ATC tier, validation status.
```

Key constraints to include in SKILL.md:
- Step 4 (validate) MUST precede Step 5 (write) — never skip
- If validate.cjs is absent, block and instruct operator to run plan 11-02 first
- The YAML frontmatter is the machine-readable contract; body is free-form human narrative
- D-13: schema_path is canonical at super-gsd/templates/plan-schema-v2.json in GSDedits repo
  </action>
  <verify>
    <automated>test -f "C:/Users/jack.berrow/GSDedits/super-gsd/skills/sgsd-write-plan/SKILL.md" && grep -c "validate.cjs" "C:/Users/jack.berrow/GSDedits/super-gsd/skills/sgsd-write-plan/SKILL.md"</automated>
  </verify>
  <done>
- super-gsd/skills/sgsd-write-plan/SKILL.md exists
- validate.cjs called before Write tool (Step 4 before Step 5)
- Output format is YAML frontmatter + free-form Markdown body
- All 9 required task fields documented in Step 2
- Skill is git-controlled (not external cache)
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Add classifier skip-path to orchestrator Step 2</name>
  <files>super-gsd/skills/sgsd-orchestrate/SKILL.md</files>
  <action>
Read sgsd-orchestrate/SKILL.md in full.

Locate Step 2 (the Haiku classifier dispatch step). BEFORE the existing Agent spawn,
insert a conditional branch:

```
// SCHEMA-04: v2 plans skip Haiku classifier
IF plan frontmatter has schema_version == 2:
  // Synthesize classifier result from frontmatter fields
  model         ← frontmatter.model (required SCHEMA-02 field)
  atc_tier      ← (frontmatter.expected_ATC_tier || 'LITE').toLowerCase()
  files_count   ← count of all files_touched across all tasks
  complexity    ← files_count <= 3 ? 'light' : files_count <= 6 ? 'standard' : 'heavy'
  deliberate    ← (frontmatter.depends_on?.length > 2 || files_count > 5)
  classifier_result = {
    complexity, model, atc_tier, deliberate,
    reason: "v2 plan — classifier skip (SCHEMA-04)"
  }
  SKIP Agent(sgsd-classifier) spawn
  USE classifier_result as if returned by sgsd-classifier

ELSE (schema_version absent or schema_version == 1):
  PROCEED with existing Step 2 (spawn Haiku classifier as before)
```

This change MUST NOT alter the classifier result structure — it must be identical
to the sgsd-classifier.md output contract so all downstream Steps (3+) work unchanged.

Note: The frontmatter must already be parsed to reach this branch (orchestrator reads
schema_version earlier for D-12 drift check). The same parsed frontmatter object
is available here — no additional file read needed.

v1 plans: no schema_version or schema_version: 1 → existing path unchanged.
v2 plans: schema_version: 2 → synthetic result, no Haiku spawn.
  </action>
  <verify>
    <automated>grep -n "schema_version.*2\|SCHEMA-04\|classifier skip" "C:/Users/jack.berrow/GSDedits/super-gsd/skills/sgsd-orchestrate/SKILL.md" | head -15</automated>
  </verify>
  <done>
- Orchestrator Step 2 has pre-branch checking schema_version
- schema_version==2 path: synthetic classifier result from frontmatter; no Agent spawn
- schema_version absent or 1: existing Haiku spawn path unchanged
- Synthetic result shape identical to sgsd-classifier.md output contract
- Comment references SCHEMA-04
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| sgsd-write-plan → validate.cjs → Write | Plan content flows through validator before landing on disk |
| synthetic classifier result → downstream dispatch | Frontmatter-derived values replace Haiku output; must match same shape |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-11-12 | Tampering | sgsd-write-plan skipping validate step | mitigate | Skill instructions make Step 4 mandatory before Step 5; orchestrator load-time validate.cjs provides second gate |
| T-11-13 | Elevation of Privilege | synthetic classifier over-granting model tier | mitigate | model field is frontmatter-declared and schema-validated (enum: haiku|sonnet|opus); no arbitrary escalation |
| T-11-14 | Repudiation | classifier skip not logged | accept | reason field in synthetic result ("v2 plan — classifier skip") provides traceability in dispatch logs |
</threat_model>

<verification>
ls C:/Users/jack.berrow/GSDedits/super-gsd/skills/sgsd-write-plan/SKILL.md && grep -c "validate.cjs" C:/Users/jack.berrow/GSDedits/super-gsd/skills/sgsd-write-plan/SKILL.md
</verification>

<success_criteria>
- super-gsd/skills/sgsd-write-plan/SKILL.md exists and is git-controlled
- Skill explicitly calls validate.cjs before Write tool (mechanical enforcement)
- Output format: YAML frontmatter with all 9 SCHEMA-02 required task fields
- Orchestrator Step 2 skips Haiku classifier for schema_version==2 plans (SCHEMA-04)
- v1 plans still route through existing Haiku classifier unchanged
- Synthetic classifier result shape matches sgsd-classifier.md contract
</success_criteria>

<output>
After completion, create .planning/phases/11-plan-schema-v2/plans/11-05-SUMMARY.md
</output>
