---
name: sgsd-resume
description: "Resume from checkpoint with full context restoration. Replaces /gsd-resume-work for Super GSD."
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Agent
---

<objective>
Detect checkpoint, restore context, and re-enter the autonomous loop.
If no checkpoint, fall back to cold start from STATE.md.
</objective>

<process>
## Step 1: Check for Checkpoint

```bash
cat .planning/ORCHESTRATOR-CHECKPOINT.md 2>/dev/null
```

### If checkpoint found:

1. Parse frontmatter: active_phase, next_unit, phase_state
2. Read "Next Action" section — this is the EXACT dispatch to make
3. Read "Remaining Work" — for context awareness
4. Delete checkpoint file (it's consumed):
   ```bash
   rm .planning/ORCHESTRATOR-CHECKPOINT.md
   git add -u .planning/ORCHESTRATOR-CHECKPOINT.md
   git commit -m "chore: consume checkpoint — resuming at phase {N}"
   ```
5. Report briefly: "Resuming from checkpoint: {next_unit}"
6. Enter auto loop at the specified next action

### If no checkpoint:

1. Read `.planning/STATE.md` (frontmatter only, offset 0, limit 30)
2. Read `.planning/ROADMAP.md` (first 50 lines — phase list)
3. Check git status: any uncommitted work?
4. Determine position from dispatch table
5. Report: "Cold start. Position: phase {N}, {state}."
6. Ask user: "Enter auto mode? (go/next/status)"

## Step 2: Verify State Consistency

```bash
# Check last commit matches expected state
git log --oneline -3

# Check for incomplete work (PLAN without SUMMARY)
ls .planning/phases/*-*/*-PLAN.md 2>/dev/null | while read plan; do
  summary=$(echo "$plan" | sed 's/PLAN/SUMMARY/')
  [ ! -f "$summary" ] && echo "INCOMPLETE: $plan"
done
```

If inconsistencies found: report them, suggest `/gsd-health --repair`.

## Step 3: Query ByteRover for Context

```
sgsd-recall "current project state recent decisions"
```

Inject relevant results into working memory for the session.

## Step 4: Enter Loop or Report

If user said "continue" / "go" → enter auto loop (invoke /gsd-orchestrate go)
If user said "status" → report and wait
If user said "next" → execute one unit via /gsd-orchestrate next
</process>
