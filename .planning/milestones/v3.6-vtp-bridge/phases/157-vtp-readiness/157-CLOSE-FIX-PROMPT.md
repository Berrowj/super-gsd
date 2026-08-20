# P157 close-fix (sole round) — manual readiness must probe VTP before any freshness short-circuit

You are the implementer. Fresh context. Node works; no `claude` spawning. Do NOT
commit. Allowed files ONLY: super-gsd/skills/sgsd-readiness/SKILL.md,
super-gsd/agents/sgsd-milestone-readiness.md, super-gsd/agents/sgsd-phase-readiness.md,
super-gsd/scripts/lib/orchestrator-hooks.cjs, super-gsd/registry/skill-routing.yaml,
super-gsd/scripts/lib/skill-routing-registry.cjs,
super-gsd/tests/vtp-readiness/assert-vtp-readiness.cjs. Do NOT touch run.cjs,
registry.cjs, vtp-services.yaml, or the propagation-readiness tests.

## The CRITICAL (close review verdict)

"Manual readiness can return a fresh manifest before running the three VTP probes."
The manual readiness sequence short-circuits when MILESTONE-READINESS.md is fresh,
returning before the VTP consult executes, so the three probe rows never happen on
the manual surface. That defeats review change 7 (both surfaces must exercise the
probes).

## Required fix (close review, verbatim)

1. Move the manual VTP consult BEFORE the freshness short-circuit.
2. Explicitly pass its three probe rows to the readiness agent (rows travel with the
   manifest answer, fresh or stale).
3. Add a full-sequence falsifier: manual readiness with a FRESH manifest must still
   produce the three probe rows; assert order (consult precedes short-circuit) on the
   actual sequence, not a reimplementation.

## Verify before reporting (sandbox-allowed parts; orchestrator reruns spawn-bound cases)

    node super-gsd/tests/vtp-readiness/assert-vtp-readiness.cjs --case readiness-entrypoints
    node super-gsd/scripts/lib/skill-routing-registry.cjs --self-test

Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / ONE_LINER, max 150 words.
