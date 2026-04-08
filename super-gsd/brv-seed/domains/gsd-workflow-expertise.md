---
title: GSD Workflow Expertise
tags: [gsd, workflow, orchestration, patterns]
keywords: [phase, plan, execute, verify, autonomous, dispatch]
importance: 90
maturity: core
---

## Raw Concept

GSD workflow patterns proven across 65+ phases and 318+ plans. Core loop:
discuss → plan → execute → verify → ship. Each phase produces CONTEXT.md,
RESEARCH.md, PLAN.md, SUMMARY.md, VERIFICATION.md.

## Narrative

### Execution Patterns
- Atomic commits per task, never batch
- Wave-based parallel execution (wave 1 completes before wave 2 starts)
- Fresh context per sub-agent — orchestrator stays lean
- Tool-call chaining keeps auto loop alive (text-only = loop dies)
- Checkpoint at 70% context — write state, stop, resume next session

### Planning Patterns
- CONTEXT.md locks user decisions — planner MUST follow
- Plans are prompts, not documents — compressed XML for token efficiency
- Goal-backward planning: start from outcome, work backwards to tasks
- 2-3 tasks per plan, each fits in one context window
- must_haves section is contract between planner and verifier

### Verification Patterns
- Task completion != goal achievement — verify outcomes not task checkboxes
- 4-level artifact check: exists → substantive → wired → data flows
- Don't trust SUMMARY claims — verify against actual codebase
- Structured gaps in YAML frontmatter for gap closure planning

### Anti-Patterns
- Loading full ROADMAP/STATE every loop iteration (waste)
- Sub-agent reports >300 words (context bloat)
- Orchestrator doing heavy work (should dispatch)
- Stopping between slices/phases (premature exit)
- Amending commits instead of creating new ones

## Facts

- category: convention
  statement: Every sub-agent report must be under 300 words in structured format
- category: convention
  statement: Orchestrator uses Opus, execution agents use Sonnet, classifiers use Haiku
- category: convention
  statement: Scripts created by agents are curated into ByteRover for reuse
- category: convention
  statement: Token usage is logged per unit to .planning/metrics/token-log.jsonl
