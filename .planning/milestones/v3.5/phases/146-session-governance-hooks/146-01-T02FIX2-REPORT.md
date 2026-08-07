FILES_CHANGED: `super-gsd/scripts/merge-settings.js` (modified); `super-gsd/config/repo-settings-overlay.json` (modified)

VERIFICATION:  
`node --check super-gsd/scripts/merge-settings.js` → exit 0 ✓  
`node super-gsd/scripts/merge-settings.js --self-test-repo-local-hooks` → exit 0 ✓  
`node -e "<temp repo; run --repo-local-hooks twice; compare settings bytes>"` → exit 0 ✓

DEVIATIONS: Tooling only: `apply_patch` was blocked by the Windows sandbox wrapper, so edits were made via constrained text replacement in the two allowed files. No orphan code-scope edits.

BLOCKERS: none

SCRIPTS_CREATED: none

ONE_LINER: Fixed repo-local writes with realpath boundary validation plus pre-rename revalidation/cleanup, and switched repo hook dedupe to explicit outer hook-entry markers: `sgsd_managed: true` + stable `sgsd_hook_id`, chosen to mark SGSD-owned entries while leaving inner command hook objects schema-clean.
