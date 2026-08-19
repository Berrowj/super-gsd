# P155-T4b — Opaque, ROADMAP-ordered phase model in the state resolver (GATE tier)

You are the implementer for ONE task. Fresh context. You CANNOT spawn `claude` (EPERM),
and bash child spawns may return status=null in your sandbox — run what you can with
plain node, report honestly; the orchestrator re-runs everything unsandboxed. Do NOT
commit.

## Read first

- Task P155-T4b in `.planning/milestones/v3.6-vtp-bridge/phases/155-propagation-readiness/155-01-PLAN-LOCKED.md`
  — your verbatim contract above all else.
- `super-gsd/scripts/lib/phase-name.cjs` — the shared parser T2-T3 landed (numeric-aware
  comparator, dual-root discovery, fault-vs-empty, realpath dedup). EXTEND it if needed;
  never fork logic out of it.
- `super-gsd/tools/state-resolver/resolve.cjs` — current tier code. Name parsing already
  routes through phase-name.cjs; tier SEMANTICS are yours to fix now.
- Your ready-made acceptance surface: 23 currently-failing cases in
  `super-gsd/tests/propagation-readiness/assert-dual-root-resolvers.cjs --tool state-resolver`
  (flat-only activity markers, absent-root exit codes, git v-scheme markers). They were
  written to T4b's spec and MUST pass when you are done.
- The devcp defect report context in `CONTEXT.md` section T4b: the resolver returned
  phase 156/v2.0 at confidence 0.70 with a backwards re-sync recommendation while ground
  truth was v30-07/v3.0.

## Deliverables

1. `resolve.cjs`: active and next phase derive from the active ROADMAP.md phase table,
   never `num + 1`. All seven evidence tiers preserved with their priorities, confidence
   values, `projection_stale`, `conflicts`, graceful degradation. Checkpoint, pulse,
   activity, folder and git candidate parsing route through phase-name.cjs; valid
   v-scheme inputs (including `feat(pv30-07)` commits) resolve without coercion;
   unsupported or ambiguous markers explicitly ABSTAIN and fall through to the next
   tier rather than misparse. CONTEXT probe accepts `CONTEXT.md`, `{id}-CONTEXT.md`,
   and `NN-CONTEXT.md`. Frontmatter reader strips inline comments from unquoted
   scalars (`current_phase: v30-07  # note` yields `v30-07`). Absent roots are
   non-errors (ok:false JSON with exit 0 where the matrix expects it).
2. `super-gsd/tests/propagation-readiness/assert-state-resolver.cjs` (new): --case all
   runs (a) the devcp-shaped mixed-flat fixture — 146 dirs, 31 v-named, decimals,
   legacy integers — asserting ROADMAP-ordered v30-07 wins, the highest legacy integer
   never wins, and NO backwards re-sync is ever recommended; (b) tier-isolated fixtures
   for checkpoint, pulse, activity and REAL git-log v-scheme evidence, each proving
   resolve-or-abstain per the contract.
3. Any phase-name.cjs additions needed (e.g. ROADMAP-table ordering helper) live IN
   phase-name.cjs, exported, self-tested.

## Boundaries

No registry, no alias data, no renames, no writes to STATE.md. T4 (wiring consumers)
is NOT yours. Do not touch the four consumers, install.sh, or the hooks.

## Verify before reporting (run what the sandbox allows)

    node super-gsd/tests/propagation-readiness/assert-state-resolver.cjs --case all
    node super-gsd/tests/propagation-readiness/assert-dual-root-resolvers.cjs --tool state-resolver --case full-matrix

## Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / ONE_LINER, max 200 words.
