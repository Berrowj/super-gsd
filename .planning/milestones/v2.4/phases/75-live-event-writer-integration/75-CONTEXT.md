---
phase: 75
phase_name: Live Event Writer Integration
milestone: v2.4
created: 2026-04-29
status: in-progress
deviation_from_standard: integration phase (multi-file; FULL tier; READ-ONLY invariant on read path)
---

# Phase 75 -- Live Event Writer Integration (CONTEXT)

## Goal

Wire the Phase 74 `orchestrator-live-writer.cjs` into the orchestrator's
existing dispatch + log emit points so `.planning/ORCHESTRATOR-LIVE.jsonl`
gets representative events on a live run. Preserve legacy ledgers.

## Locked Scope (D75.1-D75.5)

- D75.1: Add a `--emit <json-string>` CLI flag to the writer so any
  Bash/PowerShell caller can emit an event without requiring Node lib
  imports.
- D75.2: Find existing orchestrator log-emit points (sgsd-activity-logger,
  cockpit-shell stream writers, sgsd-orchestrate SKILL.md prose). For
  each that has a clear event-equivalent, ADD a parallel call to
  `appendEvent` while leaving the legacy write intact.
- D75.3: Add a parser library `super-gsd/scripts/lib/orchestrator-live-reader.cjs`
  that tails the stream and returns parsed events. READ-ONLY invariant:
  reader never writes / appends / unlinks.
- D75.4: Self-test emits 10+ representative events of different types,
  parses them back, asserts shape conformance + counts.
- D75.5: Update SKILL.md (sgsd-orchestrate) to document conceptual
  wire-in points: when in the loop should each event type fire.

## Inputs Consumed

- super-gsd/scripts/lib/orchestrator-live-writer.cjs (Phase 74)
- super-gsd/docs/ORCHESTRATOR-LIVE-EVENTS.md (Phase 74 contract)
- super-gsd/skills/sgsd-orchestrate/SKILL.md (orchestrator skill — wire-in target)
- existing .jsonl loggers under super-gsd/scripts/

## Outputs

- super-gsd/scripts/lib/orchestrator-live-writer.cjs (UPDATED — `--emit` CLI added)
- super-gsd/scripts/lib/orchestrator-live-reader.cjs (NEW — READ-ONLY parser)
- super-gsd/skills/sgsd-orchestrate/SKILL.md (UPDATED — wire-in section added; non-destructive insert)
- 5 Phase 75 standard artifacts

## Acceptance

1. `node super-gsd/scripts/lib/orchestrator-live-writer.cjs --emit '{"type":"phase_started","data":{"phase":"75"},"phase":"75"}'` exits 0; appends row.
2. `node super-gsd/scripts/lib/orchestrator-live-reader.cjs --self-test` exits 0 (read 10+ representative events, parse, assert).
3. Reader READ-ONLY invariant: scan source for fs-write tokens; ZERO hits.
4. `git status --short` before/after a real `--emit` test on a temp dir is byte-identical (re: actual repo state) — test in a temp dir to avoid polluting live `.planning/ORCHESTRATOR-LIVE.jsonl`.
5. SKILL.md gains a "Live Event Wire-In Points" section listing the 16 event types and where in the loop they fire.
6. Bad event JSON via `--emit` doesn't crash; emits structured error.
