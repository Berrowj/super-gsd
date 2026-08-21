# P161-T3G — smoke must skip warn-downgraded dead project rows

Files ONLY: super-gsd/scripts/lib/hook-registration-preflight.cjs (and
install.sh only if the skip must thread through it). Edits-first; no spawns; do
NOT commit.

## Live evidence (repaired-phase run)

The three dead project rows now correctly WARN
(project_hook_registration_missing_global_covered), but the subsequent
dependency smoke still runs against those PROJECT script paths — which do not
exist — and fails the install:
ERROR: hook_smoke_failed ...clarity project\super-gsd\hooks\sgsd-session-start.js

## Fix

Descriptors that were warn-downgraded (missing script, live global coverage)
must be EXCLUDED from the dependency smoke — there is nothing to smoke; their
coverage is the global hook, which the global smoke already exercises. Thread
the warned set from preflightProjectManagedRegistrations to the smoke step
(return it, filter before smokeHookRegistrations). Rows that exist still smoke;
refusals still refuse; nothing else changes.

Static verify: reconstruct the repaired-phase shape (3 dead-but-covered rows +
N existing rows) — smoke set contains only the existing rows; warned rows
absent; a dead row WITHOUT coverage still refuses before smoke.

Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / ONE_LINER, max 90 words.
