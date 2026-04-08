---
title: Model Routing Rules
tags: [model, routing, opus, sonnet, haiku, cost]
keywords: [model, opus, sonnet, haiku, routing, classification, budget]
related:
  - "patterns/token-efficiency-expertise"
importance: 90
maturity: core
---

## Raw Concept

Right-size every agent call. Opus for judgment/synthesis, Sonnet for execution/planning,
Haiku for classification/tagging. 5-20x cost savings on subtasks.

## Narrative

### Routing Table
| Role | Model | Cost | When |
|------|-------|------|------|
| Orchestrator | Opus | 1x | Always — lean state machine |
| CEO deliberation | Opus | 1x | /gsd-deliberate only |
| Board members (4) | Sonnet | 0.2x ea | /gsd-deliberate only |
| Researcher | Sonnet | 0.2x | Phase research |
| Planner | Sonnet | 0.2x | Plan creation |
| Plan checker | Sonnet | 0.2x | Plan verification |
| Executor | Sonnet | 0.2x | Code implementation |
| Verifier | Sonnet | 0.2x | Phase verification |
| Code reviewer | Sonnet | 0.2x | Quality review |
| Classifier | Haiku | 0.05x | Every dispatch |
| Context selector | Haiku | 0.05x | Every dispatch |
| Commit message | Haiku | 0.05x | Optional |
| Stuck detector | Haiku | 0.05x | Hook-based |

### Decision Rules
- If task is classification/routing/tagging → Haiku
- If task is implementation/analysis/planning → Sonnet
- If task is synthesis/judgment/orchestration → Opus
- Never use Opus for work Sonnet can handle
- Never use Sonnet for work Haiku can handle
- Classifier agent determines model for each dispatch

## Facts

- category: convention
  statement: Orchestrator is always Opus — it makes dispatch decisions
- category: convention
  statement: Execution agents are always Sonnet — detailed plans reduce need for Opus
- category: convention
  statement: Classification/tagging is always Haiku — 0.05x cost ratio
- category: convention
  statement: Right-sizing models cuts costs 5-20x with zero quality trade-off
