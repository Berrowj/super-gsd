---
phase: 45
name: Context Packet Builder
milestone: v1.9
depends_on: [42, 43, 44]
unblocks: [46, 47, 48, 49, 50, 51]
---

# Phase 45 Context

Goal: replace raw inherited context with role-specific packets.

Build `context-packet/build.cjs` for researcher, planner, executor, verifier,
reviewer, and cockpit modes. Packets use capsules, legal registry, active debt,
evidence requirements, and critical bypass before raw files.

