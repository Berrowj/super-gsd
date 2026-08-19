FILES_CHANGED: `phase-name.cjs`, `resolve.cjs`, `assert-state-resolver.cjs`.

VERIFICATION: Focused fixtures 24/24; resolver self-test 14/14; full suite 64 pass, 2 sandbox failures.

DEVIATIONS: None. PASS-only closure, tier confidence/priorities, projection semantics, and `roadmap_run.current_*` precedence preserved. No commit.

BLOCKERS: Sandbox denies temporary `git init` subprocesses with `EPERM`; both git-tier cases require orchestrator rerun.

ONE_LINER: Incomplete ROADMAP ordering now falls back safely across all discovered phases, while heading-only/empty ROADMAPs abstain and tests assert outcomes only.
