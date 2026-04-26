---
phase: 27
title: Cockpit Data Source + Objective Tree Audit
type: docs-mostly
created: 2026-04-26
discuss_decisions: [27.1, 27.2]
unblocks: [28, 29]
mode: gsd-discuss-phase --auto
controlling_principle: Autonomy continues; evidence tells the truth.
---

# Phase 27 — Data Source + Objective Tree (CONTEXT)

## Goal

Prove every Q1–Q8 lane resolves to existing telemetry. Confirm DISCUSS 27.1
(no new `cockpit-state.json`). Encode the orchestrator-side `phase`
stamping requirement (DISCUSS 27.2) for Phase 28 to implement. Specify the
objective tree schema (derived, not stored).

This is **docs-mostly**. The plan is itself the deliverable contract.
Phase 28 will land the actual stamper code change.

## What's locked (from DISCUSS.md)

- **27.1** No new `cockpit-state.json`. Cockpit derives state from existing 13
  metric streams every refresh.
- **27.2** Orchestrator stamps `phase` field canonically into every
  `activity-log.jsonl` row. Path-derivation removed.

## Important finding from RESEARCH (carry into PLAN)

The existing stamper at `super-gsd/hooks/sgsd-activity-logger.js` has a
**broken regex** that matches `by_phase:` line in STATE.md and writes
literal `"\"26\":"` as the phase value. Of 8253 rows, only 2526 carry
non-null `phase`; many of those are corrupt. **The stamper is not missing
— it's broken.**

Phase 27 documents this in its PLAN; **Phase 28 fixes it** (env-var primary
+ anchored YAML fallback + `^[0-9]+$` validation guard, per RESEARCH §3).

## What the planner must produce

ONE plan: `27-01-cockpit-data-contract-PLAN.md`. Body must contain:

1. **Data source matrix** — table mapping each Q1–Q8 to existing source(s)
   with file paths, schemas, writers, readers (cite RESEARCH §1, §2).
2. **`phase` stamping spec for Phase 28** — exact change required to
   `sgsd-activity-logger.js`: source of phase ID (env var preferred, STATE
   frontmatter as anchored fallback), validation regex `^[0-9]+$`, behavior
   when no phase resolvable (write `phase: null`, do not invent).
3. **Objective tree schema** — milestone → phase → objective →
   {gate, agent, artifact, blocker, unlock} with stable IDs per node type
   (RESEARCH proposes 9 nodes; reconcile with ROADMAP-AGENT 8-node spec
   below).
4. **Cockpit derivation rules** — refresh-on-demand from STATE.md + phase
   folders + 13 metric streams + CRIT-BACKLOG.
5. **Acceptance criteria** — runnable checks the verifier executes.

## Open derivation calls (planner locks without operator re-ask)

Per RESEARCH:

1. **Tree node count** — RESEARCH proposes 9 nodes (added `unlock`);
   ROADMAP-AGENT lists 8. **Recommendation: 9 nodes** — `unlock` is
   needed for Q3, can't be derived from the other 8. Lock as recommendation.
2. **Activity-log backfill** — corrupt rows from existing broken stamper.
   **Recommendation: NO backfill** — additive-only per controlling
   principle. Phase 28 fixes forward; old rows surface as `phase: null`
   (or corrupt) in cockpit Q5 lane → render `unavailable`.
3. **Stamper failure mode** — when stamper cannot resolve phase ID.
   **Recommendation: write `phase: null`** — never invent. Cockpit Q5
   downgrades to `unavailable` for this run.

## Standard-workflow deviations

Per ROADMAP-AGENT.md Phase 27 deviation block:
- Step 1 (`gsd-pattern-mapper`) — skipped (docs-mostly; Phase 28 owns code patterns)
- Step 7 (`sgsd-muda-audit`) — skipped (no diff_lines threshold met)
- Step 6 executor — produces docs only (the stamper code change is
  scoped to Phase 28's executor, NOT 27's)

All other steps mandatory.

## Status taxonomy at phase close

- `PASS` if zero new backlog rows tagged to phase 27
- `PASS-WITH-DEFERRED-N` if Codex unavailable at Step 9 (anticipated
  per readiness manifest — same pattern as Phase 26)
- `CANDIDATE-WITH-DEBT` only if edge-guard miss

## Kill / defer conditions

- **Defer** if any Q1–Q8 lane requires a new state file → would invalidate
  DISCUSS 27.1; escalate to operator. RESEARCH says all 8 resolve; not expected.
- **Hard stop** only if operator approval needed for a tree-schema change
  beyond DISCUSS scope. None foreseen.
