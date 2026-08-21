# P161 planning task — author 161-01-PLAN-LOCKED.md

You are the planner. You WRITE the plan file and VALIDATE it yourself. No source
changes. Node works; no claude spawning (EPERM).

## Read first

1. `.planning/milestones/v3.8-fleet-cockpit/phases/161-hook-distribution-completion/CONTEXT.md`
   — authoritative scope (T1 glob fix, T2 registration completeness + manifest
   tripwire, T3 end-to-end sgsd-update proof).
2. `.planning/milestones/v3.8-fleet-cockpit/HANDOVER.md` section 13 — the live
   failure (exit 5, four hook_registration_missing lines, .super-gsd-version
   correctly held back).
3. `super-gsd/install.sh` — hook copy loops (find the glob that excludes .cjs)
   and both merge sites (now guarded by P160's preflight).
4. `super-gsd/config/settings-overlay.json` — the 9-of-14 registration gap;
   count shipped hooks in super-gsd/hooks/ + tools/codex-hooks/ yourself.
5. `super-gsd/scripts/sgsd-update.sh` — the project-integration step that
   exits 5.
6. `super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs`
   — extend this suite; its cases must ALL stay green (the P160 guard is the
   floor; distribution catches up to it, never the reverse).
7. `super-gsd/templates/plan-schema-v2.json`; P160's plan as house style.

## Plan shape guidance

Likely 3 tasks per CONTEXT. Cautions:
- T2's completeness check needs an explicit hook MANIFEST (shipped hooks with
  intended registration surface or an intentionally-unregistered reason) so the
  tripwire is manifest-vs-overlay, not glob-inference.
- statusline hooks may be legitimately unregistered-by-default on some
  surfaces — the manifest must be able to say so with a reason rather than
  force-register everything.
- T3's fixture mirrors Clarity: stale sgsd_managed entries pointing at a dir
  containing only systemd/; sgsd-update must complete exit 0 AFTER T1+T2 while
  the dead-entry removal remains documented operator-side.
- Real-data SACs; red-first; edits-first sandbox division; depends_on STRINGS.

## Validate before you finish

    node super-gsd/tools/plan-schema/validate.cjs \
      --plan-file .planning/milestones/v3.8-fleet-cockpit/phases/161-hook-distribution-completion/161-01-PLAN-LOCKED.md \
      --project-dir . --mode write

Exit 0 required. Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS /
ONE_LINER, max 150 words.
