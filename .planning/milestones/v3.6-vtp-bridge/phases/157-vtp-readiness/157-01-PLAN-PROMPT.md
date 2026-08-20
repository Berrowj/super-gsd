# P157 planning task — author 157-01-PLAN-LOCKED.md

You are the planner. You WRITE the plan file and VALIDATE it yourself. No source
changes in this task. You CANNOT spawn `claude` (EPERM); node works.

## Read first

1. `.planning/milestones/v3.6-vtp-bridge/phases/157-vtp-readiness/CONTEXT.md` —
   authoritative scope: T1 vtp-services.yaml, T2 three probes through BOTH readiness
   surfaces (review change 7 verbatim there), T3 SessionStart pending-ledger depth.
2. `super-gsd/skills/sgsd-orchestrate/SKILL.md` — Rule 0 milestone-readiness wiring
   (the automatic surface T2 must reach).
3. The manual readiness surface: locate the sgsd-readiness dispatch path (registry
   skill-routing rows + agents sgsd-milestone-readiness / sgsd-phase-readiness).
4. `super-gsd/config/settings-overlay.json` + `super-gsd/scripts/merge-settings.js` +
   the P155 SessionStart hook registration/activation test under
   `super-gsd/tests/propagation-readiness/` — T3 must reuse this exact pattern.
5. `super-gsd/templates/plan-schema-v2.json` — frontmatter contract.
6. P156's 156-01-PLAN-LOCKED.md as house style for real-data SACs and red-first tasks.

## Plan shape guidance, not a straitjacket

Likely 3 tasks (T1 registry file + schema/lint test; T2 probes + wiring into Rule 0
AND manual readiness, falsifier exercising both entrypoints with a fixture env;
T3 SessionStart depth row + activation-through-merged-settings test). Consider
whether T1+T2 merge cleanly; do not pad.

HARD constraints from CONTEXT: env NAMES only — a test that ever echoes an env VALUE
is a contract violation; probes are existence/connect-shaped with no secret output;
hooks never do network. Fixture envs must use FAKE names/values in isolated
process.env, never the operator's real environment values in assertions or logs.
depends_on values are STRINGS. Every task revertable.

## Validate before you finish

    node super-gsd/tools/plan-schema/validate.cjs \
      --plan-file .planning/milestones/v3.6-vtp-bridge/phases/157-vtp-readiness/157-01-PLAN-LOCKED.md \
      --project-dir . --mode write

Exit 0 required. Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS /
ONE_LINER, max 150 words.
