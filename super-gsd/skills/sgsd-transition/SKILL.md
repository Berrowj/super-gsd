---
name: sgsd-transition
description: "Migrate from GSD 2.0 (Pi harness) to Super GSD. One-time import of decisions, knowledge, requirements, and milestone work."
argument-hint: "[path/to/.gsd/]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
---

<objective>
One-time migration command for users transitioning from GSD 2.0 (Pi harness) back to
Claude Code with Super GSD. Reads .gsd/ artifacts, curates knowledge into SGSD memory,
maps completed work into .planning/ structure.

$ARGUMENTS: path to .gsd/ directory (defaults to ./.gsd/)
</objective>

<step_1_discover>
## Step 1: Discover GSD 2.0 State

Set `GSD_DIR` to `$ARGUMENTS` if provided, otherwise default to `./.gsd/`.

First, check the directory exists at all:
```bash
ls "$GSD_DIR" 2>/dev/null || echo "NOT_FOUND"
```

If `NOT_FOUND`: stop and report "No GSD 2.0 directory found at {GSD_DIR}. Pass the path as an argument: /gsd-transition path/to/.gsd/". Do not proceed.

Otherwise, read (existence check only, don't load full files):
```bash
ls "$GSD_DIR/STATE.md" "$GSD_DIR/DECISIONS.md" "$GSD_DIR/KNOWLEDGE.md" \
   "$GSD_DIR/REQUIREMENTS.md" "$GSD_DIR/PROJECT.md" 2>/dev/null
ls "$GSD_DIR/milestones/" 2>/dev/null
```

Report to user:
- Found: {list of files}
- Milestones: {count and IDs}
- Decisions: {count}
- Requirements: {count}
- If any expected file is missing: "Note: {file} not found — step {N} will be skipped"
</step_1_discover>

<step_2_decisions>
## Step 2: Migrate Decisions

Read `.gsd/DECISIONS.md` in chunks (100 lines at a time).
For each decision (D001, D002, ...):
1. Extract: ID, decision text, choice, rationale
2. Classify domain (architecture, api, database, auth, testing, etc.)
3. Curate into SGSD memory:
   ```
   sgsd-curate --type decision --slug "{decision_id}" --summary "{choice}" < decision.md
     domain: decisions/{classified_domain}
     importance: 70
     tags: [decision, {domain}]
   ```

Skip decisions that are clearly superseded by later ones (same topic, later date).
Log: "Migrated {N} decisions into SGSD memory decisions"
</step_2_decisions>

<step_3_knowledge>
## Step 3: Migrate Knowledge

Read `.gsd/KNOWLEDGE.md`.
For each principle/rule/anti-pattern:
1. Classify: pattern | anti-pattern | error-rule | domain-knowledge
2. Curate into SGSD memory:
   - Patterns → patterns/{domain}
   - Anti-patterns → anti-patterns/
   - Error rules → error-rules/
   - Domain knowledge → domain/{topic}

Check against existing CLAUDE.md ERR-NNNN rules — don't duplicate.
Log: "Migrated {N} knowledge items"
</step_3_knowledge>

<step_4_requirements>
## Step 4: Migrate Requirements

Read `.gsd/REQUIREMENTS.md`.
Merge into `.planning/REQUIREMENTS.md`:
1. Read existing .planning/REQUIREMENTS.md (if any)
2. For each .gsd/ requirement not already present:
   - Append with original ID and validation status
   - Mark validated requirements as [x]
3. Write merged file

Log: "Merged {N} requirements ({M} validated)"
</step_4_requirements>

<step_5_milestones>
## Step 5: Map Completed Work

Read `.gsd/milestones/` directory:
1. For each milestone (M001, M002, ...):
   - Read ROADMAP.md to get slice list
   - Check completion status
2. Map completed milestones to .planning/ phases:
   - Determine next available phase number
   - Create phase entries in ROADMAP.md with [x] markers
   - Do NOT create full phase directories for already-completed work
3. Map incomplete milestones as pending phases:
   - Create phase entries with [ ] markers
   - Include goals and success criteria from .gsd/ milestone

Log: "Mapped {N} milestones → {M} phases ({C} complete, {P} pending)"
</step_5_milestones>

<step_6_report>
## Step 6: Migration Report

Write `.planning/TRANSITION-REPORT.md`:

```markdown
# GSD 2.0 → Super GSD Migration Report

**Date**: {ISO date}
**Source**: {path to .gsd/}
**Target**: .planning/

## Migrated
- Decisions: {N} → `.planning/memory/architecture/decisions/` ({skipped} skipped as superseded)
- Knowledge: {N} → `.planning/memory/architecture/{patterns,anti-patterns}/` + `.planning/memory/errors/`
- Requirements: {N} merged into .planning/REQUIREMENTS.md
- Milestones: {N} → {M} phases in ROADMAP.md

## Skipped
- {list of items skipped and why}

## Manual Review Needed
- {items that need human decision}

## SGSD Memory Tree
{summary of what was curated and where}
```

Report to user: "Migration complete. Review .planning/TRANSITION-REPORT.md"
</step_6_report>
