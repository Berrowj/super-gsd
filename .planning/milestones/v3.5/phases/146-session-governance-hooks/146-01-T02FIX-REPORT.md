FILES_CHANGED: `super-gsd/scripts/merge-settings.js` (modified)

VERIFICATION:
`node --check super-gsd/scripts/merge-settings.js` → exit 0 ✓  
`node super-gsd/scripts/merge-settings.js --self-test-repo-local-hooks` → exit 0 ✓  
`node super-gsd/scripts/merge-settings.js --repo-local-hooks <overlay> <temp-outside>/settings.json <temp-repo>` → exit 4 ✓, no file created  
`node super-gsd/scripts/merge-settings.js --repo-local-hooks <overlay> <temp-repo>/.claude/settings.json <temp-repo>` → exit 0 then exit 0 ✓, byte-identical second run

DEVIATIONS: none

BLOCKERS: none

SCRIPTS_CREATED: none

ONE_LINER: Repo-local installs now derive and validate `<repo>/.claude/settings.json`, refuse home `.claude`, strip+warn on top-level `env`, and refresh stale hook args via command+normalized-matcher dedupe.
