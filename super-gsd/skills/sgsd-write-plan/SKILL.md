---
name: sgsd-write-plan
version: 1.0.0
description: "SGSD-native plan-authoring skill. Replaces superpowers:writing-plans for SGSD plan authoring. Emits v2 YAML-frontmatter PLAN.md files conforming to plan-schema-v2.json and calls validate.cjs mechanically before writing — enforces SCHEMA-05 at write-time."
replaces: "superpowers:writing-plans (for SGSD plan authoring only)"
schema: "v2 (super-gsd/templates/plan-schema-v2.json)"
allowed-tools:
  - Read
  - Write
  - Bash
---

## Purpose

Author v2-compliant PLAN.md files for SGSD phases. Emits YAML frontmatter conforming to
`plan-schema-v2.json` and **mechanically calls `validate.cjs` before writing** (SCHEMA-05).

This is the canonical plan-authoring skill for SGSD. The third-party `superpowers:writing-plans`
emits Markdown prose with `- [ ]` checkbox steps — incompatible with v2 YAML frontmatter and
without validate.cjs enforcement. Use this skill instead for any SGSD plan file.

**Why Option B (replacement skill) over overlay or hook:**
- Option A (overlay prompt): relies on LLM compliance, not mechanical enforcement. validate.cjs
  would not be called deterministically.
- Option C (PreToolUse hook on Write to `*PLAN.md`): requires mutating settings.json, which is
  prohibited after the 2026-04-21 key-exposure incident (global CLAUDE.md rule).
- Option B (this skill): git-controlled, explicitly calls validate.cjs before Write,
  mechanical enforcement — no compliance assumption.

## Trigger

```
/sgsd-write-plan <phase-slug> <plan-NN> [goal]
```

Examples:
```
/sgsd-write-plan 12-orchestrator-engine 01 "implement model routing"
/sgsd-write-plan 11-plan-schema-v2 05
```

## Steps

### Step 1: Gather context

Read the following if they exist under `.planning/phases/<phase-slug>/`:
- `<phase-slug>-CONTEXT.md` — domain decisions, locked constraints, implementation decisions
- `<phase-slug>-RESEARCH.md` — findings, RQ answers, recommended patterns

Also check:
- `.planning/ROADMAP.md` — phase goal, deps, success criteria for this phase
- `.planning/REQUIREMENTS.md` — relevant requirement IDs for this plan

If `validate.cjs` is absent at `super-gsd/tools/plan-schema/validate.cjs`, **STOP immediately**:
> BLOCKED: validate.cjs not found at super-gsd/tools/plan-schema/validate.cjs.
> Run plan 11-02 first to install the schema validator before authoring v2 plans.

Verify it exists:
```bash
test -f super-gsd/tools/plan-schema/validate.cjs && echo "FOUND" || echo "MISSING"
```

### Step 2: Draft plan frontmatter (YAML)

Produce YAML frontmatter matching plan-schema-v2.json. Required top-level fields:

```yaml
---
schema_version: 2
tasks:
  - id: t1
    agent: <agent-name>          # e.g. gsd-executor, gsd-planner, gsd-phase-researcher
    model: haiku|sonnet|opus
    files_touched:               # list of file paths this task creates or modifies
      - path/to/file.ext
    input_contract: <what this task receives — data, files, flags>
    output_contract: <what this task produces — artifacts, state changes>
    hypothesis: <why this approach will work — one sentence>
    falsifier: <observable condition that proves hypothesis wrong>
    stop_rule: <when the task is complete — concrete done condition>
  # add more tasks as needed
expected_ATC_tier: LITE|FULL|GATE|SKIP   # omit to default LITE
skip_gates: []
depends_on: []            # plan IDs this plan depends on, e.g. ["11-01", "11-02"]
known_deadends: []        # approaches already proven not to work
verification_cmd: null    # shell command to run as final verification; null = verifier agent
lessons_path: null        # path to lessons file if this plan generates one
---
```

**All 9 task fields are required** (`id`, `agent`, `model`, `files_touched`, `input_contract`,
`output_contract`, `hypothesis`, `falsifier`, `stop_rule`). Omitting any field will cause
validate.cjs to exit 1 and block Step 5.

**D-13 canonical schema:** `super-gsd/templates/plan-schema-v2.json` in this repo (GSDedits)
is the single source of truth for the v2 schema structure.

### Step 3: Draft plan body (free-form Markdown)

Below the closing `---`, write the human-readable narrative. Suggested sections:

```markdown
## Goal
One paragraph describing what this plan delivers and why.

## Context
Key decisions, constraints, and prior work relevant to this plan.

## Tasks
Brief per-task summary (the YAML frontmatter already has the machine-readable contract;
this section is the human narrative explaining the approach).

## Verification
How to confirm the plan succeeded end-to-end.

## Success Criteria
Bullet list of observable, verifiable outcomes.
```

### Step 4: Validate BEFORE writing (MANDATORY — mechanical enforcement)

**This step MUST precede Step 5. Never skip.**

Write the full plan content (frontmatter + body) to a deterministic draft path, then run validate.cjs:

Write the full plan content to: `.planning/.sgsd-draft-plan.md`
(Use the Write tool — avoids shell quoting hazards and /tmp path
assumptions that break on Windows/WSL without explicit context.)

Then run validate.cjs against the draft:
```bash
node super-gsd/tools/plan-schema/validate.cjs \
  --plan-file .planning/.sgsd-draft-plan.md \
  --project-dir . \
  --mode write
```

After validation completes (exit 0 or exit 1), delete the draft:
```bash
rm .planning/.sgsd-draft-plan.md
```

EXIT_CODE=$?

**Exit code handling:**

| Exit | Meaning | Action |
|------|---------|--------|
| 0 | VALID — frontmatter passes schema | Proceed to Step 5 |
| 1 | INVALID — schema errors found | Display ajv errors from stderr, revise frontmatter, retry Step 4 |
| 2 | BLOCKED — validate.cjs precondition failure | Report: "tool missing or schema file absent — run plan 11-01 and 11-02 first" |

**On exit 1:** Read the stderr output carefully. Common errors:
- `missing required property 'falsifier'` → add `falsifier:` field to the failing task
- `must be equal to one of the allowed values` → check enum fields (`model`, `expected_ATC_tier`)
- `must be array` → `files_touched`, `skip_gates`, `depends_on`, `known_deadends` must be lists

Revise the frontmatter and retry Step 4. Do NOT proceed to Step 5 with a non-zero exit.

**If validate.cjs is absent (exit 2 with "file not found" message):**
> BLOCKED: validate.cjs missing. Run plan 11-02 to install the schema validator.
> Do not write the plan file without validation.

### Step 5: Write the plan file

Only after validate.cjs exits 0:

```bash
# Clean up temp file
rm "$TMP_PLAN"
```

Write the plan to the canonical path using the Write tool:

```
Target: .planning/phases/<phase-slug>/<phase-slug>-<NN>-<descriptive-slug>.md
```

File name convention examples:
- `11-01-schema-json.md`
- `11-05-writing-plans-hook.md`
- `12-03-model-routing.md`

If the phase directory does not exist, create it via Bash before writing:
```bash
mkdir -p .planning/phases/<phase-slug>/plans
```

### Step 6: Confirm

Report the following:
- Plan file path (absolute)
- Task count and task IDs
- `expected_ATC_tier` value
- Validation status: `validate.cjs exit 0 — VALID`
- Any decisions made during drafting worth recording

## Constraints

1. **Step 4 before Step 5 — always.** Validation is not optional. A plan that bypasses validate.cjs
   violates SCHEMA-05 and will fail load-time validation in the orchestrator (Step 6.2).

2. **YAML frontmatter is the machine-readable contract.** The body below `---` is free-form human
   narrative. The schema only validates the frontmatter.

3. **schema_version: 2 is always set.** Never omit it. Without it, the orchestrator's classifier
   skip-path (SCHEMA-04) will not fire, and the plan will route through the Haiku classifier
   even when `model` and `expected_ATC_tier` are declared.

4. **Do NOT modify validate.cjs or plan-schema-v2.json** from within this skill. Those files are
   owned by plans 11-01 and 11-02 respectively. If the schema needs updating, open a new phase.

5. **Do NOT write to `~/.claude/plugins/cache/`** (the superpowers writing-plans cache). This skill
   is the replacement, not a patch to the external skill.

## Error Reference

| Symptom | Cause | Fix |
|---------|-------|-----|
| `validate.cjs: command not found` | Node not in PATH | Use `node super-gsd/tools/plan-schema/validate.cjs` |
| `Cannot find module 'ajv'` | npm install not run | `cd super-gsd/tools/plan-schema && npm install` |
| `ENOENT: plan-schema-v2.json` | Schema file missing | Run plan 11-01 first |
| `must have required property 'hypothesis'` | Task missing a required field | Add the field per Step 2 template |
| `schema_version must be equal to 2` | Wrong or missing schema_version | Set `schema_version: 2` in frontmatter |
