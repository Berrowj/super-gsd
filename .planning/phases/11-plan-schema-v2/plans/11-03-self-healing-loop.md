---
phase: 11-plan-schema-v2
plan: 03
type: execute
wave: 2
depends_on:
  - "11-01"
  - "11-02"
files_modified:
  - custom-gsd-extract/claude-agents/gsd-planner.md
  - super-gsd/skills/sgsd-orchestrate/SKILL.md
autonomous: true
requirements:
  - SCHEMA-02

# v2 plan self-referential frontmatter
schema_version: 2
tasks:
  - id: t1
    agent: gsd-executor
    model: sonnet
    files_touched:
      - custom-gsd-extract/claude-agents/gsd-planner.md
    input_contract: D-09..D-11, RESEARCH RQ-5, existing planner mode-branching pattern
    output_contract: gsd-planner.md gains --fix-schema mode section; preserves task.id/goal/files_touched
    hypothesis: adding fix-schema mode inline to gsd-planner.md mirrors gap/revision/reviews pattern with minimal diff
    falsifier: planner --fix-schema prompt does not extract task.id/goal/files_touched as locked constraints before regenerating
    stop_rule: fix-schema section present; locked-field extraction explicit in mode instructions
  - id: t2
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/skills/sgsd-orchestrate/SKILL.md
    input_contract: D-09..D-11, RESEARCH RQ-5, existing dispatch Rule 8 pattern
    output_contract: orchestrator dispatch table gains schema-validation branch; 3-attempt retry loop; checkpoint-on-cap logic
    hypothesis: a Rule 8.5 schema-fix branch slots cleanly between Rule 8 and Rule 9 using same retry pattern
    falsifier: orchestrator still proceeds past a validation failure without dispatching --fix-schema
    stop_rule: Rule 8.5 present; retry counter tracks K/3; checkpoint written with all 3 envelopes on cap
expected_ATC_tier: FULL
skip_gates: []
depends_on:
  - "11-01"
  - "11-02"
known_deadends:
  - "Do not create a separate planner-fix-schema.md reference file — inline per RQ-5 recommendation"
  - "Do not pass plan-errors.jsonl path to planner — inline the most recent row per RQ-5 OQ3"
verification_cmd: null
lessons_path: null

must_haves:
  truths:
    - "gsd-planner.md has a <fix_schema_mode> section triggered by --fix-schema flag"
    - "Fix mode extracts task.id, task.goal, task.files_touched BEFORE generating the repair prompt"
    - "Orchestrator dispatches gsd-planner --fix-schema on load-time validation failure"
    - "Orchestrator writes sibling .fix-attempt-K.md files; promotes only on re-validation pass"
    - "After 3 failed attempts, orchestrator writes ORCHESTRATOR-CHECKPOINT.md with all 3 envelopes + attempts"
  artifacts:
    - path: "custom-gsd-extract/claude-agents/gsd-planner.md"
      provides: "Planner with --fix-schema mode section"
      contains: "<fix_schema_mode>"
    - path: "super-gsd/skills/sgsd-orchestrate/SKILL.md"
      provides: "Orchestrator with Rule 8.5 schema-fix dispatch branch"
      contains: "Rule 8.5"
  key_links:
    - from: "sgsd-orchestrate Rule 8.5"
      to: "gsd-planner --fix-schema"
      via: "Agent dispatch on validation failure"
      pattern: "fix-schema"
    - from: "sgsd-orchestrate retry loop"
      to: ".fix-attempt-K.md sibling files"
      via: "Write tool before validate.cjs re-run"
      pattern: "\\.fix-attempt-\\d\\.md"
---

<goal>
Wire the self-healing schema repair loop: gsd-planner gains --fix-schema mode; orchestrator gains Rule 8.5 retry branch.

Purpose: SCHEMA-02 requires malformed plans to be repaired automatically, not silently skipped. This plan implements D-09/D-10/D-11.
Output: gsd-planner.md --fix-schema section + orchestrator Rule 8.5 dispatch + 3-attempt checkpoint logic.
</goal>

<context>
@.planning/phases/11-plan-schema-v2/11-CONTEXT.md
@.planning/phases/11-plan-schema-v2/11-RESEARCH.md
@custom-gsd-extract/claude-agents/gsd-planner.md
@super-gsd/skills/sgsd-orchestrate/SKILL.md
</context>

<interfaces>
<!-- Existing planner mode pattern (RQ-5) -->
Planner detects mode in <step name="load_mode_context">:
  - --gaps    → loads planner-gap-closure.md
  - --reviews → loads planner-reviews.md
  - <revision_context> → loads planner-revision.md
  NEW: --fix-schema → activates <fix_schema_mode> inline section

Existing orchestrator dispatch table (CLAUDE.md Rule 8):
  Rule 8: Verification failed → dispatch planner --gaps
  NEW Rule 8.5: Load-time validate.cjs exit 1 → dispatch planner --fix-schema

D-09 fix-planner input:
  - malformed plan file path
  - ajv error envelope (most recent plan-errors.jsonl row for this plan — passed inline)
  - canonical plan-schema-v2.json contract path
  - LOCKED: task.id, task.goal, task.files_touched values extracted from original before dispatch

D-11 staging convention:
  - attempt K writes to: {plan-dir}/{NN}-{PP}-PLAN.fix-attempt-{K}.md
  - on re-validation pass: overwrite {NN}-{PP}-PLAN.md; delete sibling
  - on re-validation fail: retain sibling; increment K

D-10 checkpoint body on cap:
  - all 3 error envelopes (JSONL rows from plan-errors.jsonl for this plan)
  - all 3 fix attempt file contents (from .fix-attempt-1.md, .fix-attempt-2.md, .fix-attempt-3.md)
  - specific plan path that failed
  - operator action required: inspect schema OR inspect plan for semantic errors
</interfaces>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Add --fix-schema mode to gsd-planner.md</name>
  <files>custom-gsd-extract/claude-agents/gsd-planner.md</files>
  <action>
Read gsd-planner.md in full. Locate the <step name="load_mode_context"> section.

Add a new detection branch for --fix-schema BEFORE the standard planning steps:

```
- If --fix-schema flag present: activate <fix_schema_mode> section inline
```

Then add a <fix_schema_mode> XML section to the planner document body (place after the existing revision_mode section). The section must contain:

1. TRIGGER: flag --fix-schema present in invocation context
2. INPUTS received from orchestrator:
   - plan_file_path: path to malformed PLAN.md
   - error_envelope: inline JSON (the most recent plan-errors.jsonl row for this plan)
   - schema_path: super-gsd/templates/plan-schema-v2.json
   - locked_fields: { id, goal, files_touched } extracted VERBATIM from the original plan before dispatch
3. LOCKED CONSTRAINT (D-09): The planner MUST NOT change task.id, task.goal, or task.files_touched.
   Only repair: missing required fields, wrong types, wrong field ordering.
   If the error indicates a missing field, ADD it with a reasonable default value.
   If the error indicates wrong type, COERCE to correct type.
   DO NOT regenerate or paraphrase task.goal or task.id.
4. OUTPUT: write repaired plan to {plan_file_path}.fix-attempt-{K}.md (sibling file per D-11)
   where K is provided by the orchestrator (1, 2, or 3).
5. COMMIT: orchestrator commits each attempt as:
   fix({phase}-{plan}): repair schema violation attempt K/3
6. DO NOT promote the sibling to overwrite the original — orchestrator handles promotion after re-validation.

Self-check the planner must perform before writing the fix attempt:
- [ ] task.id unchanged
- [ ] task.goal unchanged (character-for-character)
- [ ] task.files_touched unchanged (same array, same order)
- [ ] All ajv errors from error_envelope are addressed in the fix
  </action>
  <verify>
    <automated>grep -n "fix_schema_mode\|fix-schema" "C:/Users/jack.berrow/GSDedits/custom-gsd-extract/claude-agents/gsd-planner.md" | head -20</automated>
  </verify>
  <done>
- gsd-planner.md contains <fix_schema_mode> section
- load_mode_context step includes --fix-schema detection branch
- Section explicitly states locked fields constraint (D-09)
- Sibling file naming convention documented (D-11)
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Add Rule 8.5 schema-fix dispatch to orchestrator</name>
  <files>super-gsd/skills/sgsd-orchestrate/SKILL.md</files>
  <action>
Read sgsd-orchestrate/SKILL.md in full. Locate the dispatch rules table (Rules 1-9 in CLAUDE.md).

Add Rule 8.5 in the dispatch table between Rule 8 (verification failed) and Rule 9 (all phases complete):

Rule 8.5: Load-time validate.cjs exits 1 → dispatch gsd-planner --fix-schema

Also add the schema-fix retry loop block near the plan-load section (wherever the orchestrator
currently loads/reads plan files for dispatch). The retry logic:

```
ON validate.cjs exit 1 for plan {NN}-{PP}-PLAN.md:
  schema_fix_attempt = 0
  WHILE schema_fix_attempt < 3:
    schema_fix_attempt += 1
    Extract locked_fields = { id, goal, files_touched } from original plan frontmatter tasks[]
    Read most recent plan-errors.jsonl row for this plan (filter by plan_file field)
    Dispatch gsd-planner --fix-schema with:
      plan_file_path, error_envelope (inline JSON), schema_path, locked_fields, attempt_K=schema_fix_attempt
    Planner writes {NN}-{PP}-PLAN.fix-attempt-{schema_fix_attempt}.md
    Commit: fix({phase}-{plan}): repair schema violation attempt {schema_fix_attempt}/3
    Re-run validate.cjs on the sibling file
    IF exit 0:
      Overwrite {NN}-{PP}-PLAN.md with sibling content
      Delete sibling file
      Commit: fix({phase}-{plan}): promote schema repair attempt {schema_fix_attempt}/3
      BREAK (proceed with dispatch)
    # else: loop continues

  IF schema_fix_attempt == 3 AND still invalid:
    Write ORCHESTRATOR-CHECKPOINT.md with:
      next_unit: BLOCKED — manual schema repair required for {NN}-{PP}-PLAN.md
      error_envelopes: [all 3 plan-errors.jsonl rows for this plan]
      fix_attempts: [contents of all 3 .fix-attempt-K.md sibling files]
      plan_path: {NN}-{PP}-PLAN.md
      operator_action: inspect schema OR inspect plan for semantic errors
    git add ORCHESTRATOR-CHECKPOINT.md && git commit -m "chore(checkpoint): schema repair cap hit for {plan}"
    EXIT LOOP (Exit #3 Blocker)
```

The locked_fields extraction MUST happen before dispatching — not inside the planner.
The orchestrator extracts them by reading the original PLAN.md frontmatter tasks[] array.
This prevents the planner from corrupting them.

Do NOT change any existing dispatch rules. Only add Rule 8.5 and the retry block.
  </action>
  <verify>
    <automated>grep -n "8\.5\|fix-schema\|fix_schema\|fix-attempt" "C:/Users/jack.berrow/GSDedits/super-gsd/skills/sgsd-orchestrate/SKILL.md" | head -20</automated>
  </verify>
  <done>
- Rule 8.5 present in dispatch table
- Retry loop (3 attempts) documented with sibling file convention (D-11)
- Checkpoint-on-cap logic present with all 3 envelopes + fix attempts (D-10)
- Locked-field extraction happens in orchestrator before dispatch (D-09)
- Existing rules 1-9 unchanged
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| orchestrator → planner --fix-schema | Error envelope passed inline — could contain attacker-crafted plan content |
| sibling .fix-attempt files → promotion | Planner output overwrites original plan on pass |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-11-06 | Tampering | fix-attempt promotion | mitigate | Orchestrator re-validates sibling before overwriting original; only exit 0 triggers promotion |
| T-11-07 | Repudiation | repair attempt commits | accept | Each attempt committed with K/3 label; full trail in git log |
| T-11-08 | Denial of Service | infinite repair loop | mitigate | D-10 hard cap at 3 attempts; checkpoint halt enforced |
</threat_model>

<verification>
grep -c "fix_schema_mode\|fix-schema" C:/Users/jack.berrow/GSDedits/custom-gsd-extract/claude-agents/gsd-planner.md && grep -c "8\.5" C:/Users/jack.berrow/GSDedits/super-gsd/skills/sgsd-orchestrate/SKILL.md
</verification>

<success_criteria>
- gsd-planner.md has --fix-schema detection in load_mode_context + <fix_schema_mode> section
- Locked fields constraint (task.id, task.goal, task.files_touched) explicit in planner mode
- Orchestrator Rule 8.5 present between Rules 8 and 9
- 3-attempt retry loop with sibling staging (D-11) documented in orchestrator
- Checkpoint-on-cap logic includes all 3 envelopes + all 3 fix attempt files (D-10)
</success_criteria>

<output>
After completion, create .planning/phases/11-plan-schema-v2/plans/11-03-SUMMARY.md
</output>
