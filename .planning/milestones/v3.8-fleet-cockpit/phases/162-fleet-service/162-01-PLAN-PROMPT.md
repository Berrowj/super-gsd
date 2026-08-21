# P162 planning task — author 162-01-PLAN-LOCKED.md

You are the planner. You WRITE the plan file and VALIDATE it yourself. No source
changes. Node works; no claude spawning (EPERM).

## Read first

1. `.planning/milestones/v3.8-fleet-cockpit/phases/162-fleet-service/CONTEXT.md`
   — authoritative scope (routes, discovery, caching, status derivation, noise
   filters, conflict rendering, hard constraints).
2. `.planning/milestones/v3.8-fleet-cockpit/HANDOVER.md` sections 4-7 and 9
   step 1 — the source design with the acceptance checklist your SACs must
   carry verbatim.
3. `super-gsd/tools/cockpit-state/adapter.cjs` — the snapshot builder the
   service wraps (buildSnapshot({projectDir}), SCHEMA_VERSION 1, 12 sections);
   run `node super-gsd/tools/cockpit-state/run-self-test.cjs` mentally — its
   19/19 is the baseline the phase must not disturb.
4. `scripts/sgsd-agent-dashboard.sh` conventions for the sgsd-fleet.sh wrapper.
5. `super-gsd/templates/plan-schema-v2.json`; P161's plan as house style.

## Plan shape guidance

Likely 3 tasks: (T1) fleet.cjs discovery+cache+roll-up with fixtures/lanes
captured snapshots; (T2) status.cjs derivation with the four noise filters and
conflict rule as CONTRACTUAL assertions (each filter is a named fixture);
(T3) server.cjs + routes + run-self-test.cjs + sgsd-fleet.sh + docs/FLEET-COCKPIT.md.
Every handover step-1 acceptance item maps to a SAC. Hard constraints binding:
zero deps (node:http/fs/path only — a require of anything else is a violation),
CJS, ASCII, read-only (no mutating handlers at all), verbatim snapshot under
/api/lane/:name. The devcp load-delta criterion becomes a bounded-concurrency +
never-build-on-request structural SAC (load measurement itself is a run-home
concern). Windows note: this box IS the dev host; git worktree discovery must
be driven through a fixture git repo in tests (no live Clarity here).

## Validate before you finish

    node super-gsd/tools/plan-schema/validate.cjs \
      --plan-file .planning/milestones/v3.8-fleet-cockpit/phases/162-fleet-service/162-01-PLAN-LOCKED.md \
      --project-dir . --mode write

Exit 0 required. Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS /
ONE_LINER, max 150 words.
