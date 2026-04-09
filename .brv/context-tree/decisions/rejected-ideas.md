---
title: Rejected Ideas — What NOT To Build
tags: [decision, rejected, anti-feature, scope]
keywords: [backroom, constraint engine, graph engine, python, rejected]
importance: 70
maturity: core
---

## Explicitly Rejected

These were evaluated through VTP idea pipeline and rejected with evidence:

### Backroom/Private Channels (Dumb Score: 45)
O(n^2) complexity between agents. PI's creator didn't implement either.
Unproven value vs cost. Board members already see all positions in Round 2.

### Constraint Engine (No Primitives)
Claude Code has zero per-agent token tracking, no cost metering, no budget enforcement.
You cannot say "stop after $3." Workaround: prompt-level soft limits ("under 500 words").

### Full Graph Execution Engine
Sequential works. /gsd-insert-phase handles revisits. Building a full Petri net
executor is overengineering for the problem space.

### LangGraph Python Library Integration
Wrong ecosystem (Python vs Node/TS). Adopt the patterns (cyclic graphs, shared state,
hub-and-spoke), not the library.

### GUI Code Editor
Wrong layer — Super GSD is a CLI framework, not an IDE.

### Cloud Execution Environment
Opaque, expensive, lock-in. Local execution via Claude Code is correct.

### Custom Vector Database
BM25 sufficient. No evidence semantic search adds value for code knowledge.

## Source
SESSION-DEBRIEF-2026-04-08-09.md — PI meeting idea #6 rejected, LangGraph idea #4 modified
