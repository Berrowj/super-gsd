FILES_CHANGED: super-gsd/skills/sgsd-triage/SKILL.md (modified); super-gsd/scripts/sgsd-triage-runtime.cjs (modified); super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs (modified)

VERIFICATION: `node --check super-gsd/scripts/sgsd-triage-runtime.cjs` -> exit 0; `node --check super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs` -> exit 0; `node super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs --scenario all` -> exit 1

DEVIATIONS: none

BLOCKERS: sandbox blocks fixture subprocesses: full runner failed at `spawnSync bash EPERM` before reaching new scenarios; in-process staged reuse/sanitization smoke passed locally

SCRIPTS_CREATED: none

ONE_LINER: Step 3 now reuses staged VTP response/evidence without re-entering `safeCallVtp`, and VTP response text is sanitized before Markdown evidence/prompt embedding.

STATUS: DONE_WITH_CONCERNS
