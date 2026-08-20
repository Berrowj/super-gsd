# P157-T1 — vtp-services.yaml topology registry + loader, red-then-green

You are the implementer for ONE task. Fresh context. Node works; no `claude`
spawning (EPERM). If a needed spawn is sandbox-denied, fail loud naming the error;
NEVER self-fulfil — the orchestrator re-runs unsandboxed. Do NOT commit.

## Read first

- Task P157-T1 in `.planning/milestones/v3.6-vtp-bridge/phases/157-vtp-readiness/157-01-PLAN-LOCKED.md`
  (revision 2) — your VERBATIM contract. Follow it over this prompt where they differ.
- CONTEXT.md beside it — the topology facts and the absolute secrets rule: env NAMES
  only, never values, no host/url/credential scalars anywhere in the registry, tests
  use fake values in isolated process.env only.
- `super-gsd/registry/` — house style for YAML registries (look at gates.yaml or
  skill-routing.yaml headers for the provenance-comment convention).
- js-yaml is the repo's pinned YAML dependency (T2 of P156 used it JSON_SCHEMA-style
  with duplicate-key rejection; reuse that pattern, do not vendor a new parser).

## Order of work — the red run is contractual

1. Write `super-gsd/tests/vtp-readiness/assert-vtp-readiness.cjs` with the
   registry-contract case (bad-sentinel registries generated in temp: value-carrying
   field, embedded host scalar, duplicate key, wrong pin fact, broken single-writer
   semantics — each must be rejected with a stable reason code that never echoes the
   rejected value).
2. RUN `--case registry-contract` before the registry/loader exist. Record the red
   command + output in your report.
3. Write `super-gsd/registry/vtp-services.yaml` (schema_version 1; servers vtp-kb
   canonical + jcl-internal, jcl-products, qmd; the six env NAMES; paths, pins,
   single-writer facts per the contract) and
   `super-gsd/tools/vtp-readiness/registry.cjs` (loadRegistry({registryPath, homeDir})).
4. Re-run to green.

## Verify before reporting

    node super-gsd/tests/vtp-readiness/assert-vtp-readiness.cjs --case registry-contract

Report: FILES_CHANGED / VERIFICATION (RED preserved) / DEVIATIONS / BLOCKERS /
SCRIPTS_CREATED / ONE_LINER, max 250 words.
