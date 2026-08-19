# P155 planning task, revision 2 — apply the NOGO findings and the operator split

You are the planner. You EDIT the existing plan file and VALIDATE it yourself. Do not
modify any source code. You CANNOT spawn `claude` (EPERM); nothing here needs it.

## Read first

1. `.planning/milestones/v3.6-vtp-bridge/phases/155-propagation-readiness/155-01-PLAN-LOCKED.md` — your rev 1.
2. `.planning/milestones/v3.6-vtp-bridge/phases/155-propagation-readiness/155-PLANREVIEW-REPORT.md` — the NOGO. Address every REQUIRED_CHANGE that survives the split.
3. `.planning/milestones/v3.6-vtp-bridge/phases/155-propagation-readiness/CONTEXT.md`
4. `super-gsd/tools/phase-folder-audit/audit.cjs` around line 167 — `const phaseRe = /^\d{2}-/;` — the reviewer's finding that the "copyable pattern" itself excludes v-scheme and decimal names is VERIFIED. T3 must not copy it blindly; both must share one normaliser.

## The operator's split decision (2026-08-19)

P155 narrows to the PROPAGATION CORE. Remove T4c, T5, T6 from this plan entirely —
they are carved out to phases 156, 157, 158 (already seeded). Do not leave dangling
references to them in dependencies, ACs, or prose.

Remaining tasks: T1 (overlay unification), T2+T3 (now ONE atomic task, see below),
T4b (resolver phase model), T4 (wire decision path to resolver). Order:
T1 independent; T2/T3 atomic; T4b before T4, unchanged.

## Apply these REQUIRED_CHANGES from the review

1. **T2+T3 become one atomic compatibility transition.** Rev 1 had T2 remove the
   legacy-root default before T3 made consumers safe. Merge them: consumers become
   dual-root safe and the installer stops creating the legacy root in the SAME task,
   with an AC that runs the four consumers against a project that has NO legacy root
   and one that has BOTH roots.
2. **T3's consumer tests get the full matrix:** milestone and flat roots, v-scheme,
   decimal, and integer names, canonical duplicates, absent roots, mutation sentinels.
   And because `audit.cjs:167` shares the integer bug, the task must route ALL of
   audit.cjs, the four consumers, and the resolver through ONE shared name-parsing
   helper rather than copying a broken regex five times.
3. **SAC for T4 must cover the higher evidence tiers.** The resolver's checkpoint,
   pulse, activity, and git tiers also parse phase ids (e.g. `feat(pNN)` commits are
   integer-shaped). Fixing the folder tier alone leaves the others confidently wrong.
   Add fixture coverage: a pulse row and a git log carrying v-scheme ids must resolve
   correctly, or those tiers must explicitly abstain rather than misparse.
4. **SAC-1 (overlay/hooks) must execute genuine Claude transport** via the existing
   runnable gate (`super-gsd/tests/hook-transport/assert-live-dispatch.cjs` modes),
   NOT a config grep. Note in the AC that the orchestrator runs the live modes because
   the executor sandbox cannot spawn claude.
5. **The installer SAC must run the real `install.sh` into an isolated HOME/project
   fixture and execute the installed hook**, proving installation replaced the live
   surface, not merely that the repo copy is correct.
8. **Provenance note**: keep the body note accurate — it now discloses the 12 SACs and
   the depends_on quoting; do not regress it.

(Changes 6 and 7 moved with T4c and T5 to phases 156 and 157; do not address them here.)

## Validate before you finish

    node super-gsd/tools/plan-schema/validate.cjs \
      --plan-file .planning/milestones/v3.6-vtp-bridge/phases/155-propagation-readiness/155-01-PLAN-LOCKED.md \
      --project-dir . --mode write

Exit 0 required. `depends_on` values are STRINGS (["153", "154"]).
Bump `revision: 2` in frontmatter.

## Report format, exactly this, max 200 words, no preamble

```
FILES_CHANGED: path (created|modified)
VERIFICATION: `cmd` exit N pass|fail
DEVIATIONS: [constraint] description | none
BLOCKERS: description | none
ONE_LINER: substantive summary
```
