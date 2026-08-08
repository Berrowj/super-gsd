# P150-T150-03b — CONTINUE killed T150-03: fix fixture mkdir bug, then make all 5 tests green

Prior dispatch killed at wrapper timeout in TDD-red state: sgsd-boot.sh/sgsd-registry-sync.sh/sgsd-remote-tmux.sh modified, runtime-provenance.test.cjs written, 0/5 passing — ALL five fail at fixture setup: fs.copyFileSync into the canonical 'scripts' dir throws ENOENT because that directory is never created (write() helper mkdirs parents, copyFileSync does not — see test lines ~116-119). Fix: mkdirSync the canonical scripts/agents dirs (recursive) before the copyFileSync calls. Then run the suite; make any REMAINING reds green — they will now exercise the real boot/remote provenance behavior (no-open smoke, pin mismatch rejection, provenance-selected cockpit start). Original contract: .planning/milestones/v3.5/phases/150-propagation-trust-runbook/150-01-T3-CODEX-EXECUTOR-PROMPT.md. Do not restart or rewrite what works.

## Verify: node --test super-gsd/tests/propagation/runtime-provenance.test.cjs -> 5/5.

## Report contract: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / SCRIPTS_CREATED / ONE_LINER / STATUS
