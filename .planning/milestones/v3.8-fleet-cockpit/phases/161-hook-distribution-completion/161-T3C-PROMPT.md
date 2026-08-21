# P161-T3C — reconcile the uncovered-rows refusal (evidence attached)

Files ONLY: super-gsd/scripts/lib/hook-registration-preflight.cjs and/or the
guard test's sgsd-update-clarity-recovery fixture. Edits-first; no spawns; do
NOT commit. Do not weaken the CONTRACT (below); you may fix whichever side is
wrong.

## Contract (unchanged)

A dead project sgsd_managed row is WARN-downgraded ONLY when the SAME hook has
LIVE global coverage: globally registered AND its script path exists and
resolves. Registration alone is NOT live. Without live coverage: refuse
hook_registration_missing.

## Evidence (orchestrator, direct probes)

1. Direct call with empty globalSettings THROWS correctly
   (hook_registration_missing) — the basic path works.
2. The failing assertion is assert-installer-registration-guard.cjs:1750 inside
   assertUncoveredProjectRowsRefuse, called at line 1897 immediately AFTER
   assertBrokenClarityUpdate. At that point project.globalSettingsPath reflects
   whatever the BROKEN-phase run (oldSha source) wrote globally. If that broken
   run registered same-named hooks globally (even with dead/absent scripts),
   and findLiveGlobalCoverage treats registration without adapter-backed script
   resolution as coverage, the three rows warn instead of refuse => assertion
   fails exactly as observed.

## Fix directions (pick what the evidence supports, explain in report)

- If findLiveGlobalCoverage does not adapter-verify the global script's
  existence/resolvability, make it do so (reuse preflightHookDescriptors'
  checks); dead global registrations must not count as coverage.
- If the fixture's broken phase writes global coverage that a REAL oldSha
  Clarity run would not have had, correct the fixture's oldSha construction
  instead — but only if that matches the 2026-08-13 report's reality (global
  install succeeded but did NOT register/deploy these five hooks).
- Re-verify statically by requiring the lib and reproducing assertion 1750's
  exact call with the fixture's two settings files.

Report: FILES_CHANGED / VERIFICATION (static, show the reproduced call result)
/ DEVIATIONS / BLOCKERS / ONE_LINER, max 120 words.
