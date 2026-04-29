---
phase: 93
phase_name: Scheduled Audit Design
milestone: v2.7
created: 2026-04-29
status: in-progress
deviation_from_standard: docs phase
---

# Phase 93 -- CONTEXT

Define cron schedules for the Phase 91 cloud-safe audits running in the
Phase 92 Oz environment. Spec only; schedules NOT auto-created.

## Locked Scope

- D93.1: SGSD-SCHEDULED-AUDIT-DESIGN.md authored.
- D93.2: 4 + 1 optional schedules (SA-01..SA-05) with cron / runtime / output / review / disable / cost.
- D93.3: Cost aggregate table (~533/year if all 5; ~104/year for starter pair).
- D93.4: Schedule prompt template operator pastes into Oz UI.
- D93.5: Disable / stop instructions per schedule.
- D93.6: NOT-scheduled list (carries CU-01..CU-06 + Phase 90 exclusions).

## Outputs
- super-gsd/docs/SGSD-SCHEDULED-AUDIT-DESIGN.md
- 5 Phase 93 standard artifacts

## Acceptance
1. 5 candidate schedules defined.
2. Cost aggregate calculated.
3. Disable/stop instructions per schedule.
4. NOT-scheduled list explicit.
5. Cross-refs to Phase 91 + Phase 92.
