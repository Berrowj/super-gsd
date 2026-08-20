# P156-T2 — SUMMARY.md close-gate on the ACTUAL route, red-first

You are the implementer for ONE task. Fresh context. Node works; no `claude`
spawning (EPERM — if a case needs a real spawn the sandbox denies, make the test
fail loud naming the error, NEVER self-fulfil; the orchestrator re-runs unsandboxed).
Do NOT commit.

## Read first

- Task P156-T2 in `.planning/milestones/v3.6-vtp-bridge/phases/156-state-close-contract/156-01-PLAN-LOCKED.md`
  (revision 2; AMENDMENT-1 change 2 binds you) — VERBATIM contract: input_contract,
  falsifier, stop_rule, SAC-4/5. It defines the seven-field SUMMARY frontmatter shape,
  js-yaml JSON_SCHEMA parsing, duplicate-key rejection, reason codes, exit codes.
- `super-gsd/scripts/lib/orchestrator-hooks.cjs` — the production skillRoutingConsult
  path you wire the preflight into (moment=phase-close + execute=true only).
- `super-gsd/scripts/lib/phase-name.cjs` — locate phases through it; never copy.
- Passing-shape templates: P154 and P155 SUMMARY.md files under
  `.planning/milestones/v3.6-vtp-bridge/phases/`.
- T1 already shipped: state.write() exists; do not modify it.

## Order of work — the ACTUAL-ROUTE red run is contractual (AMENDMENT-1)

1. Write `super-gsd/tests/state-close-contract/assert-phase-close-route.cjs` with the
   devcp fixture (closed v30-06.8, passing AUDIT.md, no SUMMARY.md) driving the REAL
   exported skillRoutingConsult with the production registry loader and a fixture
   dispatch executor, plus the production CLI wrapper against a generated benign
   registry.
2. RUN the AUDIT-without-SUMMARY case BEFORE implementing the gate. Today it wrongly
   proceeds — record that genuinely failing run (command + output) in your report.
3. Implement `super-gsd/tools/phase-close/check.cjs` (read-only API + CLI 0/1/2) and
   wire the preflight into skillRoutingConsult per the input_contract; encode the
   close ordering in sgsd-orchestrate SKILL (SUMMARY authored after verification/ATC/
   audit evidence, consult validates, state.write advances, close commit includes
   SUMMARY+STATE, only then Step 6.7).
4. Re-run to green: refusals (no SUMMARY, malformed frontmatter, identity mismatch)
   and passes (exact P154 shape, exact P155 shape), zero dispatches/state advances on
   refusal, exactly one scheduled close execution on pass.

## Verify before reporting

    node super-gsd/tests/state-close-contract/assert-phase-close-route.cjs --case all
    node super-gsd/scripts/lib/orchestrator-hooks.cjs --self-test

Report: FILES_CHANGED / VERIFICATION (include the preserved RED run) / DEVIATIONS /
BLOCKERS / SCRIPTS_CREATED / ONE_LINER, max 250 words.
