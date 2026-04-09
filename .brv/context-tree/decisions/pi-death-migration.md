---
title: PI Death & Migration Decision
tags: [decision, pi, oauth, migration, architecture]
keywords: [pi, oauth, death, migration, claude code, gsd 2.0, harness]
importance: 85
maturity: core
---

## Decision

Anthropic disabled OAuth, killing PI agent harness and GSD 2.0. Decision: replicate PI's
strategic capabilities using Claude Code's native primitives (Agent tool, hooks, skills, memory).

## What Died
- PI custom runtime (system prompt overwrite, custom directories, constraint engine)
- GSD 2.0 (built on PI — TypeScript app, SQLite state, headless auto-restart)
- Per-agent expertise persistence, cost/budget constraints, time limits

## What Survived
- GSD 1.0 (68 skills, 24 agents, gsd-tools.cjs)
- Claude Code Agent tool (spawn subagents, model selection, parallel execution)
- Hooks, memory, skills, CLAUDE.md

## The Fundamental Constraint
PI was a custom runtime that controlled everything. Claude Code is an opinionated runtime
you customize at the edges. The pattern is always: orchestrator-driven, spawn-collect-synthesize,
file-system coordinated, prompt-customized.

## Source
SESSION-DEBRIEF-2026-04-08-09.md — 2 VTP meetings processed, 15 ideas developed, 1 rejected
