# P161-T3D — make assertion 1750 self-diagnosing, and fix what it reveals if obvious

File ONLY: super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs.
Edits-first; no spawns; do NOT commit.

assertUncoveredProjectRowsRefuse (line ~1735) fails in live runs with the bare
message "dead managed project rows without live global coverage did not refuse"
while a static reconstruction of the same call throws correctly with 3
hook_registration_missing issues. We cannot see WHICH way the live run diverges
(no throw at all? threw with wrong count? wrong codes? warnings instead?).

Rework the assertion to capture and REPORT the actual outcome in its failure
message: call the function in a try/catch yourself instead of assert.throws;
on no-throw include the returned warnings codes; on throw include
issues.map(code) and length. Keep the pass criteria EXACTLY as now (throw,
HookRegistrationPreflightError, exactly 3 hook_registration_missing).

While there, check one suspect: the module identity. The function is
destructured from require(PREFLIGHT_PATH) inside the assertion; confirm
PREFLIGHT_PATH matches the path the live updater/test setup uses (a
case/realpath mismatch would load a second, unpatched module instance — if you
find such a mismatch, normalise it).

Report: FILES_CHANGED / VERIFICATION (static) / DEVIATIONS / BLOCKERS /
ONE_LINER, max 100 words.
