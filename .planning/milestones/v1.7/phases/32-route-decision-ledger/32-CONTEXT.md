---
phase: 32
title: Route Decision Ledger
type: code
created: 2026-04-27
discuss_decisions: [32=A]
unblocks: [35]
mode: gsd-discuss-phase --auto
---

# Phase 32 - Route Decision Ledger (CONTEXT)

## Goal

Land an append-only `.planning/metrics/route-decisions.jsonl` ledger plus
a writer module (`route-ledger.cjs`) that every orchestrator routing
decision can log to. Phase 32 SHIPS one production caller (codex_route
boundary) — the 5 remaining boundary types are pre-declared in the schema
but wired later (no schema-without-consumer violation: codex_route IS the
consumer).

## Locked decision (DISCUSS 32=A)

**Boundary-only**: Phase 32 lands one wire-in (codex_route at SKILL.md
Step 9.5 per-dispatch ATC), not all 6 boundaries. ROUTE-03 specifies
"≥1 boundary in production"; doubling up is gilding. The other 5
boundaries (milestone_promotion, phase_dispatch_first, executor_choice,
gate_skip, handoff_decision) are documented as v1.8+ candidates with
exact file:line wire-in targets pre-identified in 32-RESEARCH.md §1.

## What the planner must produce

ONE plan: `32-01-route-ledger-PLAN.md` with three atomic deliverables:

1. **Lib module** at `super-gsd/scripts/lib/route-ledger.cjs` (~280 LOC):
   - `logRouteDecision({boundary, decision, reason_codes, evidence, phase, milestone, duration_ms, run_id?})` exported function
   - Envelope-v1-wrapped row shape per Phase 31 contract:
     `{envelope_version: 1, ts, command: "logRouteDecision", status, run_id, boundary, decision, reason_codes, artifacts, evidence, next_action, risk, duration_ms, phase, milestone}`
   - JSONL atomic append using `fs.appendFileSync` (single-line, single
     orchestrator process — no locking needed per RESEARCH §6)
   - try/catch wrapping at the public API: writer NEVER throws upward.
     Errors logged to stderr, return false.
   - `--self-test` flag with 12 assertions:
     1. Module loads without throwing
     2. logRouteDecision exported
     3. Boundary enum validated (one of 6)
     4. status enum validated (envelope-v1 6-state)
     5. reason_codes is array of strings
     6. run_id auto-generated when absent (matches envelope-v1 regex)
     7. ts auto-stamped ISO-8601
     8. envelope_version === 1 (immutable)
     9. tmpdir target file gets one append per call
     10. Defensive read parses each row back to a valid envelope
     11. Empty reason_codes permitted (array, not null)
     12. Throwing inside try/catch returns false (does not crash caller)
   - Self-test isolated to `os.tmpdir()` — never touches canonical jsonl

2. **Wire-in** edit to `super-gsd/skills/sgsd-orchestrate/SKILL.md`
   immediately after `appendPerDispatchReviewEvidence(...)` in Step 9.5
   per-dispatch ATC handler. 4-line minimal call wrapped in try/catch.
   Decision factors already in scope: `provider`, `dispatchResult.exit`,
   `dispatchResult.timeout_hit`, `fallbackTriggered`. The orchestrator
   continues regardless of route-ledger success/failure (RESEARCH §8).

3. **Local fallback test** at
   `super-gsd/scripts/lib/route-ledger.test.cjs` (~80 LOC):
   - Imports `logRouteDecision` from production lib (NOT mocked)
   - Constructs 4 dispatchResult shapes covering: success / timeout /
     auth-fail / parse-failure-fallback
   - Calls `logRouteDecision` with each shape, asserts the resulting
     route-decisions.jsonl row matches the expected envelope shape
   - Patch 4 compliant: exercises production code path, no predicate
     mocks.

## Acceptance (runnable, ROUTE-01..04)

- ROUTE-01: `node super-gsd/scripts/lib/route-ledger.cjs --self-test`
  exits 0 (12/12 PASS).
- ROUTE-02: All 6 boundary types in the lib's exported `BOUNDARIES`
  constant: `["milestone_promotion", "phase_dispatch_first",
  "executor_choice", "gate_skip", "codex_route", "handoff_decision"]`.
  Lib accepts only these (validation throws on unknown).
- ROUTE-03: `super-gsd/skills/sgsd-orchestrate/SKILL.md` contains a
  `logRouteDecision({boundary: "codex_route", ...})` call at the cited
  line range (Step 9.5 post-`appendPerDispatchReviewEvidence`).
- ROUTE-04: Each row contains required fields: phase, milestone,
  reason_codes, status (outcome), evidence (linked artifacts).
- Live-or-local: deterministic local fallback test exercises the same
  lib helper the orchestrator imports; produces 4 canonical envelope
  rows in tmpdir; provider-unavailable handled by status=fail +
  reason_codes=[provider_unavailable, codex_fallback_triggered].

## Open derivation calls

NONE — all 16 calls locked in 32-RESEARCH.md §9.1-9.16:
- 9.1 envelope-shaped (LOCKED)
- 9.2 codex_route as the wire-in (LOCKED)
- 9.3 try/catch wrap (LOCKED)
- 9.4 stderr-only error logging (LOCKED)
- 9.5 random hex run_id pattern (LOCKED)
- 9.6 BOUNDARIES exported as readonly const (LOCKED)
- 9.7 status from exit/timeout mapping (LOCKED)
- 9.8 reason_codes array (LOCKED)
- 9.9 evidence array (LOCKED)
- 9.10 boundary not in envelope.required (extension field) (LOCKED)
- 9.11 self-test 12 assertions (LOCKED)
- 9.12 tmpdir isolation (LOCKED)
- 9.13 vendored js-yaml import path (LOCKED)
- 9.14 5 deferred boundaries documented in lib comment (LOCKED)
- 9.15 sgsd-orchestrate skill line number (1236) for wire-in (LOCKED)
- 9.16 Patch 4 live-or-local exercise via lib (LOCKED)

## Standard workflow

Phase 32 is code (lib + skill edit + test). Standard workflow runs full:
- Step 1 (pattern-mapper): SKIPPED — research already mapped patterns
  from crit-backlog.cjs (1:1 reuse)
- Step 7 (MUDA): RUNS (diff_lines >= ~376 threshold met)
- Step 9 (phase-level ATC): RUNS dual-provider per readiness GO

## Status taxonomy at close (anticipated)

PASS expected. Codex behaviorally available per Phase 31 readiness; no
"Codex unavailable" deferrals. Real WARNs from dual-provider review
fixed in-loop in 1 attempt each (per Phase 31 precedent).

## Kill / defer conditions

- Defer if codex_route boundary turns out to have no signal value (first
  10 rows show no useful decision pattern) — kill rule per
  REQUIREMENTS.md "Kill route logging if first 10 rows show no signal".
- Hard stop if route-ledger writer throws upward and crashes the
  orchestrator on first invocation — code defect, not a defer.
