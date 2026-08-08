SALVAGE RECORD (wrapper timeout before report; implementation complete host-side)
FILES_CHANGED: install.sh, sgsd-onboard.ps1, sgsd-readiness.ps1, feature-propagation/audit.cjs (modified); config/codex-hooks.json canonical template, tools/codex-hooks/{install-hooks,self-test}.cjs, tests/propagation/codex-hooks-install.test.cjs (created)
VERIFICATION (host): codex-hooks-install suite 10/10; codex-hooks self-test PASS; node --check clean
ONE_LINER: .codex/hooks.json now installs/merges safely on every install path — junction-only repos become trust-ready
STATUS: DONE (salvaged)
