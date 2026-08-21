# P161-T3E — launch validation rejects quoted spaced paths in managed rows

Files ONLY: super-gsd/scripts/lib/hook-registration-preflight.cjs (and the
guard test only if a fixture row is genuinely malformed). Edits-first; no
spawns; do NOT commit.

## Diagnosed (self-diagnosing assertion, live run)

assertion 1750 now reports: threw=HookRegistrationPreflightError
issue_codes=["hook_registration_launch_invalid"] issues_length=1.
The fixture's stale sgsd_managed rows point under a directory named
"target project" (space). The enumeration/launch validation for project-managed
rows rejects that quoted spaced-path launch form BEFORE any existence check, so
the contract path (3x hook_registration_missing) is never reached. Quoted
spaced paths are legitimate and common on Windows (real HOME dirs contain
spaces); other cases in this same suite already exercise "target project"
successfully through the installer path.

## Fix

Make the launch parsing for managed project rows accept the same quoted-path
forms the rest of the preflight accepts (single source of truth — reuse the
existing command parser used by enumerateHookRegistrations for overlay rows if
they differ), so a well-formed row with a spaced path proceeds to existence
checking and yields hook_registration_missing per path. If, on inspection, the
fixture writes a row form that no real producer (installer/merge) ever writes,
fix the fixture to the real form instead — say which and why.

Verify statically by reproducing assertion 1750's call against a reconstructed
spaced-path fixture: must throw exactly 3 hook_registration_missing.

Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / ONE_LINER, max 100 words.
