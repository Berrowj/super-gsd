---
title: Git Commit Discipline
tags: [git, commit, atomic, discipline]
keywords: [commit, git, atomic, never batch, never skip, format]
related:
  - "patterns/orchestrator-patterns"
importance: 90
maturity: core
---

## Raw Concept

Atomic commits after every unit. Never batch. Never skip. Never amend.
Uncommitted work is lost on context reset.

## Narrative

### Commit Timing
- After each task execution: commit code changes
- After each phase completion: commit .planning/ state files
- After each planning artifact: commit PLAN.md, RESEARCH.md, etc.
- NEVER batch multiple units into one commit
- NEVER leave work uncommitted before dispatching next unit

### Commit Format
```
feat({phase}-{plan}): {one-liner}     # task code
docs({phase}): complete phase summary  # phase completion
chore: update STATE.md                 # state files
```

### Rules
- One logical change per commit (atomic)
- Stage specific files by name — never `git add -A` or `git add .`
- Never skip hooks (no `--no-verify`)
- Never amend unless explicitly asked by user

## Facts

- category: convention
  statement: Uncommitted work is lost work — commit after EVERY unit
- category: convention
  statement: Stage files individually, never use git add -A or git add .
