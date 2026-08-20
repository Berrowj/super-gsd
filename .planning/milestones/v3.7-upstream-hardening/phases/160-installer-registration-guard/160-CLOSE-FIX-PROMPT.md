# P160 close-fix (sole round) — merge refusals must fail install.sh under its real launch

Files ONLY: super-gsd/install.sh and
super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs.
Edits-first; no spawns; do NOT commit.

## The CRITICAL (close review, confirmed at source)

install.sh line 7 sets only `set -e`. The merge invocations at lines ~490/518
pipe merge-settings.js output through sed, so when the T1 preflight refuses
(exit 4) the pipeline returns sed's 0 and installation CONTINUES — the guard is
dead under ordinary `bash install.sh`. The fixture masks this by injecting
`-o pipefail` at test line ~208, so all eight cases are green while production
fails open. Harness-production seam.

## Fix

1. install.sh: make merge failures terminate the install with the refusal's
   exit code and stderr visible under plain `bash install.sh`. Prefer capturing
   the merge exit explicitly (run merge, save $?, then format output) over
   script-wide pipefail IF pipefail would change other pipelines' semantics —
   your call, but justify in the report; the refusal path must print the
   preflight's per-path error and exit non-zero at BOTH merge sites.
2. Test: remove the injected pipefail; every install-driven fixture must launch
   exactly `bash install.sh ...` as production does. The vendored-nine-hook case
   must prove non-zero install exit + zero writes under that exact launch.

Report: FILES_CHANGED / VERIFICATION (static) / DEVIATIONS / BLOCKERS /
ONE_LINER, max 120 words.
