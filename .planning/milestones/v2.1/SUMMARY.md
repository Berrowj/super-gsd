---
milestone: v2.1
name: Distribution + Onboarding (Installer Audit + New-Project Wizard + Example Project + Public Docs Refresh + Migration Upgrade Safety)
status: SHIPPED
shipped: 2026-04-29
phases: 5
plans: 5
quint_gate: green
roadmap_complete: true
---

# v2.1 Milestone SUMMARY

**Status: SHIPPED 2026-04-29**

All 5 phases (58-62) closed PASS. v2.1 quint-gate green (installer-audit 12/12 + new-project-wizard 13/13 + example-walkthrough sha256 fe16729a... canonical match + docs-refresh vtp_required_count=0 vtp_any_count=3 + upgrade-drift 12/12 self-test + 11 probes + read-only invariant). Zero new CRITICAL/HIGH debt rows.

> **ROADMAP COMPLETE - all 30 phases (26-62) closed across 6 milestones (v1.6 SHIPPED-WITH-DEBT-10, v1.7-v2.1 SHIPPED clean).**

## What v2.1 delivered

| Phase | Title                              | Commits                          | Key artifact                                                                                                | ATC findings                                                                                                              |
| ----- | ---------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 58    | Installer Portability Audit        | 35c9a56+9291eb5+73a40c2          | installer-audit/audit.cjs (12 probes + 12 self-test) + clean-room.sh + run-self-test.cjs                    | 10/10 verifier; 12/12 self-test sub-1s; live --run 9 present + 3 optional; mandatory_floor_met=true; clean-room.sh exit 0 |
| 59    | New-Project Wizard                 | b61a7f4+dbf6de2+86cf0b8+39f0df6+0bf1d75 | sgsd-new-project-wizard.cjs (5 APIs Lock-13 + deep-merge non-clobber + idempotent) + sgsd-configure.ps1 ext | 12/12 verifier; 13/13 self-test; deep-merge non-clobber + idempotent verified; sha256 fe16729a... canonical match         |
| 60    | Example Project + Demo             | 8e6c0e9+ef1fb50+cea47bb+49dd449+fcc1610 | examples/hello-world fixture + EXAMPLE-DEMO-WALKTHROUGH.md (250L; 11 documented steps)                      | 11/11 verifier; example-walkthrough self-test green; observation-only fixture restore; v2.1 third-gate green               |
| 61    | Public Docs Refresh                | f776c54+c93c8fe+8eb5cd1          | README.md surgical extension (preamble + VTP-optional sweep + sg quick-start) + sgsd-complete-milestone fourth-gate | 9/9 verifier; v2.1 fourth-gate green; vtp_required_count=0 vtp_any_count=3; sg quick-start tested live exit 0             |
| 62    | Migration + Upgrade Safety         | b3dcadf+3612c27 (+close commit)  | upgrade-drift/check.cjs (11 probes + 12 self-test + Lock-13 + READ-ONLY) + run-self-test.cjs + UPGRADE-DRIFT.md | 9/9 verifier; 12/12 self-test PASS; 11/11 live PRESENT; git status before/after identical; v2.1 fifth-gate green          |

## v2.1 acceptance gates - all green

- node super-gsd/tools/installer-audit/audit.cjs --self-test -> 12/12 PASS
- node super-gsd/tools/installer-audit/audit.cjs --run -> mandatory_floor_met=true
- bash super-gsd/tools/installer-audit/clean-room.sh -> exit 0 (~24s wall-clock)
- node super-gsd/scripts/sgsd-new-project-wizard.cjs --self-test -> 13/13 PASS sub-1s
- node super-gsd/tools/upgrade-drift/check.cjs --self-test -> 12/12 PASS
- node super-gsd/tools/upgrade-drift/check.cjs --run -> 11 probes; 11 PRESENT; exit 0; git status before/after identical
- node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.1 -> exit 0 (quint-gate green: 12+13+third-gate+fourth-gate+12)
- node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v1.9 -> exit 0 (no regression)
- node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.0 -> exit 0 (no regression)

## Lock invariants table

| Lock     | Scope                                                                  | v2.1 evidence                                                                                                              |
| -------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Lock 4   | Phase 41-61 byte-untouched + import-by-reference                       | All 5 v2.1 phases verified. check.cjs zero require() of upstream Phase 41-61 modules. sgsd-complete-milestone.cjs surgical extensions preserved prior gate paths byte-equality. |
| Lock 11  | set-membership + byte-equality only - NO embedding / cosine / fuzzy    | Verified across audit.cjs (PROBE_NAMES + SOURCE_VALUES + REASON_NOTES), wizard.cjs (PANEL_KINDS + BOOT_MODES + VALIDATION_CODES), check.cjs (PROBE_NAMES + VERSION_TAGS + REASON_NOTES). |
| Lock 13  | every public API try/catch + degraded sentinel; never throws upward    | Verified across all 5 phases. Operationally: claude CLI absent + Redis absent + Codex absent + missing fixture + missing README - no throw escapes anywhere.                  |
| READ-ONLY | upgrade-drift checker (Phase 62 specific)                              | selfTest A8 hasWrite=false (source substring scan). Operationally: git status --short before/after --run identical.                                                          |
| ASCII-only | all NEW Phase 58-62 files                                            | first_nonascii_idx === -1 across audit.cjs + wizard.cjs + run-self-test.cjs files + check.cjs + UPGRADE-DRIFT.md + README.md surgical content + sgsd-complete-milestone.cjs   |

## Generated artifacts (consumable downstream)

- super-gsd/tools/installer-audit/audit.cjs (Phase 58 - 12 probes + 4 public APIs)
- super-gsd/tools/installer-audit/clean-room.sh (Phase 58 - 9-step install walk)
- super-gsd/tools/installer-audit/run-self-test.cjs (Phase 58 - thin shell)
- super-gsd/scripts/sgsd-new-project-wizard.cjs (Phase 59 - 5 public APIs + deep-merge non-clobber + idempotent)
- super-gsd/scripts/sgsd-new-project-wizard-self-test.cjs (Phase 59 - thin spawnSync shell)
- super-gsd/scripts/sgsd-configure.ps1 (Phase 59 - surgical extension; +25 lines 0 deletions)
- examples/hello-world/PROJECT.md (Phase 60 - 78L)
- examples/hello-world/ROADMAP.md (Phase 60 - 60L)
- examples/hello-world/.planning/STATE.md (Phase 60 - 33L skeleton)
- super-gsd/docs/EXAMPLE-DEMO-WALKTHROUGH.md (Phase 60 - 250L; 11 documented steps)
- README.md (Phase 61 - +78/-1 surgical extension)
- super-gsd/tools/upgrade-drift/check.cjs (Phase 62 - 11 probes + 12 self-test + 4 public APIs Lock-13 wrapped)
- super-gsd/tools/upgrade-drift/run-self-test.cjs (Phase 62 - thin shell)
- super-gsd/docs/UPGRADE-DRIFT.md (Phase 62 - probe table + per-milestone deltas + migration recipe)
- super-gsd/scripts/sgsd-complete-milestone.cjs (Phase 58-62 - extended to v2.1 quint-gate)

## Falsifiable proof

v2.1 ships a mechanically-falsifiable distribution + onboarding gate:

1. The installer-audit gate refuses milestone close if Node/git/npm floor is not met (mandatory_floor_met=false -> exit 1).
2. The wizard gate refuses milestone close if 13/13 self-test does not PASS or deep-merge clobbers existing keys.
3. The example-walkthrough gate refuses milestone close if the wizard --defaults output config.json does not match the canonical sha256 fe16729a... fingerprint.
4. The docs-refresh gate refuses milestone close if README.md contains any vtp.*required or vtp.*must line (vtp_required_count > 0 -> exit 1).
5. The upgrade-drift gate refuses milestone close if probe count < 8 OR read_only_invariant assertion fails OR self-test < 8 PASS.

All five gates run sequentially in sgsd-complete-milestone.cjs --milestone v2.1. v2.1 closes only when all five exit 0.

## Backlog state

- v1.6 carryover: **10 unresolved** (unchanged)
- v1.7 added: 0
- v1.8 added: 0
- v1.9 added: 0
- v2.0 added: 0
- v2.1 added: **0 new CRITICAL/HIGH debt rows**
- Total open: 10 (unchanged from v1.6 close)

## Codex provider health

Codex provider_unavailable across the entire v2.1 run (consistent with v1.9 / v2.0). Phase-level ATC dispatches: all 5 phases reviewed by Claude only.

## Roadmap end-of-run

This is the FINAL milestone of the v1.6 -> v2.1 roadmap. After v2.1 closes, the roadmap_run reaches completed state. All 30 phases (26-62) closed across 6 milestones:

- v1.6 (phases 26-30): SHIPPED-WITH-DEBT-10 2026-04-27
- v1.7 (phases 31-35): SHIPPED clean 2026-04-27
- v1.8 (phases 36-40): SHIPPED clean 2026-04-27
- v1.9 (phases 41-52): SHIPPED clean 2026-04-28
- v2.0 (phases 53-57): SHIPPED clean 2026-04-29 (release readiness 97/100 GREEN)
- v2.1 (phases 58-62): SHIPPED clean 2026-04-29 (this milestone)

## Closing

v2.1 Distribution + Onboarding is SHIPPED. The milestone delivers installer audit + new-project wizard + example project + public docs refresh + migration upgrade safety drift checker. The quint-gate now requires 5 spawns of green evidence before sgsd-complete-milestone.cjs --milestone v2.1 exits 0. Lock invariants 4 / 11 / 13 + READ-ONLY + ASCII-only hold across the entire 5-phase run.

**ROADMAP COMPLETE - all 30 phases (26-62) closed.**
