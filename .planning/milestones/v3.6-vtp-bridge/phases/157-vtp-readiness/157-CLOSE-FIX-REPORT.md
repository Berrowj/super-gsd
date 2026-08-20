FILES_CHANGED: sgsd-readiness skill, milestone-readiness agent, orchestrator-hooks, VTP readiness test.

VERIFICATION: routing self-test 18/18 PASS; static entrypoints 8/8 PASS; syntax and diff checks PASS.

DEVIATIONS: None. No commit created.

BLOCKERS: Full readiness test blocked by sandbox `spawn EPERM`; orchestrator must rerun the spawn-bound cases.

ONE_LINER: Manual readiness now probes VTP before freshness and carries all three rows through fresh and stale paths.
