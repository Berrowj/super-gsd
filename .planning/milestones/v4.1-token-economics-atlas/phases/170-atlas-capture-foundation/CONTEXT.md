---
phase: "170"
slug: atlas-capture-foundation
milestone: v4.1-token-economics-atlas
status: ACTIVE
activated: 2026-09-07
design: .planning/analyses/2026-09-03-sgsd-token-economics-atlas-design.md
---

# P170 Atlas Capture Foundation

Build the passive, content-free collection substrate approved in the Atlas
design. This phase establishes a versioned event envelope, bounded append-only
storage, an OTLP-compatible localhost receiver with health and Prometheus
projections, explicit lifecycle commands, and fail-open launcher attachment.

It does not yet correlate Codex handoffs or produce the full weekly Atlas. Those
are Phases 171 and 172. The phase is complete only when a clean-room fixture can
enable collection, ingest a content-free Claude event, expose health/metrics,
survive duplicate/malformed input and sidecar failure, then disable cleanly
without changing the launched Claude argv or SGSD topology.

Known baseline defects outside scope: Chronicle SAC-P116-10/11 and
STRUCT-P116-22 fail on Windows-to-WSL path conversion; cockpit SAC-P142-03 is the
already-documented rationale scalar defect. Neither may be relabelled as an
Atlas regression or fixed in this phase.
