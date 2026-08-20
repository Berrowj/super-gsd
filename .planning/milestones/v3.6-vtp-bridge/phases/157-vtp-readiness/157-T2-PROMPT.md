# P157-T2 — three probes + BOTH readiness entrypoints, two red runs contractual

You are the implementer for ONE task. Fresh context. Node works; no `claude`
spawning (EPERM). Sandbox-denied spawns fail loud naming the error, NEVER
self-fulfil; the orchestrator re-runs unsandboxed. Do NOT commit.

## Read first

- Task P157-T2 in `157-01-PLAN-LOCKED.md` (same dir, revision 2) — VERBATIM
  contract including AMENDMENT-1: redact dispatch.cwd, rendered {project_dir},
  and raw spawn/child error text from manual-consult output AND appended
  evidence/ledger rows; leak-scan covers CLI JSON and every appended row.
- T1 is COMMITTED: `super-gsd/tools/vtp-readiness/registry.cjs` (loadRegistry)
  and `super-gsd/registry/vtp-services.yaml`. Build on them; do not modify them.
- `super-gsd/registry/skill-routing.yaml` + `super-gsd/scripts/lib/skill-routing-registry.cjs`
  — canonical on-demand row shape and compiled fallback.
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` Rule 0 (milestone pre-flight) — where
  the exact `run.cjs --trigger auto` command goes, before manifest classification.
- `super-gsd/skills/sgsd-readiness/SKILL.md`, `super-gsd/agents/sgsd-milestone-readiness.md`,
  `super-gsd/agents/sgsd-phase-readiness.md` — the manual surface and agents that
  must consume PROBE LOG rows, not copy probes.

## Order of work — TWO red runs are contractual

1. Extend `super-gsd/tests/vtp-readiness/assert-vtp-readiness.cjs` with the
   readiness-entrypoints case (fake envs, disposable TCP listener, scrubbed child
   envs, temp fixture projects).
2. RED 1: Rule 0 path with run.cjs absent. RED 2: production skillRoutingConsult
   on-demand/manual/execute=true skips readiness because its row has no dispatch.
   Record both commands + outputs in your report.
3. Implement run.cjs (three probes per contract: dist-vs-src freshness -> WARN
   "reconnect MCP" never rebuild; QDRANT_URL presence + one bounded TCP connect,
   no HTTP, no URL/socket detail output; VTP_EVIDENCE_STORE_URL presence +
   file/dir existence, no target output; exits 0/1/2) and wire BOTH entrypoints
   (routing YAML row + compiled fallback; manual skill consult; Rule 0 command;
   both agents consume rows; phase readiness reuses runner for drift).
4. Re-run to green including the AMENDMENT-1 leak-scan.

## Verify before reporting

    node super-gsd/tests/vtp-readiness/assert-vtp-readiness.cjs --case readiness-entrypoints
    node super-gsd/scripts/lib/skill-routing-registry.cjs --self-test
    node super-gsd/scripts/lib/orchestrator-hooks.cjs --self-test

(orchestrator-hooks A1 fails pre-existing on HEAD; do not chase it, note it.)

Report: FILES_CHANGED / VERIFICATION (both REDs preserved) / DEVIATIONS / BLOCKERS /
SCRIPTS_CREATED / ONE_LINER, max 250 words.
