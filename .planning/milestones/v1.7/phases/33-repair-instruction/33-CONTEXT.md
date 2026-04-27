---
phase: 33
title: Repair Instruction Contract
type: config + code
created: 2026-04-27
discuss_decisions: [33=C, 26.3]
unblocks: [35]
mode: gsd-discuss-phase --auto
---

# Phase 33 - Repair Instruction Contract (CONTEXT)

## Goal

Make every gate in `super-gsd/registry/gates.yaml` carry a
`repair_instruction:` text and add an OPTIONAL `repair_command:` ONLY
where the DISCUSS 26.3 4-AND safety predicate holds (deterministic AND
safe AND local AND auth-free). Build a schema-load checker that rejects
any `repair_command:` violating the predicate before it can fire.

## Locked decisions

- **33=C** (under 26.3): repair_command: optional, gated by 4-AND safety predicate
- **26.3 4-AND**: deterministic AND safe AND local AND auth-free (verbatim from mass-discuss)

## What the planner must produce

ONE plan: `33-01-repair-instruction-contract-PLAN.md` with 7 atomic tasks
(T1-T7) totaling ~480 lines added across 6 files, 0 deletions:

1. **T1: gates.yaml repair_instruction lines** -- add `repair_instruction:`
   text (each <=200 chars) to all 13 gate rows. Strict REPAIR-01 reading:
   every gate, not just the 4 blocking. Tone: terse, actionable, file-cited.

2. **T2: gates.yaml repair_command lines (4 of 13)** -- add OPTIONAL
   `repair_command:` to the 4 gates where 4-AND holds:
   - `sgsd-recall-queries`: `node super-gsd/scripts/lib/sgsd-recall.cjs --self-test` (det+safe+local+auth-free)
   - `MUDA-waste-audit`: `bash super-gsd/scripts/sgsd-muda-audit.sh --self-test` (det+safe+local+auth-free)
   - `sgsd-curate-learnings`: `node super-gsd/scripts/lib/sgsd-curate.cjs --self-test` (det+safe+local+auth-free)
   - `token-log`: `node super-gsd/tools/token-audit/check.cjs --self-test` (det+safe+local+auth-free)
   The remaining 9 ship `repair_instruction:` only.

3. **T3: super-gsd/scripts/lib/repair-command-checker.cjs (NEW ~280 LOC)**:
   - Exports `validateRepairCommands(gatesYaml)` returning `{ok, violations}`
   - `validateOneCommand(cmd)` returns `{ok, failed_predicate}`
   - Frozen `PREDICATES = ['deterministic','safe','local','auth-free']`
   - 4 deny-list regex arrays (one per AND clause) per RESEARCH §4
   - `--self-test` mode with 12+ assertions (mirroring route-ledger.cjs pattern)
   - Public API never throws upward (mirrors locked design from Phase 32 §9.3)

4. **T4: super-gsd/scripts/lib/gates-registry.cjs integration**: at line 53,
   immediately after gates yaml is loaded, call
   `validateRepairCommands(parsedYaml)`. On `{ok: false}`, throw with
   structured message naming the violating gate + failed predicate (load-time
   defense-in-depth: poisoned config never reaches a dispatch).

5. **T5: super-gsd/scripts/lib/sgsd-mission-strip.ps1 Q4 surfacing**:
   extend line 270 to append `| repair: <repair_instruction text>` when a
   gate is fired and unresolved. Read directly from gates.yaml (no
   crit-backlog schema change).

6. **T6: super-gsd/skills/sgsd-complete-milestone/SKILL.md Step 6 SUMMARY**:
   extend the milestone-close template (lines 103-114) to enumerate any
   gates with unresolved `repair_instruction:` (no resolution recorded in
   the milestone's metric streams).

7. **T7: verification harness** -- runnable acceptance for REPAIR-01..04.

## Acceptance (REPAIR-01..04, runnable)

- **REPAIR-01**: `grep -c '^[[:space:]]*repair_instruction:' super-gsd/registry/gates.yaml` >= 13
- **REPAIR-02**: For each gate with `repair_command:` field, the 4-AND
  predicate holds. Verifier runs validateOneCommand on each.
- **REPAIR-03**: `node super-gsd/scripts/lib/repair-command-checker.cjs --self-test`
  exits 0; injecting a violating command (e.g. `curl https://...`) into a
  test gates.yaml fixture causes `validateRepairCommands` to return
  `{ok: false, violations: [{gate, command, failed_predicate}]}`; the
  load-time checker in gates-registry.cjs throws on such fixtures.
- **REPAIR-04**: Mission Strip Q4 lane shows `repair_instruction:` text
  when a fired gate is referenced in the active phase's metrics; milestone
  close SUMMARY enumerates unresolved repairs.

## Open derivation calls

NONE -- all 10 calls locked in 33-RESEARCH.md §8:
1. REPAIR-01 strict reading (all 13 gates, not just blocking) -- LOCKED
2. 4 gates eligible for repair_command (auth-free is the deciding gate) -- LOCKED
3. Checker mirrors route-ledger.cjs 1:1 architecture -- LOCKED
4. Load-time integration at gates-registry.cjs:53 -- LOCKED
5. Mission Strip line 270 extension (no schema change) -- LOCKED
6. Milestone close lines 103-114 SUMMARY extension -- LOCKED
7. Schema-without-consumer satisfied (checker IS the consumer) -- LOCKED
8. PREDICATES frozen const + 4 deny-list arrays -- LOCKED
9. Public API never throws upward -- LOCKED
10. Single plan, 7 tasks, 6 files, ~480 lines added -- LOCKED

A2 (medium-risk) assumption flagged in research: confirm `--self-test` /
`--dry-run` flags exist on the 4 candidate scripts before commit; safe
default = ship instruction-only if a flag is absent.

## Standard workflow

Phase 33 is config + code (gates.yaml edits + new lib + 2 small skill
edits). Standard workflow runs full:
- Step 1 (pattern-mapper): SKIPPED -- research mapped patterns from
  route-ledger.cjs (1:1 reuse)
- Step 7 (MUDA): RUNS (~480 lines threshold met)
- Step 9 (phase-level ATC): RUNS dual-provider per readiness GO

## Status taxonomy at close (anticipated)

PASS expected. Codex behaviorally available per Phase 32 evidence.
Real WARNs from dual-provider review fixed in-loop (per Phase 31 + 32
precedent: trivial vocab/scope/conformance gaps closed in 1 attempt).

## Kill / defer conditions

- Defer if any of the 4 candidate `repair_command:` scripts lacks the
  `--self-test` / `--dry-run` flag (ship `repair_instruction:` only for
  that gate; backlog the missing flag for v1.8+).
- Hard stop if validateRepairCommands accepts a violating command in
  any test fixture (predicate logic is the load-bearing safety boundary).
