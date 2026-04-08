# Super GSD Framework

## What This Is

A token-efficient, multi-agent autonomous orchestrator built on GSD 1.0.
Combines the best of GSD 1.0 (68 skills, 24 agents), GSD 2.0's orchestrator
patterns (auto loop, checkpoint survival, dispatch rules), and new capabilities
(CEO/Board deliberation, ByteRover memory, model routing, ATC quality gates,
Overwatcher signal maps).

## Core Value

Ship an autonomous framework that any Claude Code Max plan user can install with
one command and immediately start building software — with the AI managing its own
token efficiency, model selection, memory, quality gates, and crash recovery.

## Current Milestone: v1.0 Ship Super GSD Framework

**Goal:** Package the Super GSD orchestrator as a production-ready framework that installs
cleanly, runs autonomously with token efficiency, and provides strategic decision-making
via multi-agent deliberation.

**Target features:**
- Autonomous orchestrator loop with checkpoint survival
- Model routing (Opus/Sonnet/Haiku) across all agent dispatches
- ByteRover memory layer with local API-free query engine
- CEO/Board deliberation system for strategic decisions
- ATC quality gates with Haiku classification
- Overwatcher signal map visualization
- Token tracking and audit system
- One-command installation (`bash install.sh --init-project`)
- GSD 2.0 transition tool for Pi users

**Key constraints:**
- No API keys — everything via Claude Code Max plan OAuth
- Must work on Windows (WSL2), macOS, Linux
- Must not break existing GSD 1.0 skills
- Token efficiency is the load-bearing architectural constraint

## Key Decisions

- D001: Opus orchestrates, Sonnet executes, Haiku classifies
- D002: Compressed XML plans (~800 tokens vs ~2,000 prose)
- D003: Structured 300-word agent reports
- D004: JSONL token logging
- D005: Frontmatter-only reads + brv-query-local
- D006: No API keys — Max plan OAuth only

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-08*
