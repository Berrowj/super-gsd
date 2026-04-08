---
title: Orchestrator Patterns - Autonomous Execution
tags: [orchestrator, autonomous, dispatch, loop, checkpoint]
keywords: [auto loop, dispatch, sub-agent, checkpoint, context survival, state machine]
related:
  - "patterns/gsd-workflow-expertise"
  - "anti-patterns/premature-stopping"
importance: 95
maturity: core
---

## Raw Concept

The orchestrator is a lean state machine. It reads state, classifies the next unit,
dispatches a sub-agent, processes the result, commits, and loops. It never does heavy
work itself. Fresh context per sub-agent prevents accumulation.

## Narrative

### The Auto Loop
1. Read STATE.md frontmatter (~200 tokens)
2. Classify next unit via Haiku (~50 tokens)
3. Query ByteRover for relevant context (~100 tokens)
4. Compose sub-agent prompt (~500 tokens)
5. Dispatch sub-agent (Sonnet, fresh context)
6. Process structured report (<300 words)
7. Curate learnings back to ByteRover
8. Update state + git commit
9. Loop (read STATE.md = tool call = loop continues)

### Tool-Call Chaining
The loop persists because every response includes a tool call. Text-only = loop dies.
Pair every status update with the next action: "Task done" + [Read STATE.md].

### Checkpoint Protocol
At 70% context: write ORCHESTRATOR-CHECKPOINT.md with exact resume point.
Next session reads checkpoint, enters loop at next_unit. User just says "continue".

### Dispatch Rules (first match wins)
1. No CONTEXT.md → suggest discuss-phase
2. No RESEARCH.md → dispatch researcher (Sonnet)
3. No PLAN.md → dispatch planner (Sonnet)
4. Plans need checking → dispatch plan-checker (Sonnet)
5. Pending tasks → dispatch executor (Sonnet)
6. All plans done → dispatch verifier (Sonnet)
7. Verification passed → mark complete, advance
8. Verification failed → dispatch planner --gaps

### Exit Conditions (ONLY 4)
1. All phases complete
2. Context >70% (checkpoint first)
3. Blocker needing human decision
4. User says stop/pause

## Facts

- category: convention
  statement: Every orchestrator response must include at least one tool call
- category: convention
  statement: Sub-agent reports are capped at 300 words in structured format
- category: convention
  statement: Checkpoint is written at 70% context, never earlier
- category: convention
  statement: Git commit after EVERY unit — uncommitted work is lost work
- category: convention
  statement: Budget/cost tracking is advisory only — never blocks execution
