# Project Research Summary

**Project:** Super GSD Autonomous Orchestrator Framework
**Researched:** 2026-04-08
**Confidence:** HIGH

## 1. Stack — Zero New Dependencies

No npm packages needed. Everything uses Node.js built-ins. Model routing is config-driven. BM25 search is custom-built. Checkpoint uses `fs`. Distribution is raw file copy.

**Do NOT add:** langchain, llamaindex, wink-bm25, better-sqlite3, express, webpack, dotenv.

## 2. Features — Moat Is Already Built

**Table stakes (covered):** Multi-step execution, file ops, shell, session continuity, pause/resume, structured output, progress visibility, token tracking.

**Differentiators (our moat):** Token-aware context selection, multi-agent deliberation, model routing, BM25 local search, ATC quality gates. No competitor has all of these.

**Partial:** Stuck-detector auto-recovery + Overwatcher anomaly alerting need completion.

**Anti-features (avoid):** GUI editor, cloud execution, PR management UI, monolithic agent, background daemon, custom vector DB.

## 3. Architecture — 4 Bounded Modifications to GSD 1.0

Modify: model-profiles.cjs, config.cjs, agent-contracts.md, gsd-tools.cjs (add `metrics append`). Use `// SUPER-GSD-START/END` patch markers. Everything else is additive.

**Critical:** Handle `@file:` IPC prefix from gsd-tools.cjs. Single-committer pattern (agents write files, orchestrator commits).

## 4. Top Pitfalls

1. **Context accumulation** (CRITICAL) — cap 5 reports, compress completed to one-liners
2. **Windows path contamination** (CRITICAL) — normalize at every hook entry
3. **Checkpoint corruption** (HIGH) — atomic write via .tmp + mv
4. **Model routing mismatch** (HIGH) — complexity floor: files>3 OR lines>100 escalates
5. **BM25 staleness** (MEDIUM) — auto-rebuild after writes
6. **Hook timeout cascade** (MEDIUM) — keep hooks under 200ms
7. **Deliberation deadlock** (MEDIUM) — 3-round hard cap in template
8. **Parallel git conflicts** (MEDIUM) — single-committer enforced

## 5. Key Recommendations

1. Fix paths + token tracking in Phase 1 — everything depends on it
2. Single-committer is non-negotiable — agents write, orchestrator commits
3. Protect the routing moat — don't trade multi-agent for monolithic
4. Termination conditions in templates, not prompts
5. Patch GSD 1.0, never fork it — marker blocks for idempotent upgrades

## Build Order

1. Token Foundation + Hook Wiring
2. Memory Layer
3. Orchestrator Engine
4. ATC Quality Gate
5. Multi-Agent Deliberation
6. Overwatcher + Stuck-Detector Completion
7. Integration Testing + Install Script
