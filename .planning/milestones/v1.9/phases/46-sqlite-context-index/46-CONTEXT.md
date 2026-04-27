---
phase: 46
name: SQLite Context Index
milestone: v1.9
depends_on: [43, 45]
unblocks: [49, 52]
---

# Phase 46 Context

Goal: add fast local retrieval without making memory canonical.

Implement a rebuildable SQLite FTS projection over capsules, accepted
decisions, gate definitions, and file summaries. Deleting the DB and rebuilding
must preserve indexed counts and hashes.

