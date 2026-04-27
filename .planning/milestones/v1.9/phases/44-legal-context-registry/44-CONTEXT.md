---
phase: 44
name: Legal Context Registry
milestone: v1.9
depends_on: [41]
unblocks: [45, 49, 51]
---

# Phase 44 Context

Goal: prevent invented or stale structural references.

Generate and validate known milestone IDs, phase IDs, gate IDs, agent IDs,
artifact IDs, provider IDs, and status vocabulary. Packet builder and cockpit
must consume this registry instead of trusting free-form generated references.

