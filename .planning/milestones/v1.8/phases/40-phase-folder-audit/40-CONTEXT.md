---
phase: 40
title: Phase Folder Perfection Contract
type: code (tool + 1 SKILL.md edit + test)
created: 2026-04-27
discuss_decisions: [40=B]
unblocks: []
mode: gsd-discuss-phase --auto
---

# Phase 40 - Phase Folder Perfection Contract (CONTEXT)

## Goal

Soft-warn auditor walking all `.planning/milestones/*/phases/*/`. Each
phase folder categorized as compliant / partial / non-compliant based
on canonical 4-required + 4-recommended file set derived from v1.7
phase template. Output `.planning/milestones/{{version}}/phase-folder-audit.md`
at milestone close. Read-only; never modifies any folder.

## Locked decision (DISCUSS 40=B)

Soft-warn auditor only. NO folder modification. NO blocking. Operator
discretion on remediation.

## What the planner must produce

ONE plan: `40-01-phase-folder-audit-PLAN.md` with 3 atomic deliverables:

1. **NEW tool** at `super-gsd/tools/phase-folder-audit/audit.cjs`
   (~600-700 LOC):
   - Frozen consts: `REQUIRED_FILES`, `RECOMMENDED_FILES`, `VERDICTS = Object.freeze(['compliant','partial','non-compliant'])`
   - Public API: `auditFolder(phaseDir)`, `auditAllPhases(planningDir, opts)`,
     `renderTable(audits)`
   - Closed-enum bucket logic: any required missing -> non-compliant;
     any recommended missing -> partial; all present -> compliant
   - All public APIs in try/catch (never throws upward)
   - --self-test 12+ assertions in tmpdir; __dirname-anchored
     fingerprint guard over 3 real phase folders (read-only invariant
     binding)

2. **EDIT** `super-gsd/skills/sgsd-complete-milestone/SKILL.md`:
   - Insert Step 4.6 between Step 4.5 (gate keep/kill) and Step 5
     (cross-phase)
   - Invoke auditAllPhases + renderTable; write
     `.planning/milestones/{{version}}/phase-folder-audit.md`
   - Step 6 SUMMARY.md subsection extension (~10 LOC)

3. **NEW test** at `super-gsd/tools/phase-folder-audit/audit.test.cjs`
   (~120 LOC):
   - 4 fixtures (compliant / partial / non-compliant / empty)
   - Uses production lib; tmpdir-isolated

## Acceptance (AUDIT-01..05, runnable)

- **AUDIT-01**: auditAllPhases walks all `milestones/*/phases/*/` directories
- **AUDIT-02**: each row classified in {compliant, partial, non-compliant}
- **AUDIT-03**: never blocks; soft-warn on non-compliant; per-phase missing-file list in output
- **AUDIT-04**: no folder mutation (fingerprint guard binds; static fs.write* deny check)
- **AUDIT-05**: SKILL.md grep for `auditAllPhases` returns >= 1

## Open derivation calls

NONE — all 13 calls locked in 40-RESEARCH.md §11.

## Standard workflow

Phase 40 is code (1 new tool + 1 SKILL.md edit + 1 test). Standard
workflow runs full:
- Step 1 (pattern-mapper): SKIPPED — research mapped from Phase 39
- Step 7 (MUDA): RUNS (~720 LOC threshold)
- Step 9 (phase-level ATC): RUNS dual-provider per readiness GO

## Status taxonomy at close (anticipated)

PASS expected. v1.8 phases 36-39 precedent: dual-provider review
surfaces 5-7 distinct findings, all in-loop fixable.

## Kill / defer conditions

- Defer if v1.8's own phase folders (36-40) are non-compliant against
  Phase 40's own auditor (would be self-defeating; expect partial at
  worst since this phase's own folder is being built right now).
- Hard stop if auditor mutates ANY phase folder (read-only invariant
  is the load-bearing safety contract; AUDIT-04 binding).

## v1.8 milestone close

After Phase 40 ships, the v1.8 milestone is ready for
`sgsd-complete-milestone`. Total v1.8 deliverables:
- gate-value-log.cjs (Phase 36; 8th envelope-v1 emitter)
- muda-deletion-candidates.cjs (Phase 37; 3 heuristics)
- sampling-decider.cjs (Phase 38; 3x3 matrix + --force-gates)
- gate-keep-kill/rubric.cjs (Phase 39; R1-R6 mechanical)
- phase-folder-audit/audit.cjs (Phase 40; soft-warn)
- BOUNDARIES extension (6->7) on route-ledger
- 2 reason_codes appended to envelope-v1 (extension protocol)
- Step 4.5 + Step 4.6 wire-ins on sgsd-complete-milestone
