# P160 planning task — author 160-01-PLAN-LOCKED.md

You are the planner. You WRITE the plan file and VALIDATE it yourself. No source
changes. Node works; no `claude` spawning (EPERM).

## Read first

1. `.planning/milestones/v3.7-upstream-hardening/phases/160-installer-registration-guard/CONTEXT.md`
   — authoritative scope: D1 dead hook registrations (install.sh has ZERO test -f
   checks; both merge sites, global ~line 379 and repo-local ~line 472), D2 stale
   bundled overlay text, D3 deployed-hook dependency resolution.
2. `super-gsd/install.sh` — both settings-merge sites and the hook copy loops.
3. `super-gsd/scripts/merge-settings.js` — the merge boundary (T1 guard may live
   in the installer, the merge script, or a preflight; argue placement).
4. `super-gsd/config/settings-overlay.json` + `repo-settings-overlay.json` — the
   registration sources whose paths must be validated.
5. The Clarity failure shape for the T1 fixture: a vendored super-gsd with only
   9 hooks (sgsd-session-start.js present; sgsd-intent-classifier.cjs,
   block-secret-leak.cjs, sgsd-quality-gate.js absent) — registrations were
   written anyway; requireStack: [] MODULE_NOT_FOUND on every prompt.
6. `super-gsd/templates/plan-schema-v2.json`; P156-P159 plans as house style.

## Plan shape guidance

Likely 3 tasks mapping D1/D2/D3; D1 first and largest. Contract points:
- T1: existence AND `node --check` resolvability guard for every hook command
  path before any registration write, BOTH merge sites; missing => fail loud
  naming the path, write NOTHING (no partial registrations). Red-first with the
  vendored-9-hook fixture; also a fixture proving the canonical 16-hook layout
  still registers cleanly.
- T2: refresh bundled overlay text (remove ByteRover-era memory routing and
  haiku/sonnet dispatch lines per the provider lock) + a drift tripwire: an
  installer self-test that fails when the bundled overlay carries known-stale
  markers.
- T3: install-time smoke: each deployed hook spawned once with a benign payload;
  non-zero exit => loud failure naming the hook. (Executor sandbox cannot spawn;
  division of labour: test design must let the orchestrator run spawn-bound
  cases unsandboxed, and static checks carry the rest.)
Real-data SACs; every task revertable; depends_on values are STRINGS.

## Validate before you finish

    node super-gsd/tools/plan-schema/validate.cjs \
      --plan-file .planning/milestones/v3.7-upstream-hardening/phases/160-installer-registration-guard/160-01-PLAN-LOCKED.md \
      --project-dir . --mode write

Exit 0 required. Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS /
ONE_LINER, max 150 words.
