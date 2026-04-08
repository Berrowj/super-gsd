---
title: Deliberation Expertise - CEO/Board Decisions
tags: [deliberation, decision, board, ceo, debate]
keywords: [deliberate, brief, memo, architect, pragmatist, contrarian, moonshot]
related:
  - "patterns/orchestrator-patterns"
  - "decisions/"
importance: 75
maturity: validated
---

## Raw Concept

Multi-agent adversarial debate for high-stakes decisions. CEO orchestrates 4 board
members (Architect, Pragmatist, Contrarian, Moonshot). Brief in → positions → optional
rebuttals → Decision Memo out.

## Narrative

### When to Deliberate
- New milestone decisions
- Architecture changes affecting 3+ phases
- Unresolved tensions in CONTEXT.md
- User explicitly calls /gsd-deliberate

### When NOT to Deliberate
- Individual phase planning (normal planner handles this)
- Bug fixes, small features
- Execution-level decisions

### Board Roles
- Architect: "Can it be built? What breaks at scale?"
- Pragmatist: "What actually ships? What's the 80% version?"
- Contrarian: "What assumption hasn't been tested?"
- Moonshot: "What if we're thinking too small?"

### Process
1. Validate brief (Situation, Stakes, Constraints, Key Questions)
2. Query ByteRover for relevant expertise
3. Spawn 4 board members in parallel (Sonnet, max 400 words each)
4. Evaluate: need Round 2? (substantive disagreement or unanimity = suspicious)
5. If Round 2: re-spawn with all positions visible
6. CEO synthesizes Decision Memo
7. Curate decision to ByteRover

### Token Budget
- 1 round: ~10,400 tokens
- 2 rounds: ~16,400 tokens
- Haiku gate (~100 tokens) saves 10K+ when deliberation isn't needed

## Facts

- category: convention
  statement: Unanimous board is suspicious — probe for groupthink
- category: convention
  statement: Deliberation only for high-stakes decisions, not per-phase work
- category: convention
  statement: Board members use Sonnet, CEO uses Opus
