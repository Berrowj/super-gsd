---
title: Anti-Pattern - Premature Loop Stopping
tags: [anti-pattern, auto-loop, stopping, exit]
keywords: [stop, pause, premature, exit, loop, checkpoint, boundary]
importance: 92
maturity: core
---

## Raw Concept

The auto loop must be FULLY automatic. Never pause between phases or milestones.
Only stop for the 4 real exit conditions.

## Narrative

### The Anti-Pattern
Claude stops the loop at phase boundaries ("Phase 27 complete! What would you like to do next?")
or writes checkpoints too early ("Context is getting heavy from setup"). Both break autonomy.

### Why It Fails
The entire point of autonomous mode is zero human intervention. Stopping between phases and
asking the user defeats the purpose. "Context is heavy from setup" is not an exit condition.

### What To Do Instead
- Phase complete → read STATE.md (tool call) → dispatch next phase
- Milestone complete → validate → complete → advance → next milestone
- Never write checkpoint unless context is GENUINELY >70% full
- Between units: update state + commit + read state → all as chained tool calls

### Valid Exit Conditions (ONLY these 4)
1. All phases/milestones complete
2. Context >70% full (write checkpoint FIRST, then stop)
3. Blocker requiring human decision
4. User explicitly says stop/pause

## Facts

- category: anti-pattern
  statement: Never stop at phase boundaries — just advance to next phase
- category: anti-pattern
  statement: "Context is heavy from setup" is NOT a valid exit condition
- category: anti-pattern
  statement: Never write checkpoint unless context genuinely exceeds 70%
