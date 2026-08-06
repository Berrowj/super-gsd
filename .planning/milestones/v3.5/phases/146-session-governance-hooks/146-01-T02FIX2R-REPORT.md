FILES_CHANGED: `super-gsd/scripts/merge-settings.js` (modified); `super-gsd/config/repo-settings-overlay.json` (modified)

VERIFICATION:  
`node --check super-gsd/scripts/merge-settings.js` → exit 0 ✓  
`node super-gsd/scripts/merge-settings.js --self-test-repo-local-hooks` → exit 0 ✓  
legit derived-target temp fixture, run twice byte-identical → exit 0 ✓

DEVIATIONS: none  
BLOCKERS: none  
SCRIPTS_CREATED: none expected

ONE_LINER: Repo-local installs now realpath-validate symlink/junction boundaries before write and rename, clean up failed temps, and dedupe only marked SGSD hooks. Hook IDs: `session-start-governance`, `user-prompt-intent-classifier`, `post-tool-use-quality-gate`.
