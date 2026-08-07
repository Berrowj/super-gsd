STATUS: DONE (report reconstructed by orchestrator — executor timed out at 1200s with work complete on disk)

FILES_CHANGED:
`super-gsd/scripts/lib/commit-gate-shadow-report.cjs` (created — buildShadowReport/analyzeShadowRepo/reportSummary + falsifier constants)
`super-gsd/hooks/sgsd-commit-gate.cjs` (extended — --shadow-report / --activate-block / --deactivate-block wiring)
`super-gsd/tests/commit-gate/assert-real-commit-gate.cjs` (extended + T147-03 banner-regex pre-fix at :964/:1001)

VERIFICATION (orchestrator host runs):
- node --check all three files → exit 0
- ALL 14 scenarios PASS host-side, incl. previously-failing hook-warn-unbacked
  + hook-warn-sentinel-failopen (now asserting the REAL `[SGSD] commit gate
  warning` banner; docs-only doesNotMatch control no longer vacuous) and the
  new shadow-report-activation scenario
- Falsifier boundaries (orchestrator probes, real appendShadowRow rows):
  199 payloads → not pass (insufficient_real_payloads)
  240 @ 4.2% with UNKNOWN conventions → not pass (convention_unknown — board rule enforced)
  240 @ 4.2% with KNOWN conventions (real PLAN-LOCKED + ATC-REVIEW seeded) → passed:true
  5.8% false-block in one repo → not pass
- Activation on failing verdict → refuses, NO mode file created
- Reporting alone → never creates the mode file
- repo_key derives from directory basename; REQUIRED_REPOS=["GSDedits","devcp"]

DEVIATIONS:
[T04-D1] Executor timeout with empty report; reconstructed (3rd instance this milestone — DEVIATION-W family).
[T04-D2] Orchestrator's first boundary probes used wrong fixtures twice (object
  input vs string roots; lowercase repo ids vs basename-derived repo_key;
  missing convention artifacts). In all three cases the CODE was right and the
  fixture wrong — the convention_unknown refusal is the board rule working.

BLOCKERS: none

ONE_LINER: --shadow-report computes the mechanical falsifier (≥200 cross-repo payloads, <5% false-block, no unknown conventions) and --activate-block refuses everything short of a recomputed passing verdict; pass path proven with seeded conventions.
