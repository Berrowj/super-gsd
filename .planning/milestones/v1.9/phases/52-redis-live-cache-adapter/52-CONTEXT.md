---
phase: 52
name: Redis Live Cache Adapter
milestone: v1.9
depends_on: [46, 50, 51]
unblocks: []
---

# Phase 52 Context

Goal: add Redis only as an optional disposable projection.

Redis may store live cockpit state, hot packets, provider canary cache, active
markers, and short-lived counters. It must not own decisions, debt, evidence,
or capsules. `FLUSHDB` must be safe.

