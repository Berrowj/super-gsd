# P156-T1 — state.write(): atomic STATE projection writer, red-then-green

You are the implementer for ONE task. Fresh context. You CANNOT spawn `claude`
(EPERM); node works. Do NOT commit.

## Read first

- Task P156-T1 in `.planning/milestones/v3.6-vtp-bridge/phases/156-state-close-contract/156-01-PLAN-LOCKED.md`
  (revision 2, includes AMENDMENT-1) — your VERBATIM contract: input_contract,
  falsifier, stop_rule, and SAC-1/2/3. Follow it over this prompt wherever they differ.
- `super-gsd/tools/state-resolver/resolve.cjs` — resolveEffectiveState; consume its
  projection_stale/stale_sources signals; NEVER modify it.
- `super-gsd/scripts/lib/phase-name.cjs` — the sole phase-name parser; consume, never copy.
- `~`-installed hook is observed at the global hooks dir; the repo-owned source you
  create is `super-gsd/hooks/gsd-phase-boundary.sh` (the scripts/ path in older docs
  does not exist — plan known_deadends).
- `.planning/STATE.md` for the real projection shape (do not reserialize it wholesale;
  surgical byte-preserving edits only).

## Order of work — the red run is contractual

1. Write `super-gsd/tests/state-close-contract/assert-state-write.cjs` (devcp-shaped
   fixtures per SAC-1/2/3: v30-06.8 / v30-07 / v30-08 ROADMAP, rename-seam failure
   injection, projection-ahead refusal keyed on resolver signals, isolated
   HOME/USERPROFILE for the hook/install case).
2. RUN it before write.cjs exists. It must fail. Paste that red command + output in
   your report. A test green before the implementation is a contract violation.
3. Implement `super-gsd/tools/state-write/write.cjs` per the input_contract (event
   envelope CLI, tmp+fsync+rename, changed=false idempotent replay, exit 0/1/2).
4. Wire: sgsd-orchestrate SKILL Step 11 plan-close call + Step 6.6.j phase-close call;
   repo-owned gsd-phase-boundary.sh with the line-25 advisory replaced by state.write
   ownership wording; install.sh hook copy loop extended.
5. Re-run to green.

## Verification before reporting

    node super-gsd/tests/state-close-contract/assert-state-write.cjs --case all
    node super-gsd/tools/state-resolver/resolve.cjs --self-test

Report: FILES_CHANGED / VERIFICATION (include the preserved RED run) / DEVIATIONS /
BLOCKERS / SCRIPTS_CREATED / ONE_LINER, max 250 words.
