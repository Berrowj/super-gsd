FILES_CHANGED:
- `super-gsd/config/model-routing.json` (modified)
- `super-gsd/config/planning-config-overlay.json` (modified)

VERIFICATION:
- `node -e "require('./super-gsd/config/model-routing.json')"` → exit 0 ✓
- `node -e "require('./super-gsd/config/planning-config-overlay.json')"` → exit 0 ✓
- `rg -n --glob "!*.md" "checkpoint_threshold_percent|context_warning_percent|context_warnings" super-gsd` → exit 1 ✓ no matches expected
- `git diff -- super-gsd/config/model-routing.json super-gsd/config/planning-config-overlay.json` → exit 0 ✓ only intended key deletions plus required comma removal
- `git ls-files --eol -- super-gsd/config/model-routing.json super-gsd/config/planning-config-overlay.json` → exit 0 ✓ both `w/crlf`

DEVIATIONS: none

BLOCKERS: none

SCRIPTS_CREATED: none

ONE_LINER: Removed dead `token_efficiency` knobs from both runtime config files; confirmed `hooks.context_warnings` is absent, and kept `token_efficiency` parent objects because live keys remain.
