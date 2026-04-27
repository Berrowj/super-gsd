---
phase: 31
title: Canonical Command Envelope
type: docs+schema
created: 2026-04-27
discuss_decisions: [31=A]
unblocks: [32, 33, 34, 35]
mode: gsd-discuss-phase --auto
---

# Phase 31 — Canonical Command Envelope (CONTEXT)

## Goal

Land the JSON schema + registry for the FIFTH contract level (command-output),
reconciled against the 4 existing contracts. Phase 31 itself is docs+schema —
the schema and registry feed Phases 32-35 implementations.

## Locked decision (DISCUSS 31=A)

New `envelope-v1` schema, separate file from `code-reviewer-v1`,
`review-providers-v1`, `handover-contract-v2`, and `plan-schema-v2`.
Different abstraction level (command-output, not agent-report or plan-shape).

## What the planner must produce

ONE plan: `31-01-canonical-envelope-PLAN.md` with deliverable contract:

1. **JSON Schema** at `super-gsd/templates/command-envelope-v1.json` — fields:
   `envelope_version` (=1), `command`, `status` (pass|warn|block|error),
   `reason_codes[]`, `artifacts[]`, `evidence[]`, `next_action`, `risk`
   (low|medium|high), `duration_ms`, `run_id`, `phase`, `milestone`. JSON Schema
   draft-07 compatible. Each field's purpose + 1-line rationale.
2. **Registry** at `super-gsd/registry/command-envelope-v1.yaml` — declares which
   commands emit/are-candidates. ≥5 commands documented per ENV-02:
   - `sgsd-boot` (candidate; v2.1 onboarding)
   - `sgsd-muda-audit` (candidate; ~60% fit, migration path documented)
   - `sgsd-readiness` (candidate; ~95% fit — closest existing match)
   - `sgsd-codex-exec` (NOT migrated — uses code-reviewer-v1 at different level; provenance rows are envelope-shaped)
   - `sgsd-system-map` (Phase 35 implementation will emit envelope)
3. **Standard reason_codes** — closed initial vocabulary per RESEARCH §4.
4. **Mission Strip read-contract** — how the cockpit (Phase 28) consumes envelope rows.
5. **Acceptance criteria** runnable: schema parses; registry yaml-validates; 5 commands enumerated; reconciliation note explicit ("does not touch existing 4 contracts").

## Open derivation calls (locked recommendations)

Per RESEARCH:
1. **`reason_codes` extensibility**: closed initial vocab + extension protocol (add via Phase 32+). Lock as recommendation.
2. **`run_id` format**: ISO timestamp + 4-char random hex (e.g. `2026-04-27T07:30:00Z-a1b2`). Lock.
3. **Per-command emit-vs-candidate distinction**: `emits_envelope: true | candidate | false`. Lock.

## Standard workflow

Phase 31 is docs+schema. Standard workflow but:
- Step 1 (pattern-mapper): SKIPPED — schema/docs phase
- Step 7 (MUDA): SKIPPED — no diff_lines threshold met (schema files only)
- Step 6 (executor): produces docs+schema files (no production code)
- Step 9 (phase-level ATC): runs (Codex+Claude both — both available per readiness)

## Status taxonomy at close (anticipated)

`PASS` if all checks green. With Codex now behaviorally available, no
"Codex unavailable" deferrals expected. Real WARNs from dual-provider review
will be in-loop fixed or backlogged honestly.

## Kill / defer conditions

- Defer if a 6th contract level emerges that requires its own schema (would expand scope)
- Hard stop if any new field would require modifying the 4 existing contracts
