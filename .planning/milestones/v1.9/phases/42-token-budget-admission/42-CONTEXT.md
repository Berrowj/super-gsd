---
phase: 42
name: Token Budget Admission
milestone: v1.9
depends_on: [41]
unblocks: [45, 47, 50, 51]
---

# Phase 42 Context

Goal: make token bloat visible and governable.

Implement `token-waste/check.cjs`, first-pass role budgets, cache-read ratio
checks, and phase/milestone close integration. Budget breaches should degrade
or reroute; they should not silently burn tokens.

