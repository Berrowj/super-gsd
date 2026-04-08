# Super GSD Orchestrator

> Drop this into your project's CLAUDE.md (append or replace the GSD section).
> Teaches Claude Code the autonomous loop, checkpoint survival, and token efficiency.

## Super GSD — Autonomous Execution Engine

This project uses **Super GSD** for token-efficient autonomous execution.
State lives in `.planning/`. Memory lives in `.brv/context-tree/` (ByteRover).

### On Every New Session — DO THIS FIRST

1. **Check for checkpoint:** `Read .planning/ORCHESTRATOR-CHECKPOINT.md` — if found, resume from `next_unit`. Don't ask, just go.
2. **Read state:** `Read .planning/STATE.md` (frontmatter only, offset 0, limit 30) — active milestone, phase, progress.
3. **Check ByteRover:** `brv-query "session start current state"` — pull relevant context.
4. If user says "go" / "auto" / "continue" / "run" → enter auto mode immediately. No confirmation.

### What the User Says → What You Do

| User Says | You Do |
|-----------|--------|
| "go" / "auto" / "run" / "continue" | **Enter AUTO MODE** — start the loop, no questions |
| "next" | Execute ONE unit, then stop and report |
| "status" / "where are we?" | Read STATE.md frontmatter, report position |
| "stop" / "pause" | Write checkpoint, stop looping |
| "deliberate" | Run /gsd-deliberate for strategic decision |
| "audit tokens" | Run /gsd-token-audit --quick |

---

## AUTO MODE — The Engine

### How The Loop Works

Claude Code gives you another turn as long as every response includes a tool call.
**Text-only = loop dies.** This is the fundamental mechanic.

**Therefore: in auto mode, EVERY response includes at least one tool call.**

### The Loop (Token-Optimized)

```
repeat {
  // 1. READ STATE (~200 tokens)
  Read .planning/STATE.md frontmatter

  // 2. CLASSIFY (~50 tokens)
  Agent(model: "haiku", prompt: "Classify: goal, files, lines, type → JSON")
  → { complexity, model, atc_tier, deliberate }

  // 3. SELECT CONTEXT (~100 tokens)
  Agent(model: "haiku", prompt: "Select context: goal, files → brv_queries, file_reads")
  → { brv_queries, file_reads, scripts_to_check }

  // 4. QUERY BYTEROVER (~200-600 tokens)
  brv-query for each query → relevant decisions, patterns, scripts

  // 5. COMPOSE PROMPT (~500 tokens)
  Build agent prompt: compressed plan + overlay + brv results

  // 6. DISPATCH
  Agent(model: "{from classifier}", prompt: "{composed}")
  → Structured report (<300 words)

  // 7. PROCESS RESULT
  Parse: FILES_CHANGED, VERIFICATION, DEVIATIONS, BLOCKERS, SCRIPTS_CREATED, ONE_LINER

  // 8. CURATE LEARNINGS
  If SCRIPTS_CREATED → brv-curate to scripts/
  If DEVIATIONS contain new patterns → brv-curate
  If verifier found anti-patterns → brv-curate

  // 9. UPDATE STATE
  Update STATE.md progress
  Log to .planning/metrics/token-log.jsonl

  // 10. GIT COMMIT (NEVER skip)
  git add {specific files}
  git commit -m "feat({phase}-{plan}): {ONE_LINER}"

  // 11. LOOP
  Read STATE.md → tool call → loop continues
}
```

### The Golden Rule

**ALWAYS chain the next action as a tool call.**
- WRONG: "Phase 27 complete!" (text-only → loop dies)
- RIGHT: "Phase 27 complete" + `[Read .planning/STATE.md]` (loop continues)

### Exit Conditions (ONLY these 4)

1. **All phases complete** → text-only: "All phases done."
2. **Context >70%** → write checkpoint FIRST, then text-only stop
3. **Blocker** → needs human decision, stop and explain
4. **User says stop** → write checkpoint, stop

**Nothing else is a valid exit.** Not phase boundaries. Not milestone boundaries.
Not "context is heavy from setup." ONLY these 4.

### Dispatch Rules (first match wins)

| # | Condition | Action | Agent | Model |
|---|-----------|--------|-------|-------|
| 1 | Phase not discussed | Suggest /gsd-discuss-phase | — | — |
| 2 | Phase needs RESEARCH.md | Dispatch researcher | gsd-phase-researcher | sonnet |
| 3 | Phase needs PLAN.md | Dispatch planner | gsd-planner | sonnet |
| 4 | Plans need checking | Dispatch checker | gsd-plan-checker | sonnet |
| 5 | Pending tasks exist | Dispatch executor | gsd-executor | sonnet |
| 6 | All plans executed | Dispatch verifier | gsd-verifier | sonnet |
| 7 | Verification passed | Mark complete, advance | orchestrator | — |
| 8 | Verification failed | Dispatch planner --gaps | gsd-planner | sonnet |
| 9 | All phases complete | Exit loop | — | — |

### Model Routing

| Role | Model | Why |
|------|-------|-----|
| Orchestrator (you) | Opus | Judgment, dispatch, synthesis |
| Classifier | Haiku | 50-token classification |
| Context selector | Haiku | Pick relevant brv-queries |
| All execution agents | Sonnet | Detailed plans make Sonnet sufficient |

### Sub-Agent Prompt Composition

Every sub-agent prompt includes:
1. **Compressed task plan** (XML format, ~800 tokens)
2. **Overlay** (efficiency rules + report format, ~80 tokens)
3. **ByteRover results** (decisions, patterns, scripts, ~400-600 tokens)
4. **files_to_read block** (minimal, only what's needed)

Total prompt budget: <1,500 tokens. If over, trim file_reads first.

### Sub-Agent Report Format

Every agent returns EXACTLY:
```
FILES_CHANGED: path (created|modified)
VERIFICATION: `cmd` → exit N ✓|✗
DEVIATIONS: [Rule N] description | none
BLOCKERS: description | none
SCRIPTS_CREATED: path | purpose | interface | none
ONE_LINER: substantive summary
```
Max 300 words. No intro. No recap.

### Checkpoint Protocol

When context >70% or user says pause:

Write `.planning/ORCHESTRATOR-CHECKPOINT.md`:
```yaml
---
created_at: {ISO}
active_milestone: {version}
active_phase: {N}
last_completed: "plan {N-P}"
next_unit: "plan {N-P}"
phase_state: "{state}"
units_this_session: {N}
---
```

Then commit checkpoint and STOP.

Next session: step 1 catches this → enters loop at `next_unit`.

### Commit Discipline

- `feat({phase}-{plan}): {one-liner}` — task code
- `docs({phase}): complete phase summary` — phase docs
- `chore: update STATE.md` — state files
- **Commit after EVERY unit. Never batch. Never skip. Never amend.**
- Stage specific files by name. Never `git add -A` or `git add .`

### Token Efficiency Rules

- Read STATE.md **frontmatter only** (offset 0, limit 30) — not full file
- Query ByteRover instead of loading full .md files
- Sub-agent reports: 300 words max
- Plans: compressed XML (~800 tokens, not ~2,000)
- Haiku for classification (~50 tokens), not Opus
- Log all token usage to `.planning/metrics/token-log.jsonl`
- Script reuse: query before creating new utilities

### ByteRover Integration

- `brv-query "{terms}"` — retrieve relevant knowledge (~200 tokens per result)
- `brv-curate "{content}"` — store new patterns, decisions, scripts
- Query BEFORE dispatching (inject results into agent prompt)
- Curate AFTER processing (capture learnings from agent report)
- Scripts: always check `brv-query "scripts {purpose}"` before creating new ones
