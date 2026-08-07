DONE_WITH_CONCERNS

FILES_CHANGED:
- `super-gsd/scripts/sgsd-stop-handoff.sh` modified
- `super-gsd/tools/autopilot-watchdog/check.cjs` modified
- `super-gsd/hooks/sgsd-session-start.js` modified

VERIFICATION:
- `bash -n super-gsd/scripts/sgsd-stop-handoff.sh` → exit 1 ✗ Git Bash sandbox `CreateFileMapping` failure
- `node super-gsd/tools/autopilot-watchdog/check.cjs --self-test-phase-resolution` → exit 0 ✓
- `node --check` touched JS/CJS files → exit 0 ✓
- `node -` handoff embedded lineage fixture → exit 0 ✓
- `node -` SessionStart forced pre-context/state failure fixture → exit 0 ✓
- `node -` 5000-row gate-tail fixture → exit 0 ✓, 100 rows, oldest-to-newest within tail, 2.430 ms
- `node -` adapter real-row fixture → exit 0 ✓
- `node super-gsd/tools/cockpit-state/adapter.cjs --self-test` → exit 1 ✗ 17/19, A7/A10 sandbox artifacts as warned
- `grep -c sgsd_managed super-gsd/config/settings-overlay.json` → exit 1 ✗ Git grep sandbox failure; PowerShell equivalent → exit 0, count 0 unchanged
- `rg ...dead knobs... super-gsd --glob '!**/*.md'` → exit 0 ✗ remaining knob declarations in `model-routing.json` and `planning-config-overlay.json`

DEVIATIONS: none; changed lines trace to A or B. DEFERRED-E needed no edit because the current reader already tail-reads and was verified.

BLOCKERS: A4 full knob deletion conflicts with the explicit touch list; the remaining files are outside allowed files.

SCRIPTS_CREATED: none

ONE_LINER: Fixed handoff refused-latch reset, frontmatter-only watchdog phase resolution, and observable SessionStart fail-open errors.
