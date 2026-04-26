---
phase: 26
title: Cockpit Operator Question Contract
type: docs-only
created: 2026-04-26
discuss_decisions: [26.1, 26.2, 26.3]
unblocks: [27, 28, 29, 30]
mode: gsd-discuss-phase --auto (locked decisions consumed, no operator Q&A)
controlling_principle: Autonomy continues; evidence tells the truth.
---

# Phase 26 — Operator Question Contract (CONTEXT)

## Goal

Define a contract that names the eight operator questions the cockpit must
answer, locks the closed status vocabulary, locks the freshness boundaries
(no gap), and specifies the repair-path discipline (mandatory text +
optional safe `repair_command`). Phases 27–30 consume this contract.

This is **docs-only**. No code commits. No new telemetry stream.

## What's locked (from DISCUSS.md)

- **26.1** 8 closed states: `active, waiting, blocked, reviewing, timed-out,
  stale, complete, unavailable`. No collapse of `unavailable`↔`stale`.
- **26.2** Freshness boundaries (no gap): generic source `<30s = active`,
  `30–599s = waiting`, `≥600s = stale`. Codex `<120s active(running)`,
  `≥3600s stale`. Audit-log/backlog `<24h fresh, ≥24h stale`.
- **26.3** `repair_instruction:` (text) mandatory. `repair_command:`
  optional only when **deterministic AND safe AND local AND auth-free**.
  Disallowed: `git push`, `rm -rf`, `curl/wget`, token-bearing commands,
  `--force` flags. Schema-load checker (Phase 33) enforces.

## What the planner must produce

The plan must land **one** deliverable: `26-01-operator-question-contract-PLAN.md`,
which is itself the operator-readable contract document. Specifically:

1. **Q1–Q8 enumeration** — name, one-line description, primary source(s),
   applicable status vocabulary, freshness rule, repair_instruction (and
   repair_command when 26.3 predicate passes).
2. **No-gap freshness table** — generic + Codex + audit-log/backlog rows.
3. **Repair-path discipline** — the 4-AND predicate, the disallowed-pattern
   list, and a "text-first" rule.
4. **Architectural responsibility map** — Mission Strip vs. existing panes
   (per RESEARCH §7).
5. **Acceptance criteria** — runnable checks confirming the contract is
   complete and unambiguous.

## Inputs the planner consumes

- `26-RESEARCH.md` (this folder) — Q1–Q8 source mapping, gaps, vocabulary
  application, freshness no-gap proof, repair predicate, architectural map
- `.planning/discussions/2026-04-26-mass-discuss.md` — locked decisions
  (verbatim citation required in PLAN)
- `.planning/milestones/COCKPIT-2.0-SCOPE.md` — operator questions verbatim
  source (must be cited, not duplicated)
- `.planning/milestones/v1.6/EXISTING-SURFACE-AUDIT.md` — current coverage
  table

## Open derivation calls (low risk; planner decides without re-asking operator)

Per RESEARCH §8 — recommendations are pre-approved:

1. **Q3 unlock when current phase is last in milestone** → use "milestone close"
   as unlock string. Don't cross-read into next milestone.
2. **Q5 fallback when phase-stamp absent (pre-Phase-28 rows)** → render
   `unavailable`. Do not path-derive (DISCUSS 27.2 forbids).
3. **Q8 rule-match precedence** → first-match-wins, mirrors CLAUDE.md
   "Dispatch Rules (first match wins)" semantics.

## Standard-workflow deviations (Phase 26 docs-only)

Per ROADMAP-AGENT.md Phase 26 deviation block:

- Step 1 (`gsd-pattern-mapper`) — **skipped** (no code patterns to map)
- Step 7 (`sgsd-muda-audit`) — **skipped** (MUDA trigger predicate not met
  for docs-only phase: no `diff_lines ≥ 100` and no `phase_type ∈ {code}`)
- Step 6 (`gsd-executor`) — produces docs only. **No per-dispatch ATC fires**
  (no code commits in this phase)

All other steps remain mandatory: planner, plan-checker, verifier,
phase-level ATC (Codex+Claude — Codex degrades to Claude-only per
MILESTONE-READINESS.md DEGRADED-PATH), curate.

## Acceptance handoff

When the planner is done:
- `26-01-operator-question-contract-PLAN.md` exists
- Plan is goal-backward consistent (plan-checker reviews)
- Plan content satisfies REQ-26-Q1..Q8 + REQ-26-VOCAB + REQ-26-FRESH +
  REQ-26-REPAIR (per RESEARCH "Phase Requirements" table)

Phase verification (Step 8) then asserts the deliverable's content matches
DISCUSS 26.1/26.2/26.3 and the no-gap proof holds.

## Status taxonomy at phase close (per controlling principle)

- `PASS` if every standard acceptance check passes AND status-consistency
  check passes AND zero CRIT-BACKLOG rows tag this phase
- `PASS-WITH-DEFERRED-N` if a phase-level ATC CRIT remains unresolved after
  3 fix attempts, OR if Codex is unavailable for the dual-provider review
  (per Patch 4 Live-or-Local rule, MILESTONE-READINESS notes Codex auth FAIL
  → Phase 26 will likely close as `PASS-WITH-DEFERRED-1` with a
  `verifier_fail` row reading "live Codex auth unavailable; fallback used")
- `CANDIDATE-WITH-DEBT` only if `edge_guard_miss` lands on Step 9 emit
  (unlikely for docs-only phase)

## Kill / defer conditions

- **Defer** if planner finds Q1–Q8 cannot be answered from existing 13
  streams. RESEARCH says no — none expected.
- **Hard stop** only if operator approval needed for an unresolved DISCUSS
  decision. None foreseen — DISCUSS 26.1/26.2/26.3 are exhaustive.
