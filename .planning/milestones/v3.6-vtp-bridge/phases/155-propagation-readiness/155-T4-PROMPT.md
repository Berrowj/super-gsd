# P155-T4 — Wire the decision path to the resolver (GATE tier, final core task)

You are the implementer for ONE task. Fresh context. You CANNOT spawn `claude` (EPERM)
and nested `git init`/bash children may return status=null — run what plain node
allows, report honestly; the orchestrator re-runs everything unsandboxed. Do NOT commit.

## Read first

- Task P155-T4 in `155-01-PLAN-LOCKED.md` (phase dir) — verbatim contract.
- `super-gsd/tools/state-resolver/resolve.cjs` — resolveEffectiveState, just hardened
  in T4b (commit d508069). Consume it; never reimplement any of it.
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` — cold_start step 1 and loop step 1
  currently read STATE.md frontmatter directly.
- `~/.claude/hooks/gsd-session-state.sh` is the LIVE global hook (does
  `head -20 .planning/STATE.md`); the repo has no owned copy yet.
- `super-gsd/install.sh` — install_global_assets, and the T2-T3 layout hunk you must
  NOT touch.

## Deliverables

1. `super-gsd/scripts/lib/decision-state.cjs` — the single rendering boundary.
   Calls resolveEffectiveState({projectDir}); renders milestone, opaque phase token,
   phase name/status, confidence, source; when projection_stale or conflicts are
   present it renders them LOUDLY (a clearly marked warning block naming both values,
   never a silent pick). Module export + CLI (`--render session|orchestrator --project <dir>`).
   READ-ONLY: it never writes STATE.md or anything else under .planning except nothing.
2. `super-gsd/hooks/gsd-session-state.sh` (new, repo-owned): replaces the raw
   `head -20` injection with `node .../decision-state.cjs --render session`. Falls back
   to a one-line "resolver unavailable: <reason>" plus NO raw STATE dump on any failure
   (fail loud, not fail silent, and never inject unvalidated frontmatter).
3. `super-gsd/skills/sgsd-orchestrate/SKILL.md`: replace the READ STATE instruction in
   cold_start step 1 and loop step 1 with running the decision-state CLI
   (`--render orchestrator`) and treating a stale/conflict warning as a visible input
   to dispatch, not a silent one. Keep every other step byte-identical.
4. `install.sh` install_global_assets: deploy the repo-owned hook to the exact live
   hook path (the same path the global settings reference), preserving the existing
   deployment pattern used for other global hooks.
5. `super-gsd/tests/propagation-readiness/assert-decision-state-consumers.cjs`
   (--consumer all):
   - adapter fixture: stale STATE + newer discovered phase => rendered output carries
     the warning block and the resolver's answer, both consumers byte-identical on it
   - installer fixture: isolated HOME/USERPROFILE/project, pre-seeded DISTINGUISHABLE
     stale hook at the live path, run REAL install.sh (--init-project
     --install-global --skip-cockpit-deps), then EXECUTE the installed hook with a
     real SessionStart JSON payload and assert the output is the adapter rendering,
     not the stale hook's output and not a raw STATE head. Deployment must be proven
     by execution, never inferred from repo bytes or config text.

## Hard constraints

- NEVER read, print or log any settings env block.
- The adapter and hook never write STATE.md (no auto-repair — that decision is the
  operator's, per the board memo).
- Do not modify resolve.cjs, phase-name.cjs, or the T2-T3 installer layout hunk.
- Surgical everywhere; SKILL.md edits confined to the two READ STATE sites.

## Verify what the sandbox allows

    node super-gsd/tests/propagation-readiness/assert-decision-state-consumers.cjs --consumer all

## Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / ONE_LINER, max 200 words.
