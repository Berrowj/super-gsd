DONE

FILES_CHANGED:
`super-gsd/scripts/lib/gate-evidence-log.cjs` (modified)
`super-gsd/scripts/lib/sgsd-state.cjs` (modified)

VERIFICATION:
`node --check super-gsd\scripts\lib\gate-evidence-log.cjs` → exit 0 ✓
`node --check super-gsd\scripts\lib\sgsd-state.cjs` → exit 0 ✓
`node -e real-repo resolver probe` → exit 0 ✓
`@'...'@ | node -` non-SGSD no-op probe → exit 0 ✓
`@'...'@ | node -` real-root envelope write probe → exit 0 ✓
`@'...'@ | node -` bounded read limit probe → exit 0 ✓
`@'...'@ | node -` BOM STATE fixture probe → exit 0 ✓
`@'...'@ | node -` duplicate-key visibility probe → exit 0 ✓
`node -e alias/export probe` → exit 0 ✓

DEVIATIONS: none

BLOCKERS: none

SCRIPTS_CREATED: none

ONE_LINER: Fixed root-bound gate evidence writes, added bounded recent-row reads, made BOM/duplicate STATE frontmatter visible, kept `findPlanLockedFiles` as the single plan-lock export, and documented `STATUS_PROSE` as the prose-parsing tripwire.
