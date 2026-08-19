FILES_CHANGED: `resolve.cjs`; `assert-state-resolver.cjs`. Sample sidecar restored; scheme work retained.

VERIFICATION: Resolver suite 61 pass / 2 EPERM; dual-root 10 pass / 136 spawn-cascade EPERM; self-test 14/14 PASS.

DEVIATIONS: `git checkout` hit external index-lock permissions; restored the exact HEAD blob via `git archive` and hash-verified it. No commit.

BLOCKERS: Sandbox denies child processes, including temporary `git init`; orchestrator rerun required.

ONE_LINER: Restored PASS-only closure vocabulary and `roadmap_run.current_*` precedence while preserving top-level fallback, comment stripping, and scheme support.
