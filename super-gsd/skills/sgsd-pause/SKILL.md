---
name: sgsd-pause
description: "Write checkpoint and stop the autonomous loop. Replaces /gsd-pause-work for Super GSD."
allowed-tools:
  - Read
  - Write
  - Bash
---

<objective>
Write an ORCHESTRATOR-CHECKPOINT.md with full resume context, commit it, and stop.
The next session's cold start will detect this and resume automatically.
</objective>

<process>
## Step 1: Gather State

```bash
head -30 .planning/STATE.md
```

Extract: milestone, phase, plan, progress.

## Step 2: Gather Session Work

Read `.planning/metrics/token-log.jsonl` — last 20 entries for this session.
Count: units completed, total estimated tokens, model breakdown.

## Step 3: Determine Next Action

From dispatch rules, what would the next loop iteration do?
Document this precisely — the resume agent needs to know EXACTLY what to dispatch.

## Step 4: Write Checkpoint

Write `.planning/ORCHESTRATOR-CHECKPOINT.md`:

```yaml
---
created_at: "{ISO timestamp}"
active_milestone: "{version}"
active_phase: {NN}
last_completed: "{last unit description}"
next_unit: "{next dispatch: agent type + phase + plan}"
phase_state: "{researching|planning|executing|verifying}"
units_this_session: {N}
estimated_tokens_used: {N}
model_breakdown:
  opus: {N}
  sonnet: {N}
  haiku: {N}
---

## Completed This Session
{list of units with ONE_LINERs from token log}

## Next Action
{Precise: "Dispatch gsd-executor for phase 27, plan 03. Task: implement auth middleware."}

## Remaining Work
- Phase {N}: {remaining plans}
- Phase {N+1}: {not started}
- ...

## Learnings Curated This Session
{Any patterns/scripts curated to ByteRover}

## Resume Instructions
1. Read this checkpoint
2. Enter auto mode at "Next Action"
3. Delete this file after reading
```

## Step 5: Commit + Stop

```bash
git add .planning/ORCHESTRATOR-CHECKPOINT.md .planning/STATE.md
git commit -m "chore: write checkpoint — pausing at phase {N}"
```

Report: "Checkpoint written. Next session: say 'continue' to resume."
</process>
