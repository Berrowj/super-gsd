SALVAGE RECORD (executor timed out at 1200s before reporting; implementation verified host-side)
FILES_CHANGED: orchestrator-hooks.cjs (+89 outcome classification), skill-routing-registry.cjs (+172 deep parity incl. dispatch + target-exists validation), skill-routing.yaml (success_exits/verdict_exits per dispatch), SKILL.md (+187 executed_with_findings contract + MUDA single-execution-point resolution)
VERIFICATION (host): registry self-test 16/16; hooks self-test 11/12 (sole fail = pre-existing Phase-87 A1); syntax OK; chronicle fixture pollution reverted again (executor-session hook writes into fixture — recurring, see DEVIATIONS)
DEVIATIONS: chronicle fixture sample-sidecar-output.json polluted a 2nd time during executor session; reverted by orchestrator; root cause is a session hook writing runtime output into the fixture path under codex sandbox EPERM conditions — flag for P150 or chore
ONE_LINER: verdict exits classify as executed_with_findings (non-blocking), dispatch drift fails parity self-test, no-op dispatches rejected, MUDA has one execution point
STATUS: DONE (salvaged)
