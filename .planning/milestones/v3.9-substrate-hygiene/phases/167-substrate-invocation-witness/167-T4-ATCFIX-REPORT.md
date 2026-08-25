FILES_CHANGED: super-gsd/install.sh (modified)  
FILES_CHANGED: super-gsd/tools/feature-propagation/audit.cjs (modified)  
FILES_CHANGED: super-gsd/tests/substrate-invocation-witness/assert-propagation.cjs (modified)  
FILES_CHANGED: super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs (modified)  
FILES_CHANGED: super-gsd/scripts/merge-settings.js (modified)  
LINES_REMOVED: 138  
VERIFICATION: `node --check super-gsd/scripts/merge-settings.js` -> exit 0  
VERIFICATION: `node --check super-gsd/tools/feature-propagation/audit.cjs` -> exit 0  
VERIFICATION: `node --check super-gsd/tests/substrate-invocation-witness/assert-propagation.cjs` -> exit 0  
VERIFICATION: `node --check super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs` -> exit 0  
VERIFICATION: `node -e "const merge = require('./super-gsd/scripts/merge-settings.js'); const audit = require('./super-gsd/tools/feature-propagation/audit.cjs'); if (typeof merge.mergeSettingsFiles !== 'function' || typeof audit.runAudit !== 'function') process.exit(1);"` -> exit 0  
VERIFICATION: `git diff --check` -> exit 0  
VERIFICATION: frozen schema and evidence `git diff --quiet` checks -> exit 0  
DEVIATIONS: Fixture suites and Bash were not run due the stated EPERM constraint; orchestrator verification remains required. No commit created.  
BLOCKERS: none  
ONE_LINER: `--repair-substrate-capability` now repairs witness registrations/runtime, broker definition, private manifest, witness key, and opt-in-gated four-agent grants; it no longer rewrites customised `.planning/config.json`, unrelated global agents, or commands.
